package com.mrj.music.player

import android.content.Context
import android.net.Uri
import android.os.Handler
import android.os.Looper
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import com.mrj.music.data.remote.MRJApiClient
import com.mrj.music.data.home.HomeFeedDatabase
import com.mrj.music.data.home.QueuePersistenceEntity
import com.mrj.music.intelligence.MRJBehaviorTracker
import com.mrj.music.model.NativeTrack
import com.mrj.music.storage.NativeOfflineStorage
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/** The single native playback authority for Android. */
class UnifiedPlayerManager private constructor(private val context: Context) {
    companion object {
        @Volatile private var instance: UnifiedPlayerManager? = null
        private const val BUFFERING_TIMEOUT_MS = 8_000L

        fun getInstance(context: Context): UnifiedPlayerManager = instance ?: synchronized(this) {
            instance ?: UnifiedPlayerManager(context.applicationContext).also { instance = it }
        }
    }

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private val handler = Handler(Looper.getMainLooper())
    private val queueManager = SmartQueueManager()
    private val queuePersistence = HomeFeedDatabase.getInstance(context).queuePersistenceDao()
    private val resolver = StreamResolver()
    private val behaviorTracker = MRJBehaviorTracker.getInstance(context)
    private val offlineStorage = NativeOfflineStorage.getInstance(context)
    private val audioFocusManager = MRJAudioFocusManager(context, object : AudioFocusCallback {
        override fun onAudioFocusPause() = pause()
        override fun onAudioFocusResume() = resume()
        override fun onAudioFocusDuck(duckRatio: Float) { player.volume = duckRatio }
        override fun onAudioFocusUnduck() { player.volume = 1f }
    })

    val player: ExoPlayer = ExoPlayer.Builder(context)
        .setAudioAttributes(
            AudioAttributes.Builder()
                .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
                .setUsage(C.USAGE_MEDIA)
                .build(),
            true
        )
        .setHandleAudioBecomingNoisy(true)
        .setWakeMode(C.WAKE_MODE_NETWORK)
        .build()

    private val _playbackState = MutableStateFlow(PlaybackState())
    val playbackState: StateFlow<PlaybackState> = _playbackState.asStateFlow()
    private val _currentTrack = MutableStateFlow<NativeTrack?>(null)
    val currentTrack: StateFlow<NativeTrack?> = _currentTrack.asStateFlow()
    private val _isPlaying = MutableStateFlow(false)
    val isPlaying: StateFlow<Boolean> = _isPlaying.asStateFlow()
    val queue: List<NativeTrack> get() = queueManager.queue.value
    val queueIndex: Int get() = queueManager.currentIndex.value
    val isShuffleEnabled: Boolean get() = _playbackState.value.shuffleEnabled
    val autoplayEnabled: Boolean get() = _playbackState.value.autoplayEnabled
    private val _sleepTimerState = MutableStateFlow(SleepTimerState())
    val sleepTimerState: StateFlow<SleepTimerState> = _sleepTimerState.asStateFlow()
    private val listeners = mutableSetOf<PlayerEventListener>()

    private var recoveryAttempt = 0
    private var positionPolling = false
    private var playbackRequestId = 0L
    private var playbackJob: Job? = null
    private var preloadJob: Job? = null
    private var autoplayFetchInFlight = false
    private var autoplayFetchPending = false
    private var lastAutoplaySeed: String? = null
    private val playedTrackIds = LinkedHashSet<String>()
    private var searchSessionId: String? = null
    private var playlistId: String? = null
    private var albumId: String? = null
    private var restoredTrackId: String? = null
    private var restoredPositionMs: Long = 0L
    private var bufferingStartedAt: Long? = null

