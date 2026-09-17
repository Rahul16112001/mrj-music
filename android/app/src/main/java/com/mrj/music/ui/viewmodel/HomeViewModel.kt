package com.mrj.music.ui.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.mrj.music.data.home.HomeFeedRepository
import com.mrj.music.data.home.HomeFeedState
import com.mrj.music.data.remote.HomeFeedResponse
import com.mrj.music.data.remote.HomeFeedSectionDto
import com.mrj.music.data.remote.HomeFeedTrackDto
import com.mrj.music.data.security.SecureAuthStorage
import com.mrj.music.model.NativeTrack
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.util.Calendar

data class DailyMixItem(val id: String, val title: String, val subtitle: String, val vibe: String, val color: String, val posterImage: String?, val tracksCount: Int, val tracks: List<NativeTrack>)
data class PlaylistCardItem(val id: String, val title: String, val subtitle: String, val posterImage: String?, val tracks: List<NativeTrack> = emptyList())
data class CircadianMood(val phaseName: String, val moodTitle: String, val primaryColorHex: Long, val secondaryColorHex: Long, val targetVibe: String)

data class HomeUiState(
    val isLoading: Boolean = true, val isRefreshing: Boolean = false, val isStale: Boolean = false,
    val greeting: String = "Good evening", val userName: String = "Listener", val userAvatar: String? = null, val userEmail: String? = null,
    val selectedFilter: String = "Music", val circadianMood: CircadianMood = CircadianMood("LATE_NIGHT", "Late Night Chill", 0xFF651FFF, 0xFFE91E63, "Calm Lo-Fi & Soul"),
    val featuredThisWeek: List<DailyMixItem> = emptyList(), val playlistsForYou: List<PlaylistCardItem> = emptyList(), val trendingPlaylists: List<PlaylistCardItem> = emptyList(), val hotPlaylists: List<PlaylistCardItem> = emptyList(),
    val basedOnRecents: List<NativeTrack> = emptyList(), val albumsForYou: List<PlaylistCardItem> = emptyList(), val mostLovedArtists: List<Map<String, Any>> = emptyList(), val popularHindiSongs: List<NativeTrack> = emptyList(),
    val stayUpbeat: List<PlaylistCardItem> = emptyList(), val becauseYouFollowTitle: String = "Because You Follow Arijit Singh", val becauseYouFollowArtists: List<Map<String, Any>> = emptyList(),
    val artistSpotlightTitle: String = "", val artistSpotlightTracks: List<NativeTrack> = emptyList(), val newReleases: List<NativeTrack> = emptyList(), val trendingSongs: List<NativeTrack> = emptyList(), val errorMessage: String? = null
)

class HomeViewModel(application: Application) : AndroidViewModel(application) {
    private val secureStorage = SecureAuthStorage.getInstance(application)
    private val repository = HomeFeedRepository(application)
    private val _uiState = MutableStateFlow(HomeUiState())
    val uiState: StateFlow<HomeUiState> = _uiState.asStateFlow()

