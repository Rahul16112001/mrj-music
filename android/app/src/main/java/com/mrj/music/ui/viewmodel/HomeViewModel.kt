package com.mrj.music.ui.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.mrj.music.data.remote.MRJApiClient
import com.mrj.music.data.security.SecureAuthStorage
import com.mrj.music.model.NativeTrack
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class HomeUiState(
    val isLoading: Boolean = true,
    val quickPicks: List<NativeTrack> = emptyList(),
    val recommended: List<NativeTrack> = emptyList(),
    val trendingArtists: List<Map<String, Any>> = emptyList(),
    val greeting: String = "Good evening",
    val userName: String = "Listener",
    val errorMessage: String? = null
)

class HomeViewModel(application: Application) : AndroidViewModel(application) {

    private val secureStorage = SecureAuthStorage.getInstance(application)
    private val _uiState = MutableStateFlow(HomeUiState())
    val uiState: StateFlow<HomeUiState> = _uiState.asStateFlow()

    init {
        loadHomeData()
    }

    fun loadHomeData() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null)
            try {
                val token = secureStorage.getAccessToken()
                val authHeader = if (token != null) "Bearer $token" else null
                val res = MRJApiClient.apiService.getPersonalizedHome(region = "IN", authHeader = authHeader)

                val preferredName = secureStorage.getPreferredName()
                val userProfile = secureStorage.getUserProfile()
                val rawName = (userProfile?.get("name") as? String) ?: "Listener"
                val calloutName = if (!preferredName.isNullOrBlank()) preferredName else rawName

                if (res.isSuccessful && res.body() != null) {
                    val body = res.body()!!
                    val greeting = body["greeting"] as? String ?: "Welcome back"
                    val personalized = body["personalized"] as? Map<*, *>

                    val discovery = body["discovery"] as? Map<*, *>
                    val charts = body["charts"] as? Map<*, *>

                    val timeOfDay = personalized?.get("timeOfDay") as? Map<*, *>
                    val timeOfDayTracks = (timeOfDay?.get("tracks") as? List<Map<String, Any>>) ?: emptyList()
                    val qpList = (personalized?.get("quickPicks") as? List<Map<String, Any>>) ?: emptyList()
                    val dailyMixes = (personalized?.get("dailyMixes") as? List<Map<String, Any>>) ?: emptyList()
                    val listenAgain = (personalized?.get("listenAgain") as? List<Map<String, Any>>) ?: emptyList()
                    val recList = (personalized?.get("recommendedForYou") as? List<Map<String, Any>>) ?: emptyList()
                    val newReleases = (discovery?.get("newReleases") as? List<Map<String, Any>>) ?: emptyList()
                    val trendingReg = (charts?.get("trendingRegional") as? List<Map<String, Any>>) ?: emptyList()
                    val trendingWorld = (charts?.get("trendingWorldwide") as? List<Map<String, Any>>) ?: emptyList()

                    val combinedQuickRaw = if (qpList.isNotEmpty()) qpList else if (timeOfDayTracks.isNotEmpty()) timeOfDayTracks else (dailyMixes + listenAgain)
                    val combinedRecRaw = if (recList.isNotEmpty()) recList else (newReleases + trendingReg + trendingWorld)

                    val quickPicks = combinedQuickRaw.mapNotNull { parseTrack(it) }
                    val recommended = combinedRecRaw.mapNotNull { parseTrack(it) }

                    val rawArtists = (charts?.get("topArtists") as? List<Map<String, Any>>)
                        ?: (discovery?.get("topArtists") as? List<Map<String, Any>>)

                    val artists = if (!rawArtists.isNullOrEmpty()) {
                        rawArtists
                    } else {
                        listOf(
                            mapOf("id" to "1", "name" to "Arijit Singh", "image" to "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400"),
                            mapOf("id" to "2", "name" to "Shreya Ghoshal", "image" to "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400"),
                            mapOf("id" to "3", "name" to "Diljit Dosanjh", "image" to "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400"),
                            mapOf("id" to "4", "name" to "Sidhu Moose Wala", "image" to "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400"),
                            mapOf("id" to "5", "name" to "Karan Aujla", "image" to "https://images.unsplash.com/photo-1511735111819-9a3f7709049c?w=400"),
                            mapOf("id" to "6", "name" to "The Weeknd", "image" to "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=400"),
                            mapOf("id" to "7", "name" to "Pawan Singh", "image" to "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=400"),
                            mapOf("id" to "8", "name" to "Khesari Lal Yadav", "image" to "https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=400")
                        )
                    }

                    _uiState.value = HomeUiState(
                        isLoading = false,
                        quickPicks = quickPicks,
                        recommended = recommended,
                        trendingArtists = artists,
                        greeting = greeting,
                        userName = calloutName
                    )
                } else {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        errorMessage = "Unable to connect to MRJ Music servers."
                    )
                }
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    errorMessage = e.message ?: "Failed to load dashboard."
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