    init {
        scope.launch(Dispatchers.IO) {
            val saved = runCatching { queuePersistence.getAll() }.getOrDefault(emptyList())
            if (saved.isNotEmpty()) withContext(Dispatchers.Main) {
                val savedIndex = saved.firstOrNull()?.currentIndex ?: 0
                restoredTrackId = saved.getOrNull(savedIndex)?.canonicalTrackId
                restoredPositionMs = saved.getOrNull(savedIndex)?.positionMs ?: 0L
                queueManager.replace(saved.map { it.toTrack() }, saved.getOrNull(savedIndex)?.canonicalTrackId)
            }
        }
        queueManager.queue.collectToState()
        queueManager.currentIndex.collectToState()
        player.addListener(object : Player.Listener {
            override fun onPlaybackStateChanged(playbackState: Int) {
                updateState(status = when (playbackState) {
                    Player.STATE_BUFFERING -> PlaybackStatus.BUFFERING
                    Player.STATE_READY -> if (player.isPlaying) PlaybackStatus.PLAYING else PlaybackStatus.PAUSED
                    Player.STATE_ENDED -> PlaybackStatus.ENDED
                    else -> _playbackState.value.status
                })
                if (playbackState == Player.STATE_ENDED) {
                    if (_sleepTimerState.value.isActive && _sleepTimerState.value.isEndOfTrack) {
                        cancelSleepTimer()
                        pause()
                    } else {
                        playNext(false)
                    }
                }
                if (playbackState == Player.STATE_BUFFERING && bufferingStartedAt == null) {
                    bufferingStartedAt = System.currentTimeMillis()
                    scheduleBufferingWatchdog()
                    _playbackState.value.currentTrack?.let { track ->
                        runCatching { behaviorTracker.onBufferingStarted(track) }
                    }
                } else if (playbackState == Player.STATE_READY && bufferingStartedAt != null) {
                    handler.removeCallbacks(bufferingWatchdog)
                    val duration = System.currentTimeMillis() - (bufferingStartedAt ?: System.currentTimeMillis())
                    bufferingStartedAt = null
                    _playbackState.value.currentTrack?.let { track ->
                        runCatching { behaviorTracker.onBufferingEnded(track, duration) }
                    }
                }
            }

            override fun onMediaItemTransition(mediaItem: MediaItem?, reason: Int) {
                val id = mediaItem?.mediaId ?: return
                val track = queueManager.queue.value.firstOrNull { (it.canonicalTrackId ?: it.id) == id } ?: return
                playedTrackIds.add(id)
                while (playedTrackIds.size > 50) playedTrackIds.remove(playedTrackIds.first())
                queueManager.setCurrent(track)
                runCatching { behaviorTracker.onTrackStarted(track) }
                updateState(currentTrack = track, status = if (player.isPlaying) PlaybackStatus.PLAYING else PlaybackStatus.PAUSED)
                preloadUpcoming(playbackRequestId)
                maybePrefetchAutoplay(track)
            }

            override fun onIsPlayingChanged(isPlaying: Boolean) {
                updateState(status = if (isPlaying) PlaybackStatus.PLAYING else PlaybackStatus.PAUSED)
                if (isPlaying) startPositionPolling() else positionPolling = false
            }

            override fun onPlayerError(error: PlaybackException) {
                handler.removeCallbacks(bufferingWatchdog)
                val track = _playbackState.value.currentTrack ?: return
                if (recoveryAttempt == 0) {
                    recoveryAttempt = 1
                    scope.launch {
                        resolver.invalidate(track)
                        playTrack(track, resetRecovery = false)
                    }
                } else {
                    runCatching { behaviorTracker.onStreamFailure(track, error.message) }
                    updateState(status = PlaybackStatus.ERROR, errorMessage = error.message, streamResolution = StreamResolutionStatus.FAILED)
                }
            }
        })
    }

