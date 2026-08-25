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

data class TopPrediction(
    val type: String, // "artist" or "song"
    val title: String,
    val subtitle: String,
    val thumbnail: String?,
    val category: String? = null,
    val track: NativeTrack? = null,
    val matchedLyrics: String? = null
)

data class SearchUiState(
    val query: String = "",
    val correctedQuery: String? = null,
    val isTypoCorrected: Boolean = false,
    val isLoading: Boolean = false,
    val isSuggestionSubmitted: Boolean = false,
    val topPrediction: TopPrediction? = null,
    val trendingKeywords: List<String> = emptyList(),
    val suggestions: List<String> = emptyList(),
    val instantSongs: List<NativeTrack> = emptyList(),
    val songs: List<NativeTrack> = emptyList(),
    val artists: List<Map<String, Any>> = emptyList(),
    val albums: List<Map<String, Any>> = emptyList(),
    val playlists: List<Map<String, Any>> = emptyList(),
    val activeCategory: String = "All",
    val recentSearches: List<String> = listOf("Arijit Singh", "Diljit Dosanjh", "Karan Aujla", "Tauba Tauba", "Lo-Fi Beats"),
    val errorMessage: String? = null
)

class SearchViewModel(application: Application) : AndroidViewModel(application) {

    private val secureStorage = SecureAuthStorage.getInstance(application)
    private val _uiState = MutableStateFlow(SearchUiState())
    val uiState: StateFlow<SearchUiState> = _uiState.asStateFlow()

    private var searchJob: Job? = null
    private var predictiveJob: Job? = null

    init {
        loadSearchHistory()
        loadTrendingKeywords()
    }

    private fun loadTrendingKeywords() {
        viewModelScope.launch {
            val defaultKeywords = listOf(
                "Tauba Tauba",
                "Arijit Singh",
                "Karan Aujla",
                "Apna Bana Le",
                "Stree 2 Songs",
                "Diljit Dosanjh",
                "Aaj Ki Raat",
                "Maan Meri Jaan",
                "Sidhu Moose Wala",
                "Lo-Fi Bollywood"
            )
            _uiState.value = _uiState.value.copy(trendingKeywords = defaultKeywords)

            try {
                val country = java.util.Locale.getDefault().country.ifBlank { "IN" }
                val res = MRJApiClient.apiService.getTrendingKeywords(country)
                if (res.isSuccessful && res.body() != null) {
                    val list = (res.body()!!["keywords"] as? List<String>) ?: emptyList()
                    if (list.isNotEmpty()) {
                        _uiState.value = _uiState.value.copy(trendingKeywords = list)
                    }
                }
            } catch (_: Exception) {}
        }
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
        _uiState.value = _uiState.value.copy(
            query = newQuery,
            isSuggestionSubmitted = false // Reset submission state when typing
        )
        searchJob?.cancel()
        predictiveJob?.cancel()

        if (newQuery.isBlank()) {
            _uiState.value = _uiState.value.copy(
                correctedQuery = null,
                isTypoCorrected = false,
                songs = emptyList(),
                artists = emptyList(),
                albums = emptyList(),
                playlists = emptyList(),
                suggestions = emptyList(),
                instantSongs = emptyList(),
                topPrediction = null,
                isLoading = false
            )
            return
        }

        // 1. Process query with high-precision AI/ML fuzzy matching
        val fuzzyResult = com.mrj.music.search.FuzzySearchEngine.processQuery(newQuery)

        _uiState.value = _uiState.value.copy(
            suggestions = fuzzyResult.suggestions,
            topPrediction = fuzzyResult.topPrediction,
            instantSongs = fuzzyResult.instantSongs,
            correctedQuery = fuzzyResult.correctedQuery,
            isTypoCorrected = fuzzyResult.isTypoCorrected
        )

        val effectiveQuery = fuzzyResult.correctedQuery ?: newQuery

        // 2. Fetch server predictive suggestions
        predictiveJob = viewModelScope.launch {
            delay(150)
            fetchPredictiveSearch(effectiveQuery)
        }

        // 3. Full search debounce (350ms)
        searchJob = viewModelScope.launch {
            delay(350)
            performSearch(effectiveQuery)
        }
    }

    fun onSuggestionClick(suggestion: String) {
        _uiState.value = _uiState.value.copy(
            query = suggestion,
            isSuggestionSubmitted = true // Collapses suggestions list
        )
        searchJob?.cancel()
        predictiveJob?.cancel()
        performSearch(suggestion)
    }

