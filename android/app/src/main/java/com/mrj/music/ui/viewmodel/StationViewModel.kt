package com.mrj.music.ui.viewmodel

import android.app.Application
import android.util.Log
import androidx.compose.ui.graphics.Color
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.mrj.music.data.remote.MRJApiClient
import com.mrj.music.data.security.SecureAuthStorage
import com.mrj.music.model.NativeTrack
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

private const val TAG = "MRJ_StationViewModel"

data class GenreItem(
    val id: String,
    val name: String,
    val icon: String,
    val description: String,
    val gradient: List<Color>
)

data class MoodItem(
    val id: String,
    val name: String,
    val icon: String,
    val count: String,
    val gradient: List<Color>
)

data class StationUiState(
    val type: String = "genre", // "genre" or "mood"
    val id: String = "",
    val title: String = "",
    val subtitle: String = "",
    val icon: String = "🎵",
    val gradient: List<Color> = listOf(Color(0xFFE50914), Color(0xFF1E0305)),
    val tracks: List<NativeTrack> = emptyList(),
    val isLoading: Boolean = false,
    val errorMessage: String? = null
)

class StationViewModel(application: Application) : AndroidViewModel(application) {

    private val secureStorage = SecureAuthStorage.getInstance(application)
    private val _stationState = MutableStateFlow(StationUiState())
    val stationState: StateFlow<StationUiState> = _stationState.asStateFlow()

    private val _genres = MutableStateFlow<List<GenreItem>>(emptyList())
    val genres: StateFlow<List<GenreItem>> = _genres.asStateFlow()

    private val _moods = MutableStateFlow<List<MoodItem>>(emptyList())
    val moods: StateFlow<List<MoodItem>> = _moods.asStateFlow()

    init {
        loadDiscoveryStations()
    }

    fun loadDiscoveryStations() {
        viewModelScope.launch {
            // 1. Load Genres & Categories
            try {
                val res = MRJApiClient.apiService.getCategories()
                if (res.isSuccessful && res.body() != null) {
                    val rawCats = res.body()!!["categories"] as? List<Map<String, Any>> ?: emptyList()
                    val parsed = rawCats.map { map ->
                        val id = map["id"]?.toString() ?: ""
                        val name = map["name"]?.toString() ?: "Genre"
                        val icon = map["icon"]?.toString() ?: "🎵"
                        val desc = map["description"]?.toString() ?: "Top curated hits"
                        GenreItem(
                            id = id,
                            name = name,
                            icon = icon,
                            description = desc,
                            gradient = parseColorGradient(map["color"]?.toString(), id)
                        )
                    }
                    _genres.value = if (parsed.isNotEmpty()) parsed else getDefaultGenres()
                } else {
                    _genres.value = getDefaultGenres()
                }
            } catch (e: Exception) {
                Log.w(TAG, "Failed to load categories: ${e.message}")
                _genres.value = getDefaultGenres()
            }

            // 2. Load Mood Stations from Home API
            try {
                val res = MRJApiClient.apiService.getPersonalizedHome(region = "IN")
                if (res.isSuccessful && res.body() != null) {
                    val rawMoods = res.body()!!["moods"] as? List<Map<String, Any>> ?: emptyList()
                    val parsedMoods = rawMoods.map { map ->
                        val id = map["id"]?.toString() ?: ""
                        val name = map["name"]?.toString() ?: "Vibe"
                        val count = map["count"]?.toString() ?: "50+ Songs"
                        val icon = getMoodEmoji(id)
                        MoodItem(
                            id = id,
                            name = name,
                            icon = icon,
                            count = count,
                            gradient = parseColorGradient(map["color"]?.toString(), id)
                        )
                    }
                    _moods.value = if (parsedMoods.isNotEmpty()) parsedMoods else getDefaultMoods()
                } else {
                    _moods.value = getDefaultMoods()
                }
            } catch (e: Exception) {
                Log.w(TAG, "Failed to load moods: ${e.message}")
                _moods.value = getDefaultMoods()
            }
        }
    }

