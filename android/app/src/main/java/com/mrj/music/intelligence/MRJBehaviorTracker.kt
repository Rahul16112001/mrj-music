package com.mrj.music.intelligence

import android.content.Context
import android.util.Log
import com.mrj.music.data.security.SecureAuthStorage
import com.mrj.music.data.remote.MRJApiClient
import com.mrj.music.model.NativeTrack
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import java.util.Collections
import java.util.UUID

/**
 * Tracks real-time granular listening telemetry and behavioral interactions.
 * Ingests events locally and flushes to the backend ML Intelligence Engine.
 */
class MRJBehaviorTracker private constructor(context: Context) {

    private val appContext = context.applicationContext
    private val secureStorage = SecureAuthStorage.getInstance(appContext)
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val eventBuffer = Collections.synchronizedList(mutableListOf<Map<String, Any?>>())

    private var currentTrackId: String? = null
    private var currentTrackStartTime: Long = 0L
    private var hasFired50Percent = false
    private var hasFired25Percent = false
    private var hasFired75Percent = false
    private var hasFiredCompleted = false

    companion object {
        private const val TAG = "MRJBehaviorTracker"
        private const val FLUSH_THRESHOLD = 5

        @Volatile
        private var instance: MRJBehaviorTracker? = null

        fun getInstance(context: Context): MRJBehaviorTracker {
            return instance ?: synchronized(this) {
                instance ?: MRJBehaviorTracker(context).also { instance = it }
            }
        }
    }

    fun onTrackStarted(track: NativeTrack) {
        currentTrackId = track.id
        currentTrackStartTime = System.currentTimeMillis()
        hasFired50Percent = false
        hasFired25Percent = false
        hasFired75Percent = false
        hasFiredCompleted = false

        recordEvent(
            eventType = "PLAY_STARTED",
            track = track,
            listenedSeconds = 0,
            completionPercent = 0
        )
    }

    fun onProgress(track: NativeTrack, currentMs: Long, durationMs: Long) {
        if (track.id != currentTrackId || durationMs <= 0) return

        val percent = (currentMs.toDouble() / durationMs.toDouble()) * 100.0
        val listenedSec = (currentMs / 1000).toInt()

        if (percent >= 25.0 && !hasFired25Percent) {
            hasFired25Percent = true
            recordEvent("PLAY_25", track, listenedSec, percent.toInt())
        }
        if (percent >= 50.0 && !hasFired50Percent) {
            hasFired50Percent = true
            recordEvent(
                eventType = "PLAY_50",
                track = track,
                listenedSeconds = listenedSec,
                completionPercent = percent.toInt()
            )
        }

        if (percent >= 75.0 && !hasFired75Percent) {
            hasFired75Percent = true
            recordEvent("PLAY_75", track, listenedSec, percent.toInt())
        }

        if (percent >= 90.0 && !hasFiredCompleted) {
            hasFiredCompleted = true
            recordEvent(
                eventType = "PLAY_COMPLETED",
                track = track,
                listenedSeconds = listenedSec,
                completionPercent = 100
            )
        }
    }

    fun onTrackSkipped(track: NativeTrack, playedSeconds: Int) {
        val eventType = if (playedSeconds < 15) "SKIP_EARLY" else "SKIP_LATE"
        val percent = if (track.duration > 0) ((playedSeconds.toDouble() / track.duration) * 100.0).toInt() else 0

        recordEvent(
            eventType = eventType,
            track = track,
            listenedSeconds = playedSeconds,
            completionPercent = percent,
            skipped = true
        )
    }

    fun onTrackLiked(track: NativeTrack) {
        recordEvent(
            eventType = "LIKE",
            track = track,
            listenedSeconds = 0,
            completionPercent = 0
        )
    }

    fun onTrackRepeated(track: NativeTrack) {
        recordEvent(
            eventType = "REPEAT",
            track = track,
            listenedSeconds = 0,
            completionPercent = 100
        )
    }

    fun onStreamFailure(track: NativeTrack, reason: String?) {
        recordEvent("STREAM_FAILURE", track, 0, 0)
        Log.w(TAG, "Stream failure for '${track.title}': ${reason ?: "unknown"}")
    }

    fun onProviderUsed(track: NativeTrack, provider: String?) {
        recordEvent("PROVIDER_USED", track, 0, 0)
        Log.d(TAG, "Provider used for '${track.title}': ${provider ?: "unknown"}")
    }

    fun onBufferingStarted(track: NativeTrack) = recordEvent("BUFFERING_STARTED", track, 0, 0)

    fun onBufferingEnded(track: NativeTrack, durationMs: Long) = recordEvent("BUFFERING_ENDED", track, (durationMs / 1000L).toInt(), 0)

    private fun recordEvent(
        eventType: String,
        track: NativeTrack,
        listenedSeconds: Int,
        completionPercent: Int,
        skipped: Boolean = false
    ) {
        val event = mapOf(
            "id" to ("evt_" + UUID.randomUUID().toString()),
            "eventType" to eventType,
            "trackId" to track.id,
            "canonicalTrackId" to (track.canonicalTrackId ?: track.id),
            "title" to track.title,
            "artist" to track.artist,
            "album" to (track.album ?: ""),
            "thumbnail" to (track.thumbnail ?: ""),
            "genre" to (track.genre ?: ""),
            "duration" to track.duration.toInt(),
            "listenedSeconds" to listenedSeconds,
            "completionPercent" to completionPercent,
            "skipped" to skipped,
            "provider" to (track.provider ?: "unknown"),
            "timestamp" to System.currentTimeMillis()
        )

        eventBuffer.add(event)
        Log.d(TAG, "Recorded behavioral event: $eventType for '${track.title}' by ${track.artist}")

        if (eventBuffer.size >= FLUSH_THRESHOLD || eventType == "PLAY_COMPLETED" || eventType == "LIKE" || eventType == "SKIP_EARLY") {
            flushEvents()
        }
    }

    fun flushEvents() {
        if (eventBuffer.isEmpty()) return

        val toFlush: List<Map<String, Any?>>
        synchronized(eventBuffer) {
            toFlush = ArrayList(eventBuffer)
            eventBuffer.clear()
        }

        scope.launch {
            try {
                val token = secureStorage.getAccessToken()
                val authHeader = if (token != null) "Bearer $token" else null
                val payload = mapOf("events" to toFlush)
                val response = MRJApiClient.apiService.postPlaybackEvents(authHeader, payload)
                if (response.isSuccessful) {
                    Log.d(TAG, "Successfully flushed ${toFlush.size} behavioral events to server")
                } else {
                    Log.w(TAG, "Failed to flush events: HTTP ${response.code()}")
                }
            } catch (e: Exception) {
                Log.w(TAG, "Error flushing behavioral events: ${e.message}")
            }
        }
    }
}
