package com.mrj.music.ui.screens.album

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.mrj.music.data.repository.MusicRepository
import com.mrj.music.domain.model.Album
import com.mrj.music.domain.model.Track
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class AlbumState(
    val isLoading: Boolean = false,
    val album: Album? = null,
    val tracks: List<Track> = emptyList(),
    val error: String? = null
)

@HiltViewModel
class AlbumViewModel @Inject constructor(
    private val musicRepository: MusicRepository
) : ViewModel() {

    private val _state = MutableStateFlow(AlbumState())
    val state: StateFlow<AlbumState> = _state.asStateFlow()

    fun loadAlbum(albumId: String) {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, error = null)
            val result = musicRepository.getAlbum(albumId)
            _state.value = if (result.isSuccess) {
                val data = result.getOrNull()!!
                val albumData = data["album"] as? Map<String, Any> ?: emptyMap()
                val tracks = (data["tracks"] as? List<Map<String, Any>>)?.map { track ->
                    Track(
                        id = track["id"] as? String ?: "",
                        title = track["title"] as? String ?: "",
                        artist = track["artist"] as? String ?: "",
                        album = track["album"] as? String,
                        thumbnail = track["thumbnail"] as? String,
                        duration = (track["duration"] as? Number)?.toDouble() ?: 0.0
                    )
                } ?: emptyList()

                Album(
                    id = albumId,
                    title = albumData["title"] as? String ?: "",
                    artist = albumData["artist"] as? String ?: "",
                    artistId = albumData["artistId"] as? String,
                    thumbnail = albumData["thumbnail"] as? String,
                    year = albumData["year"] as? String,
                    trackCount = (albumData["trackCount"] as? Number)?.toInt() ?: tracks.size,
                    tracks = tracks
                ).let { album ->
                    _state.value.copy(isLoading = false, album = album, tracks = tracks)
                }
            } else {
                _state.value.copy(isLoading = false, error = result.exceptionOrNull()?.message ?: "Failed to load album")
            }
        }
    }
}
