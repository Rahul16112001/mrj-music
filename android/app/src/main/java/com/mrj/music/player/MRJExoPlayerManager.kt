package com.mrj.music.player

import android.annotation.SuppressLint
import android.content.Context
import android.net.wifi.WifiManager
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.util.Log
import android.view.View
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.exoplayer.DefaultLoadControl
import androidx.media3.exoplayer.ExoPlayer
import com.mrj.music.audiofx.MRJAudioEffectManager
import com.mrj.music.data.remote.MRJApiClient
import com.mrj.music.data.security.SecureAuthStorage
import com.mrj.music.model.NativeTrack
import com.mrj.music.storage.NativeOfflineStorage
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.launch
import java.util.Collections

@SuppressLint("SetJavaScriptEnabled")
class BackgroundMediaWebView(context: Context) : WebView(context.applicationContext ?: context) {
    init {
        resumeTimers()
    }

    override fun onWindowVisibilityChanged(visibility: Int) {
        // Force VISIBLE so Chromium never throttles timers or pauses media on lockscreen/minimize
        super.onWindowVisibilityChanged(View.VISIBLE)
    }

    override fun dispatchWindowVisibilityChanged(visibility: Int) {
        super.dispatchWindowVisibilityChanged(View.VISIBLE)
    }

    override fun onVisibilityChanged(changedView: View, visibility: Int) {
        super.onVisibilityChanged(changedView, View.VISIBLE)
    }

    override fun onPause() {
        // Do NOT call super.onPause() to keep background audio thread and JS engine actively running
    }

    override fun onWindowFocusChanged(hasWindowFocus: Boolean) {
        // Retain focus state so HTML5 player never detects window blur
        super.onWindowFocusChanged(true)
    }
}

private const val TAG = "MRJ_ExoPlayerManager"

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

@SuppressLint("SetJavaScriptEnabled")
class MRJExoPlayerManager private constructor(private val context: Context) : AudioFocusCallback {

    companion object {
        @Volatile
        private var instance: MRJExoPlayerManager? = null

        fun getInstance(context: Context): MRJExoPlayerManager {
            return instance ?: synchronized(this) {
                instance ?: MRJExoPlayerManager(context.applicationContext ?: context).also { instance = it }
            }
        }
    }

    private val loadControl = DefaultLoadControl.Builder()
        .setBufferDurationsMs(
            30_000, // minBufferMs
            120_000, // maxBufferMs (2 minutes buffer to prevent drops)
            2_000, // bufferForPlaybackMs
            5_000 // bufferForPlaybackAfterRebufferMs
        )
        .build()

    val player: ExoPlayer = ExoPlayer.Builder(context)
        .setAudioAttributes(
            AudioAttributes.Builder()
                .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
                .setUsage(C.USAGE_MEDIA)
                .build(),
            true
        )
        .setLoadControl(loadControl)
        .setHandleAudioBecomingNoisy(true)
        .setWakeMode(C.WAKE_MODE_NETWORK)
        .build()

    private val offlineStorage = NativeOfflineStorage.getInstance(context)
    private val secureStorage = SecureAuthStorage.getInstance(context)
    private val behaviorTracker = com.mrj.music.intelligence.MRJBehaviorTracker.getInstance(context)
    private val audioFocusManager = MRJAudioFocusManager(context, this)

    private val listeners = mutableListOf<PlayerEventListener>()
    private val mainHandler = Handler(Looper.getMainLooper())
    private val playerScope = CoroutineScope(Dispatchers.Main + SupervisorJob())

    private var wakeLock: PowerManager.WakeLock? = null
    private var wifiLock: WifiManager.WifiLock? = null

    private val _currentTrack = MutableStateFlow<NativeTrack?>(null)
    val currentTrack: StateFlow<NativeTrack?> = _currentTrack

    private val _isPlaying = MutableStateFlow(false)
    val isPlaying: StateFlow<Boolean> = _isPlaying

    private val _position = MutableStateFlow(0L)
    private val _duration = MutableStateFlow(0L)
    val positionFlow: Flow<Pair<Long, Long>> = _position.combine(_duration) { pos, dur -> pos to dur }

    private val _sleepTimerState = MutableStateFlow(SleepTimerState())
    val sleepTimerState: StateFlow<SleepTimerState> = _sleepTimerState

    val queue = mutableListOf<NativeTrack>()
    var queueIndex: Int = 0
        private set
    var isShuffleEnabled: Boolean = false
        private set
    var autoplayEnabled: Boolean = secureStorage.getAutoplayEnabled()
        private set

    private var trackStartTimestamp: Long = 0L
    private var consecutiveErrorCount: Int = 0
    private var currentPlayingVideoId: String? = null
    private var trackRecoveryAttempts: Int = 0
    private var webView: WebView? = null
    private var isUsingNativeExo: Boolean = false
    private var isHtmlReady: Boolean = false
    private var pendingYouTubeId: String? = null
    private var volumeFadeJob: Job? = null
    private var sleepTimerJob: Job? = null

    // Audio Focus Callbacks from MRJAudioFocusManager
    override fun onAudioFocusPause() {
        mainHandler.post {
            pause()
        }
    }

    override fun onAudioFocusResume() {
        mainHandler.post {
            resume()
        }
    }

    override fun onAudioFocusDuck(duckRatio: Float) {
        mainHandler.post {
            setVolume(duckRatio)
        }
    }

    override fun onAudioFocusUnduck() {
        mainHandler.post {
            setVolume(1.0f)
        }
    }

    private val positionPollRunnable = object : Runnable {
        override fun run() {
            try {
                if (isUsingNativeExo && player.isPlaying) {
                    val pos = player.currentPosition
                    val dur = if (player.duration > 0) player.duration
                              else ((_currentTrack.value?.duration ?: 0.0) * 1000).toLong()
                    _position.value = pos
                    _duration.value = dur
                    listeners.forEach { it.onPositionChange(pos, dur) }
                    _currentTrack.value?.let { curr ->
                        behaviorTracker.onProgress(curr, pos, dur)
                    }
                }
            } catch (e: Exception) {
                Log.w(TAG, "Position poll error: ${e.message}")
            }
            if (isUsingNativeExo && player.isPlaying) {
                mainHandler.postDelayed(this, 1000)
            }
        }
    }

