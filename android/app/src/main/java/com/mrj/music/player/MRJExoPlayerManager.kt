package com.mrj.music.player

import android.content.Context
import androidx.media3.exoplayer.ExoPlayer
import com.mrj.music.model.NativeTrack
import kotlinx.coroutines.flow.StateFlow

data class SleepTimerState(
    val isActive: Boolean = false,
    val remainingSeconds: Long = 0L,
    val initialDurationMinutes: Int = 0,
    val isEndOfTrack: Boolean = false
)

interface PlayerEventListener {
    fun onPlaybackStateChange(isPlaying: Boolean, isLoading: Boolean)
    fun onTrackChange(track: NativeTrack?)
    fun onPositionChange(positionMs: Long, durationMs: Long)
    fun onQueueChange(queue: List<NativeTrack>, currentIndex: Int)
    fun onError(errorMessage: String)
    fun onAutoplayChange(isAutoplay: Boolean) {}
}

/**
 * Temporary source-compatible facade. New Android code must use
 * UnifiedPlayerManager directly; this class contains no playback engine.
 */
@Deprecated("Use UnifiedPlayerManager")
class MRJExoPlayerManager private constructor(context: Context) {
    private val delegate = UnifiedPlayerManager.getInstance(context)

    companion object {
        fun getInstance(context: Context): MRJExoPlayerManager = MRJExoPlayerManager(context.applicationContext)
    }

    val player: ExoPlayer get() = delegate.player
    val currentTrack: StateFlow<NativeTrack?> get() = delegate.currentTrack
    val isPlaying: StateFlow<Boolean> get() = delegate.isPlaying
    val sleepTimerState: StateFlow<SleepTimerState> get() = delegate.sleepTimerState
    val queue: List<NativeTrack> get() = delegate.queue
    val queueIndex: Int get() = delegate.queueIndex
    val isShuffleEnabled: Boolean get() = delegate.isShuffleEnabled
    val autoplayEnabled: Boolean get() = delegate.autoplayEnabled

    fun addListener(listener: PlayerEventListener) = delegate.addListener(listener)
    fun removeListener(listener: PlayerEventListener) = delegate.removeListener(listener)
    fun playTrack(track: NativeTrack, newQueue: List<NativeTrack>? = null) = delegate.playTrack(track, newQueue)
    fun pause() = delegate.pause()
    fun resume() = delegate.resume()
    fun togglePlay() = delegate.togglePlay()
    fun togglePlayPause() = delegate.togglePlayPause()
    fun playNext(isUserInitiated: Boolean = true) = delegate.playNext(isUserInitiated)
    fun playPrevious() = delegate.playPrevious()
    fun seekTo(positionMs: Long) = delegate.seekTo(positionMs)
    fun setShuffle(enabled: Boolean) = delegate.setShuffle(enabled)
    fun toggleShuffle() = delegate.toggleShuffle()
    fun setAutoplay(enabled: Boolean) = delegate.setAutoplay(enabled)
    fun toggleAutoplay() = delegate.toggleAutoplay()
    fun addToQueue(track: NativeTrack) = delegate.addToQueue(track)
    fun insertNextInQueue(track: NativeTrack) = delegate.insertNextInQueue(track)
    fun removeTrackFromQueue(index: Int) = delegate.removeTrackFromQueue(index)
    fun reorderQueue(fromIndex: Int, toIndex: Int) = delegate.reorderQueue(fromIndex, toIndex)
    fun clearQueueExceptCurrent() = delegate.clearQueueExceptCurrent()
    fun fetchDynamicAutoplayQueue(track: NativeTrack, autoPlayNextIfWaiting: Boolean = false) = delegate.fetchDynamicAutoplayQueue(track, autoPlayNextIfWaiting)
    fun startSleepTimer(minutes: Int) = delegate.startSleepTimer(minutes)
    fun startSleepTimerEndOfTrack() = delegate.startSleepTimerEndOfTrack()
    fun cancelSleepTimer() = delegate.cancelSleepTimer()
    fun release() = delegate.release()
}
