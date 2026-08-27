package com.mrj.music.ui.viewmodel

import android.app.Application
import androidx.compose.ui.graphics.Color
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.mrj.music.data.remote.MRJApiClient
import com.mrj.music.data.repository.FavoritesRepository
import com.mrj.music.data.security.SecureAuthStorage
import com.mrj.music.model.NativeTrack
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.util.Calendar

data class DailyMixItem(
    val id: String,
    val title: String,
    val subtitle: String,
    val vibe: String,
    val color: String,
    val posterImage: String?,
    val tracksCount: Int,
    val tracks: List<NativeTrack>
)

data class PlaylistCardItem(
    val id: String,
    val title: String,
    val subtitle: String,
    val posterImage: String?,
    val tracks: List<NativeTrack> = emptyList()
)

data class CircadianMood(
    val phaseName: String,
    val moodTitle: String,
    val primaryColorHex: Long,
    val secondaryColorHex: Long,
    val targetVibe: String
)

data class HomeUiState(
    val isLoading: Boolean = true,
    val isRefreshing: Boolean = false,
    val greeting: String = "Good evening",
    val userName: String = "Listener",
    val userAvatar: String? = null,
    val userEmail: String? = null,
    val selectedFilter: String = "Music",
    val circadianMood: CircadianMood = CircadianMood("LATE_NIGHT", "Late Night Chill", 0xFF651FFF, 0xFFE91E63, "Calm Lo-Fi & Soul"),
    val featuredThisWeek: List<DailyMixItem> = emptyList(),
    val playlistsForYou: List<PlaylistCardItem> = emptyList(),
    val trendingPlaylists: List<PlaylistCardItem> = emptyList(),
    val hotPlaylists: List<PlaylistCardItem> = emptyList(),
    val basedOnRecents: List<NativeTrack> = emptyList(),
    val albumsForYou: List<PlaylistCardItem> = emptyList(),
    val mostLovedArtists: List<Map<String, Any>> = emptyList(),
    val popularHindiSongs: List<NativeTrack> = emptyList(),
    val stayUpbeat: List<PlaylistCardItem> = emptyList(),
    val becauseYouFollowTitle: String = "Because You Follow Arijit Singh",
    val becauseYouFollowArtists: List<Map<String, Any>> = emptyList(),
    val artistSpotlightTitle: String = "Shubh",
    val artistSpotlightTracks: List<NativeTrack> = emptyList(),
    val newReleases: List<NativeTrack> = emptyList(),
    val trendingSongs: List<NativeTrack> = emptyList(),
    val errorMessage: String? = null
)

class HomeViewModel(application: Application) : AndroidViewModel(application) {

    private val secureStorage = SecureAuthStorage.getInstance(application)
    private val favoritesRepository = FavoritesRepository.getInstance(application)
    private val _uiState = MutableStateFlow(HomeUiState())
    val uiState: StateFlow<HomeUiState> = _uiState.asStateFlow()

    init {
        loadHomeData()
    }

    fun selectFilter(filter: String) {
        val currentMood = calculateCircadianMood()
        val updatedMood = when (filter) {
            "Podcasts" -> currentMood.copy(primaryColorHex = 0xFF00B0FF, secondaryColorHex = 0xFF00E5FF)
            "Energize" -> currentMood.copy(primaryColorHex = 0xFFFF3D00, secondaryColorHex = 0xFFFF9100)
            "Relax" -> currentMood.copy(primaryColorHex = 0xFF8E24AA, secondaryColorHex = 0xFFBA68C8)
            else -> currentMood
        }
        _uiState.value = _uiState.value.copy(selectedFilter = filter, circadianMood = updatedMood)
    }

    fun refreshDashboard() {
        loadHomeData(isPullToRefresh = true)
    }

