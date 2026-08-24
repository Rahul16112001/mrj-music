package com.mrj.music.domain.model

data class User(
    val id: String,
    val name: String,
    val email: String,
    val createdAt: Long
)

data class Track(
    val id: String,
    val title: String,
    val artist: String,
    val album: String? = null,
    val thumbnail: String? = null,
    val duration: Double = 0.0,
    val genre: String? = null,
    val canonicalTrackId: String? = null,
    val providerTrackId: String? = null,
    val playbackFormat: String = "audio",
    val isOfficialMusic: Boolean = false,
    val isMusicVideo: Boolean = false,
    val isLive: Boolean = false,
    val isLyricsVideo: Boolean = false,
    val isSlowed: Boolean = false,
    val isRemix: Boolean = false,
    val isCover: Boolean = false,
    val isShort: Boolean = false,
    val isReaction: Boolean = false,
    val isCompilation: Boolean = false,
    val isPodcast: Boolean = false,
    val releaseYear: String? = null,
    val artistId: String? = null,
    val albumId: String? = null,
    val views: String? = null,
    val sourceType: String? = null,
    val provider: String? = null,
    val musicScore: Double? = null,
    val videoScore: Double? = null,
    val recommendationReason: String? = null,
    val isOffline: Boolean = false,
    val downloadedAt: Long? = null,
    val fileSize: Long? = null,
    val quality: String? = null,
    val bitrate: String? = null,
    val downloadType: String? = null,
    val priorityScore: Double? = null,
    val downloadCategory: String? = null,
    val offlineEligible: Boolean? = null,
    val lastPlayedAt: Long? = null
)

data class Artist(
    val id: String,
    val name: String,
    val thumbnail: String? = null,
    val subscribers: String? = null,
    val monthlyListeners: String? = null,
    val bio: String? = null,
    val topSongs: List<Track> = emptyList(),
    val albums: List<Album> = emptyList(),
    val singles: List<Track> = emptyList(),
    val relatedArtists: List<RelatedArtist> = emptyList()
)

data class Album(
    val id: String,
    val title: String,
    val artist: String,
    val artistId: String? = null,
    val thumbnail: String? = null,
    val year: String? = null,
    val trackCount: Int = 0,
    val totalDuration: Int? = null,
    val tracks: List<Track> = emptyList()
)

data class Playlist(
    val id: String,
    val userId: String? = null,
    val title: String,
    val description: String? = null,
    val thumbnail: String? = null,
    val trackCount: Int = 0,
    val tracks: List<Track> = emptyList(),
    val createdAt: Long = 0,
    val updatedAt: Long = 0,
    val isCustom: Boolean = true
)

data class RelatedArtist(
    val id: String,
    val name: String,
    val thumbnail: String? = null,
    val listeners: String? = null
)

data class LyricData(
    val syncedLyrics: String? = null,
    val plainLyrics: String? = null,
    val isSynced: Boolean = false
)

data class MoodStation(
    val id: String,
    val name: String,
    val color: String,
    val count: String,
    val icon: String? = null
)

data class SearchResult(
    val query: String,
    val intent: String? = null,
    val songs: List<Track> = emptyList(),
    val videos: List<Track> = emptyList(),
    val artists: List<Artist> = emptyList(),
    val albums: List<Album> = emptyList(),
    val podcasts: List<Track> = emptyList(),
    val results: List<Track> = emptyList()
)

data class HomeData(
    val greeting: String? = null,
    val timeOfDay: TimeOfDay? = null,
    val quickPicks: List<Track> = emptyList(),
    val dailyMixes: List<DailyMix> = emptyList(),
    val listenAgain: List<Track> = emptyList(),
    val onRepeat: OnRepeat? = null,
    val recommendedForYou: List<Track> = emptyList(),
    val becauseYouLike: BecauseYouLike? = null,
    val discovery: Discovery? = null,
    val charts: Charts? = null,
    val moods: List<MoodStation> = emptyList()
)

data class TimeOfDay(
    val sectionTitle: String,
    val tracks: List<Track> = emptyList()
)

data class DailyMix(
    val id: String,
    val title: String,
    val description: String,
    val tracks: List<Track> = emptyList()
)

data class OnRepeat(
    val songs: List<Track> = emptyList(),
    val artists: List<ArtistSummary> = emptyList()
)

data class ArtistSummary(
    val name: String,
    val thumbnail: String
)

data class BecauseYouLike(
    val type: String,
    val title: String,
    val artist: String,
    val tracks: List<Track> = emptyList()
)

data class Discovery(
    val newReleases: List<Track> = emptyList(),
    val topArtists: List<Artist> = emptyList()
)

data class Charts(
    val trendingRegional: List<Track> = emptyList(),
    val trendingWorldwide: List<Track> = emptyList(),
    val topSongs: List<Track> = emptyList(),
    val topArtists: List<Artist> = emptyList(),
    val region: String,
    val updatedAt: Long
)

data class AuthRequest(
    val email: String,
    val password: String
)

data class RegisterRequest(
    val name: String,
    val email: String,
    val password: String,
    val ageGroup: String? = null,
    val gender: String? = null
)

data class AuthResponse(
    val user: User,
    val token: String,
    val refreshToken: String
)

data class UpdateInfo(
    val isUpdateAvailable: Boolean = false,
    val latestVersion: String = "",
    val versionCode: Int = 0,
    val downloadUrl: String = "",
    val releaseNotes: List<String> = emptyList(),
    val isMandatory: Boolean = false,
    val fileSize: String = "",
    val fileSizeBytes: Long = 0
)
