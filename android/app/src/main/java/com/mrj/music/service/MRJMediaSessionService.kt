package com.mrj.music.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.media.app.NotificationCompat.MediaStyle
import androidx.media3.common.util.UnstableApi
import androidx.media3.session.MediaSession
import androidx.media3.session.MediaSessionService
import com.mrj.music.MainActivity
import com.mrj.music.R
import com.mrj.music.bridge.MRJNativePlayerPlugin
import com.mrj.music.model.NativeTrack
import com.mrj.music.player.MRJExoPlayerManager
import com.mrj.music.player.PlayerEventListener
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.net.URL

/**
 * Foreground service that owns ONLY the media notification + lock-screen surface.
 *
 * The audio itself plays in the WebView (YouTube IFrame / HTML5 Audio); the retained
 * ExoPlayer is kept idle (see [MRJExoPlayerManager]). Transport buttons therefore do NOT
 * control a native player — they relay a `remoteCommand` event to JS, which drives the
 * real engine.
 *
 * Fixes vs. the previous version:
 *  - No hardcoded "MRJ Music / Playing high quality music" placeholder on create (that was
 *    the stuck notification). The notification is posted only once JS sends real metadata.
 *  - Media3 ~5s foreground rule: the notification is posted WITHOUT artwork and
 *    startForeground() is called synchronously; artwork is fetched off-thread and the
 *    notification is re-posted. Fetching art before the first startForeground crashed on
 *    slow networks (ForegroundServiceDidNotStartInTimeException).
 *  - onTaskRemoved tears the notification down when the app is swiped away.
 *  - Dark colorized MediaStyle + monochrome small icon (no white "MRJ…" blob).
 */
@androidx.annotation.OptIn(UnstableApi::class)
class MRJMediaSessionService : MediaSessionService(), PlayerEventListener {
    private var mediaSession: MediaSession? = null
    private lateinit var playerManager: MRJExoPlayerManager
    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val notificationManager by lazy {
        getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    }

    companion object {
        const val CHANNEL_ID = "mrj_playback_channel"
        const val NOTIFICATION_ID = 1001
        const val ACTION_PLAY_PAUSE = "com.mrj.music.ACTION_PLAY_PAUSE"
        const val ACTION_NEXT = "com.mrj.music.ACTION_NEXT"
        const val ACTION_PREVIOUS = "com.mrj.music.ACTION_PREVIOUS"
        const val ACTION_STOP = "com.mrj.music.ACTION_STOP"
        private const val NOTIFICATION_COLOR = 0xFF030303.toInt()
    }

    override fun onCreate() {
        super.onCreate()
        playerManager = MRJExoPlayerManager.getInstance(this)
        playerManager.addListener(this)

        createNotificationChannel()

        val pendingIntent = PendingIntent.getActivity(
            this, 0,
            Intent(this, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
            },
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        mediaSession = MediaSession.Builder(this, playerManager.player)
            .setSessionActivity(pendingIntent)
            .build()

        // When started via startForegroundService (from updateMetadata, which sets the
        // track first), post the real notification immediately to satisfy the ~5s rule.
        val track = playerManager.currentTrack
        if (track != null) {
            updateNotification(track, playerManager.lastKnownPlaying)
        } else {
            // Safety net only: if we were ever started without a track we must still call
            // startForeground within ~5s or the OS kills us. Replaced by real metadata
            // as soon as JS sends it.
            startForegroundCompat(buildMinimalNotification())
        }
    }

    override fun onGetSession(controllerInfo: MediaSession.ControllerInfo): MediaSession? {
        return mediaSession
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            // Relay transport to JS — the WebView is the real engine. Must match the
            // uppercase command strings the web bridge dispatches on.
            ACTION_PLAY_PAUSE -> MRJNativePlayerPlugin.emitRemoteCommand("PLAY_PAUSE")
            ACTION_NEXT -> MRJNativePlayerPlugin.emitRemoteCommand("NEXT")
            ACTION_PREVIOUS -> MRJNativePlayerPlugin.emitRemoteCommand("PREVIOUS")
            ACTION_STOP -> {
                // JS-initiated teardown (playback ended, no autoplay). Do NOT emit a
                // remoteCommand here — that would loop back into stop().
                removeForeground()
                stopSelf()
                return START_NOT_STICKY
            }
        }
        super.onStartCommand(intent, flags, startId)
        // Not sticky: the notification is meaningless without the live WebView, so don't
        // let the OS resurrect a bare service (which produced the stuck notification).
        return START_NOT_STICKY
    }

    // Suppress Media3's own auto-notification so it never competes with ours on the idle
    // metadata-only player. We manage the foreground notification ourselves.
    override fun onUpdateNotification(session: MediaSession, startInForegroundRequired: Boolean) {
        // Intentionally no-op.
    }

