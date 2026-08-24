package com.mrj.music.ui.screens.artist

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.mrj.music.data.repository.MusicRepository
import com.mrj.music.domain.model.Artist
import com.mrj.music.domain.model.Track
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class ArtistState(
    val isLoading: Boolean = false,
    val artist: Artist? = null,
    val topSongs: List<Track> = emptyList(),
    val error: String? = null
)

@HiltViewModel
class ArtistViewModel @Inject constructor(
    private val musicRepository: MusicRepository
) : ViewModel() {

    private val _state = MutableStateFlow(ArtistState())
    val state: StateFlow<ArtistState> = _state.asStateFlow()

    fun loadArtist(artistId: String) {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, error = null)
            val result = musicRepository.getArtist(artistId)
            _state.value = if (result.isSuccess) {
                val data = result.getOrNull()!!
                val artistData = data["artist"] as? Map<String, Any> ?: emptyMap()
                val topSongs = (artistData["topSongs"] as? List<Map<String, Any>>)?.map { song ->
                    Track(
                        id = song["id"] as? String ?: "",
                        title = song["title"] as? String ?: "",
                        artist = song["artist"] as? String ?: "",
                        album = song["album"] as? String,
                        thumbnail = song["thumbnail"] as? String,
                        duration = (song["duration"] as? Number)?.toDouble() ?: 0.0
                    )
                } ?: emptyList()

                val relatedArtists = (artistData["relatedArtists"] as? List<Map<String, Any>>)?.map { ra ->
                    com.mrj.music.domain.model.RelatedArtist(
                        id = ra["id"] as? String ?: "",
                        name = ra["name"] as? String ?: "",
                        thumbnail = ra["thumbnail"] as? String,
                        listeners = ra["listeners"] as? String
                    )
                } ?: emptyList()

                _state.value.copy(
                    isLoading = false,
                    artist = Artist(
                        id = artistId,
                        name = artistData["name"] as? String ?: "",
                        thumbnail = artistData["thumbnail"] as? String,
                        subscribers = artistData["subscribers"] as? String,
                        monthlyListeners = artistData["monthlyListeners"] as? String,
                        bio = artistData["bio"] as? String,
                        topSongs = topSongs,
                        relatedArtists = relatedArtists
                    ),
                    topSongs = topSongs
                )
            } else {
                _state.value.copy(isLoading = false, error = result.exceptionOrNull()?.message ?: "Failed to load artist")
            }
        }
    }
}