    fun playTrack(track: NativeTrack, newQueue: List<NativeTrack>? = null, resetRecovery: Boolean = true) {
        playbackJob?.cancel()
        preloadJob?.cancel()
        val requestId = ++playbackRequestId
        playbackJob = scope.launch {
            if (newQueue != null) queueManager.replace(newQueue, track.canonicalTrackId ?: track.id)
            // Start resolving upcoming items immediately. This runs in parallel
            // with the selected track so Next is usually already prepared.
            preloadUpcoming(requestId)
            if (resetRecovery) recoveryAttempt = 0
            // Keep the currently audible track visible while the replacement resolves.
            // The new track is committed only after this request wins the race.
            updateState(status = PlaybackStatus.RESOLVING, streamResolution = StreamResolutionStatus.RESOLVING, errorMessage = null)

            val localTrack = withContext(Dispatchers.IO) {
                runCatching {
                    offlineStorage.getTrack(track.id)?.takeIf { offlineStorage.isTrackDownloaded(it.id) }
                }.getOrNull()
            }
            var resolvedProvider: String? = null
            val item = if (localTrack != null) {
                localTrack.toMediaItem()
            } else {
                val resolved = runCatching { resolver.resolve(track) }.getOrNull()
                if (resolved == null) {
                    if (requestId == playbackRequestId) {
                        updateState(status = PlaybackStatus.ERROR, streamResolution = StreamResolutionStatus.UNAVAILABLE, errorMessage = "No playable source available")
                    }
                    return@launch
                }
                resolvedProvider = resolved.provider
                runCatching { behaviorTracker.onProviderUsed(track, resolvedProvider) }
                MediaItem.Builder()
                    .setMediaId(track.canonicalTrackId ?: track.id)
                    .setUri(Uri.parse(resolved.url))
                    .setMediaMetadata(metadata(track))
                    .build()
            }

            if (requestId != playbackRequestId) return@launch

            val mediaId = track.canonicalTrackId ?: track.id
            val existingIndex = (0 until player.mediaItemCount)
                .firstOrNull { player.getMediaItemAt(it).mediaId == mediaId }
            queueManager.setCurrent(track)
            if (existingIndex != null) {
                // A preloaded item may contain an expired provider URL. Replace the
                // actual MediaItem instead of seeking back to the stale one.
                player.removeMediaItem(existingIndex)
                player.addMediaItem(existingIndex, item)
                player.prepare()
                player.seekTo(existingIndex, 0L)
                audioFocusManager.onPlaybackStarted()
                player.play()
            } else {
                player.setMediaItem(item)
                player.prepare()
                if (restoredTrackId == mediaId && restoredPositionMs > 0L) {
                    player.seekTo(restoredPositionMs)
                    restoredTrackId = null
                    restoredPositionMs = 0L
                }
                audioFocusManager.onPlaybackStarted()
                player.play()
            }
            updateState(
                currentTrack = track,
                status = if (player.isPlaying) PlaybackStatus.PLAYING else PlaybackStatus.BUFFERING,
                selectedProvider = if (localTrack != null) "offline" else resolvedProvider,
                streamResolution = StreamResolutionStatus.RESOLVED,
                isOffline = localTrack != null,
                errorMessage = null
            )
            preloadUpcoming(requestId)
        }
    }

    fun pause() {
        player.pause()
        audioFocusManager.onPlaybackStopped()
    }

    fun resume() {
        audioFocusManager.onPlaybackStarted()
        if (player.currentMediaItem == null) queueManager.current()?.let { playTrack(it) } else player.play()
    }

    fun togglePlayPause() { if (player.isPlaying) pause() else resume() }
    fun togglePlay() = togglePlayPause()

    fun seekTo(positionMs: Long) { player.seekTo(positionMs.coerceAtLeast(0L)) }

    fun playNext(isUserInitiated: Boolean = true) {
        if (!isUserInitiated && !_playbackState.value.autoplayEnabled) return pause()
        if (isUserInitiated) {
            _playbackState.value.currentTrack?.let { track ->
                behaviorTracker.onTrackSkipped(track, (player.currentPosition / 1000L).toInt())
            }
        }
        val next = queueManager.nextCandidate()
        if (next == null) {
            val current = queueManager.current()
            if (current != null && _playbackState.value.autoplayEnabled) {
                fetchDynamicAutoplayQueue(current, autoPlayNextIfWaiting = true)
            } else {
                pause()
            }
            return
        }
        playTrack(next)
    }

    fun playPrevious() {
        if (player.currentPosition > 3_000L) return seekTo(0L)
        queueManager.previousCandidate()?.let { playTrack(it) } ?: seekTo(0L)
    }

