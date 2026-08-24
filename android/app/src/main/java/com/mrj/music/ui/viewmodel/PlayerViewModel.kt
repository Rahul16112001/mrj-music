package com.mrj.music.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.mrj.music.data.repository.MusicRepository
import com.mrj.music.player.MRJExoPlayerManager
import com.mrj.music.domain.model.Track
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class PlayerState(
    val currentTrack: Track? = null,
    val isPlaying: Boolean = false,
    val isLoading: Boolean = false,
    val currentPosition: Long = 0L,
    val duration: Long = 0L,
    val queue: List<Track> = emptyList(),
    val queueIndex: Int = 0,
    val isShuffleEnabled: Boolean = false,
    val repeatMode: String = "off",
    val isLiked: Boolean = false
)

@HiltViewModel
class PlayerViewModel @Inject constructor(
    private val musicRepository: MusicRepository,
    private val playerManager: MRJExoPlayerManager
) : ViewModel() {

    private val _state = MutableStateFlow(PlayerState())
    val state: StateFlow<PlayerState> = _state.asStateFlow()

    init {
        observePlayerState()
    }

    private fun observePlayerState() {
        viewModelScope.launch {
            playerManager.currentTrackFlow.collect { track ->
                _state.value = _state.value.copy(currentTrack = track)
            }
        }
        viewModelScope.launch {
            playerManager.isPlayingFlow.collect { playing ->
                _state.value = _state.value.copy(isPlaying = playing)
            }
        }
        viewModelScope.launch {
            playerManager.positionFlow.collect { (pos, dur) ->
                _state.value = _state.value.copy(currentPosition = pos, duration = dur)
            }
        }
    }

    fun playTrack(track: Track, queue: List<Track> = emptyList()) {
        playerManager.playTrack(track, queue)
        _state.value = _state.value.copy(
            currentTrack = track,
            queue = queue,
            queueIndex = queue.indexOfFirst { it.id == track.id }.coerceAtLeast(0)
        )
    }

    fun togglePlay() {
        playerManager.togglePlay()
    }

    fun pause() {
        playerManager.pause()
    }

    fun resume() {
        playerManager.resume()
    }

    fun seekTo(positionMs: Long) {
        playerManager.seekTo(positionMs)
    }

    fun playNext() {
        playerManager.playNext()
    }

    fun playPrevious() {
        playerManager.playPrevious()
    }

    fun setShuffle(enabled: Boolean) {
        playerManager.setShuffle(enabled)
        _state.value = _state.value.copy(isShuffleEnabled = enabled)
    }

    fun toggleLike(track: Track) {
        viewModelScope.launch {
            val isLiked = musicRepository.isLiked(track.id)
            if (isLiked) {
                musicRepository.unlikeTrack(track.id)
            } else {
                musicRepository.likeTrack(
                    mapOf(
                        "id" to track.id,
                        "title" to track.title,
                        "artist" to track.artist,
                        "album" to (track.album ?: ""),
                        "thumbnail" to (track.thumbnail ?: ""),
                        "duration" to track.duration
                    )
                )
            }
            _state.value = _state.value.copy(isLiked = !isLiked)
        }
    }
}