    inner class WebAppInterface {
        @JavascriptInterface
        fun onReady() {
            Log.d(TAG, "YouTube Player Engine Ready")
            isHtmlReady = true
            val pending = pendingYouTubeId
            if (!pending.isNullOrBlank()) {
                pendingYouTubeId = null
                mainHandler.post {
                    webView?.evaluateJavascript("playVideo('$pending');", null)
                }
            }
        }

        @JavascriptInterface
        fun onStateChange(state: Int) {
            mainHandler.post {
                // 1 = PLAYING, 2 = PAUSED, 3 = BUFFERING, 0 = ENDED
                when (state) {
                    1 -> {
                        consecutiveErrorCount = 0
                        _isPlaying.value = true
                        acquireHardwareLocks()
                        try { player.playWhenReady = true } catch (_: Exception) {}
                        listeners.forEach { it.onPlaybackStateChange(true, false) }
                        fadeVolume(from = 0.05f, to = 1.0f, durationMs = 350L)
                    }
                    2 -> {
                        _isPlaying.value = false
                        releaseHardwareLocks()
                        try { player.playWhenReady = false } catch (_: Exception) {}
                        listeners.forEach { it.onPlaybackStateChange(false, false) }
                    }
                    3 -> {
                        listeners.forEach { it.onPlaybackStateChange(_isPlaying.value, true) }
                    }
                    0 -> {
                        _isPlaying.value = false
                        releaseHardwareLocks()
                        try { player.playWhenReady = false } catch (_: Exception) {}
                        handleTrackEnded()
                    }
                }
            }
        }

        @JavascriptInterface
        fun onTimeUpdate(currSec: Double, durSec: Double) {
            mainHandler.post {
                if (!isUsingNativeExo) {
                    val posMs = (currSec * 1000).toLong()
                    val durMs = if (durSec > 0) (durSec * 1000).toLong()
                                else ((_currentTrack.value?.duration ?: 0.0) * 1000).toLong()
                    _position.value = posMs
                    _duration.value = durMs
                    listeners.forEach { it.onPositionChange(posMs, durMs) }
                    _currentTrack.value?.let { curr ->
                        behaviorTracker.onProgress(curr, posMs, durMs)
                    }
                }
            }
        }

        @JavascriptInterface
        fun onError(code: Int) {
            mainHandler.post {
                val current = _currentTrack.value
                val failedId = currentPlayingVideoId
                Log.e(TAG, "YouTube Player Engine error code: $code on videoId '$failedId' for track '${current?.title}'")

                if (current != null && trackRecoveryAttempts < 2) {
                    trackRecoveryAttempts++
                    Log.d(TAG, "Attempting auto-recovery #$trackRecoveryAttempts with alternative audio for: ${current.title}")

                    CoroutineScope(Dispatchers.IO).launch {
                        try {
                            val searchQuery = "${current.title} ${current.artist} lyrics audio".trim()
                            val searchRes = MRJApiClient.apiService.search(query = searchQuery, type = "songs")
                            if (searchRes.isSuccessful && searchRes.body() != null) {
                                val songs = (searchRes.body()!!["songs"] as? List<Map<String, Any>>)
                                    ?: (searchRes.body()!!["results"] as? List<Map<String, Any>>)
                                    ?: emptyList()

                                for (s in songs) {
                                    val audioSource = s["audioSource"] as? Map<*, *>
                                    val altId = (audioSource?.get("providerTrackId") as? String)
                                        ?: (s["providerTrackId"] as? String)
                                        ?: (s["videoId"] as? String)
                                        ?: extractIdFromThumbnail(s["thumbnail"] as? String)

                                    if (!altId.isNullOrBlank() && isValidYouTubeId(altId) && altId != failedId) {
                                        Log.d(TAG, "Auto-recovery successfully found alternative stream: $altId for '${current.title}'")
                                        mainHandler.post {
                                            dispatchPlayVideo(altId)
                                        }
                                        return@launch
                                    }
                                }
                            }
                        } catch (e: Exception) {
                            Log.w(TAG, "Auto-recovery stream search error: ${e.message}")
                        }

                        mainHandler.post {
                            consecutiveErrorCount++
                            if (consecutiveErrorCount >= 3) {
                                Log.w(TAG, "Hit maximum consecutive stream errors (3). Pausing.")
                                _isPlaying.value = false
                                pause()
                                listeners.forEach { it.onError("Stream issue. Please try another track.") }
                                consecutiveErrorCount = 0
                                return@post
                            }
                            listeners.forEach { it.onError("Stream issue encountered. Transitioning to next song...") }
                            mainHandler.postDelayed({
                                if (autoplayEnabled || queue.isNotEmpty()) {
                                    playNext(isUserInitiated = false)
                                }
                            }, 1500)
                        }
                    }
                    return@post
                }

                consecutiveErrorCount++
                if (consecutiveErrorCount >= 3) {
                    Log.w(TAG, "Hit maximum consecutive stream errors (3). Pausing to prevent rapid skipping loop.")
                    _isPlaying.value = false
                    pause()
                    listeners.forEach { it.onError("Unable to play stream. Please try another track.") }
                    consecutiveErrorCount = 0
                    return@post
                }
                listeners.forEach { it.onError("Stream issue encountered. Transitioning to next song...") }
                mainHandler.postDelayed({
                    if (autoplayEnabled || queue.isNotEmpty()) {
                        playNext(isUserInitiated = false)
                    }
                }, 1500)
            }
        }
    }

