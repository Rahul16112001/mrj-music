package com.mrj.music.ui.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.mrj.music.data.remote.MRJApiClient
import com.mrj.music.model.NativeTrack
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class SearchUiState(
    val query: String = "",
    val isLoading: Boolean = false,
    val songs: List<NativeTrack> = emptyList(),
    val activeCategory: String = "All",
    val recentSearches: List<String> = listOf("Arijit Singh", "Diljit Dosanjh", "Lo-Fi Beats", "Sidhu Moose Wala", "Bollywood Hits"),
    val errorMessage: String? = null
)

class SearchViewModel(application: Application) : AndroidViewModel(application) {

    private val _uiState = MutableStateFlow(SearchUiState())
    val uiState: StateFlow<SearchUiState> = _uiState.asStateFlow()

    private var searchJob: Job? = null

    fun onQueryChange(newQuery: String) {
        _uiState.value = _uiState.value.copy(query = newQuery)
        searchJob?.cancel()

        if (newQuery.isBlank()) {
            _uiState.value = _uiState.value.copy(songs = emptyList(), isLoading = false)
            return
        }

        searchJob = viewModelScope.launch {
            delay(350) // 350ms debounce
            performSearch(newQuery)
        }
    }

    fun setCategory(category: String) {
        _uiState.value = _uiState.value.copy(activeCategory = category)
    }

    fun performSearch(query: String) {
        if (query.isBlank()) return
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null)
            try {
                val res = MRJApiClient.apiService.search(query = query.trim(), type = "songs")
                if (res.isSuccessful && res.body() != null) {
                    val body = res.body()!!
                    val rawSongs = (body["songs"] as? List<Map<String, Any>>) ?: emptyList()
                    val parsed = rawSongs.mapNotNull { parseTrack(it) }
                    _uiState.value = _uiState.value.copy(songs = parsed, isLoading = false)
                } else {
                    _uiState.value = _uiState.value.copy(isLoading = false, errorMessage = "No results found.")
                }
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(isLoading = false, errorMessage = e.message ?: "Search failed.")
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

        val audioSource = map["audioSource"] as? Map<*, *>
        val providerTrackId = (audioSource?.get("providerTrackId") as? String)
            ?: (map["providerTrackId"] as? String)
            ?: (map["videoId"] as? String)
            ?: (map["youtubeId"] as? String)
            ?: (if (!id.contains("|")) id else null)

        val streamUrl = map["streamUrl"] as? String 
            ?: "https://mrj-music.vercel.app/api/music/stream/${providerTrackId ?: id}"

        return NativeTrack(
            id = id,
            canonicalTrackId = canonicalTrackId,
            title = title,
            artist = artist,
            album = album,
            thumbnail = thumbnail,
            duration = duration,
            genre = genre,
            providerTrackId = providerTrackId,
            streamUrl = streamUrl
        )
    }
}
