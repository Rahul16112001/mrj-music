package com.mrj.music.player

import com.mrj.music.model.NativeTrack

/**
 * High-level state of the native playback engine.
 *
 * This is intentionally immutable. A single player authority can publish
 * complete snapshots without requiring Compose or other clients to combine
 * several independently changing StateFlows.
 */
data class PlaybackState(
    val currentTrack: NativeTrack? = null,
    val status: PlaybackStatus = PlaybackStatus.IDLE,
    val positionMs: Long = 0L,
    val durationMs: Long = 0L,
    val bufferedPositionMs: Long = 0L,
    val queue: List<NativeTrack> = emptyList(),
    val currentQueueIndex: Int = 0,
    val shuffleEnabled: Boolean = false,
    val repeatMode: RepeatMode = RepeatMode.OFF,
    val autoplayEnabled: Boolean = true,
    val volume: Float = 1.0f,
    val isMuted: Boolean = false,
    val selectedProvider: String? = null,
    val streamResolution: StreamResolutionStatus = StreamResolutionStatus.NOT_REQUESTED,
    val isOffline: Boolean = false,
    val errorMessage: String? = null,
    val recoveryAttempt: Int = 0,
    val isSearchingAlternativeSource: Boolean = false
)

enum class PlaybackStatus {
    IDLE,
    RESOLVING,
    BUFFERING,
    PLAYING,
    PAUSED,
    ENDED,
    ERROR
}

enum class StreamResolutionStatus {
    NOT_REQUESTED,
    RESOLVING,
    RESOLVED,
    EXPIRED,
    FORBIDDEN,
    UNAVAILABLE,
    FAILED
}

enum class RepeatMode {
    OFF,
    ONE,
    ALL
}
