package com.mrj.music.player

import android.content.Context
import android.os.Handler
import android.os.Looper
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import com.mrj.music.model.NativeTrack
import com.mrj.music.storage.NativeOfflineStorage
import java.util.Collections

interface PlayerEventListener {
    fun onPlaybackStateChange(isPlaying: Boolean, isLoading: Boolean)
    fun onTrackChange(track: NativeTrack?)
    fun onPositionChange(positionMs: Long, durationMs: Long)
    fun onQueueChange(queue: List<NativeTrack>, currentIndex: Int)
    fun onError(errorMessage: String)
}

class MRJExoPlayerManager(private val context: Context) {
    val player: ExoPlayer = ExoPlayer.Builder(context)
        .setAudioAttributes(
            AudioAttributes.Builder()
                .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
                .setUsage(C.USAGE_MEDIA)
                .build(),
            true // Handle Audio Focus automatically (ducking, pause on phone calls)
        )
        .setHandleAudioBecomingNoisy(true) // Pause on headphone disconnect
        .setWakeMode(C.WAKE_MODE_NETWORK) // Prevent CPU sleep during background audio
        .build()

    private val offlineStorage = NativeOfflineStorage.getInstance(context)
    private val listeners = mutableListOf<PlayerEventListener>()

    var currentTrack: NativeTrack? = null
        private set
    val queue = mutableListOf<NativeTrack>()
    var queueIndex: Int = 0
        private set
    var isShuffleEnabled: Boolean = false
        private set
    var autoplayEnabled: Boolean = true

    private val handler = Handler(Looper.getMainLooper())
    private val positionPollRunnable = object : Runnable {
        override fun run() {
            if (player.isPlaying) {
                val pos = player.currentPosition
                val dur = if (player.duration > 0) player.duration else (currentTrack?.duration?.times(1000)?.toLong() ?: 0L)
                listeners.forEach { it.onPositionChange(pos, dur) }
            }
            handler.postDelayed(this, 1000)
        }
    }

    init {
        player.addListener(object : Player.Listener {
            override fun onPlaybackStateChanged(playbackState: Int) {
                val isBuffering = playbackState == Player.STATE_BUFFERING
                val isPlaying = player.isPlaying
                listeners.forEach { it.onPlaybackStateChange(isPlaying, isBuffering) }

                if (playbackState == Player.STATE_ENDED) {
                    handleTrackEnded()
                }
            }

            override fun onIsPlayingChanged(isPlaying: Boolean) {
                listeners.forEach { it.onPlaybackStateChange(isPlaying, false) }
                if (isPlaying) {
                    handler.post(positionPollRunnable)
                }
            }

            override fun onPlayerError(error: PlaybackException) {
                error.printStackTrace()
                listeners.forEach { it.onError(error.localizedMessage ?: "Playback error") }
                // Try recovery or next track
                if (autoplayEnabled) {
                    playNext()
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

        // Check if track is available offline
        val storedTrack = offlineStorage.getTrack(track.id) ?: offlineStorage.getTrack(track.canonicalTrackId ?: "")
        val trackToPlay = if (storedTrack != null && offlineStorage.isTrackDownloaded(storedTrack.id)) {
            storedTrack
        } else {
            track
        }

        currentTrack = trackToPlay
        val mediaItem = trackToPlay.toMediaItem()

        player.setMediaItem(mediaItem)
        player.prepare()
        player.play()

        listeners.forEach {
            it.onTrackChange(trackToPlay)
            it.onQueueChange(queue, queueIndex)
        }
    }

    fun pause() {
        player.pause()
    }

    fun resume() {
        val curr = currentTrack
        if (player.playbackState == Player.STATE_IDLE && curr != null) {
            playTrack(curr)
        } else {
            player.play()
        }
    }

    fun togglePlay() {
        if (player.isPlaying) {
            pause()
        } else {
            resume()
        }
    }

    fun seekTo(positionMs: Long) {
        player.seekTo(positionMs)
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
    }

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

    private fun handleTrackEnded() {
        playNext()
    }

    private fun triggerOfflineAutoplay() {
        val downloads = offlineStorage.getAllDownloadedTracks()
        if (downloads.isEmpty()) return

        val candidates = downloads.filter { it.id != currentTrack?.id }
        if (candidates.isNotEmpty()) {
            val nextTrack = candidates.random()
            queue.add(nextTrack)
            queueIndex = queue.size - 1
            playTrack(nextTrack)
        }
    }

    fun release() {
        handler.removeCallbacks(positionPollRunnable)
        player.release()
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