    fun onSearchSubmit(query: String) {
        if (query.isBlank()) return
        _uiState.value = _uiState.value.copy(
            query = query,
            isSuggestionSubmitted = true // Collapses suggestions list
        )
        searchJob?.cancel()
        predictiveJob?.cancel()
        performSearch(query)
    }

    private suspend fun fetchPredictiveSearch(query: String) {
        try {
            val token = secureStorage.getAccessToken()
            val authHeader = if (token != null) "Bearer $token" else null
            val country = java.util.Locale.getDefault().country.ifBlank { "IN" }

            val res = MRJApiClient.apiService.getPredictiveSearch(authHeader, query.trim(), country)
            if (res.isSuccessful && res.body() != null) {
                val body = res.body()!!
                val suggestionsList = (body["suggestions"] as? List<String>) ?: emptyList()
                val instantRaw = (body["instantSongs"] as? List<Map<String, Any>>) ?: emptyList()
                val parsedInstant = instantRaw.mapNotNull { parseTrack(it) }

                var topPred: TopPrediction? = null
                val rawPred = body["topPrediction"] as? Map<String, Any>
                if (rawPred != null) {
                    val pType = rawPred["type"] as? String ?: "artist"
                    val pTitle = rawPred["title"] as? String ?: ""
                    val pSubtitle = rawPred["subtitle"] as? String ?: ""
                    val pThumb = rawPred["thumbnail"] as? String
                    val pCategory = rawPred["category"] as? String
                    val trackObj = if (pType == "song") parseTrack(rawPred) else null

                    topPred = TopPrediction(
                        type = pType,
                        title = pTitle,
                        subtitle = pSubtitle,
                        thumbnail = pThumb,
                        category = pCategory,
                        track = trackObj
                    )
                }

                _uiState.value = _uiState.value.copy(
                    suggestions = if (suggestionsList.isNotEmpty()) suggestionsList else _uiState.value.suggestions,
                    instantSongs = parsedInstant,
                    topPrediction = topPred ?: _uiState.value.topPrediction
                )
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
                val token = secureStorage.getAccessToken()
                val authHeader = if (token != null) "Bearer $token" else null
                val country = java.util.Locale.getDefault().country.ifBlank { "IN" }
                val searchCategory = when (_uiState.value.activeCategory) {
                    "Songs" -> "songs"
                    "Artists" -> "artists"
                    "Albums" -> "albums"
                    "Playlists" -> "playlists"
                    else -> "all"
                }

                val res = MRJApiClient.apiService.getCategorizedSearch(
                    authHeader = authHeader,
                    query = query.trim(),
                    category = searchCategory,
                    country = country
                )

                if (res.isSuccessful && res.body() != null) {
                    val body = res.body()!!
                    val rawSongs = (body["songs"] as? List<Map<String, Any>>) ?: emptyList()
                    val rawArtists = (body["artists"] as? List<Map<String, Any>>) ?: emptyList()
                    val rawAlbums = (body["albums"] as? List<Map<String, Any>>) ?: emptyList()
                    val rawPlaylists = (body["playlists"] as? List<Map<String, Any>>) ?: emptyList()

                    val parsedSongs = rawSongs.mapNotNull { parseTrack(it) }

                    _uiState.value = _uiState.value.copy(
                        songs = parsedSongs,
                        artists = rawArtists,
                        albums = rawAlbums,
                        playlists = rawPlaylists,
                        isLoading = false
                    )

                    saveRecentSearch(query.trim())
                } else {
                    // Fallback to legacy search endpoint if categorized endpoint unavailable
                    val legacyRes = MRJApiClient.apiService.search(query = query.trim(), type = searchCategory)
                    if (legacyRes.isSuccessful && legacyRes.body() != null) {
                        val body = legacyRes.body()!!
                        val rawSongs = (body["songs"] as? List<Map<String, Any>>) ?: emptyList()
                        val rawArtists = (body["artists"] as? List<Map<String, Any>>) ?: emptyList()
                        val rawAlbums = (body["albums"] as? List<Map<String, Any>>) ?: emptyList()
                        val rawPlaylists = (body["playlists"] as? List<Map<String, Any>>) ?: emptyList()
                        val parsedSongs = rawSongs.mapNotNull { parseTrack(it) }

                        _uiState.value = _uiState.value.copy(
                            songs = parsedSongs,
                            artists = rawArtists,
                            albums = rawAlbums,
                            playlists = rawPlaylists,
                            isLoading = false
                        )
                    } else {
                        _uiState.value = _uiState.value.copy(isLoading = false, errorMessage = "No results found.")
                    }
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