    fun addToQueue(track: NativeTrack) { queueManager.add(track) }
    fun insertNextInQueue(track: NativeTrack) { queueManager.add(track, playNext = true) }
    fun removeTrackFromQueue(index: Int) {
        val current = _playbackState.value.currentQueueIndex
        queueManager.remove(index)
        if (index == current) queueManager.current()?.let { playTrack(it) } ?: pause()
    }
    fun reorderQueue(fromIndex: Int, toIndex: Int) { queueManager.reorder(fromIndex, toIndex) }
    fun clearQueueExceptCurrent() { queueManager.clearExceptCurrent() }

    fun clearPersistedQueue() {
        scope.launch(Dispatchers.IO) { runCatching { queuePersistence.clear() } }
    }

    fun setShuffle(enabled: Boolean) {
        queueManager.setShuffle(enabled)
        updateState(shuffleEnabled = enabled)
    }
    fun toggleShuffle() { setShuffle(!_playbackState.value.shuffleEnabled) }
    fun setAutoplay(enabled: Boolean) { updateState(autoplayEnabled = enabled) }
    fun toggleAutoplay() { setAutoplay(!_playbackState.value.autoplayEnabled) }

    fun setRepeat(mode: RepeatMode) { queueManager.setRepeat(mode); updateState(repeatMode = mode) }

    fun setVolume(volume: Float) {
        val value = volume.coerceIn(0f, 1f)
        player.volume = value
        updateState(volume = value, isMuted = value == 0f)
    }

    fun fetchDynamicAutoplayQueue(track: NativeTrack, autoPlayNextIfWaiting: Boolean = false) {
        if (autoplayFetchInFlight) {
            autoplayFetchPending = autoplayFetchPending || autoPlayNextIfWaiting
            return
        }
        autoplayFetchInFlight = true
        scope.launch(Dispatchers.IO) {
            val additions = runCatching {
                val currentId = track.canonicalTrackId ?: track.id
                val current = mapOf(
                    "id" to currentId,
                    "canonicalTrackId" to currentId,
                    "title" to track.title,
                    "artist" to track.artist,
                    "album" to track.album,
                    "genre" to track.genre,
                    "duration" to track.duration,
                    "provider" to track.provider,
                    "providerTrackId" to track.providerTrackId
                )
                val currentQueueIds = queueManager.queue.value.map { it.canonicalTrackId ?: it.id }
                val body = MRJApiClient.apiService.getDynamicQueue(
                    body = mapOf(
                        "currentTrackId" to currentId,
                        "currentTrack" to current,
                        "playedTrackIds" to playedTrackIds.toList(),
                        "currentQueueIds" to currentQueueIds,
                        "searchSessionId" to searchSessionId,
                        "playlistId" to playlistId,
                        "albumId" to albumId,
                        "localTime" to java.time.OffsetDateTime.now().toString(),
                        "earlySkipSignal" to false,
                        "mood" to _playbackState.value.currentTrack?.genre
                    )
                ).body()
                var raw = (body?.get("queue") as? List<*>)
                    ?: (body?.get("tracks") as? List<*>)
                    ?: (body?.get("recommendations") as? List<*>)
                    ?: emptyList<Any>()
                raw.mapNotNull { (it as? Map<*, *>)?.toNativeTrack() }
            }.getOrElse { emptyList() }
            withContext(Dispatchers.Main) {
                autoplayFetchInFlight = false
                additions.forEach { queueManager.add(it) }
                if (additions.isNotEmpty()) preloadUpcoming(playbackRequestId)
                val shouldContinue = autoPlayNextIfWaiting || autoplayFetchPending
                autoplayFetchPending = false
                if (shouldContinue) playNext(false)
            }
        }
    }

    fun setPlaybackContext(searchSessionId: String? = null, playlistId: String? = null, albumId: String? = null) {
        this.searchSessionId = searchSessionId
        this.playlistId = playlistId
        this.albumId = albumId
    }

    private fun maybePrefetchAutoplay(track: NativeTrack) {
        if (!_playbackState.value.autoplayEnabled) return
        val remaining = queueManager.queue.value.size - queueManager.currentIndex.value - 1
        if (remaining <= 2 && lastAutoplaySeed != (track.canonicalTrackId ?: track.id)) {
            lastAutoplaySeed = track.canonicalTrackId ?: track.id
            fetchDynamicAutoplayQueue(track)
        }
    }

