package com.mrj.music.player

import android.content.Context
import android.util.Log
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import com.mrj.music.model.NativeTrack
import java.util.Collections

private const val TAG = "MRJ_ExoPlayerManager"

interface PlayerEventListener {
    fun onPlaybackStateChange(isPlaying: Boolean, isLoading: Boolean)
    fun onTrackChange(track: NativeTrack?)
    fun onPositionChange(positionMs: Long, durationMs: Long)
    fun onQueueChange(queue: List<NativeTrack>, currentIndex: Int)
    fun onError(errorMessage: String)
}

/**
 * METADATA-ONLY player manager.
 *
 * The real audio engine is the WebView — online playback runs through a hidden YouTube
 * IFrame player and offline playback through HTML5 Audio (blob URLs). This class used to
 * be a SECOND, competing ExoPlayer audio engine: notification buttons drove it,
 * [triggerOfflineAutoplay] layered a random download on top of the YouTube audio, and
 * `onPlayerError` fired `playNext()` every 1.5s against a backend URL that returns JSON,
 * not audio bytes — a skip storm plus doubled audio ("everything is disturbed").
 *
 * It is now a pure state holder for the lock-screen / notification surface. It NEVER
 * prepares or starts the ExoPlayer. The retained [player] instance exists only so a
 * Media3 [androidx.media3.session.MediaSession] can be built on it; it is deliberately
 * kept idle with no media items. All transport (play/pause/next/prev/seek) is relayed to
 * the WebView via the plugin's `remoteCommand` event; JS is the single source of truth.
 */
class MRJExoPlayerManager private constructor(private val context: Context) {

    val player: ExoPlayer = ExoPlayer.Builder(context)
        .setAudioAttributes(
            AudioAttributes.Builder()
                .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
                .setUsage(C.USAGE_MEDIA)
                .build(),
            true
        )
        .build()

    private val listeners = mutableListOf<PlayerEventListener>()

    var currentTrack: NativeTrack? = null
        private set
    val queue = mutableListOf<NativeTrack>()
    var queueIndex: Int = 0
        private set
    var isShuffleEnabled: Boolean = false
        private set
    var autoplayEnabled: Boolean = true

    // Last play/pause state pushed from JS (via updateMetadata / setPlaybackState).
    // The notification reads this instead of the idle ExoPlayer's own state.
    var lastKnownPlaying: Boolean = true
        private set

    init {
        // Keep a minimal listener purely for diagnostics. Critically, there is NO
        // auto-skip on error and NO advance on STATE_ENDED — the idle player must never
        // drive playback. These handlers previously caused the skip storm.
        player.addListener(object : Player.Listener {
            override fun onPlayerError(error: PlaybackException) {
                Log.w(TAG, "Idle ExoPlayer reported an error (ignored; metadata-only): " +
                    "${error.errorCode} ${error.message}")
            }
        })
    }

    fun addListener(listener: PlayerEventListener) {
        if (!listeners.contains(listener)) listeners.add(listener)
    }

    fun removeListener(listener: PlayerEventListener) {
        listeners.remove(listener)
    }

    /**
     * Metadata-only. Updates the current track + queue and notifies listeners (the
     * notification service) — but NEVER touches the ExoPlayer. The WebView owns the audio.
     */
    fun playTrack(track: NativeTrack, newQueue: List<NativeTrack>? = null) {
        if (track.id.isBlank()) {
            Log.w(TAG, "playTrack called with blank track ID — ignoring")
            return
        }
        if (newQueue != null && newQueue.isNotEmpty()) {
            queue.clear()
            queue.addAll(newQueue)
            queueIndex = queue.indexOfFirst { it.id == track.id }.coerceAtLeast(0)
        } else if (queue.none { it.id == track.id }) {
            queue.add(track)
            queueIndex = queue.size - 1
        } else {
            queueIndex = queue.indexOfFirst { it.id == track.id }
        }
        currentTrack = track
        lastKnownPlaying = true
        listeners.forEach {
            it.onTrackChange(track)
            it.onQueueChange(queue, queueIndex)
        }
    }

    /**
     * Push a new track's metadata to the notification. Called by the plugin on every
     * JS-driven track change. Does not start any audio.
     */
    fun notifyTrackChange(track: NativeTrack, isPlaying: Boolean) {
        currentTrack = track
        lastKnownPlaying = isPlaying
        listeners.forEach {
            it.onTrackChange(track)
            it.onPlaybackStateChange(isPlaying, false)
        }
    }

    /**
     * Push a play/pause change to the notification without resending full metadata.
     * Called by the plugin's setPlaybackState.
     */
    fun notifyPlaybackState(isPlaying: Boolean) {
        lastKnownPlaying = isPlaying
        listeners.forEach { it.onPlaybackStateChange(isPlaying, false) }
    }

    // ---- Transport methods kept for the plugin surface, but INERT. ----
    // JS never calls these to control audio (it drives the WebView directly); they exist
    // only so the Capacitor plugin's method table stays intact. None of them touch the
    // ExoPlayer, so there is no way to spin up a second audio stream.
    fun pause() { lastKnownPlaying = false }
    fun resume() { lastKnownPlaying = true }
    fun togglePlay() { /* no-op: JS toggles the WebView engine */ }
    fun seekTo(positionMs: Long) { /* no-op: JS seeks the WebView engine */ }
    fun playNext() { /* no-op: JS advances the queue */ }
    fun playPrevious() { /* no-op: JS advances the queue */ }

    fun setShuffle(enabled: Boolean) {
        isShuffleEnabled = enabled
        if (enabled && queue.isNotEmpty()) {
            val current = currentTrack
            Collections.shuffle(queue)
            if (current != null) {
                queue.remove(current)
                queue.add(0, current)
                queueIndex = 0
            }
        }
        listeners.forEach { it.onQueueChange(queue, queueIndex) }
    }

    fun release() {
        try {
            player.release()
        } catch (e: Exception) {
            Log.w(TAG, "release() error: ${e.message}")
        }
    }

    companion object {
        @Volatile
        private var instance: MRJExoPlayerManager? = null

        fun getInstance(context: Context): MRJExoPlayerManager {
            return instance ?: synchronized(this) {
                instance ?: MRJExoPlayerManager(context.applicationContext).also { instance = it }
            }
        }
    }
}
