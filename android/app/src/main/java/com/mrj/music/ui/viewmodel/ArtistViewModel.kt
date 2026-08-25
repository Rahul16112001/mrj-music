package com.mrj.music.ui.viewmodel

import android.app.Application
import android.util.Log
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.mrj.music.data.remote.MRJApiClient
import com.mrj.music.model.NativeTrack
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

private const val TAG = "MRJ_ArtistViewModel"

data class ArtistAlbum(
    val id: String,
    val title: String,
    val artist: String,
    val thumbnail: String?,
    val year: String?,
    val trackCount: Int = 1,
    val genre: String? = null
)

data class RelatedArtist(
    val id: String,
    val name: String,
    val thumbnail: String?
)

data class ArtistUiState(
    val name: String = "",
    val image: String = "",
    val banner: String = "",
    val genres: List<String> = emptyList(),
    val monthlyListeners: String = "",
    val topTracks: List<NativeTrack> = emptyList(),
    val albums: List<ArtistAlbum> = emptyList(),
    val relatedArtists: List<RelatedArtist> = emptyList(),
    val isLoading: Boolean = false,
    val errorMessage: String? = null
)

class ArtistViewModel(application: Application) : AndroidViewModel(application) {

    private val _uiState = MutableStateFlow(ArtistUiState())
    val uiState: StateFlow<ArtistUiState> = _uiState.asStateFlow()

    fun loadArtist(artistName: String) {
        if (artistName.isBlank()) return

        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(
                name = artistName,
                isLoading = true,
                errorMessage = null
            )

            try {
                val res = MRJApiClient.apiService.getArtist(artistName)
                if (res.isSuccessful && res.body() != null) {
                    val body = res.body()!!
                    val artistData = body["artist"] as? Map<String, Any>

                    if (artistData != null) {
                        val name = artistData["name"] as? String ?: artistName
                        val image = artistData["image"] as? String ?: (artistData["thumbnail"] as? String) ?: ""
                        val banner = artistData["banner"] as? String ?: image
                        val genres = (artistData["genres"] as? List<*>)?.mapNotNull { it?.toString() } ?: emptyList()
                        val monthlyListeners = artistData["monthlyListeners"] as? String ?: "1.2M monthly listeners"

                        val rawTracks = (artistData["topSongs"] as? List<*>)
                            ?: (artistData["topTracks"] as? List<*>)
                            ?: (artistData["songs"] as? List<*>)
                            ?: (artistData["tracks"] as? List<*>)
                            ?: emptyList<Any>()

                        var topTracks = rawTracks.mapNotNull {
                            if (it is Map<*, *>) parseTrack(it as Map<String, Any>) else null
                        }

                        // Robust Fallback: If topTracks is empty from artist endpoint, search for artist's top tracks
                        if (topTracks.isEmpty()) {
                            try {
                                val searchRes = MRJApiClient.apiService.search(query = artistName, type = "songs")
                                if (searchRes.isSuccessful && searchRes.body() != null) {
                                    val songsList = (searchRes.body()!!["songs"] as? List<Map<String, Any>>)
                                        ?: (searchRes.body()!!["results"] as? List<Map<String, Any>>)
                                        ?: emptyList()
                                    topTracks = songsList.mapNotNull { parseTrack(it) }
                                }
                            } catch (e: Exception) {
                                Log.w(TAG, "Search fallback for $artistName failed: ${e.message}")
                            }
                        }

                        val rawAlbums = (artistData["albums"] as? List<*>) ?: emptyList<Any>()
                        val albums = rawAlbums.mapNotNull {
                            if (it is Map<*, *>) {
                                val map = it as Map<String, Any>
                                ArtistAlbum(
                                    id = map["id"]?.toString() ?: "",
                                    title = map["title"]?.toString() ?: "Album",
                                    artist = map["artist"]?.toString() ?: name,
                                    thumbnail = map["thumbnail"]?.toString(),
                                    year = map["year"]?.toString() ?: map["releaseYear"]?.toString(),
                                    trackCount = (map["trackCount"] as? Number)?.toInt() ?: 1,
                                    genre = map["genre"]?.toString()
                                )
                            } else null
                        }

                        val rawRelated = (artistData["relatedArtists"] as? List<*>) ?: emptyList<Any>()
                        val related = rawRelated.mapNotNull {
                            if (it is Map<*, *>) {
                                val map = it as Map<String, Any>
                                RelatedArtist(
                                    id = map["id"]?.toString() ?: "",
                                    name = map["name"]?.toString() ?: "",
                                    thumbnail = map["thumbnail"]?.toString() ?: map["image"]?.toString()
                                )
                            } else null
                        }

                        _uiState.value = ArtistUiState(
                            name = name,
                            image = image,
                            banner = banner,
                            genres = genres,
                            monthlyListeners = monthlyListeners,
                            topTracks = topTracks,
                            albums = albums,
                            relatedArtists = related,
                            isLoading = false
                        )
                        return@launch
                    }
                }

                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    errorMessage = "Unable to load artist discography"
                )
            } catch (e: Exception) {
                Log.e(TAG, "Error loading artist $artistName: ${e.message}")
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    errorMessage = e.localizedMessage ?: "Network error"
                )
            }
        }
    }

    private fun parseTrack(map: Map<String, Any>): NativeTrack? {
        val id = (map["id"] as? String) ?: (map["providerTrackId"] as? String) ?: return null
        val title = map["title"] as? String ?: return null
        val artist = map["artist"] as? String ?: "Unknown Artist"
        val thumbnail = map["thumbnail"] as? String
        val duration = (map["duration"] as? Number)?.toDouble() ?: 210.0
        val album = map["album"] as? String
        val genre = map["genre"] as? String
        val canonicalTrackId = map["canonicalTrackId"] as? String ?: id
        val providerTrackId = (map["providerTrackId"] as? String)
            ?: (map["videoId"] as? String)
            ?: (if (!id.contains("|")) id else null)

        return NativeTrack(
            id = id,
            canonicalTrackId = canonicalTrackId,
            title = title,
            artist = artist,
            album = album,
            thumbnail = thumbnail,
            duration = duration,
            genre = genre,
            providerTrackId = providerTrackId
        )
    }
}
