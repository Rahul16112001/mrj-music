package com.mrj.music.ui.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.mrj.music.model.NativeTrack
import com.mrj.music.player.MRJExoPlayerManager
import com.mrj.music.player.PlayerEventListener
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class PlayerUiState(
    val currentTrack: NativeTrack? = null,
    val isPlaying: Boolean = false,
    val isLoading: Boolean = false,
    val positionMs: Long = 0L,
    val durationMs: Long = 0L,
    val queue: List<NativeTrack> = emptyList(),
    val currentIndex: Int = 0,
    val isShuffle: Boolean = false,
    val isAutoplay: Boolean = true,
    val errorMessage: String? = null
)

class PlayerViewModel(application: Application) : AndroidViewModel(application), PlayerEventListener {

    val playerManager = MRJExoPlayerManager.getInstance(application)

    private val _uiState = MutableStateFlow(PlayerUiState())
    val uiState: StateFlow<PlayerUiState> = _uiState.asStateFlow()

    init {
        playerManager.addListener(this)
        _uiState.value = _uiState.value.copy(
            currentTrack = playerManager.currentTrack.value,
            isPlaying = playerManager.isPlaying.value,
            queue = playerManager.queue.toList(),
            currentIndex = playerManager.queueIndex,
            isShuffle = playerManager.isShuffleEnabled,
            isAutoplay = playerManager.autoplayEnabled
        )
    }

    fun getOrCreatePlayerEngineView(context: android.content.Context) = playerManager.getOrCreatePlayerEngineView(context)

    fun playTrack(track: NativeTrack, newQueue: List<NativeTrack>? = null) {
        playerManager.playTrack(track, newQueue)
    }

    fun togglePlayPause() {
        playerManager.togglePlayPause()
    }

    fun playNext() {
        playerManager.playNext()
    }

    fun playPrevious() {
        playerManager.playPrevious()
    }

    fun seekTo(positionMs: Long) {
        playerManager.seekTo(positionMs)
    }

    fun toggleShuffle() {
        val next = !playerManager.isShuffleEnabled
        playerManager.setShuffle(next)
        _uiState.value = _uiState.value.copy(isShuffle = next, queue = playerManager.queue.toList())
    }

    fun toggleAutoplay() {
        playerManager.toggleAutoplay()
    }

    fun setAutoplay(enabled: Boolean) {
        playerManager.setAutoplay(enabled)
    }

    fun clearError() {
        _uiState.value = _uiState.value.copy(errorMessage = null)
    }

    override fun onPlaybackStateChange(isPlaying: Boolean, isLoading: Boolean) {
        _uiState.value = _uiState.value.copy(isPlaying = isPlaying, isLoading = isLoading)
    }

    override fun onTrackChange(track: NativeTrack?) {
        _uiState.value = _uiState.value.copy(
            currentTrack = track,
            queue = playerManager.queue.toList(),
            currentIndex = playerManager.queueIndex
        )
    }

    override fun onPositionChange(positionMs: Long, durationMs: Long) {
        _uiState.value = _uiState.value.copy(positionMs = positionMs, durationMs = durationMs)
    }

    override fun onQueueChange(queue: List<NativeTrack>, currentIndex: Int) {
        _uiState.value = _uiState.value.copy(queue = queue, currentIndex = currentIndex)
    }

    override fun onAutoplayChange(isAutoplay: Boolean) {
        _uiState.value = _uiState.value.copy(isAutoplay = isAutoplay)
    }

    override fun onError(errorMessage: String) {
        _uiState.value = _uiState.value.copy(errorMessage = errorMessage, isLoading = false)
    }

    override fun onCleared() {
        super.onCleared()
        playerManager.removeListener(this)
    }
}