    init {
        viewModelScope.launch { repository.state.collect { state ->
            when (state) {
                HomeFeedState.Loading -> _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null)
                is HomeFeedState.Success -> applyFeed(state.response, state.stale)
                is HomeFeedState.Error -> _uiState.value = _uiState.value.copy(isLoading = false, isRefreshing = false, errorMessage = state.message)
            }
        } }
        loadHomeData()
    }

    fun selectFilter(filter: String) {
        val mood = calculateCircadianMood()
        val updated = when (filter) { "Podcasts" -> mood.copy(primaryColorHex = 0xFF00B0FF, secondaryColorHex = 0xFF00E5FF); "Energize" -> mood.copy(primaryColorHex = 0xFFFF3D00, secondaryColorHex = 0xFFFF9100); "Relax" -> mood.copy(primaryColorHex = 0xFF8E24AA, secondaryColorHex = 0xFFBA68C8); else -> mood }
        _uiState.value = _uiState.value.copy(selectedFilter = filter, circadianMood = updated)
    }

    fun refreshDashboard() = loadHomeData(true)

    fun loadHomeData(isPullToRefresh: Boolean = false) {
        viewModelScope.launch {
            val current = _uiState.value
            _uiState.value = current.copy(isLoading = current.featuredThisWeek.isEmpty(), isRefreshing = isPullToRefresh, errorMessage = null)
            val profile = secureStorage.getUserProfile()
            val userId = profile?.get("id") as? String
            val region = java.util.Locale.getDefault().country.ifBlank { "IN" }
            repository.load(userId, region, isPullToRefresh)
        }
    }

    private fun applyFeed(response: HomeFeedResponse, stale: Boolean) {
        val sections = response.sections.associateBy { it.id }
        val quick = tracks(sections["quick_picks"]); val mixes = tracks(sections["daily_mixes"]); val viral = tracks(sections["viral_tracks"]); val regional = tracks(sections["regional_charts"]); val worldwide = tracks(sections["worldwide_charts"])
        val profile = secureStorage.getUserProfile(); val preferred = secureStorage.getPreferredName(); val name = preferred?.takeIf { it.isNotBlank() } ?: (profile?.get("name") as? String) ?: "Listener"; val email = profile?.get("email") as? String
        fun playlist(id: String, title: String, list: List<NativeTrack>) = PlaylistCardItem(id, title, list.joinToString(", ") { it.artist }.take(80), list.firstOrNull()?.thumbnail, list)
        fun playlistCards(prefix: String, title: String, list: List<NativeTrack>): List<PlaylistCardItem> =
            list.chunked(6).mapIndexed { index, chunk -> playlist("${prefix}_${index + 1}", "$title ${index + 1}", chunk) }
        val dailyMixItems = mixes.chunked(6).mapIndexed { index, chunk ->
            DailyMixItem("daily_mix_${index + 1}", "Daily Mix ${index + 1}", "Verified picks for you", "Daily mix", "from-purple-900 to-rose-900", chunk.firstOrNull()?.thumbnail, chunk.size, chunk)
        }
        val allTracks = (quick + mixes + viral + regional + worldwide)
            .distinctBy { it.canonicalTrackId ?: it.id }
        val derivedAlbums = allTracks
            .filter { !it.album.isNullOrBlank() }
            .groupBy { it.album!!.trim().lowercase() }
            .values.mapIndexed { index, group ->
                playlist("album_${index + 1}", group.first().album ?: "Album", group)
            }
        val derivedArtists = allTracks.groupBy { it.artist.trim().lowercase() }
            .values.map { group ->
                mapOf<String, Any>("name" to group.first().artist, "image" to (group.first().thumbnail ?: ""))
            }
            .distinctBy { it["name"] }
        _uiState.value = _uiState.value.copy(
            isLoading = false, isRefreshing = false, isStale = stale,
            greeting = calculateCircadianMood().moodTitle, userName = name, userEmail = email,
            circadianMood = calculateCircadianMood(), featuredThisWeek = dailyMixItems,
            playlistsForYou = playlistCards("quick_picks", "Quick Picks", quick),
            trendingPlaylists = playlistCards("regional_charts", "Regional Charts", regional),
            hotPlaylists = playlistCards("viral_tracks", "Hot Playlist", viral),
            basedOnRecents = quick, albumsForYou = derivedAlbums, mostLovedArtists = derivedArtists, popularHindiSongs = regional,
            stayUpbeat = playlistCards("worldwide_charts", "Worldwide Charts", worldwide),
            artistSpotlightTitle = regional.firstOrNull()?.artist ?: "", artistSpotlightTracks = regional,
            becauseYouFollowArtists = derivedArtists,
            newReleases = mixes, trendingSongs = viral
        )
    }

    private fun tracks(section: HomeFeedSectionDto?): List<NativeTrack> = section?.tracks.orEmpty().mapNotNull(::toNativeTrack)

    private fun toNativeTrack(dto: HomeFeedTrackDto): NativeTrack? {
        if (!dto.sourceAvailable || (!dto.canonicalTrackId.startsWith("ytm_") && !dto.canonicalTrackId.startsWith("canonical_"))) return null
        if (dto.title.isBlank() || dto.artist.isBlank() || dto.artworkUrl.isBlank()) return null
        return NativeTrack(id = dto.canonicalTrackId, canonicalTrackId = dto.canonicalTrackId, title = dto.title, artist = dto.artist, album = dto.album, thumbnail = dto.artworkUrl, duration = dto.duration?.toDouble() ?: 0.0, providerTrackId = dto.providerTrackId, provider = dto.provider, streamUrl = "https://mrj-music.duckdns.org/api/music/stream/${android.net.Uri.encode(dto.canonicalTrackId)}")
    }

    private fun calculateCircadianMood(): CircadianMood = when (Calendar.getInstance().get(Calendar.HOUR_OF_DAY)) {
        in 5..11 -> CircadianMood("MORNING", "Morning Awakening", 0xFFFF6D00, 0xFFFFD600, "Fresh Energy & Acoustic Focus")
        in 12..16 -> CircadianMood("AFTERNOON", "Flow & Focus", 0xFF00B0FF, 0xFF00E676, "Melodic Beats & Workday Rhythm")
        in 17..21 -> CircadianMood("EVENING", "Evening Decompression", 0xFFE91E63, 0xFFFF5722, "Party & High-Energy Hits")
        else -> CircadianMood("LATE_NIGHT", "Late Night Chill", 0xFF651FFF, 0xFF3D5AFE, "Calm Lo-Fi & Midnight Soul")
    }
}
