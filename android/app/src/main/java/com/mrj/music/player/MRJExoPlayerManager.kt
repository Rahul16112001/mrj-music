package com.mrj.music.player

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.util.Log
import androidx.compose.runtime.mutableStateOf
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import com.mrj.music.model.NativeTrack
import com.mrj.music.storage.NativeOfflineStorage
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import java.util.Collections

private const val TAG = "MRJ_ExoPlayerManager"

interface PlayerEventListener {
    fun onPlaybackStateChange(isPlaying: Boolean, isLoading: Boolean)
    fun onTrackChange(track: NativeTrack?)
    fun onPositionChange(positionMs: Long, durationMs: Long)
    fun onQueueChange(queue: List<NativeTrack>, currentIndex: Int)
    fun onError(errorMessage: String)
}

import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class MRJExoPlayerManager @Inject constructor(private val context: Context) {

    val player: ExoPlayer = ExoPlayer.Builder(context)
        .setAudioAttributes(
            AudioAttributes.Builder()
                .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
                .setUsage(C.USAGE_MEDIA)
                .build(),
            true // Handle Audio Focus automatically
        )
        .setHandleAudioBecomingNoisy(true) // Pause on headphone disconnect
        .setWakeMode(C.WAKE_MODE_NETWORK) // Prevent CPU sleep during background audio
        .build()

    private val offlineStorage = NativeOfflineStorage.getInstance(context)
    private val listeners = mutableListOf<PlayerEventListener>()
    private val mainHandler = Handler(Looper.getMainLooper())

    private val _currentTrack = MutableStateFlow<NativeTrack?>(null)
    val currentTrack: StateFlow<NativeTrack?> = _currentTrack

    private val _isPlaying = MutableStateFlow(false)
    val isPlaying: StateFlow<Boolean> = _isPlaying

    private val _position = MutableStateFlow(0L)
    private val _duration = MutableStateFlow(0L)
    val positionFlow: StateFlow<Pair<Long, Long>> = _position.combine(_duration) { pos, dur -> pos to dur }

    val queue = mutableListOf<NativeTrack>()
    var queueIndex: Int = 0
        private set
    var isShuffleEnabled: Boolean = false
        private set
    var autoplayEnabled: Boolean = true

    private val positionPollRunnable = object : Runnable {
        override fun run() {
            try {
                if (player.isPlaying) {
                    val pos = player.currentPosition
                    val dur = if (player.duration > 0) player.duration
                              else ((_currentTrack.value?.duration ?: 0.0) * 1000).toLong()
                    _position.value = pos
                    _duration.value = dur
                    listeners.forEach { it.onPositionChange(pos, dur) }
                }
            } catch (e: Exception) {
                Log.w(TAG, "Position poll error: ${e.message}")
            }
            mainHandler.postDelayed(this, 1000)
        }
    }

    init {
        player.addListener(object : Player.Listener {
            override fun onPlaybackStateChanged(playbackState: Int) {
                val isBuffering = playbackState == Player.STATE_BUFFERING
                val isPlaying = player.isPlaying
                listeners.forEach { it.onPlaybackStateChange(isPlaying, isBuffering) }

                if (playbackState == Player.STATE_ENDED) {
                    Log.d(TAG, "Track ended, advancing to next")
                    handleTrackEnded()
                }
            }

            override fun onIsPlayingChanged(isPlaying: Boolean) {
                listeners.forEach { it.onPlaybackStateChange(isPlaying, false) }
                if (isPlaying) {
                    mainHandler.post(positionPollRunnable)
                }
            }

            override fun onPlayerError(error: PlaybackException) {
                Log.e(TAG, "ExoPlayer error: ${error.message}, code: ${error.errorCode}", error)
                val msg = when (error.errorCode) {
                    PlaybackException.ERROR_CODE_IO_NETWORK_CONNECTION_FAILED ->
                        "Network connection failed. Check your internet connection."
                    PlaybackException.ERROR_CODE_IO_BAD_HTTP_STATUS ->
                        "Stream unavailable (HTTP error). Try another song."
                    PlaybackException.ERROR_CODE_PARSING_CONTAINER_UNSUPPORTED ->
                        "Audio format not supported on this device."
                    PlaybackException.ERROR_CODE_IO_NO_PERMISSION ->
                        "Permission denied reading audio file."
                    else -> "Playback error (${error.errorCode}): ${error.localizedMessage ?: "Unknown error"}"
                }
                listeners.forEach { it.onError(msg) }

                // Auto-recover: try next track after error
                if (autoplayEnabled) {
                    mainHandler.postDelayed({ playNext() }, 1500)
                }
            }
        })
    }

    fun addListener(listener: PlayerEventListener) {
        if (!listeners.contains(listener)) listeners.add(listener)
    }

    fun removeListener(listener: PlayerEventListener) {
        listeners.remove(listener)
    }

    fun playTrack(track: NativeTrack, newQueue: List<NativeTrack>? = null) {
        // Input validation
        if (track.id.isBlank()) {
            Log.e(TAG, "playTrack called with blank track ID — ignoring")
            listeners.forEach { it.onError("Invalid track: missing ID") }
            return
        }

        try {
            if (newQueue != null && newQueue.isNotEmpty()) {
                queue.clear()
                queue.addAll(newQueue)
                queueIndex = queue.indexOfFirst { it.id == track.id }.coerceAtLeast(0)
            } else if (!queue.any { it.id == track.id }) {
                queue.add(track)
                queueIndex = queue.size - 1
            } else {
                queueIndex = queue.indexOfFirst { it.id == track.id }
            }

            // Prefer offline if available
            val offlineTrack = try {
                offlineStorage.getTrack(track.id)
                    ?: offlineStorage.getTrack(track.canonicalTrackId ?: "")
            } catch (e: Exception) {
                Log.w(TAG, "Offline storage lookup failed: ${e.message}")
                null
            }

            val trackToPlay = if (offlineTrack != null && offlineStorage.isTrackDownloaded(offlineTrack.id)) {
                Log.d(TAG, "Playing from offline vault: ${offlineTrack.title}")
                offlineTrack
            } else {
                track
            }

            _currentTrack.value = trackToPlay

            // Build MediaItem safely — this will never produce an empty URI
            val mediaItem = try {
                trackToPlay.toMediaItem()
            } catch (e: Exception) {
                Log.e(TAG, "Failed to build MediaItem for: ${trackToPlay.title} — ${e.message}")
                listeners.forEach { it.onError("Failed to prepare track: ${e.message}") }
                return
            }

            Log.d(TAG, "ExoPlayer: setMediaItem -> ${trackToPlay.title} | uri: ${mediaItem.localConfiguration?.uri}")

            // Reset and play
            player.stop()
            player.clearMediaItems()
            player.setMediaItem(mediaItem)
            player.prepare()
            player.play()

            listeners.forEach {
                it.onTrackChange(trackToPlay)
                it.onQueueChange(queue, queueIndex)
            }

        } catch (e: Exception) {
            Log.e(TAG, "playTrack exception: ${e.message}", e)
            listeners.forEach { it.onError("Playback failed: ${e.message ?: "Unknown error"}") }
        }
    }

    fun pause() {
        try { player.pause() } catch (e: Exception) { Log.w(TAG, "pause() error: ${e.message}") }
    }

    fun resume() {
        try {
            val curr = _currentTrack.value
            if (player.playbackState == Player.STATE_IDLE && curr != null) {
                playTrack(curr)
            } else {
                player.play()
            }
        } catch (e: Exception) {
            Log.w(TAG, "resume() error: ${e.message}")
        }
    }

    fun togglePlay() {
        if (player.isPlaying) pause() else resume()
    }

    fun notifyTrackChange(track: NativeTrack, isPlaying: Boolean) {
        _currentTrack.value = track
        listeners.forEach {
            it.onTrackChange(track)
            it.onPlaybackStateChange(isPlaying, false)
        }
    }

    fun seekTo(positionMs: Long) {
        try { player.seekTo(positionMs) } catch (e: Exception) { Log.w(TAG, "seekTo() error: ${e.message}") }
    }

    fun playNext() {
        if (queue.isEmpty()) {
            triggerOfflineAutoplay()
            return
        }
        if (queueIndex < queue.size - 1) {
            queueIndex++
            playTrack(queue[queueIndex])
        } else if (autoplayEnabled) {
            triggerOfflineAutoplay()
        }
    }

    fun playPrevious() {
        try {
            if (player.currentPosition > 3000) {
                player.seekTo(0)
                return
            }
            if (queueIndex > 0) {
                queueIndex--
                playTrack(queue[queueIndex])
            } else {
                player.seekTo(0)
            }
        } catch (e: Exception) {
            Log.w(TAG, "playPrevious() error: ${e.message}")
        }
    }

    fun setShuffle(enabled: Boolean) {
        isShuffleEnabled = enabled
        if (enabled && queue.isNotEmpty()) {
            val current = _currentTrack.value
            Collections.shuffle(queue)
            if (current != null) {
                queue.remove(current)
                queue.add(0, current)
                queueIndex = 0
            }
        }
        listeners.forEach { it.onQueueChange(queue, queueIndex) }
    }

    private fun handleTrackEnded() {
        playNext()
    }

    private fun triggerOfflineAutoplay() {
        try {
            val downloads = offlineStorage.getAllDownloadedTracks()
            if (downloads.isEmpty()) return
            val candidates = downloads.filter { it.id != _currentTrack.value?.id }
            if (candidates.isNotEmpty()) {
                val nextTrack = candidates.random()
                queue.add(nextTrack)
                queueIndex = queue.size - 1
                playTrack(nextTrack)
            }
        } catch (e: Exception) {
            Log.w(TAG, "triggerOfflineAutoplay() error: ${e.message}")
        }
    }

    fun release() {
        try {
            mainHandler.removeCallbacks(positionPollRunnable)
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