    private val htmlContent = """
        <!DOCTYPE html>
        <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            html, body { margin:0; padding:0; width:100%; height:100%; background:#000; overflow:hidden; }
            #player { width:100%; height:100%; }
          </style>
          <script src="https://www.youtube.com/iframe_api"></script>
        </head>
        <body>
          <div id="player"></div>
          <script>
            // 1. Freeze visibility properties so Chromium never thinks it is hidden
            Object.defineProperty(document, 'hidden', { get: function() { return false; }, configurable: true });
            Object.defineProperty(document, 'visibilityState', { get: function() { return 'visible'; }, configurable: true });
            Object.defineProperty(document, 'webkitVisibilityState', { get: function() { return 'visible'; }, configurable: true });
            Object.defineProperty(document, 'webkitHidden', { get: function() { return false; }, configurable: true });

            // 2. Block visibility and blur events from reaching YouTube player
            ['visibilitychange', 'webkitvisibilitychange', 'blur', 'focusout', 'pagehide', 'freeze'].forEach(function(evt) {
              window.addEventListener(evt, function(e) { e.stopImmediatePropagation(); }, true);
              document.addEventListener(evt, function(e) { e.stopImmediatePropagation(); }, true);
            });

            // 3. Web Audio Context Keep-Alive (Continuous silent buffer oscillator so OS audio track stays actively engaged)
            var audioCtx = null;
            function ensureAudioEngaged() {
              try {
                if (!audioCtx) {
                  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                  var osc = audioCtx.createOscillator();
                  var gain = audioCtx.createGain();
                  gain.gain.value = 0.0001;
                  osc.connect(gain);
                  gain.connect(audioCtx.destination);
                  osc.start();
                } else if (audioCtx.state === 'suspended') {
                  audioCtx.resume();
                }
              } catch(e) {}
            }

            var player = null;
            var pendingId = null;
            var bufferStallTimer = null;
            var shouldBePlaying = false;

            function onYouTubeIframeAPIReady() {
              console.log('YT API Ready');
              player = new YT.Player('player', {
                height: '100%',
                width: '100%',
                playerVars: {
                  autoplay: 1,
                  controls: 0,
                  playsinline: 1,
                  enablejsapi: 1,
                  rel: 0,
                  fs: 0,
                  origin: 'https://mrj-music.vercel.app'
                },
                events: {
                  'onReady': onPlayerReady,
                  'onStateChange': onPlayerStateChange,
                  'onError': onPlayerError
                }
              });
            }

            function onPlayerReady(event) {
              console.log('YT Player onReady fired');
              if (player) {
                try { player.unMute(); } catch(e) {}
                try { player.setVolume(100); } catch(e) {}
              }
              if (pendingId) {
                var vid = pendingId;
                pendingId = null;
                playVideo(vid);
              }
              if (window.AndroidBridge && window.AndroidBridge.onReady) {
                window.AndroidBridge.onReady();
              }
            }

            function checkBufferingStall(state) {
              if (state === 3) { // BUFFERING
                if (!bufferStallTimer) {
                  bufferStallTimer = setTimeout(function() {
                    console.log('Buffer stall watchdog triggered -> Re-syncing stream');
                    if (player && player.playVideo) {
                      var cur = player.getCurrentTime() || 0;
                      player.seekTo(cur, true);
                      player.playVideo();
                    }
                    bufferStallTimer = null;
                  }, 6000);
                }
              } else {
                if (bufferStallTimer) {
                  clearTimeout(bufferStallTimer);
                  bufferStallTimer = null;
                }
              }
            }

            function onPlayerStateChange(event) {
              console.log('YT State Change: ' + event.data);
              checkBufferingStall(event.data);

              // Auto-resume if YouTube pauses due to background power-saving while shouldBePlaying is true
              if (event.data === 2 && shouldBePlaying) {
                console.log('Spurious background pause detected -> auto-resuming immediately');
                setTimeout(function() {
                  if (shouldBePlaying && player && player.playVideo) {
                    player.playVideo();
                  }
                }, 50);
                return;
              }

              // Filter out spurious ENDED (0) events fired during video load / quality change
              if (event.data === 0) {
                var cur = (player && player.getCurrentTime) ? (player.getCurrentTime() || 0) : 0;
                var dur = (player && player.getDuration) ? (player.getDuration() || 0) : 0;
                if (dur > 10 && (cur >= dur * 0.85 || (dur - cur) <= 5.0)) {
                  console.log('Real track ended confirmed at: ' + cur + 's / ' + dur + 's');
                  if (window.AndroidBridge && window.AndroidBridge.onStateChange) {
                    window.AndroidBridge.onStateChange(0);
                  }
                } else {
                  console.log('Ignored spurious YT ENDED event during video transition (cur=' + cur + ', dur=' + dur + ')');
                }
                return;
              }

              if (window.AndroidBridge && window.AndroidBridge.onStateChange) {
                window.AndroidBridge.onStateChange(event.data);
              }
            }

            function onPlayerError(event) {
              console.error('YT Player Error: ' + event.data);
              if (window.AndroidBridge && window.AndroidBridge.onError) {
                window.AndroidBridge.onError(event.data);
              }
            }

            setInterval(function() {
              ensureAudioEngaged();
              if (player && player.getCurrentTime && player.getDuration) {
                var cur = player.getCurrentTime() || 0;
                var dur = player.getDuration() || 0;
                if (window.AndroidBridge && window.AndroidBridge.onTimeUpdate) {
                  window.AndroidBridge.onTimeUpdate(cur, dur);
                }
              }
            }, 500);

            function playVideo(id) {
              console.log('JS playVideo called with id: ' + id);
              shouldBePlaying = true;
              ensureAudioEngaged();
              if (player && player.loadVideoById) {
                try { player.unMute(); } catch(e) {}
                player.loadVideoById({ videoId: id, startSeconds: 0 });
                player.playVideo();
              } else {
                pendingId = id;
              }
            }

            function pauseVideo() {
              console.log('JS pauseVideo called explicitly');
              shouldBePlaying = false;
              if (player && player.pauseVideo) player.pauseVideo();
            }

            function resumeVideo() {
              console.log('JS resumeVideo called explicitly');
              shouldBePlaying = true;
              ensureAudioEngaged();
              if (player && player.playVideo) {
                try { player.unMute(); } catch(e) {}
                player.playVideo();
              }
            }

            function seekTo(sec) {
              if (player && player.seekTo) player.seekTo(sec, true);
            }

            function setVolume(vol) {
              if (player && player.setVolume) {
                try { player.setVolume(vol); } catch(e) {}
              }
            }
          </script>
        </body>
        </html>
    """.trimIndent()

    fun getOrCreatePlayerEngineView(ctx: Context): WebView {
        if (webView == null) {
            val appContext = ctx.applicationContext ?: ctx
            val wv = BackgroundMediaWebView(appContext).apply {
                layoutParams = android.view.ViewGroup.LayoutParams(
                    android.view.ViewGroup.LayoutParams.MATCH_PARENT,
                    android.view.ViewGroup.LayoutParams.MATCH_PARENT
                )
                resumeTimers()
                settings.javaScriptEnabled = true
                settings.mediaPlaybackRequiresUserGesture = false
                settings.domStorageEnabled = true
                settings.databaseEnabled = true
                settings.mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
                settings.userAgentString = "Mozilla/5.0 (Linux; Android 13; Mobile; rv:128.0) Gecko/128.0 Firefox/128.0"
                webChromeClient = object : WebChromeClient() {
                    override fun onConsoleMessage(consoleMessage: android.webkit.ConsoleMessage?): Boolean {
                        Log.d(TAG, "WebView Console: [${consoleMessage?.messageLevel()}] ${consoleMessage?.message()}")
                        return true
                    }
                }
                webViewClient = object : WebViewClient() {
                    override fun onPageFinished(view: WebView?, url: String?) {
                        super.onPageFinished(view, url)
                        Log.d(TAG, "WebView Audio Engine Page Loaded: $url")
                    }
                }
                addJavascriptInterface(WebAppInterface(), "AndroidBridge")
                loadDataWithBaseURL("https://mrj-music.vercel.app", htmlContent, "text/html", "UTF-8", null)
            }
            webView = wv
        }
        return webView!!
    }

