package com.mrj.music.ui.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.mrj.music.data.remote.MRJApiClient
import com.mrj.music.data.security.SecureAuthStorage
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
    val artists: List<Map<String, Any>> = emptyList(),
    val albums: List<Map<String, Any>> = emptyList(),
    val suggestions: List<String> = emptyList(),
    val suggestedSongs: List<NativeTrack> = emptyList(),
    val activeCategory: String = "All",
    val recentSearches: List<String> = listOf("Arijit Singh", "Diljit Dosanjh", "Lo-Fi Beats", "Sidhu Moose Wala", "Bollywood Hits"),
    val errorMessage: String? = null
)

class SearchViewModel(application: Application) : AndroidViewModel(application) {

    private val secureStorage = SecureAuthStorage.getInstance(application)
    private val _uiState = MutableStateFlow(SearchUiState())
    val uiState: StateFlow<SearchUiState> = _uiState.asStateFlow()

    private var searchJob: Job? = null
    private var suggestionsJob: Job? = null

    init {
        loadSearchHistory()
    }

    private fun loadSearchHistory() {
        viewModelScope.launch {
            try {
                val token = secureStorage.getAccessToken()
                if (token != null) {
                    val res = MRJApiClient.apiService.getSearchHistory("Bearer $token")
                    if (res.isSuccessful && res.body() != null) {
                        val history = (res.body()!!["history"] as? List<String>) ?: emptyList()
                        if (history.isNotEmpty()) {
                            _uiState.value = _uiState.value.copy(recentSearches = history)
                        }
                    }
                }
            } catch (_: Exception) {}
        }
    }

    fun onQueryChange(newQuery: String) {
        _uiState.value = _uiState.value.copy(query = newQuery)
        searchJob?.cancel()
        suggestionsJob?.cancel()

        if (newQuery.isBlank()) {
            _uiState.value = _uiState.value.copy(
                songs = emptyList(),
                suggestions = emptyList(),
                suggestedSongs = emptyList(),
                isLoading = false
            )
            return
        }

        val trimmed = newQuery.trim()
        val instantFallback = listOf(
            trimmed,
            "$trimmed song",
            "$trimmed songs",
            "$trimmed lyrics",
            "$trimmed live",
            "$trimmed remix"
        )
        _uiState.value = _uiState.value.copy(
            suggestions = instantFallback
        )

        // Fast instant suggestions from backend (100ms)
        suggestionsJob = viewModelScope.launch {
            delay(100)
            fetchSuggestions(newQuery)
        }

        // Full search debounce (350ms)
        searchJob = viewModelScope.launch {
            delay(350)
            performSearch(newQuery)
        }
    }

    fun onSuggestionClick(suggestion: String) {
        _uiState.value = _uiState.value.copy(query = suggestion)
        searchJob?.cancel()
        suggestionsJob?.cancel()
        performSearch(suggestion)
    }

    private suspend fun fetchSuggestions(query: String) {
        try {
            val res = MRJApiClient.apiService.getSuggestions(query.trim())
            if (res.isSuccessful && res.body() != null) {
                val body = res.body()!!
                val suggestionsList = (body["suggestions"] as? List<String>) ?: emptyList()
                val songsListRaw = (body["songs"] as? List<Map<String, Any>>) ?: emptyList()
                val suggestedParsed = songsListRaw.mapNotNull { parseTrack(it) }

                if (suggestionsList.isNotEmpty()) {
                    _uiState.value = _uiState.value.copy(
                        suggestions = suggestionsList,
                        suggestedSongs = suggestedParsed
                    )
                }
            }
        } catch (_: Exception) {}
    }

    fun setCategory(category: String) {
        _uiState.value = _uiState.value.copy(activeCategory = category)
        val currentQuery = _uiState.value.query
        if (currentQuery.isNotBlank()) {
            performSearch(currentQuery)
        }
    }

    fun performSearch(query: String) {
        if (query.isBlank()) return
        searchJob?.cancel()
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null)
            try {
                val searchType = when (_uiState.value.activeCategory) {
                    "Songs" -> "songs"
                    "Videos" -> "videos"
                    "Artists" -> "artists"
                    "Albums" -> "albums"
                    else -> "all"
                }

                val res = MRJApiClient.apiService.search(query = query.trim(), type = searchType)
                if (res.isSuccessful && res.body() != null) {
                    val body = res.body()!!
                    val rawSongs = (body["songs"] as? List<Map<String, Any>>) ?: emptyList()
                    val rawVideos = (body["videos"] as? List<Map<String, Any>>) ?: emptyList()
                    val rawResults = (body["results"] as? List<Map<String, Any>>) ?: emptyList()
                    val rawArtists = (body["artists"] as? List<Map<String, Any>>) ?: emptyList()
                    val rawAlbums = (body["albums"] as? List<Map<String, Any>>) ?: emptyList()

                    val allRaw = (rawSongs + rawVideos + rawResults).distinctBy {
                        (it["id"] as? String) ?: (it["providerTrackId"] as? String) ?: ""
                    }
                    val parsed = allRaw.mapNotNull { parseTrack(it) }

                    _uiState.value = _uiState.value.copy(
                        songs = parsed,
                        artists = rawArtists,
                        albums = rawAlbums,
                        isLoading = false
                    )

                    // Record in recent searches
                    saveRecentSearch(query.trim())
                } else {
                    _uiState.value = _uiState.value.copy(isLoading = false, errorMessage = "No results found.")
                }
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(isLoading = false, errorMessage = e.message ?: "Search failed.")
            }
        }
    }

    private fun saveRecentSearch(query: String) {
        val current = _uiState.value.recentSearches.toMutableList()
        current.remove(query)
        current.add(0, query)
        val trimmed = current.take(10)
        _uiState.value = _uiState.value.copy(recentSearches = trimmed)

        viewModelScope.launch {
            try {
                val token = secureStorage.getAccessToken()
                if (token != null) {
                    MRJApiClient.apiService.addSearchHistory("Bearer $token", mapOf("query" to query))
                }
            } catch (_: Exception) {}
        }
    }

    fun removeRecentSearch(query: String) {
        val current = _uiState.value.recentSearches.toMutableList()
        current.remove(query)
        _uiState.value = _uiState.value.copy(recentSearches = current)

        viewModelScope.launch {
            try {
                val token = secureStorage.getAccessToken()
                if (token != null) {
                    MRJApiClient.apiService.removeSearchHistory("Bearer $token", query)
                }
            } catch (_: Exception) {}
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
