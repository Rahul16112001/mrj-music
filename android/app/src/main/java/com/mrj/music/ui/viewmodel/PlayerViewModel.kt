package com.mrj.music.ui.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.mrj.music.data.remote.MRJApiClient
import com.mrj.music.model.NativeTrack
import com.mrj.music.player.MRJExoPlayerManager
import com.mrj.music.player.PlayerEventListener
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class LyricLine(
    val timeMs: Long,
    val text: String
)

data class LyricsUiState(
    val isLoading: Boolean = false,
    val syncedLines: List<LyricLine> = emptyList(),
    val plainLyrics: String? = null,
    val isSynced: Boolean = false,
    val errorMessage: String? = null,
    val trackId: String? = null
)

data class PlayerUiState(
    val currentTrack: NativeTrack? = null,
    val isPlaying: Boolean = false,
    val isLoading: Boolean = false,
    val positionMs: Long = 0L,
    val durationMs: Long = 0L,
    val queue: List<NativeTrack> = emptyList(),
    val currentIndex: Int = 0,
    val isShuffle: Boolean = false,
    val isAutoplay: Boolean = true,
    val errorMessage: String? = null
)

class PlayerViewModel(application: Application) : AndroidViewModel(application), PlayerEventListener {

    val playerManager = MRJExoPlayerManager.getInstance(application)
    val favoritesRepo = com.mrj.music.data.repository.FavoritesRepository.getInstance(application)
    private val audioEffectManager = com.mrj.music.audiofx.MRJAudioEffectManager.getInstance(application)

    val equalizerState = audioEffectManager.equalizerState
    private val _dynamicThemeColor = MutableStateFlow<androidx.compose.ui.graphics.Color>(com.mrj.music.ui.theme.CrimsonRed)
    val dynamicThemeColor: StateFlow<androidx.compose.ui.graphics.Color> = _dynamicThemeColor.asStateFlow()

    val likedTrackIds: StateFlow<Set<String>> = favoritesRepo.likedTrackIds

    fun isLiked(trackId: String): Boolean = favoritesRepo.isLiked(trackId)
    fun toggleLike(track: NativeTrack) = favoritesRepo.toggleLike(track)

    private val _uiState = MutableStateFlow(PlayerUiState())
    val uiState: StateFlow<PlayerUiState> = _uiState.asStateFlow()

    private val _lyricsState = MutableStateFlow(LyricsUiState())
    val lyricsState: StateFlow<LyricsUiState> = _lyricsState.asStateFlow()

    private var lyricsJob: Job? = null

    init {
        playerManager.addListener(this)
        _uiState.value = _uiState.value.copy(
            currentTrack = playerManager.currentTrack.value,
            isPlaying = playerManager.isPlaying.value,
            queue = playerManager.queue.toList(),
            currentIndex = playerManager.queueIndex,
            isShuffle = playerManager.isShuffleEnabled,
            isAutoplay = playerManager.autoplayEnabled
        )

        playerManager.currentTrack.value?.let {
            loadLyricsForTrack(it)
            viewModelScope.launch {
                val color = com.mrj.music.ui.theme.PaletteExtractor.extractThemeColor(getApplication(), it.thumbnail)
                _dynamicThemeColor.value = color
            }
        }
    }

    fun getOrCreatePlayerEngineView(context: android.content.Context) = playerManager.getOrCreatePlayerEngineView(context)

    fun playTrack(track: NativeTrack, newQueue: List<NativeTrack>? = null) {
        playerManager.playTrack(track, newQueue)
        loadLyricsForTrack(track)
    }

    fun togglePlayPause() {
        playerManager.togglePlayPause()
    }

    fun playNext() {
        playerManager.playNext()
    }

    fun playPrevious() {
        playerManager.playPrevious()
    }

    fun reorderQueue(fromIndex: Int, toIndex: Int) {
        playerManager.reorderQueue(fromIndex, toIndex)
    }

    fun removeTrackFromQueue(index: Int) {
        playerManager.removeTrackFromQueue(index)
    }

    fun clearQueue() {
        playerManager.clearQueueExceptCurrent()
    }

    fun insertNextInQueue(track: NativeTrack) {
        playerManager.insertNextInQueue(track)
    }

    fun addToQueue(track: NativeTrack) {
        playerManager.addToQueue(track)
    }

    val sleepTimerState: StateFlow<com.mrj.music.player.SleepTimerState> = playerManager.sleepTimerState

    fun startSleepTimer(minutes: Int) {
        playerManager.startSleepTimer(minutes)
    }

    fun startSleepTimerEndOfTrack() {
        playerManager.startSleepTimerEndOfTrack()
    }

    fun cancelSleepTimer() {
        playerManager.cancelSleepTimer()
    }

    fun playTrackAtIndex(index: Int) {
        val q = _uiState.value.queue
        if (index in q.indices) {
            playerManager.playTrack(q[index])
            loadLyricsForTrack(q[index])
        }
    }

    fun seekTo(positionMs: Long) {
        playerManager.seekTo(positionMs)
    }

    fun seekToLyric(timeMs: Long) {
        playerManager.seekTo(timeMs)
    }