    private fun acquireHardwareLocks() {
        try {
            if (wakeLock == null) {
                val pm = context.getSystemService(Context.POWER_SERVICE) as PowerManager
                wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "MRJMusic:ExoWakeLock").apply {
                    setReferenceCounted(false)
                }
            }
            if (wakeLock?.isHeld == false) {
                wakeLock?.acquire(12 * 60 * 60 * 1000L)
            }

            if (wifiLock == null) {
                val wm = context.applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
                wifiLock = wm.createWifiLock(WifiManager.WIFI_MODE_FULL_HIGH_PERF, "MRJMusic:ExoWifiLock").apply {
                    setReferenceCounted(false)
                }
            }
            if (wifiLock?.isHeld == false) {
                wifiLock?.acquire()
            }
        } catch (e: Exception) {
            Log.w(TAG, "Error acquiring hardware locks: ${e.message}")
        }
    }

    private fun releaseHardwareLocks() {
        try {
            if (wakeLock?.isHeld == true) wakeLock?.release()
            if (wifiLock?.isHeld == true) wifiLock?.release()
        } catch (e: Exception) {
            Log.w(TAG, "Error releasing hardware locks: ${e.message}")
        }
    }

    fun addListener(listener: PlayerEventListener) {
        if (!listeners.contains(listener)) listeners.add(listener)
    }

    fun removeListener(listener: PlayerEventListener) {
        listeners.remove(listener)
    }

    private fun dispatchPlayVideo(videoId: String) {
        currentPlayingVideoId = videoId
        trackStartTimestamp = System.currentTimeMillis()
        audioFocusManager.onPlaybackStarted()
        acquireHardwareLocks()

        // Keep native ExoPlayer AudioTrack active in background with silence so Android OS & OEM battery optimizers never suspend audio thread
        try {
            val silenceSource = androidx.media3.exoplayer.source.SilenceMediaSource(86400000000L) // 24 hours of silence
            player.stop()
            player.clearMediaItems()
            player.setMediaSource(silenceSource)
            player.prepare()
            player.play()
        } catch (e: Exception) {
            Log.w(TAG, "SilenceMediaSource setup notice: ${e.message}")
        }

        mainHandler.post {
            getOrCreatePlayerEngineView(context)
            setVolume(0.05f)
            if (isHtmlReady && webView != null) {
                Log.d(TAG, "Executing JS playVideo('$videoId')")
                webView?.evaluateJavascript("playVideo('$videoId');", null)
            } else {
                Log.d(TAG, "HTML engine not ready yet, queuing pending video ID: $videoId")
                pendingYouTubeId = videoId
            }
            fadeVolume(from = 0.05f, to = 1.0f, durationMs = 300L)
        }
    }

    init {
        mainHandler.post {
            getOrCreatePlayerEngineView(context)
        }
        player.addListener(object : Player.Listener {
            override fun onAudioSessionIdChanged(audioSessionId: Int) {
                try {
                    MRJAudioEffectManager.getInstance(context).attachAudioSession(audioSessionId)
                } catch (e: Exception) {
                    Log.w(TAG, "Failed attaching audioSessionId: ${e.message}")
                }
            }

            override fun onPlaybackStateChanged(playbackState: Int) {
                try {
                    MRJAudioEffectManager.getInstance(context).attachAudioSession(player.audioSessionId)
                } catch (_: Exception) {}

                if (isUsingNativeExo) {
                    val isBuffering = playbackState == Player.STATE_BUFFERING
                    val isPlaying = player.isPlaying
                    listeners.forEach { it.onPlaybackStateChange(isPlaying, isBuffering) }

                    if (playbackState == Player.STATE_ENDED) {
                        Log.d(TAG, "ExoPlayer STATE_ENDED triggered")
                        handleTrackEnded()
                    }
                }
            }

            override fun onIsPlayingChanged(isPlaying: Boolean) {
                if (isUsingNativeExo) {
                    _isPlaying.value = isPlaying
                    if (isPlaying) {
                        acquireHardwareLocks()
                    } else {
                        releaseHardwareLocks()
                    }
                    listeners.forEach { it.onPlaybackStateChange(isPlaying, false) }
                    if (isPlaying) {
                        mainHandler.post(positionPollRunnable)
                    }
                }
            }

            override fun onPlayerError(error: PlaybackException) {
                if (isUsingNativeExo) {
                    Log.e(TAG, "ExoPlayer error on track '${_currentTrack.value?.title}': ${error.message}, code: ${error.errorCode}")
                    val current = _currentTrack.value
                    if (current != null) {
                        Log.w(TAG, "Deleting corrupt local audio for '${current.title}' and self-healing with online stream.")
                        offlineStorage.deleteTrack(current.id)
                        isUsingNativeExo = false
                        val ytId = resolveYouTubeVideoId(current)
                        if (!ytId.isNullOrBlank() && isValidYouTubeId(ytId)) {
                            dispatchPlayVideo(ytId)
                            return
                        }
                    }
                    listeners.forEach { it.onError("Playback issue. Transitioning to next song...") }
                    mainHandler.postDelayed({
                        if (autoplayEnabled || queue.isNotEmpty()) {
                            playNext(isUserInitiated = false)
                        }
                    }, 1500)
                }
            }
        })
    }

    fun setVolume(volume: Float) {
        val clamped = volume.coerceIn(0f, 1f)
        try { player.volume = clamped } catch (_: Exception) {}
        mainHandler.post {
            val ytVol = (clamped * 100).toInt()
            webView?.evaluateJavascript("setVolume($ytVol);", null)
        }
    }

    fun fadeVolume(
        from: Float,
        to: Float,
        durationMs: Long,
        onComplete: (() -> Unit)? = null
    ) {
        volumeFadeJob?.cancel()
        volumeFadeJob = playerScope.launch {
            val steps = 8
            val stepDelay = (durationMs / steps).coerceAtLeast(10L)
            val delta = (to - from) / steps
            var currentVol = from
            for (i in 1..steps) {
                currentVol += delta
                setVolume(currentVol)
                delay(stepDelay)
            }
            setVolume(to)
            onComplete?.invoke()
        }
    }

    fun startSleepTimer(minutes: Int) {
        sleepTimerJob?.cancel()
        if (minutes <= 0) {
            cancelSleepTimer()
            return
        }
        val totalSeconds = minutes * 60L
        _sleepTimerState.value = SleepTimerState(
            isActive = true,
            remainingSeconds = totalSeconds,
            initialDurationMinutes = minutes,
            isEndOfTrack = false
        )
        sleepTimerJob = playerScope.launch {
            var remaining = totalSeconds
            while (remaining > 0 && _sleepTimerState.value.isActive) {
                delay(1000L)
                remaining--
                _sleepTimerState.value = _sleepTimerState.value.copy(remainingSeconds = remaining)

                // Smooth volume fade during the last 30 seconds
                if (remaining <= 30) {
                    val vol = (remaining.toFloat() / 30f).coerceIn(0f, 1f)
                    setVolume(vol)
                }
            }
            if (_sleepTimerState.value.isActive) {
                Log.d(TAG, "Sleep timer expired — smoothly pausing playback")
                pause()
                setVolume(1.0f)
                _sleepTimerState.value = SleepTimerState()
            }
        }
    }

    fun startSleepTimerEndOfTrack() {
        sleepTimerJob?.cancel()
        _sleepTimerState.value = SleepTimerState(
            isActive = true,
            remainingSeconds = 0L,
            initialDurationMinutes = 0,
            isEndOfTrack = true
        )
    }

    fun cancelSleepTimer() {
        sleepTimerJob?.cancel()
        _sleepTimerState.value = SleepTimerState()
        setVolume(1.0f)
    }

    fun playTrack(track: NativeTrack, newQueue: List<NativeTrack>? = null) {
        if (track.id.isBlank()) {
            Log.e(TAG, "playTrack called with blank track ID — ignoring")
            listeners.forEach { it.onError("Invalid track: missing ID") }
            return
        }

        try {
            if (newQueue != null && newQueue.isNotEmpty()) {
                queue.clear()
                queue.addAll(newQueue)
                queueIndex = queue.indexOfFirst { it.id == track.id }.takeIf { it >= 0 } ?: 0
            } else if (queue.none { it.id == track.id }) {
                queue.add(track)
                queueIndex = queue.size - 1
            } else {
                queueIndex = queue.indexOfFirst { it.id == track.id }
            }

            val offlineTrack = try {
                offlineStorage.getTrack(track.id) ?: offlineStorage.getTrack(track.canonicalTrackId ?: "")
            } catch (_: Exception) {
                null
            }
            val trackToPlay = if (offlineTrack != null && offlineStorage.isTrackDownloaded(offlineTrack.id)) {
                Log.d(TAG, "Playing downloaded offline vault track: ${offlineTrack.title}")
                offlineTrack
            } else {
                track
            }

            _currentTrack.value = trackToPlay
            trackStartTimestamp = System.currentTimeMillis()
            trackRecoveryAttempts = 0

            try {
                val mediaMetadata = androidx.media3.common.MediaMetadata.Builder()
                    .setTitle(trackToPlay.title)
                    .setArtist(trackToPlay.artist)
                    .setAlbumTitle(trackToPlay.album ?: "MRJ Music")
                    .setArtworkUri(if (!trackToPlay.thumbnail.isNullOrBlank()) android.net.Uri.parse(trackToPlay.thumbnail) else null)
                    .build()

                val syncMediaItem = androidx.media3.common.MediaItem.Builder()
                    .setMediaId(trackToPlay.id)
                    .setUri(android.net.Uri.parse("https://mrj-music.vercel.app/stream/${trackToPlay.id}"))
                    .setMediaMetadata(mediaMetadata)
                    .build()

                player.setMediaItem(syncMediaItem)
            } catch (e: Exception) {
                Log.w(TAG, "Failed setting mediaItem metadata: ${e.message}")
            }

            val isOffline = offlineTrack != null && offlineStorage.isTrackDownloaded(offlineTrack.id)
            if (isOffline) {
                isUsingNativeExo = true
                mainHandler.post { webView?.evaluateJavascript("pauseVideo();", null) }

                audioFocusManager.onPlaybackStarted()
                acquireHardwareLocks()

                val mediaItem = trackToPlay.toMediaItem()
                setVolume(0.05f)
                player.stop()
                player.clearMediaItems()
                player.setMediaItem(mediaItem)
                player.prepare()
                player.play()
                fadeVolume(from = 0.05f, to = 1.0f, durationMs = 350L)
            } else {
                // Check if user has active internet connection
                val isOnline = isNetworkConnected()
                if (!isOnline) {
                    val availableDownloaded = offlineStorage.getAllDownloadedTracks()
                    if (availableDownloaded.isNotEmpty()) {
                        Log.i(TAG, "Device is offline. Rerouting to downloaded offline tracks.")
                        mainHandler.post {
                            android.widget.Toast.makeText(context, "Offline: Playing from your downloaded library", android.widget.Toast.LENGTH_SHORT).show()
                        }
                        val nextOfflineTrack = availableDownloaded.first()
                        playTrack(nextOfflineTrack, availableDownloaded)
                        return
                    } else {
                        Log.w(TAG, "Device is offline and no offline downloads are available.")
                        mainHandler.post {
                            android.widget.Toast.makeText(context, "No internet connection & no downloaded songs available", android.widget.Toast.LENGTH_LONG).show()
                        }
                        _isPlaying.value = false
                        listeners.forEach { it.onError("No internet connection") }
                        return
                    }
                }

                isUsingNativeExo = false
                _isPlaying.value = true
                listeners.forEach { it.onPlaybackStateChange(true, true) }

                val resolvedId = resolveYouTubeVideoId(trackToPlay)

                if (!resolvedId.isNullOrBlank() && isValidYouTubeId(resolvedId)) {
                    Log.d(TAG, "Streaming online track directly via YouTube Engine: ${trackToPlay.title} ($resolvedId)")
                    dispatchPlayVideo(resolvedId)
                } else {
                    Log.d(TAG, "Resolving official studio audio source for: ${trackToPlay.title} - ${trackToPlay.artist}")
                    CoroutineScope(Dispatchers.IO).launch {
                        try {
                            val canonId = trackToPlay.canonicalTrackId ?: trackToPlay.id
                            val resolveRes = MRJApiClient.apiService.resolvePlaybackSource(
                                id = canonId,
                                title = trackToPlay.title,
                                artist = trackToPlay.artist,
                                duration = trackToPlay.duration,
                                format = "audio"
                            )
                            if (resolveRes.isSuccessful && resolveRes.body() != null) {
                                val source = resolveRes.body()!!["source"] as? Map<*, *>
                                val resolvedProviderId = (source?.get("providerTrackId") as? String)
                                    ?: (source?.get("sourceId") as? String)
                                if (!resolvedProviderId.isNullOrBlank() && isValidYouTubeId(resolvedProviderId)) {
                                    Log.d(TAG, "Backend resolved official studio audio: $resolvedProviderId")
                                    dispatchPlayVideo(resolvedProviderId)
                                    return@launch
                                }
                            }
                        } catch (e: Exception) {
                            Log.w(TAG, "Backend resolve-source failed: ${e.message}")
                        }

                        try {
                            val searchQuery = "${trackToPlay.title} ${trackToPlay.artist} official audio".trim()
                            val searchRes = MRJApiClient.apiService.search(query = searchQuery, type = "songs")
                            if (searchRes.isSuccessful && searchRes.body() != null) {
                                val songs = (searchRes.body()!!["songs"] as? List<Map<String, Any>>)
                                    ?: (searchRes.body()!!["results"] as? List<Map<String, Any>>)
                                    ?: emptyList()
                                for (s in songs) {
                                    val audioSource = s["audioSource"] as? Map<*, *>
                                    val dynamicId = (audioSource?.get("providerTrackId") as? String)
                                        ?: (s["providerTrackId"] as? String)
                                        ?: (s["videoId"] as? String)
                                        ?: extractIdFromThumbnail(s["thumbnail"] as? String)

                                    if (!dynamicId.isNullOrBlank() && isValidYouTubeId(dynamicId)) {
                                        Log.d(TAG, "Resolved official audio via search: $dynamicId")
                                        dispatchPlayVideo(dynamicId)
                                        return@launch
                                    }
                                }
                            }
                        } catch (e: Exception) {
                            Log.w(TAG, "Dynamic search resolution failed: ${e.message}")
                        }

                        val fallback = trackToPlay.id.removePrefix("yt_")
                        if (isValidYouTubeId(fallback)) {
                            dispatchPlayVideo(fallback)
                        }
                    }
                }
            }

            behaviorTracker.onTrackStarted(trackToPlay)

            if (autoplayEnabled && (newQueue == null || newQueue.size <= 1)) {
                fetchDynamicAutoplayQueue(trackToPlay)
            }

            listeners.forEach {
                it.onTrackChange(trackToPlay)
                it.onQueueChange(queue, queueIndex)
            }
        } catch (e: Exception) {
            Log.e(TAG, "playTrack exception: ${e.message}", e)
            listeners.forEach { it.onError("Playback failed: ${e.message ?: "Unknown error"}") }
        }
    }

    fun fetchDynamicAutoplayQueue(track: NativeTrack, isEarlySkip: Boolean = false) {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val token = secureStorage.getAccessToken()
                val authHeader = if (token != null) "Bearer $token" else null
                val country = java.util.Locale.getDefault().country.ifBlank { "IN" }
                val hour = java.util.Calendar.getInstance().get(java.util.Calendar.HOUR_OF_DAY)

                val payload = mapOf(
                    "currentTrack" to mapOf(
                        "id" to track.id,
                        "canonicalTrackId" to (track.canonicalTrackId ?: track.id),
                        "title" to track.title,
                        "artist" to track.artist,
                        "genre" to (track.genre ?: "")
                    ),
                    "playedTrackIds" to listOf(track.id),
                    "currentQueueIds" to queue.take(queueIndex + 1).map { it.id },
                    "countryCode" to country,
                    "localHour" to hour,
                    "isEarlySkip" to isEarlySkip
                )

                val res = try {
                    MRJApiClient.apiService.getNextRecommendations(authHeader, payload)
                } catch (e: Exception) {
                    null
                }

                val tracksRaw = if (res != null && res.isSuccessful && res.body() != null) {
                    (res.body()!!["recommendations"] as? List<Map<String, Any>>)
                        ?: (res.body()!!["queue"] as? List<Map<String, Any>>)
                        ?: (res.body()!!["tracks"] as? List<Map<String, Any>>)
                        ?: emptyList()
                } else emptyList()

                val parsed = tracksRaw.mapNotNull { raw ->
                    val id = (raw["id"] as? String) ?: (raw["providerTrackId"] as? String) ?: return@mapNotNull null
                    val title = raw["title"] as? String ?: return@mapNotNull null
                    val artist = raw["artist"] as? String ?: "Unknown Artist"
                    val thumbnail = raw["thumbnail"] as? String
                    val duration = (raw["duration"] as? Number)?.toDouble() ?: 210.0
                    val audioSource = raw["audioSource"] as? Map<*, *>
                    val providerTrackId = (audioSource?.get("providerTrackId") as? String)
                        ?: (raw["providerTrackId"] as? String)
                        ?: (raw["videoId"] as? String)
                        ?: extractIdFromThumbnail(thumbnail)

                    NativeTrack(
                        id = id,
                        canonicalTrackId = raw["canonicalTrackId"] as? String ?: id,
                        title = title,
                        artist = artist,
                        album = raw["album"] as? String,
                        thumbnail = thumbnail,
                        duration = duration,
                        genre = raw["genre"] as? String,
                        providerTrackId = providerTrackId,
                        streamUrl = "https://mrj-music.vercel.app/api/music/stream/${providerTrackId ?: id}"
                    )
                }

                    if (parsed.isNotEmpty()) {
                        mainHandler.post {
                            val currentSlice = mutableListOf(track)
                            val existingIds = mutableSetOf(track.id)
                            val existingTitles = mutableSetOf(normalizeTitleForDeduplication(track.title))
                            val fresh = mutableListOf<NativeTrack>()

                            for (p in parsed) {
                                val norm = normalizeTitleForDeduplication(p.title)
                                val isDup = existingIds.contains(p.id) || existingTitles.any { exist ->
                                    exist == norm || (norm.length >= 4 && exist.contains(norm)) || (exist.length >= 4 && norm.contains(exist))
                                }
                                if (!isDup && norm.isNotBlank()) {
                                    fresh.add(p)
                                    existingIds.add(p.id)
                                    existingTitles.add(norm)
                                }
                            }

                            if (fresh.isNotEmpty()) {
                                queue.clear()
                                queue.addAll(currentSlice)
                                queue.addAll(fresh)
                                queueIndex = 0
                                listeners.forEach { it.onQueueChange(queue, queueIndex) }
                                Log.d(TAG, "⚡ Dynamic Autoplay Queue Morphed: ${queue.size} total tracks (Harmonized with ${track.title})")
                            }
                        }
                    } else {
                        // Fallback: Query artist & similar songs to generate dynamic AI queue
                        val fallbackQuery = if (track.artist.isNotBlank() && track.artist != "Unknown Artist") "${track.artist} top songs" else "${track.title} similar"
                        val searchRes = MRJApiClient.apiService.search(query = fallbackQuery, type = "songs")
                        if (searchRes.isSuccessful && searchRes.body() != null) {
                            val fallbackRaw = (searchRes.body()!!["songs"] as? List<Map<String, Any>>)
                                ?: (searchRes.body()!!["results"] as? List<Map<String, Any>>)
                                ?: emptyList()

                            val fallbackParsed = fallbackRaw.mapNotNull { raw ->
                                val id = (raw["id"] as? String) ?: (raw["providerTrackId"] as? String) ?: return@mapNotNull null
                                val title = raw["title"] as? String ?: return@mapNotNull null
                                val artist = raw["artist"] as? String ?: "Unknown Artist"
                                val thumbnail = raw["thumbnail"] as? String
                                val duration = (raw["duration"] as? Number)?.toDouble() ?: 210.0
                                val audioSource = raw["audioSource"] as? Map<*, *>
                                val providerTrackId = (audioSource?.get("providerTrackId") as? String)
                                    ?: (raw["providerTrackId"] as? String)
                                    ?: (raw["videoId"] as? String)
                                    ?: extractIdFromThumbnail(thumbnail)

                                NativeTrack(
                                    id = id,
                                    canonicalTrackId = raw["canonicalTrackId"] as? String ?: id,
                                    title = title,
                                    artist = artist,
                                    album = raw["album"] as? String,
                                    thumbnail = thumbnail,
                                    duration = duration,
                                    genre = raw["genre"] as? String,
                                    providerTrackId = providerTrackId,
                                    streamUrl = "https://mrj-music.vercel.app/api/music/stream/${providerTrackId ?: id}"
                                )
                            }

                            mainHandler.post {
                                val currentSlice = mutableListOf(track)
                                val existingIds = mutableSetOf(track.id)
                                val existingTitles = mutableSetOf(normalizeTitleForDeduplication(track.title))
                                val fresh = mutableListOf<NativeTrack>()

                                for (p in fallbackParsed) {
                                    val norm = normalizeTitleForDeduplication(p.title)
                                    val isDup = existingIds.contains(p.id) || existingTitles.any { exist ->
                                        exist == norm || (norm.length >= 4 && exist.contains(norm)) || (exist.length >= 4 && norm.contains(exist))
                                    }
                                    if (!isDup && norm.isNotBlank()) {
                                        fresh.add(p)
                                        existingIds.add(p.id)
                                        existingTitles.add(norm)
                                    }
                                }

                                if (fresh.isNotEmpty()) {
                                    queue.clear()
                                    queue.addAll(currentSlice)
                                    queue.addAll(fresh)
                                    queueIndex = 0
                                    listeners.forEach { it.onQueueChange(queue, queueIndex) }
                                    Log.d(TAG, "⚡ Dynamic Autoplay Queue Fallback Morphed: ${queue.size} total tracks")
                                }
                            }
                        }
                    }
            } catch (e: Exception) {
                Log.w(TAG, "fetchDynamicAutoplayQueue failed: ${e.message}")
            }
        }
    }

    private fun normalizeTitleForDeduplication(title: String): String {
        return title.lowercase()
            .replace(Regex("""\(.*?\)|\[.*?\]"""), "")
            .replace(Regex("""(?i)\b(official|video|audio|lyrics|lyrical|full|song|hd|4k|feat|ft|remix|slowed|reverb|version|release|views|minutes|ago)\b"""), "")
            .replace(Regex("""[^a-z0-9\s]"""), " ")
            .replace(Regex("""\s+"""), " ")
            .trim()
    }

    private fun isValidYouTubeId(id: String?): Boolean {
        if (id.isNullOrBlank()) return false
        if (id.length != 11) return false
        if (id.contains("|") || id.contains(" ") || id.contains("/") || id.contains(".")) return false
        if (id.matches(Regex("""^[a-z]+-[a-z]+$"""))) return false
        return true
    }

    private fun extractIdFromThumbnail(thumbnail: String?): String? {
        if (thumbnail.isNullOrBlank()) return null
        val viRegex = Regex("""/vi/([a-zA-Z0-9_-]{11})/""")
        return viRegex.find(thumbnail)?.groupValues?.get(1)
    }

    fun isNetworkConnected(): Boolean {
        return try {
            val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as? android.net.ConnectivityManager ?: return false
            val activeNet = cm.activeNetwork ?: return false
            val caps = cm.getNetworkCapabilities(activeNet) ?: return false
            caps.hasCapability(android.net.NetworkCapabilities.NET_CAPABILITY_INTERNET)
        } catch (_: Exception) {
            true // fallback to true if permission or reflection error
        }
    }

    fun resolveYouTubeVideoId(track: NativeTrack): String? {
        val fromThumb = extractIdFromThumbnail(track.thumbnail)
        if (isValidYouTubeId(fromThumb)) {
            return fromThumb
        }

        val stream = track.streamUrl ?: ""
        val urlRegex = Regex("""(?:v=|youtu\.be/|/stream/|/embed/)([a-zA-Z0-9_-]{11})""")
        val urlMatch = urlRegex.find(stream)
        if (urlMatch != null && isValidYouTubeId(urlMatch.groupValues[1])) {
            return urlMatch.groupValues[1]
        }

        val pid = track.providerTrackId?.trim()?.removePrefix("yt_")?.removePrefix("yt:")
        if (isValidYouTubeId(pid)) {
            return pid
        }

        val tid = track.id.trim().removePrefix("yt_").removePrefix("yt:")
        if (isValidYouTubeId(tid)) {
            return tid
        }

        return null
    }

    fun pause() {
        releaseHardwareLocks()
        audioFocusManager.onPlaybackStopped()
        if (isUsingNativeExo) {
            try { player.pause() } catch (e: Exception) { Log.w(TAG, "pause() error: ${e.message}") }
        } else {
            _isPlaying.value = false
            try { player.pause() } catch (_: Exception) {}
            mainHandler.post { webView?.evaluateJavascript("pauseVideo();", null) }
            listeners.forEach { it.onPlaybackStateChange(false, false) }
        }
    }

    fun resume() {
        audioFocusManager.onPlaybackStarted()
        acquireHardwareLocks()
        setVolume(0.05f)
        if (isUsingNativeExo) {
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
        } else {
            _isPlaying.value = true
            try {
                if (player.playbackState == Player.STATE_IDLE) {
                    val silenceSource = androidx.media3.exoplayer.source.SilenceMediaSource(86400000000L)
                    player.setMediaSource(silenceSource)
                    player.prepare()
                }
                player.play()
            } catch (_: Exception) {}
            mainHandler.post { webView?.evaluateJavascript("resumeVideo();", null) }
            listeners.forEach { it.onPlaybackStateChange(true, false) }
        }
        fadeVolume(from = 0.05f, to = 1.0f, durationMs = 300L)
    }

    fun togglePlay() {
        if (_isPlaying.value) {
            fadeVolume(from = 1.0f, to = 0.0f, durationMs = 120L) {
                pause()
                setVolume(1.0f)
            }
        } else {
            resume()
        }
    }

    fun togglePlayPause() {
        togglePlay()
    }

    fun setAutoplay(enabled: Boolean) {
        autoplayEnabled = enabled
        secureStorage.saveAutoplayEnabled(enabled)
        Log.d(TAG, "Autoplay updated to: $enabled")
        listeners.forEach { it.onAutoplayChange(enabled) }
    }

    fun toggleAutoplay() {
        setAutoplay(!autoplayEnabled)
    }

    fun seekTo(positionMs: Long) {
        if (isUsingNativeExo) {
            try { player.seekTo(positionMs) } catch (e: Exception) { Log.w(TAG, "seekTo() error: ${e.message}") }
        } else {
            val sec = positionMs / 1000.0
            mainHandler.post { webView?.evaluateJavascript("seekTo($sec);", null) }
        }
    }

    fun playNext(isUserInitiated: Boolean = true) {
        if (!isUserInitiated && !autoplayEnabled) {
            Log.d(TAG, "playNext called automatically but autoplayEnabled is false — pausing at end of song")
            _isPlaying.value = false
            pause()
            return
        }

        val curr = _currentTrack.value
        if (isUserInitiated && curr != null) {
            val playedSec = (_position.value / 1000).toInt()
            behaviorTracker.onTrackSkipped(curr, playedSec)
            if (playedSec < 15) {
                fetchDynamicAutoplayQueue(curr, isEarlySkip = true)
            }
        }

        if (queue.isEmpty()) {
            if (curr != null) {
                fetchDynamicAutoplayQueue(curr)
            }
            triggerOfflineAutoplay()
            return
        }

        if (queueIndex < queue.size - 1) {
            queueIndex++
            playTrack(queue[queueIndex])

            if (queue.size - queueIndex <= 3 && autoplayEnabled) {
                fetchDynamicAutoplayQueue(queue[queueIndex])
            }
        } else if (autoplayEnabled || isUserInitiated) {
            val lastTrack = _currentTrack.value ?: queue.lastOrNull()
            if (lastTrack != null) {
                fetchDynamicAutoplayQueue(lastTrack)
            }
            triggerOfflineAutoplay()
        } else {
            _isPlaying.value = false
            pause()
        }
    }

    fun playPrevious() {
        try {
            if (_position.value > 3000) {
                seekTo(0)
                return
            }
            if (queueIndex > 0) {
                queueIndex--
                playTrack(queue[queueIndex])
            } else {
                seekTo(0)
            }
        } catch (e: Exception) {
            Log.w(TAG, "playPrevious error: ${e.message}")
        }
    }

    fun setShuffle(enabled: Boolean) {
        isShuffleEnabled = enabled
        if (isShuffleEnabled && queue.size > 1) {
            val current = _currentTrack.value
            val remaining = queue.filter { it.id != current?.id }.shuffled()
            queue.clear()
            if (current != null) queue.add(current)
            queue.addAll(remaining)
            queueIndex = 0
        }
        listeners.forEach { it.onQueueChange(queue, queueIndex) }
    }

    fun toggleShuffle() {
        setShuffle(!isShuffleEnabled)
    }

    fun reorderQueue(fromIndex: Int, toIndex: Int) {
        if (fromIndex in queue.indices && toIndex in queue.indices) {
            val item = queue.removeAt(fromIndex)
            queue.add(toIndex, item)
            val current = _currentTrack.value
            if (current != null) {
                queueIndex = queue.indexOfFirst { it.id == current.id }.coerceAtLeast(0)
            }
            listeners.forEach { it.onQueueChange(queue, queueIndex) }
        }
    }

    fun removeTrackFromQueue(index: Int) {
        if (index in queue.indices) {
            val isCurrent = (index == queueIndex)
            queue.removeAt(index)
            if (isCurrent) {
                if (queue.isNotEmpty()) {
                    queueIndex = queueIndex.coerceAtMost(queue.size - 1)
                    playTrack(queue[queueIndex])
                } else {
                    pause()
                }
            } else if (index < queueIndex) {
                queueIndex--
            }
            listeners.forEach { it.onQueueChange(queue, queueIndex) }
        }
    }

    fun clearQueueExceptCurrent() {
        val current = _currentTrack.value
        queue.clear()
        if (current != null) {
            queue.add(current)
            queueIndex = 0
        }
        listeners.forEach { it.onQueueChange(queue, queueIndex) }
    }

    fun insertNextInQueue(track: NativeTrack) {
        if (queue.isEmpty()) {
            queue.add(track)
            queueIndex = 0
        } else {
            val insertIndex = (queueIndex + 1).coerceAtMost(queue.size)
            queue.add(insertIndex, track)
        }
        listeners.forEach { it.onQueueChange(queue, queueIndex) }
    }

    fun addToQueue(track: NativeTrack) {
        queue.add(track)
        listeners.forEach { it.onQueueChange(queue, queueIndex) }
    }

    private fun handleTrackEnded() {
        val currPos = _position.value
        val dur = _duration.value
        val isActuallyEnded = (dur > 10_000L && currPos >= (dur * 0.85).toLong())
                || (dur > 0L && (dur - currPos) <= 5_000L && currPos > 15_000L)
                || (dur == 0L && (System.currentTimeMillis() - trackStartTimestamp) > 30_000L)

        if (!isActuallyEnded) {
            Log.w(TAG, "Spurious track-ended event received at pos=${currPos}ms / dur=${dur}ms. Ignoring false trigger.")
            return
        }

        consecutiveErrorCount = 0
        val curr = _currentTrack.value
        if (curr != null) {
            val durationSec = (curr.duration).toInt()
            behaviorTracker.onProgress(curr, (durationSec * 1000).toLong(), (durationSec * 1000).toLong())
        }

        if (_sleepTimerState.value.isEndOfTrack) {
            Log.d(TAG, "Sleep timer 'End of Track' reached — pausing playback")
            pause()
            _sleepTimerState.value = SleepTimerState()
            return
        }

        playNext(isUserInitiated = false)
    }

    private fun triggerOfflineAutoplay() {
        try {
            val offlineList = offlineStorage.getAllDownloadedTracks()
            if (offlineList.isNotEmpty()) {
                val nextOffline = offlineList.shuffled().firstOrNull { it.id != _currentTrack.value?.id } ?: offlineList.first()
                Log.d(TAG, "Autoplaying next offline vault track: ${nextOffline.title}")
                playTrack(nextOffline)
            }
        } catch (e: Exception) {
            Log.w(TAG, "Offline autoplay fallback failed: ${e.message}")
        }
    }

    fun release() {
        try {
            releaseHardwareLocks()
            audioFocusManager.onPlaybackStopped()
            player.release()
            webView?.destroy()
            webView = null
        } catch (e: Exception) {
            Log.w(TAG, "release() exception: ${e.message}")
        }
    }
}