    fun release() {
        playbackJob?.cancel()
        preloadJob?.cancel()
        audioFocusManager.onPlaybackStopped()
        handler.removeCallbacksAndMessages(null)
        player.release()
    }

    fun addListener(listener: PlayerEventListener) { listeners += listener }
    fun removeListener(listener: PlayerEventListener) { listeners -= listener }
    private val sleepTimerTick = object : Runnable {
        override fun run() {
            val current = _sleepTimerState.value
            if (!current.isActive || current.isEndOfTrack) return
            val remaining = current.remainingSeconds - 1L
            if (remaining <= 0L) {
                _sleepTimerState.value = SleepTimerState()
                pause()
            } else {
                _sleepTimerState.value = current.copy(remainingSeconds = remaining)
                handler.postDelayed(this, 1000L)
            }
        }
    }

    fun startSleepTimer(minutes: Int) {
        handler.removeCallbacks(sleepTimerTick)
        if (minutes <= 0) {
            _sleepTimerState.value = SleepTimerState()
            return
        }
        _sleepTimerState.value = SleepTimerState(true, minutes * 60L, minutes, false)
        handler.postDelayed(sleepTimerTick, 1000L)
    }

    fun startSleepTimerEndOfTrack() {
        handler.removeCallbacks(sleepTimerTick)
        _sleepTimerState.value = SleepTimerState(true, 0L, 0, true)
    }

    fun cancelSleepTimer() {
        handler.removeCallbacks(sleepTimerTick)
        _sleepTimerState.value = SleepTimerState()
    }

    private fun startPositionPolling() {
        if (positionPolling) return
        positionPolling = true
        handler.post(object : Runnable {
            override fun run() {
                if (!positionPolling) return
                updateState(positionMs = player.currentPosition, durationMs = player.duration.coerceAtLeast(0L), bufferedPositionMs = player.bufferedPosition)
                _playbackState.value.currentTrack?.let { track ->
                    behaviorTracker.onProgress(track, player.currentPosition, player.duration)
                }
                if (player.duration > 0L && player.duration - player.currentPosition <= 30_000L) {
                    preloadUpcoming(playbackRequestId)
                }
                handler.postDelayed(this, 250L)
            }
        })
    }

    private val bufferingWatchdog = Runnable {
        if (player.playbackState != Player.STATE_BUFFERING) return@Runnable
        val track = _playbackState.value.currentTrack ?: return@Runnable
        if (recoveryAttempt == 0) {
            recoveryAttempt = 1
            scope.launch {
                resolver.invalidate(track)
                playTrack(track, resetRecovery = false)
            }
        } else {
            runCatching { behaviorTracker.onStreamFailure(track, "buffering_timeout") }
            val next = queueManager.nextCandidate()
            if (next != null) {
                playTrack(next)
            } else {
                updateState(
                    status = PlaybackStatus.ERROR,
                    streamResolution = StreamResolutionStatus.FAILED,
                    errorMessage = "Stream timed out"
                )
            }
        }
    }

    private fun scheduleBufferingWatchdog() {
        handler.removeCallbacks(bufferingWatchdog)
        handler.postDelayed(bufferingWatchdog, BUFFERING_TIMEOUT_MS)
    }

    private fun metadata(track: NativeTrack): MediaMetadata = MediaMetadata.Builder()
        .setTitle(track.title)
        .setArtist(track.artist)
        .setAlbumTitle(track.album ?: "Single")
        .setArtworkUri(track.thumbnail?.let(Uri::parse))
        .build()

    private fun preloadUpcoming(requestId: Long) {
        if (preloadJob?.isActive == true) return
        val upcoming = queueManager.queue.value
            .drop(queueManager.currentIndex.value + 1)
            .take(3)
        if (upcoming.isEmpty()) return
        preloadJob = scope.launch {
            val items = upcoming.map { track ->
                async {
                    runCatching {
                        resolver.resolve(track)?.let { resolved ->
                            MediaItem.Builder()
                                .setMediaId(track.canonicalTrackId ?: track.id)
                                .setUri(Uri.parse(resolved.url))
                                .setMediaMetadata(metadata(track))
                                .build()
                        }
                    }.getOrNull()
                }
            }.awaitAll().filterNotNull()
            if (requestId != playbackRequestId || items.isEmpty()) return@launch
            val newItems = items.filterNot { item ->
                (0 until player.mediaItemCount).any { player.getMediaItemAt(it).mediaId == item.mediaId }
            }
            if (newItems.isNotEmpty()) player.addMediaItems(newItems)
        }
    }

