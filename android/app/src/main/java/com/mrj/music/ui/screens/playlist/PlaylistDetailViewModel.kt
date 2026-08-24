package com.mrj.music.ui.screens.playlist

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.mrj.music.data.repository.MusicRepository
import com.mrj.music.domain.model.Playlist
import com.mrj.music.domain.model.Track
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class PlaylistDetailState(
    val isLoading: Boolean = false,
    val playlist: Playlist? = null,
    val tracks: List<Track> = emptyList(),
    val error: String? = null
)

@HiltViewModel
class PlaylistDetailViewModel @Inject constructor(
    private val musicRepository: MusicRepository
) : ViewModel() {

    private val _state = MutableStateFlow(PlaylistDetailState())
    val state: StateFlow<PlaylistDetailState> = _state.asStateFlow()

    fun loadPlaylist(playlistId: String) {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, error = null)
            val result = musicRepository.getPlaylists()
            _state.value = if (result.isSuccess) {
                val data = result.getOrNull()!!
                val playlists = (data["playlists"] as? List<Map<String, Any>>) ?: emptyList()
                val playlist = playlists.find { it["id"] == playlistId }
                val tracks = (playlist?.get("tracks") as? List<Map<String, Any>>)?.map { track ->
                    Track(
                        id = track["id"] as? String ?: "",
                        title = track["title"] as? String ?: "",
                        artist = track["artist"] as? String ?: "",
                        album = track["album"] as? String,
                        thumbnail = track["thumbnail"] as? String,
                        duration = (track["duration"] as? Number)?.toDouble() ?: 0.0
                    )
                } ?: emptyList()

                _state.value.copy(
                    isLoading = false,
                    playlist = playlist?.let { p ->
                        Playlist(
                            id = p["id"] as? String ?: "",
                            userId = p["userId"] as? String,
                            title = p["title"] as? String ?: "",
                            description = p["description"] as? String,
                            thumbnail = p["thumbnail"] as? String,
                            trackCount = (p["trackCount"] as? Number)?.toInt() ?: tracks.size,
                            tracks = tracks
                        )
                    },
                    tracks = tracks
                )
            } else {
                _state.value.copy(isLoading = false, error = result.exceptionOrNull()?.message ?: "Failed to load playlist")
            }
        }
    }
}
