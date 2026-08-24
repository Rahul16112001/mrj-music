package com.mrj.music.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.mrj.music.data.repository.MusicRepository
import com.mrj.music.domain.model.*
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class HomeState(
    val isLoading: Boolean = false,
    val greeting: String? = null,
    val quickPicks: List<Track> = emptyList(),
    val dailyMixes: List<DailyMix> = emptyList(),
    val listenAgain: List<Track> = emptyList(),
    val onRepeatSongs: List<Track> = emptyList(),
    val onRepeatArtists: List<ArtistSummary> = emptyList(),
    val recommendedForYou: List<Track> = emptyList(),
    val becauseYouLike: BecauseYouLike? = null,
    val discovery: Discovery? = null,
    val charts: Charts? = null,
    val moods: List<MoodStation> = emptyList(),
    val error: String? = null
)

@HiltViewModel
class HomeViewModel @Inject constructor(
    private val musicRepository: MusicRepository
) : ViewModel() {

    private val _state = MutableStateFlow(HomeState())
    val state: StateFlow<HomeState> = _state.asStateFlow()

    init {
        loadHome()
    }

    fun loadHome() {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, error = null)
            val result = musicRepository.getHome()
            _state.value = if (result.isSuccess) {
                val data = result.getOrNull()!!
                val personalized = data["personalized"] as? Map<String, Any> ?: emptyMap()
                val discovery = data["discovery"] as? Map<String, Any> ?: emptyMap()
                val charts = data["charts"] as? Map<String, Any> ?: emptyMap()
                val moods = (data["moods"] as? List<Map<String, Any>>)?.map { mood ->
                    MoodStation(
                        id = mood["id"] as? String ?: "",
                        name = mood["name"] as? String ?: "",
                        color = mood["color"] as? String ?: "#FF0000",
                        count = mood["count"] as? String ?: "",
                        icon = mood["icon"] as? String
                    )
                } ?: emptyList()

                val timeOfDay = personalized["timeOfDay"] as? Map<String, Any> ?: emptyMap()

                HomeState(
                    isLoading = false,
                    greeting = personalized["greeting"] as? String,
                    quickPicks = (personalized["quickPicks"] as? List<Map<String, Any>>)?.map { map ->
                        Track(
                            id = map["id"] as? String ?: "",
                            title = map["title"] as? String ?: "",
                            artist = map["artist"] as? String ?: "",
                            album = map["album"] as? String,
                            thumbnail = map["thumbnail"] as? String,
                            duration = (map["duration"] as? Number)?.toDouble() ?: 0.0,
                            genre = map["genre"] as? String,
                            canonicalTrackId = map["canonicalTrackId"] as? String,
                            providerTrackId = map["providerTrackId"] as? String,
                            playbackFormat = map["playbackFormat"] as? String ?: "audio"
                        )
                    } ?: emptyList(),
                    dailyMixes = (personalized["dailyMixes"] as? List<Map<String, Any>>)?.map { mix ->
                        DailyMix(
                            id = mix["id"] as? String ?: "",
                            title = mix["title"] as? String ?: "",
                            description = mix["description"] as? String ?: "",
                            tracks = (mix["tracks"] as? List<Map<String, Any>>)?.map { track ->
                                Track(
                                    id = track["id"] as? String ?: "",
                                    title = track["title"] as? String ?: "",
                                    artist = track["artist"] as? String ?: "",
                                    thumbnail = track["thumbnail"] as? String,
                                    duration = (track["duration"] as? Number)?.toDouble() ?: 0.0
                                )
                            } ?: emptyList()
                        )
                    } ?: emptyList(),
                    listenAgain = (personalized["listenAgain"] as? List<Map<String, Any>>)?.map { track ->
                        Track(
                            id = track["id"] as? String ?: "",
                            title = track["title"] as? String ?: "",
                            artist = track["artist"] as? String ?: "",
                            thumbnail = track["thumbnail"] as? String,
                            duration = (track["duration"] as? Number)?.toDouble() ?: 0.0
                        )
                    } ?: emptyList(),
                    onRepeatSongs = ((personalized["onRepeat"] as? Map<String, Any>)?.get("songs") as? List<Map<String, Any>>)?.map { track ->
                        Track(
                            id = track["id"] as? String ?: "",
                            title = track["title"] as? String ?: "",
                            artist = track["artist"] as? String ?: "",
                            thumbnail = track["thumbnail"] as? String,
                            duration = (track["duration"] as? Number)?.toDouble() ?: 0.0
                        )
                    } ?: emptyList(),
                    onRepeatArtists = ((personalized["onRepeat"] as? Map<String, Any>)?.get("artists") as? List<Map<String, Any>>)?.map { artist ->
                        ArtistSummary(
                            name = artist["name"] as? String ?: "",
                            thumbnail = artist["thumbnail"] as? String ?: ""
                        )
                    } ?: emptyList(),
                    recommendedForYou = (personalized["recommendedForYou"] as? List<Map<String, Any>>)?.map { track ->
                        Track(
                            id = track["id"] as? String ?: "",
                            title = track["title"] as? String ?: "",
                            artist = track["artist"] as? String ?: "",
                            thumbnail = track["thumbnail"] as? String,
                            duration = (track["duration"] as? Number)?.toDouble() ?: 0.0
                        )
                    } ?: emptyList(),
                    becauseYouLike = (personalized["becauseYouLike"] as? Map<String, Any>)?.let { byl ->
                        BecauseYouLike(
                            type = byl["type"] as? String ?: "artist",
                            title = byl["title"] as? String ?: "",
                            artist = byl["artist"] as? String ?: "",
                            tracks = (byl["tracks"] as? List<Map<String, Any>>)?.map { track ->
                                Track(
                                    id = track["id"] as? String ?: "",
                                    title = track["title"] as? String ?: "",
                                    artist = track["artist"] as? String ?: "",
                                    thumbnail = track["thumbnail"] as? String,
                                    duration = (track["duration"] as? Number)?.toDouble() ?: 0.0
                                )
                            } ?: emptyList()
                        )
                    },
                    discovery = Discovery(
                        newReleases = (discovery["newReleases"] as? List<Map<String, Any>>)?.map { track ->
                            Track(
                                id = track["id"] as? String ?: "",
                                title = track["title"] as? String ?: "",
                                artist = track["artist"] as? String ?: "",
                                thumbnail = track["thumbnail"] as? String,
                                duration = (track["duration"] as? Number)?.toDouble() ?: 0.0
                            )
                        } ?: emptyList(),
                        topArtists = (discovery["topArtists"] as? List<Map<String, Any>>)?.map { artist ->
                            ArtistSummary(
                                name = artist["name"] as? String ?: "",
                                thumbnail = artist["thumbnail"] as? String ?: ""
                            )
                        } ?: emptyList()
                    ),
                    charts = Charts(
                        trendingRegional = (charts["trendingRegional"] as? List<Map<String, Any>>)?.map { track ->
                            Track(
                                id = track["id"] as? String ?: "",
                                title = track["title"] as? String ?: "",
                                artist = track["artist"] as? String ?: "",
                                thumbnail = track["thumbnail"] as? String,
                                duration = (track["duration"] as? Number)?.toDouble() ?: 0.0
                            )
                        } ?: emptyList(),
                        trendingWorldwide = (charts["trendingWorldwide"] as? List<Map<String, Any>>)?.map { track ->
                            Track(
                                id = track["id"] as? String ?: "",
                                title = track["title"] as? String ?: "",
                                artist = track["artist"] as? String ?: "",
                                thumbnail = track["thumbnail"] as? String,
                                duration = (track["duration"] as? Number)?.toDouble() ?: 0.0
                            )
                        } ?: emptyList(),
                        topSongs = (charts["topSongs"] as? List<Map<String, Any>>)?.map { track ->
                            Track(
                                id = track["id"] as? String ?: "",
                                title = track["title"] as? String ?: "",
                                artist = track["artist"] as? String ?: "",
                                thumbnail = track["thumbnail"] as? String,
                                duration = (track["duration"] as? Number)?.toDouble() ?: 0.0
                            )
                        } ?: emptyList(),
                        topArtists = emptyList(),
                        region = charts["region"] as? String ?: "GLOBAL",
                        updatedAt = (charts["updatedAt"] as? Number)?.toLong() ?: System.currentTimeMillis()
                    ),
                    moods = moods
                )
            } else {
                HomeState(isLoading = false, error = result.exceptionOrNull()?.message ?: "Failed to load home")
            }
        }
    }
}