    private fun updateState(
        currentTrack: NativeTrack? = _playbackState.value.currentTrack,
        status: PlaybackStatus = _playbackState.value.status,
        positionMs: Long = _playbackState.value.positionMs,
        durationMs: Long = _playbackState.value.durationMs,
        bufferedPositionMs: Long = _playbackState.value.bufferedPositionMs,
        selectedProvider: String? = _playbackState.value.selectedProvider,
        streamResolution: StreamResolutionStatus = _playbackState.value.streamResolution,
        isOffline: Boolean = _playbackState.value.isOffline,
        errorMessage: String? = _playbackState.value.errorMessage,
        recoveryAttemptValue: Int = recoveryAttempt,
        autoplayEnabled: Boolean = _playbackState.value.autoplayEnabled,
        shuffleEnabled: Boolean = _playbackState.value.shuffleEnabled,
        repeatMode: RepeatMode = _playbackState.value.repeatMode,
        volume: Float = _playbackState.value.volume,
        isMuted: Boolean = _playbackState.value.isMuted
    ) {
        _playbackState.value = PlaybackState(currentTrack, status, positionMs, durationMs, bufferedPositionMs, queueManager.queue.value, queueManager.currentIndex.value, shuffleEnabled, repeatMode, autoplayEnabled, volume, isMuted, selectedProvider, streamResolution, isOffline, errorMessage, recoveryAttemptValue, streamResolution == StreamResolutionStatus.RESOLVING)
        _currentTrack.value = currentTrack
        _isPlaying.value = status == PlaybackStatus.PLAYING
        listeners.toList().forEach { listener ->
            // A UI observer must not be able to crash the playback authority.
            runCatching {
                listener.onPlaybackStateChange(_isPlaying.value, status == PlaybackStatus.BUFFERING || status == PlaybackStatus.RESOLVING)
                listener.onTrackChange(currentTrack)
                listener.onPositionChange(positionMs, durationMs)
                listener.onQueueChange(queueManager.queue.value, queueManager.currentIndex.value)
                listener.onAutoplayChange(autoplayEnabled)
                if (errorMessage != null) listener.onError(errorMessage)
            }
        }
    }

    private fun kotlinx.coroutines.flow.StateFlow<*>.collectToState() {
        scope.launch { collect { updateState(); persistQueue() } }
    }


    private fun persistQueue() {
        val items = queueManager.queue.value
        if (items.isEmpty()) return
        val currentIndex = queueManager.currentIndex.value
        val currentPosition = player.currentPosition
        scope.launch(Dispatchers.IO) {
            runCatching {
                queuePersistence.clear()
                queuePersistence.insertAll(items.mapIndexed { index, track -> QueuePersistenceEntity.fromTrack(index, currentIndex, track, if (index == currentIndex) currentPosition else 0L, System.currentTimeMillis()) })
            }
        }
    }

    private fun Map<*, *>.toNativeTrack(): NativeTrack? {
        if (this["sourceAvailable"] != true) return null
        val id = this["id"] as? String ?: this["canonicalTrackId"] as? String ?: return null
        val title = this["title"] as? String ?: return null
        return NativeTrack(
            id = id,
            canonicalTrackId = this["canonicalTrackId"] as? String ?: id,
            title = title,
            artist = this["artist"] as? String ?: "Unknown Artist",
            album = this["album"] as? String,
            thumbnail = (this["artworkUrl"] as? String)
                ?: (this["thumbnail"] as? String)
                ?: (this["artwork"] as? String)
                ?: (this["cover"] as? String),
            duration = (this["duration"] as? Number)?.toDouble() ?: 0.0,
            providerTrackId = this["providerTrackId"] as? String,
            provider = this["provider"] as? String
        )
    }
}