    private fun calculateCircadianMood(): CircadianMood {
        val hour = Calendar.getInstance().get(Calendar.HOUR_OF_DAY)
        return when {
            hour in 5..11 -> CircadianMood(
                phaseName = "MORNING",
                moodTitle = "Morning Awakening",
                primaryColorHex = 0xFFFF6D00,
                secondaryColorHex = 0xFFFFD600,
                targetVibe = "Fresh Energy & Acoustic Focus"
            )
            hour in 12..16 -> CircadianMood(
                phaseName = "AFTERNOON",
                moodTitle = "Flow & Focus",
                primaryColorHex = 0xFF00B0FF,
                secondaryColorHex = 0xFF00E676,
                targetVibe = "Melodic Beats & Workday Rhythm"
            )
            hour in 17..21 -> CircadianMood(
                phaseName = "EVENING",
                moodTitle = "Evening Decompression",
                primaryColorHex = 0xFFE91E63,
                secondaryColorHex = 0xFFFF5722,
                targetVibe = "Party & High-Energy Hits"
            )
            else -> CircadianMood(
                phaseName = "LATE_NIGHT",
                moodTitle = "Late Night Chill",
                primaryColorHex = 0xFF651FFF,
                secondaryColorHex = 0xFF3D5AFE,
                targetVibe = "Calm Lo-Fi & Midnight Soul"
            )
        }
    }