    override fun onTaskRemoved(rootIntent: Intent?) {
        // Online audio lives in the WebView, which dies with the task; nothing to keep
        // alive, so clear the notification instead of leaving it stuck.
        removeForeground()
        stopSelf()
        super.onTaskRemoved(rootIntent)
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "MRJ Music Playback",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Lock screen and background playback controls"
                setShowBadge(false)
                setSound(null, null)
                enableVibration(false)
            }
            notificationManager.createNotificationChannel(channel)
        }
    }

    private fun getActionPendingIntent(action: String, requestCode: Int): PendingIntent {
        val intent = Intent(this, MRJMediaSessionService::class.java).apply {
            this.action = action
        }
        return PendingIntent.getService(
            this, requestCode, intent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
    }

    private fun contentPendingIntent(): PendingIntent {
        return PendingIntent.getActivity(
            this, 0,
            Intent(this, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
            },
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
    }

    private fun buildNotification(track: NativeTrack, isPlaying: Boolean, artwork: Bitmap?): Notification {
        val prevIntent = getActionPendingIntent(ACTION_PREVIOUS, 1)
        val playPauseIntent = getActionPendingIntent(ACTION_PLAY_PAUSE, 2)
        val nextIntent = getActionPendingIntent(ACTION_NEXT, 3)

        val playPauseIcon = if (isPlaying) {
            android.R.drawable.ic_media_pause
        } else {
            android.R.drawable.ic_media_play
        }

        val builder = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(track.title)
            .setContentText(track.artist)
            .setSubText(track.album ?: "MRJ Music")
            .setSmallIcon(R.drawable.ic_stat_music)
            .setContentIntent(contentPendingIntent())
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setColor(NOTIFICATION_COLOR)
            .setColorized(true)
            .setOnlyAlertOnce(true)
            .setOngoing(isPlaying)
            .addAction(android.R.drawable.ic_media_previous, "Previous", prevIntent)
            .addAction(playPauseIcon, if (isPlaying) "Pause" else "Play", playPauseIntent)
            .addAction(android.R.drawable.ic_media_next, "Next", nextIntent)
            .setStyle(MediaStyle().setShowActionsInCompactView(0, 1, 2))

        artwork?.let { builder.setLargeIcon(it) }
        return builder.build()
    }

    private fun buildMinimalNotification(): Notification {
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("MRJ Music")
            .setSmallIcon(R.drawable.ic_stat_music)
            .setContentIntent(contentPendingIntent())
            .setColor(NOTIFICATION_COLOR)
            .setColorized(true)
            .setOnlyAlertOnce(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    private fun startForegroundCompat(notification: Notification) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
    }

    // stopForeground(int) + STOP_FOREGROUND_* flags require API 24; minSdk is 22, so fall
    // back to the boolean overload on older devices (true = remove, false = detach/keep).
    private fun removeForeground() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            stopForeground(STOP_FOREGROUND_REMOVE)
        } else {
            @Suppress("DEPRECATION")
            stopForeground(true)
        }
    }

    private fun detachForeground() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            stopForeground(STOP_FOREGROUND_DETACH)
        } else {
            @Suppress("DEPRECATION")
            stopForeground(false)
        }
    }

    private fun updateNotification(track: NativeTrack?, isPlaying: Boolean) {
        if (track == null) {
            removeForeground()
            return
        }

        // 1) Post immediately WITHOUT artwork and go foreground synchronously (~5s rule).
        val base = buildNotification(track, isPlaying, null)
        if (isPlaying) {
            startForegroundCompat(base)
        } else {
            // Paused → detach from foreground so the user can swipe it away.
            detachForeground()
            notificationManager.notify(NOTIFICATION_ID, base)
        }

        // 2) Fetch artwork off-thread, then re-post with the bitmap (no startForeground
        //    needed the second time). Guarded so we only update if still the same track.
        val thumb = track.thumbnail
        if (!thumb.isNullOrBlank()) {
            serviceScope.launch {
                val art = try {
                    val conn = URL(thumb).openConnection().apply {
                        connectTimeout = 8000
                        readTimeout = 8000
                    }
                    BitmapFactory.decodeStream(conn.getInputStream())
                } catch (_: Exception) {
                    null
                }
                if (art != null) {
                    withContext(Dispatchers.Main) {
                        if (playerManager.currentTrack?.id == track.id) {
                            notificationManager.notify(
                                NOTIFICATION_ID,
                                buildNotification(track, playerManager.lastKnownPlaying, art)
                            )
                        }
                    }
                }
            }
        }
    }

    override fun onPlaybackStateChange(isPlaying: Boolean, isLoading: Boolean) {
        updateNotification(playerManager.currentTrack, isPlaying)
    }

    override fun onTrackChange(track: NativeTrack?) {
        updateNotification(track, playerManager.lastKnownPlaying)
    }

    override fun onPositionChange(positionMs: Long, durationMs: Long) {}
    override fun onQueueChange(queue: List<NativeTrack>, currentIndex: Int) {}
    override fun onError(errorMessage: String) {}

    override fun onDestroy() {
        serviceScope.cancel()
        playerManager.removeListener(this)
        mediaSession?.run {
            release()
            mediaSession = null
        }
        super.onDestroy()
    }
}