    fun loadStation(type: String, id: String, displayName: String? = null) {
        viewModelScope.launch {
            val isGenre = type.equals("genre", ignoreCase = true)
            val fallbackTitle = displayName ?: if (isGenre) "Genre Radio" else "Vibe Station"
            val gradient = parseColorGradient(null, id)
            val icon = if (isGenre) getGenreEmoji(id) else getMoodEmoji(id)

            _stationState.value = StationUiState(
                type = type,
                id = id,
                title = fallbackTitle,
                subtitle = if (isGenre) "Curated Top Regional & Genre Chart Hits" else "Endless Streaming Vibe Station",
                icon = icon,
                gradient = gradient,
                isLoading = true,
                errorMessage = null
            )

            try {
                val token = secureStorage.getAccessToken()
                val authHeader = if (token != null) "Bearer $token" else null

                val tracks = if (isGenre) {
                    val res = MRJApiClient.apiService.getCategoryTracks(id, authHeader)
                    if (res.isSuccessful && res.body() != null) {
                        val list = res.body()!!["tracks"] as? List<Map<String, Any>> ?: emptyList()
                        list.mapNotNull { parseTrack(it) }
                    } else emptyList()
                } else {
                    val res = MRJApiClient.apiService.getMoodTracks(id, authHeader)
                    if (res.isSuccessful && res.body() != null) {
                        val list = res.body()!!["tracks"] as? List<Map<String, Any>> ?: emptyList()
                        list.mapNotNull { parseTrack(it) }
                    } else emptyList()
                }

                if (tracks.isNotEmpty()) {
                    _stationState.value = _stationState.value.copy(
                        tracks = tracks,
                        isLoading = false
                    )
                    return@launch
                }

                // Fallback: Search for the station name
                val searchRes = MRJApiClient.apiService.search(query = displayName ?: id, type = "songs")
                if (searchRes.isSuccessful && searchRes.body() != null) {
                    val searchList = (searchRes.body()!!["songs"] as? List<Map<String, Any>>)
                        ?: (searchRes.body()!!["results"] as? List<Map<String, Any>>)
                        ?: emptyList()
                    val fallbackTracks = searchList.mapNotNull { parseTrack(it) }
                    if (fallbackTracks.isNotEmpty()) {
                        _stationState.value = _stationState.value.copy(
                            tracks = fallbackTracks,
                            isLoading = false
                        )
                        return@launch
                    }
                }

                _stationState.value = _stationState.value.copy(
                    isLoading = false,
                    errorMessage = "No tracks found for this station"
                )
            } catch (e: Exception) {
                Log.e(TAG, "Error loading station $id: ${e.message}")
                _stationState.value = _stationState.value.copy(
                    isLoading = false,
                    errorMessage = e.localizedMessage ?: "Network error"
                )
            }
        }
    }