    fun loadLyricsForTrack(track: NativeTrack) {
        if (_lyricsState.value.trackId == track.id && (_lyricsState.value.syncedLines.isNotEmpty() || _lyricsState.value.plainLyrics != null)) {
            return
        }

        lyricsJob?.cancel()
        lyricsJob = viewModelScope.launch {
            _lyricsState.value = LyricsUiState(isLoading = true, trackId = track.id)
            try {
                val durSec = (track.duration ?: 210.0).toLong()
                val res = MRJApiClient.apiService.getLyrics(
                    track = track.title.trim(),
                    artist = track.artist.trim(),
                    duration = durSec
                )
                if (res.isSuccessful && res.body() != null) {
                    val body = res.body()!!
                    val syncedRaw = body["syncedLyrics"] as? String
                    val plainRaw = body["plainLyrics"] as? String

                    if (!syncedRaw.isNullOrBlank()) {
                        val parsed = parseLrc(syncedRaw)
                        _lyricsState.value = LyricsUiState(
                            isLoading = false,
                            syncedLines = parsed,
                            plainLyrics = plainRaw,
                            isSynced = true,
                            trackId = track.id
                        )
                    } else if (!plainRaw.isNullOrBlank()) {
                        _lyricsState.value = LyricsUiState(
                            isLoading = false,
                            plainLyrics = plainRaw,
                            isSynced = false,
                            trackId = track.id
                        )
                    } else {
                        _lyricsState.value = LyricsUiState(
                            isLoading = false,
                            errorMessage = "Lyrics not available for this track.",
                            trackId = track.id
                        )
                    }
                } else {
                    _lyricsState.value = LyricsUiState(
                        isLoading = false,
                        errorMessage = "Lyrics not available for this track.",
                        trackId = track.id
                    )
                }
            } catch (e: Exception) {
                _lyricsState.value = LyricsUiState(
                    isLoading = false,
                    errorMessage = "Unable to load lyrics.",
                    trackId = track.id
                )
            }
        }
    }

    private fun parseLrc(lrcText: String): List<LyricLine> {
        val result = mutableListOf<LyricLine>()
        val timeRegex = Regex("""\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)""")

        for (line in lrcText.lines()) {
            val match = timeRegex.find(line.trim())
            if (match != null) {
                val (minStr, secStr, msStr, text) = match.destructured
                val min = minStr.toLongOrNull() ?: 0L
                val sec = secStr.toLongOrNull() ?: 0L
                val msClean = msStr.padEnd(3, '0').take(3)
                val ms = msClean.toLongOrNull() ?: 0L
                val timeMs = min * 60_000L + sec * 1_000L + ms
                val cleanText = text.trim()
                if (cleanText.isNotBlank()) {
                    result.add(LyricLine(timeMs, cleanText))
                }
            }
        }
        return result.sortedBy { it.timeMs }
    }

    fun toggleShuffle() {
        val next = !playerManager.isShuffleEnabled
        playerManager.setShuffle(next)
        _uiState.value = _uiState.value.copy(isShuffle = next, queue = playerManager.queue.toList())
    }

    fun toggleAutoplay() {
        playerManager.toggleAutoplay()
    }

    fun setAutoplay(enabled: Boolean) {
        playerManager.setAutoplay(enabled)
    }

    fun setEqualizerEnabled(enabled: Boolean) = audioEffectManager.setEnabled(enabled)
    fun setEqualizerPreset(preset: String) = audioEffectManager.setPreset(preset)
    fun setEqualizerBandGain(bandIndex: Int, gainDb: Int) = audioEffectManager.setBandGain(bandIndex, gainDb)
    fun setBassBoost(strengthPercent: Int) = audioEffectManager.setBassBoost(strengthPercent)
    fun setVirtualizer(strengthPercent: Int) = audioEffectManager.setVirtualizer(strengthPercent)
    fun resetEqualizer() = audioEffectManager.resetToFlat()

    fun clearError() {
        _uiState.value = _uiState.value.copy(errorMessage = null)
    }

    override fun onPlaybackStateChange(isPlaying: Boolean, isLoading: Boolean) {
        _uiState.value = _uiState.value.copy(isPlaying = isPlaying, isLoading = isLoading)
    }

    override fun onTrackChange(track: NativeTrack?) {
        _uiState.value = _uiState.value.copy(
            currentTrack = track,
            queue = playerManager.queue.toList(),
            currentIndex = playerManager.queueIndex
        )
        if (track != null) {
            loadLyricsForTrack(track)
            viewModelScope.launch {
                val color = com.mrj.music.ui.theme.PaletteExtractor.extractThemeColor(getApplication(), track.thumbnail)
                _dynamicThemeColor.value = color
            }
        }
    }

    override fun onPositionChange(positionMs: Long, durationMs: Long) {
        _uiState.value = _uiState.value.copy(positionMs = positionMs, durationMs = durationMs)
    }

    override fun onQueueChange(queue: List<NativeTrack>, currentIndex: Int) {
        _uiState.value = _uiState.value.copy(queue = queue, currentIndex = currentIndex)
    }

    override fun onAutoplayChange(isAutoplay: Boolean) {
        _uiState.value = _uiState.value.copy(isAutoplay = isAutoplay)
    }

    override fun onError(errorMessage: String) {
        _uiState.value = _uiState.value.copy(errorMessage = errorMessage, isLoading = false)
    }

    override fun onCleared() {
        super.onCleared()
        playerManager.removeListener(this)
    }
}