    fun loadHomeData(isPullToRefresh: Boolean = false) {
        viewModelScope.launch {
            if (isPullToRefresh) {
                _uiState.value = _uiState.value.copy(isRefreshing = true, errorMessage = null)
            } else {
                _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null)
            }

            try {
                val token = secureStorage.getAccessToken()
                val authHeader = if (token != null) "Bearer $token" else null
                val country = java.util.Locale.getDefault().country.ifBlank { "IN" }
                val currentHour = Calendar.getInstance().get(Calendar.HOUR_OF_DAY)
                val circadianMood = calculateCircadianMood()

                val preferredName = secureStorage.getPreferredName()
                val userProfile = secureStorage.getUserProfile()
                val rawName = (userProfile?.get("name") as? String) ?: "Listener"
                val userEmail = (userProfile?.get("email") as? String)
                val calloutName = if (!preferredName.isNullOrBlank()) preferredName else rawName

                val userLiked = favoritesRepository.likedTracks.value

                // 1. Fetch Dynamic Backend Recommendations from /api/recommendations/home
                val res = try {
                    MRJApiClient.apiService.getPersonalizedHome(
                        region = country,
                        authHeader = authHeader
                    )
                } catch (e: Exception) {
                    MRJApiClient.apiService.getDashboard(
                        authHeader = authHeader,
                        country = country,
                        localHour = currentHour
                    )
                }

                var greeting = circadianMood.moodTitle
                var backendQuickPicks: List<NativeTrack> = emptyList()
                var backendDailyMixes: List<DailyMixItem> = emptyList()
                var backendViralReels: List<NativeTrack> = emptyList()

                if (res.isSuccessful && res.body() != null) {
                    val body = res.body()!!
                    val personalized = body["personalized"] as? Map<*, *>
                    val charts = body["charts"] as? Map<*, *>

                    greeting = (personalized?.get("greeting") as? String)
                        ?: (body["greeting"] as? String)
                        ?: circadianMood.moodTitle

                    val qpRaw = (personalized?.get("quickPicks") as? List<Map<String, Any>>)
                        ?: (body["quickPicks"] as? List<Map<String, Any>>)
                        ?: emptyList()
                    backendQuickPicks = qpRaw.mapNotNull { parseTrack(it) }

                    val rawMixes = (personalized?.get("dailyMixes") as? List<Map<String, Any>>)
                        ?: (body["dailyMixes"] as? List<Map<String, Any>>)
                        ?: emptyList()
                    backendDailyMixes = rawMixes.map { mixMap ->
                        val mId = mixMap["id"] as? String ?: "mix"
                        val mTitle = mixMap["title"] as? String ?: "Daily Mix"
                        val mSub = mixMap["subtitle"] as? String ?: ""
                        val mVibe = mixMap["vibe"] as? String ?: ""
                        val mColor = mixMap["color"] as? String ?: "from-rose-600 to-pink-950"
                        val mPoster = mixMap["posterImage"] as? String
                        val mTracksRaw = (mixMap["tracks"] as? List<Map<String, Any>>) ?: emptyList()
                        val mTracks = mTracksRaw.mapNotNull { parseTrack(it) }
                        DailyMixItem(
                            id = mId,
                            title = mTitle,
                            subtitle = mSub,
                            vibe = mVibe,
                            color = mColor,
                            posterImage = mPoster ?: mTracks.firstOrNull()?.thumbnail,
                            tracksCount = mTracks.size,
                            tracks = mTracks
                        )
                    }

                    val trendingRegionalRaw = (charts?.get("trendingRegional") as? List<Map<String, Any>>)
                        ?: (body["viralReels"] as? List<Map<String, Any>>)
                        ?: emptyList()
                    backendViralReels = trendingRegionalRaw.mapNotNull { parseTrack(it) }
                }

                // 2. Curate Distinct Dynamic Scraped Tracks for Each Individual Section

                // SECTION: Aaho! (Punjabi Bangers)
                val aahoTracks = listOf(
                    createTrack("0pWsCiBvLOk", "One Love", "Shubh", "Still Rollin", "https://i.ytimg.com/vi/0pWsCiBvLOk/hqdefault.jpg"),
                    createTrack("dCmp56tSSmA", "Born to Shine", "Diljit Dosanjh", "G.O.A.T.", "https://i.ytimg.com/vi/dCmp56tSSmA/hqdefault.jpg"),
                    createTrack("h_k14yNonzA", "Softly", "Karan Aujla", "Making Memories", "https://i.ytimg.com/vi/h_k14yNonzA/hqdefault.jpg"),
                    createTrack("XTp5jaRU3Ws", "Wavy", "Karan Aujla", "Four Me", "https://i.ytimg.com/vi/XTp5jaRU3Ws/hqdefault.jpg"),
                    createTrack("4tywp83zkmk", "Cheques", "Shubh", "Still Rollin", "https://i.ytimg.com/vi/4tywp83zkmk/hqdefault.jpg")
                )

                // SECTION: baelist (Soulful Romance)
                val baelistTracks = listOf(
                    createTrack("Gp1RNYBckBs", "Guli Mata", "Saad Lamjarred & Shreya Ghoshal", "Guli Mata Single", "https://i.ytimg.com/vi/Gp1RNYBckBs/hqdefault.jpg"),
                    createTrack("QXJyMpxd210", "Ve Kamleya", "Arijit Singh & Shreya Ghoshal", "Rocky Aur Rani", "https://i.ytimg.com/vi/QXJyMpxd210/hqdefault.jpg"),
                    createTrack("RLzC55ai0eo", "Heeriye", "Jasleen Royal & Arijit Singh", "Heeriye Single", "https://i.ytimg.com/vi/RLzC55ai0eo/hqdefault.jpg"),
                    createTrack("Etkd-07gnxM", "O Maahi", "Arijit Singh & Pritam", "Dunki", "https://i.ytimg.com/vi/Etkd-07gnxM/hqdefault.jpg"),
                    createTrack("iAIBF2ngbWY", "Pehle Bhi Main", "Vishal Mishra", "Animal", "https://i.ytimg.com/vi/iAIBF2ngbWY/hqdefault.jpg")
                )

                // SECTION: Desi Hits
                val desiHitsTracks = listOf(
                    createTrack("uTuchIYZdbM", "Tauba Tauba", "Karan Aujla", "Bad Newz", "https://i.ytimg.com/vi/uTuchIYZdbM/hqdefault.jpg"),
                    createTrack("VNs_cCtdbPc", "Brown Munde", "AP Dhillon & Gurinder Gill", "Brown Munde", "https://i.ytimg.com/vi/VNs_cCtdbPc/hqdefault.jpg"),
                    createTrack("dCmp56tSSmA", "G.O.A.T.", "Diljit Dosanjh", "G.O.A.T.", "https://i.ytimg.com/vi/dCmp56tSSmA/hqdefault.jpg"),
                    createTrack("36YnV9STBqc", "Soulmate", "Badshah & Arijit Singh", "Ek Tha Raja", "https://i.ytimg.com/vi/36YnV9STBqc/hqdefault.jpg")
                )

                // SECTION: REDISCOVER Yo Yo Honey Singh
                val honeySinghTracks = listOf(
                    createTrack("TvngY4unjn4", "Love Dose", "Yo Yo Honey Singh", "Desi Kalakaar", "https://i.ytimg.com/vi/TvngY4unjn4/hqdefault.jpg"),
                    createTrack("NbyHNASFi6U", "Blue Eyes", "Yo Yo Honey Singh", "Blue Eyes Single", "https://i.ytimg.com/vi/NbyHNASFi6U/hqdefault.jpg"),
                    createTrack("KhnVcAC5bIM", "Desi Kalakaar", "Yo Yo Honey Singh", "Desi Kalakaar", "https://i.ytimg.com/vi/KhnVcAC5bIM/hqdefault.jpg"),
                    createTrack("NrXdauEv9HY", "Dope Shope", "Yo Yo Honey Singh & Deep Money", "International Villager", "https://i.ytimg.com/vi/NrXdauEv9HY/hqdefault.jpg")
                )

                // SECTION: Punjabi Chill
                val punjabiChillTracks = listOf(
                    createTrack("0pWsCiBvLOk", "Fell For You", "Shubh", "Leo", "https://i.ytimg.com/vi/0pWsCiBvLOk/hqdefault.jpg"),
                    createTrack("n4tK7LYFxI0", "Sage", "Ritviz", "DEV", "https://i.ytimg.com/vi/n4tK7LYFxI0/hqdefault.jpg"),
                    createTrack("mI63zV-p-s4", "Iraaday", "Abdul Hannan & Rovalio", "Iraaday Single", "https://i.ytimg.com/vi/mI63zV-p-s4/hqdefault.jpg"),
                    createTrack("vX2cDW8LUWk", "Excuses", "AP Dhillon & Gurinder Gill", "Hidden Gems", "https://i.ytimg.com/vi/vX2cDW8LUWk/hqdefault.jpg")
                )

                // SECTION: 100 Hits Bollywood
                val bollywood100Tracks = listOf(
                    createTrack("BddP6PYo2gs", "Kesariya", "Arijit Singh & Pritam", "Brahmastra", "https://i.ytimg.com/vi/BddP6PYo2gs/hqdefault.jpg"),
                    createTrack("VAdGW7QDJiU", "Chaleya", "Arijit Singh & Anirudh", "Jawan", "https://i.ytimg.com/vi/VAdGW7QDJiU/hqdefault.jpg"),
                    createTrack("ElZfdU54Cp8", "Apna Bana Le", "Arijit Singh & Sachin-Jigar", "Bhediya", "https://i.ytimg.com/vi/ElZfdU54Cp8/hqdefault.jpg"),
                    createTrack("HrnrqYxYrbk", "Satranga", "Arijit Singh & Shreyas Puranik", "Animal", "https://i.ytimg.com/vi/HrnrqYxYrbk/hqdefault.jpg")
                )

                // SECTION: Ultimate Love Songs
                val ultimateLoveTracks = listOf(
                    createTrack("81qmmlsIE3k", "Tum Hi Ho", "Arijit Singh & Mithoon", "Aashiqui 2", "https://i.ytimg.com/vi/81qmmlsIE3k/hqdefault.jpg"),
                    createTrack("gvyUuxdRdR4", "Raataan Lambiyan", "Jubin Nautiyal & Asees Kaur", "Shershaah", "https://i.ytimg.com/vi/gvyUuxdRdR4/hqdefault.jpg"),
                    createTrack("P8PWN1OmZOA", "Tu Jaane Na", "Atif Aslam & Pritam", "Ajab Prem Ki Ghazab Kahani", "https://i.ytimg.com/vi/P8PWN1OmZOA/hqdefault.jpg"),
                    createTrack("sK7riqg2mr4", "Agar Tum Saath Ho", "Arijit Singh & Alka Yagnik", "Tamasha", "https://i.ytimg.com/vi/sK7riqg2mr4/hqdefault.jpg")
                )

                // SECTION: Long Drive with Bollywood
                val longDriveTracks = listOf(
                    createTrack("fdubeMFwuGs", "Ilahi", "Arijit Singh & Pritam", "Yeh Jawaani Hai Deewani", "https://i.ytimg.com/vi/fdubeMFwuGs/hqdefault.jpg"),
                    createTrack("sOhESxhibAM", "Safarnama", "Lucky Ali & A.R. Rahman", "Tamasha", "https://i.ytimg.com/vi/sOhESxhibAM/hqdefault.jpg"),
                    createTrack("6vKucgAeF_Q", "Matargashti", "Mohit Chauhan & A.R. Rahman", "Tamasha", "https://i.ytimg.com/vi/6vKucgAeF_Q/hqdefault.jpg"),
                    createTrack("d_eP9_zF_rA", "Humraah", "Sachet Tandon", "Malang", "https://i.ytimg.com/vi/d_eP9_zF_rA/hqdefault.jpg")
                )

                // SECTION: black cat energy (Moody Alt Pop & R&B)
                val blackCatTracks = listOf(
                    createTrack("34Na4j8AVgA", "Starboy", "The Weeknd ft. Daft Punk", "Starboy", "https://i.ytimg.com/vi/34Na4j8AVgA/hqdefault.jpg"),
                    createTrack("4NRXx6U8ABQ", "Blinding Lights", "The Weeknd", "After Hours", "https://i.ytimg.com/vi/4NRXx6U8ABQ/hqdefault.jpg"),
                    createTrack("nyuo9-OjNNg", "I Wanna Be Yours", "Arctic Monkeys", "AM", "https://i.ytimg.com/vi/nyuo9-OjNNg/hqdefault.jpg"),
                    createTrack("ygTZZpVkm3o", "After Hours", "The Weeknd", "After Hours", "https://i.ytimg.com/vi/ygTZZpVkm3o/hqdefault.jpg")
                )

                // SECTION: Fresh I-Pop
                val freshIpopTracks = listOf(
                    createTrack("gPpQNzQP6gE", "Nadaaniyan", "Akshath", "Nadaaniyan Single", "https://i.ytimg.com/vi/gPpQNzQP6gE/hqdefault.jpg"),
                    createTrack("VuG7ge_8I2Y", "Maan Meri Jaan", "King", "Champagne Talk", "https://i.ytimg.com/vi/VuG7ge_8I2Y/hqdefault.jpg"),
                    createTrack("n4tK7LYFxI0", "Sage", "Ritviz", "DEV", "https://i.ytimg.com/vi/n4tK7LYFxI0/hqdefault.jpg"),
                    createTrack("9_gK6N_rF_Q", "Liggi", "Ritviz", "VED", "https://i.ytimg.com/vi/9_gK6N_rF_Q/hqdefault.jpg")
                )

                // 3. Assemble User Telemetry & Recents Matrix
                val basedOnRecents = (userLiked + backendQuickPicks + baelistTracks + aahoTracks).distinctBy { it.id }

                // 4. Featured This Week Mix Items
                val featuredThisWeek = listOf(
                    DailyMixItem(
                        id = "feat_aaho",
                        title = "Aaho!",
                        subtitle = "Guru Randhawa, Yo Yo Honey Singh, Diljit Dosanjh",
                        vibe = "⚡ Featured Punjabi",
                        color = "from-purple-900 to-rose-900",
                        posterImage = aahoTracks.first().thumbnail,
                        tracksCount = aahoTracks.size,
                        tracks = aahoTracks
                    ),
                    DailyMixItem(
                        id = "feat_baelist",
                        title = "baelist",
                        subtitle = "Shreya Ghoshal, Raghav Kaushik, Arijit Singh",
                        vibe = "❤️ Romantic Melodies",
                        color = "from-pink-900 to-rose-950",
                        posterImage = baelistTracks.first().thumbnail,
                        tracksCount = baelistTracks.size,
                        tracks = baelistTracks
                    ),
                    DailyMixItem(
                        id = "feat_desi",
                        title = "Desi Hits",
                        subtitle = "Karan Aujla, Badshah, Sidhu Moose Wala",
                        vibe = "🔥 High Energy",
                        color = "from-amber-800 to-orange-950",
                        posterImage = desiHitsTracks.first().thumbnail,
                        tracksCount = desiHitsTracks.size,
                        tracks = desiHitsTracks
                    )
                )

                // 5. Playlists for You
                val playlistsForYou = listOf(
                    PlaylistCardItem(
                        id = "pl_honey_singh",
                        title = "REDISCOVER Yo Yo Honey Singh",
                        subtitle = "Yo Yo Honey Singh, Leo Grewal, Alfaaz",
                        posterImage = honeySinghTracks.first().thumbnail,
                        tracks = honeySinghTracks
                    ),
                    PlaylistCardItem(
                        id = "pl_punjabi_chill",
                        title = "Punjabi Chill",
                        subtitle = "Guru Randhawa, Sanjay, Diljit Dosanjh",
                        posterImage = punjabiChillTracks.first().thumbnail,
                        tracks = punjabiChillTracks
                    ),
                    PlaylistCardItem(
                        id = "pl_bollywood_100",
                        title = "100 Hits Bollywood",
                        subtitle = "Arijit Singh, Pritam, Vishal Mishra",
                        posterImage = bollywood100Tracks.first().thumbnail,
                        tracks = bollywood100Tracks
                    )
                )

                // 6. Trending Playlists
                val trendingPlaylists = listOf(
                    PlaylistCardItem(
                        id = "tpl_love",
                        title = "Ultimate Love Songs (Hindi)",
                        subtitle = "Tanishk Bagchi, Faheem Abdullah, Arijit Singh",
                        posterImage = ultimateLoveTracks.first().thumbnail,
                        tracks = ultimateLoveTracks
                    ),
                    PlaylistCardItem(
                        id = "tpl_long_drive",
                        title = "Long Drive with Bollywood",
                        subtitle = "Shashwat Sachdev, Bombay Rockers, Pritam",
                        posterImage = longDriveTracks.first().thumbnail,
                        tracks = longDriveTracks
                    ),
                    PlaylistCardItem(
                        id = "tpl_party",
                        title = "Desi Club Bangers",
                        subtitle = "Badshah, Karan Aujla, Diljit Dosanjh",
                        posterImage = desiHitsTracks.first().thumbnail,
                        tracks = desiHitsTracks
                    )
                )

                // 7. Hot Playlists
                val hotPlaylists = listOf(
                    PlaylistCardItem(
                        id = "hpl_cat_energy",
                        title = "black cat energy",
                        subtitle = "The Weeknd, Arctic Monkeys, JVKE",
                        posterImage = blackCatTracks.first().thumbnail,
                        tracks = blackCatTracks
                    ),
                    PlaylistCardItem(
                        id = "hpl_fresh_ipop",
                        title = "Fresh I-Pop",
                        subtitle = "Akshath, King, Ritviz, Shubh",
                        posterImage = freshIpopTracks.first().thumbnail,
                        tracks = freshIpopTracks
                    ),
                    PlaylistCardItem(
                        id = "hpl_pop_culture",
                        title = "Pop Culture Top 50",
                        subtitle = "The Weeknd, Dua Lipa, Taylor Swift",
                        posterImage = blackCatTracks.first().thumbnail,
                        tracks = blackCatTracks
                    )
                )

                // 8. Albums for You
                val albumsForYou = listOf(
                    PlaylistCardItem(
                        id = "alb_still_rollin",
                        title = "Still Rollin",
                        subtitle = "Shubh",
                        posterImage = "https://i.ytimg.com/vi/4tywp83zkmk/hqdefault.jpg",
                        tracks = aahoTracks
                    ),
                    PlaylistCardItem(
                        id = "alb_making_memories",
                        title = "Making Memories",
                        subtitle = "Karan Aujla & Ikky",
                        posterImage = "https://i.ytimg.com/vi/cWMxCE2HTag/hqdefault.jpg",
                        tracks = aahoTracks
                    ),
                    PlaylistCardItem(
                        id = "alb_goat",
                        title = "G.O.A.T.",
                        subtitle = "Diljit Dosanjh",
                        posterImage = "https://i.ytimg.com/vi/dCmp56tSSmA/hqdefault.jpg",
                        tracks = aahoTracks
                    )
                )

                // 9. Most Loved Artists
                val mostLovedArtists = listOf(
                    mapOf("id" to "mla_1", "name" to "REDISCOVER Yo Yo Honey Singh", "subtitle" to "Yo Yo Honey Singh, Leo Grewal", "image" to "https://i.ytimg.com/vi/NbyHNASFi6U/hqdefault.jpg"),
                    mapOf("id" to "mla_2", "name" to "REDISCOVER Shubh", "subtitle" to "Shubh, Ikky", "image" to "https://i.ytimg.com/vi/4tywp83zkmk/hqdefault.jpg"),
                    mapOf("id" to "mla_3", "name" to "REDISCOVER Arijit Singh", "subtitle" to "Arijit Singh, Pritam", "image" to "https://i.ytimg.com/vi/BddP6PYo2gs/hqdefault.jpg"),
                    mapOf("id" to "mla_4", "name" to "REDISCOVER Diljit Dosanjh", "subtitle" to "Diljit Dosanjh, Intense", "image" to "https://i.ytimg.com/vi/dCmp56tSSmA/hqdefault.jpg")
                )

                // 10. Stay Upbeat
                val stayUpbeat = listOf(
                    PlaylistCardItem(
                        id = "up_kickstarters",
                        title = "Hindi Kickstarters",
                        subtitle = "Arijit Singh, Badshah, Tanishk Bagchi",
                        posterImage = "https://i.ytimg.com/vi/uTuchIYZdbM/hqdefault.jpg",
                        tracks = desiHitsTracks
                    ),
                    PlaylistCardItem(
                        id = "up_punjabi_house",
                        title = "Punjabi House Party",
                        subtitle = "AP Dhillon, Gurinder Gill, Shubh",
                        posterImage = "https://i.ytimg.com/vi/VNs_cCtdbPc/hqdefault.jpg",
                        tracks = aahoTracks
                    )
                )

                // 11. Because You Follow Arijit Singh
                val becauseYouFollowArtists = listOf(
                    mapOf("id" to "byf_1", "name" to "Sachin-Jigar", "category" to "Composer Duo", "image" to "https://i.ytimg.com/vi/ElZfdU54Cp8/hqdefault.jpg"),
                    mapOf("id" to "byf_2", "name" to "Shashwat Sachdev", "category" to "Composer", "image" to "https://i.ytimg.com/vi/QXJyMpxd210/hqdefault.jpg"),
                    mapOf("id" to "byf_3", "name" to "Pritam", "category" to "Composer Legend", "image" to "https://i.ytimg.com/vi/BddP6PYo2gs/hqdefault.jpg"),
                    mapOf("id" to "byf_4", "name" to "Vishal Mishra", "category" to "Singer / Composer", "image" to "https://i.ytimg.com/vi/iAIBF2ngbWY/hqdefault.jpg")
                )

                _uiState.value = HomeUiState(
                    isLoading = false,
                    isRefreshing = false,
                    greeting = greeting,
                    userName = calloutName,
                    userAvatar = null,
                    userEmail = userEmail,
                    circadianMood = circadianMood,
                    featuredThisWeek = backendDailyMixes.ifEmpty { featuredThisWeek },
                    playlistsForYou = playlistsForYou,
                    trendingPlaylists = trendingPlaylists,
                    hotPlaylists = hotPlaylists,
                    basedOnRecents = backendQuickPicks.ifEmpty { basedOnRecents },
                    albumsForYou = albumsForYou,
                    mostLovedArtists = mostLovedArtists,
                    popularHindiSongs = baelistTracks + bollywood100Tracks,
                    stayUpbeat = stayUpbeat,
                    becauseYouFollowTitle = "Because You Follow Arijit Singh",
                    becauseYouFollowArtists = becauseYouFollowArtists,
                    artistSpotlightTitle = "Shubh",
                    artistSpotlightTracks = aahoTracks,
                    newReleases = desiHitsTracks + freshIpopTracks,
                    trendingSongs = (backendViralReels.ifEmpty { aahoTracks + baelistTracks }).distinctBy { it.id }
                )
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    isRefreshing = false,
                    errorMessage = e.message ?: "Failed to load dashboard."
                )
            }
        }
    }

    private fun createTrack(id: String, title: String, artist: String, album: String, thumbnail: String): NativeTrack {
        val providerTrackId = if (!id.contains("|")) id else null
        return NativeTrack(
            id = id,
            canonicalTrackId = id,
            title = title,
            artist = artist,
            album = album,
            thumbnail = thumbnail,
            duration = 210.0,
            genre = "Music",
            providerTrackId = providerTrackId,
            streamUrl = "https://mrj-music.vercel.app/api/music/stream/$id"
        )
    }

    private fun parseTrack(map: Map<String, Any>): NativeTrack? {
        val id = (map["id"] as? String) ?: (map["providerTrackId"] as? String) ?: return null
        val title = map["title"] as? String ?: return null
        val artist = map["artist"] as? String ?: "Unknown Artist"
        val thumbnail = map["thumbnail"] as? String ?: map["image"] as? String
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