    private fun parseTrack(map: Map<String, Any>): NativeTrack? {
        val id = (map["id"] as? String) ?: (map["providerTrackId"] as? String) ?: return null
        val title = map["title"] as? String ?: return null
        val artist = map["artist"] as? String ?: "Various Artists"
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
            providerTrackId = providerTrackId,
            streamUrl = "https://mrj-music.vercel.app/api/music/stream/${providerTrackId ?: id}"
        )
    }

    private fun parseColorGradient(colorClass: String?, id: String): List<Color> {
        val lowerId = id.lowercase()
        return when {
            lowerId.contains("punjabi") || lowerId.contains("workout") -> listOf(Color(0xFFE65100), Color(0xFFBF360C))
            lowerId.contains("bollywood") || lowerId.contains("romance") -> listOf(Color(0xFFD81B60), Color(0xFF880E4F))
            lowerId.contains("hollywood") || lowerId.contains("chill") -> listOf(Color(0xFF1E88E5), Color(0xFF0D47A1))
            lowerId.contains("tollywood") || lowerId.contains("focus") -> listOf(Color(0xFF00897B), Color(0xFF004D40))
            lowerId.contains("haryanvi") || lowerId.contains("energy") -> listOf(Color(0xFFF4511E), Color(0xFFD84315))
            lowerId.contains("bhojpuri") || lowerId.contains("party") -> listOf(Color(0xFF8E24AA), Color(0xFF4A148C))
            lowerId.contains("indie") || lowerId.contains("happy") -> listOf(Color(0xFF7CB342), Color(0xFF33691E))
            lowerId.contains("sleep") || lowerId.contains("sad") -> listOf(Color(0xFF3949AB), Color(0xFF1A237E))
            lowerId.contains("motivation") -> listOf(Color(0xFFFB8C00), Color(0xFFE65100))
            lowerId.contains("nostalgia") -> listOf(Color(0xFF00ACC1), Color(0xFF006064))
            else -> listOf(Color(0xFFE50914), Color(0xFF3D0005))
        }
    }

    private fun getGenreEmoji(id: String): String = when (id.lowercase()) {
        "bollywood" -> "🎬"
        "punjabi" -> "🌾"
        "hollywood" -> "🌍"
        "tollywood" -> "⚡"
        "haryanvi" -> "🚜"
        "bhojpuri" -> "🌶️"
        "indie" -> "🎸"
        else -> "🎵"
    }

    private fun getMoodEmoji(id: String): String = when (id.lowercase()) {
        "workout" -> "💪"
        "chill" -> "🌊"
        "romance" -> "❤️"
        "focus" -> "🧠"
        "energy" -> "⚡"
        "party" -> "🎉"
        "sleep" -> "🌙"
        "commute" -> "🚗"
        "sad" -> "🌧️"
        "happy" -> "☀️"
        "motivation" -> "🔥"
        "nostalgia" -> "📻"
        "study" -> "📚"
        else -> "✨"
    }

    private fun getDefaultGenres(): List<GenreItem> = listOf(
        GenreItem("bollywood", "Bollywood & Hindi", "🎬", "Romantic & soul-stirring Bollywood melodies", listOf(Color(0xFFD81B60), Color(0xFF880E4F))),
        GenreItem("punjabi", "Punjabi Hits", "🌾", "Bhangra, Desi Hip-Hop & Punjabi chart toppers", listOf(Color(0xFFE65100), Color(0xFFBF360C))),
        GenreItem("hollywood", "Hollywood & Pop", "🌍", "Global Billboard Hot 100 hits & international anthems", listOf(Color(0xFF1E88E5), Color(0xFF0D47A1))),
        GenreItem("tollywood", "Tollywood & South", "⚡", "High-energy Telugu, Tamil & South Indian blockbusters", listOf(Color(0xFF00897B), Color(0xFF004D40))),
        GenreItem("haryanvi", "Haryanvi Superhits", "🚜", "Desi swag, DJ beats & viral Haryanvi anthems", listOf(Color(0xFFF4511E), Color(0xFFD84315))),
        GenreItem("bhojpuri", "Bhojpuri Dhamaka", "🌶️", "Electrifying Bhojpuri party tracks & popular folk hits", listOf(Color(0xFF8E24AA), Color(0xFF4A148C))),
        GenreItem("indie", "Indie & Acoustic", "🎸", "Chill indie, soulful acoustic vibes & singer-songwriter gems", listOf(Color(0xFF7CB342), Color(0xFF33691E)))
    )

    private fun getDefaultMoods(): List<MoodItem> = listOf(
        MoodItem("workout", "Workout & High Energy", "💪", "50+ Songs", listOf(Color(0xFFE65100), Color(0xFFBF360C))),
        MoodItem("chill", "Chill & Relax", "🌊", "45+ Songs", listOf(Color(0xFF1E88E5), Color(0xFF0D47A1))),
        MoodItem("romance", "Romance & Love", "❤️", "60+ Songs", listOf(Color(0xFFD81B60), Color(0xFF880E4F))),
        MoodItem("party", "Party & Club Hits", "🎉", "65+ Songs", listOf(Color(0xFF8E24AA), Color(0xFF4A148C))),
        MoodItem("energy", "Pure Energy", "⚡", "50+ Songs", listOf(Color(0xFFF4511E), Color(0xFFD84315))),
        MoodItem("sleep", "Deep Sleep & Lo-Fi", "🌙", "35+ Songs", listOf(Color(0xFF3949AB), Color(0xFF1A237E))),
        MoodItem("happy", "Feel Good & Uplifting", "☀️", "55+ Songs", listOf(Color(0xFFFB8C00), Color(0xFFE65100))),
        MoodItem("sad", "Melancholy & Healing", "🌧️", "40+ Songs", listOf(Color(0xFF455A64), Color(0xFF263238)))
    )
}
