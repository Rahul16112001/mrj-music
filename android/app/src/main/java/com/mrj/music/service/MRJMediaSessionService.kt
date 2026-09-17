package com.mrj.music.service

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.media.app.NotificationCompat.MediaStyle
import androidx.media3.session.MediaSession
import androidx.media3.session.MediaSessionService
import com.mrj.music.MainActivity
import com.mrj.music.R
import com.mrj.music.model.NativeTrack
import com.mrj.music.player.PlayerEventListener
import com.mrj.music.player.UnifiedPlayerManager

/** Foreground media-session boundary. Playback remains owned by UnifiedPlayerManager. */
class MRJMediaSessionService : MediaSessionService(), PlayerEventListener {
    private lateinit var playerManager: UnifiedPlayerManager
    private var mediaSession: MediaSession? = null
    private val notificationManager by lazy {
        getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    }

    companion object {
        const val CHANNEL_ID = "mrj_playback_channel_v5"
        const val NOTIFICATION_ID = 1001
        const val ACTION_PLAY_PAUSE = "com.mrj.music.ACTION_PLAY_PAUSE"
        const val ACTION_PLAY = "com.mrj.music.ACTION_PLAY"
        const val ACTION_PAUSE = "com.mrj.music.ACTION_PAUSE"
        const val ACTION_NEXT = "com.mrj.music.ACTION_NEXT"
        const val ACTION_PREVIOUS = "com.mrj.music.ACTION_PREVIOUS"
        const val ACTION_STOP = "com.mrj.music.ACTION_STOP"
    }

    override fun onCreate() {
        super.onCreate()
        playerManager = UnifiedPlayerManager.getInstance(this)
        playerManager.addListener(this)
        createNotificationChannel()

        val sessionIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val sessionActivity = PendingIntent.getActivity(
            this, 0, sessionIntent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
        mediaSession = MediaSession.Builder(this, playerManager.player)
            .setSessionActivity(sessionActivity)
            .build()
    }

    override fun onGetSession(controllerInfo: MediaSession.ControllerInfo): MediaSession? = mediaSession

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        runCatching {
            when (intent?.action) {
                ACTION_PLAY_PAUSE -> playerManager.togglePlayPause()
                ACTION_PLAY -> playerManager.resume()
                ACTION_PAUSE -> playerManager.pause()
                ACTION_NEXT -> playerManager.playNext()
                ACTION_PREVIOUS -> playerManager.playPrevious()
                ACTION_STOP -> {
                    playerManager.pause()
                    stopForegroundCompat(remove = true)
                    stopSelf()
                }
            }
        }
        return START_STICKY
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID, "MRJ Music Playback", NotificationManager.IMPORTANCE_DEFAULT
            ).apply {
                description = "Playback controls and currently playing song"
                setShowBadge(false)
                lockscreenVisibility = NotificationCompat.VISIBILITY_PUBLIC
            }
            notificationManager.createNotificationChannel(channel)
        }
    }

    private fun actionPendingIntent(action: String, requestCode: Int): PendingIntent =
        PendingIntent.getBroadcast(
            this, requestCode,
            Intent(this, MRJMediaActionReceiver::class.java).apply { this.action = action },
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

    private fun updateNotification(track: NativeTrack?, isPlaying: Boolean) {
        if (track == null) {
            stopForegroundCompat(remove = true)
            return
        }
        val openAppIntent = PendingIntent.getActivity(
            this, 0,
            Intent(this, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
            },
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
        val mediaStyle = MediaStyle().setShowActionsInCompactView(0, 1, 2)
        mediaSession?.sessionCompatToken?.let(mediaStyle::setMediaSession)
        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(track.title)
            .setContentText(track.artist)
            .setSubText(track.album ?: "MRJ Music")
            .setContentIntent(openAppIntent)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setOngoing(isPlaying)
            .setOnlyAlertOnce(true)
            .addAction(android.R.drawable.ic_media_previous, "Previous", actionPendingIntent(ACTION_PREVIOUS, 1))
            .addAction(
                if (isPlaying) android.R.drawable.ic_media_pause else android.R.drawable.ic_media_play,
                if (isPlaying) "Pause" else "Play",
                actionPendingIntent(ACTION_PLAY_PAUSE, 2)
            )
            .addAction(android.R.drawable.ic_media_next, "Next", actionPendingIntent(ACTION_NEXT, 3))
            .setStyle(mediaStyle)
            .build()

        runCatching {
            if (isPlaying) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
                } else {
                    @Suppress("DEPRECATION")
                    startForeground(NOTIFICATION_ID, notification)
                }
            } else {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) stopForeground(STOP_FOREGROUND_DETACH)
                notificationManager.notify(NOTIFICATION_ID, notification)
            }
        }
    }

    private fun stopForegroundCompat(remove: Boolean) {
        runCatching {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                stopForeground(if (remove) STOP_FOREGROUND_REMOVE else STOP_FOREGROUND_DETACH)
            } else {
                @Suppress("DEPRECATION")
                stopForeground(remove)
            }
            if (remove) notificationManager.cancel(NOTIFICATION_ID)
        }
    }

    override fun onPlaybackStateChange(isPlaying: Boolean, isLoading: Boolean) {
        updateNotification(playerManager.currentTrack.value, isPlaying)
    }

    override fun onTrackChange(track: NativeTrack?) {
        updateNotification(track, playerManager.isPlaying.value)
    }

    override fun onPositionChange(positionMs: Long, durationMs: Long) = Unit
    override fun onQueueChange(queue: List<NativeTrack>, currentIndex: Int) = Unit
    override fun onError(errorMessage: String) = Unit

    override fun onDestroy() {
        playerManager.removeListener(this)
        stopForegroundCompat(remove = true)
        mediaSession?.release()
        mediaSession = null
        super.onDestroy()
    }
}
