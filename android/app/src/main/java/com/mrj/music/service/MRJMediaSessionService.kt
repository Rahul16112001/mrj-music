package com.mrj.music.service

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
import androidx.media3.session.MediaSession
import androidx.media3.session.MediaSessionService
import com.mrj.music.MainActivity
import com.mrj.music.R
import com.mrj.music.model.NativeTrack
import com.mrj.music.player.MRJExoPlayerManager
import com.mrj.music.player.PlayerEventListener
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.net.URL

class MRJMediaSessionService : MediaSessionService(), PlayerEventListener {
    private var mediaSession: MediaSession? = null
    private lateinit var playerManager: MRJExoPlayerManager
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
    }

    override fun onCreate() {
        super.onCreate()
        playerManager = MRJExoPlayerManager.getInstance(this)
        playerManager.addListener(this)

        createNotificationChannel()

        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pendingIntent = PendingIntent.getActivity(
            this, 0, intent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        mediaSession = MediaSession.Builder(this, playerManager.player)
            .setSessionActivity(pendingIntent)
            .build()

        // Immediate initial foreground notification to prevent Android 14 background kill
        postInitialForegroundNotification()
    }

    private fun postInitialForegroundNotification() {
        try {
            val openAppIntent = PendingIntent.getActivity(
                this, 0,
                Intent(this, MainActivity::class.java).apply {
                    flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
                },
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
            )

            val builder = NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("MRJ Music")
                .setContentText("Playing high quality music")
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentIntent(openAppIntent)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setOngoing(true)

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(NOTIFICATION_ID, builder.build(), ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
            } else {
                startForeground(NOTIFICATION_ID, builder.build())
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    override fun onGetSession(controllerInfo: MediaSession.ControllerInfo): MediaSession? {
        return mediaSession
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_PLAY_PAUSE -> playerManager.togglePlay()
            ACTION_NEXT -> playerManager.playNext()
            ACTION_PREVIOUS -> playerManager.playPrevious()
            ACTION_STOP -> {
                playerManager.pause()
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
            }
        }
        return super.onStartCommand(intent, flags, startId)
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val name = "MRJ Music Playback"
            val descriptionText = "Lock screen and background playback controls"
            val importance = NotificationManager.IMPORTANCE_LOW
            val channel = NotificationChannel(CHANNEL_ID, name, importance).apply {
                description = descriptionText
                setShowBadge(false)
                setSound(null, null)
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

    private fun updateNotification(track: NativeTrack?, isPlaying: Boolean) {
        if (track == null) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                stopForeground(STOP_FOREGROUND_REMOVE)
            } else {
                @Suppress("DEPRECATION")
                stopForeground(true)
            }
            return
        }

        CoroutineScope(Dispatchers.IO).launch {
            var artworkBitmap: Bitmap? = null
            if (!track.thumbnail.isNullOrEmpty()) {
                try {
                    val url = URL(track.thumbnail)
                    artworkBitmap = BitmapFactory.decodeStream(url.openConnection().getInputStream())
                } catch (_: Exception) {}
            }

            withContext(Dispatchers.Main) {
                val openAppIntent = PendingIntent.getActivity(
                    this@MRJMediaSessionService, 0,
                    Intent(this@MRJMediaSessionService, MainActivity::class.java).apply {
                        this.flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
                    },
                    PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
                )

                val prevIntent = getActionPendingIntent(ACTION_PREVIOUS, 1)
                val playPauseIntent = getActionPendingIntent(ACTION_PLAY_PAUSE, 2)
                val nextIntent = getActionPendingIntent(ACTION_NEXT, 3)

                val playPauseIcon = if (isPlaying) {
                    android.R.drawable.ic_media_pause
                } else {
                    android.R.drawable.ic_media_play
                }

                val builder = NotificationCompat.Builder(this@MRJMediaSessionService, CHANNEL_ID)
                    .setContentTitle(track.title)
                    .setContentText(track.artist)
                    .setSubText(track.album ?: "MRJ Music")
                    .setSmallIcon(R.mipmap.ic_launcher)
                    .setContentIntent(openAppIntent)
                    .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                    .setPriority(NotificationCompat.PRIORITY_LOW)
                    .setOngoing(isPlaying)
                    .addAction(android.R.drawable.ic_media_previous, "Previous", prevIntent)
                    .addAction(playPauseIcon, if (isPlaying) "Pause" else "Play", playPauseIntent)
                    .addAction(android.R.drawable.ic_media_next, "Next", nextIntent)
                    .setStyle(
                        MediaStyle()
                            .setShowActionsInCompactView(0, 1, 2)
                    )

                artworkBitmap?.let {
                    builder.setLargeIcon(it)
                }

                if (isPlaying) {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                        startForeground(NOTIFICATION_ID, builder.build(), ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
                    } else {
                        startForeground(NOTIFICATION_ID, builder.build())
                    }
                } else {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                        stopForeground(STOP_FOREGROUND_DETACH)
                    }
                    notificationManager.notify(NOTIFICATION_ID, builder.build())
                }
            }
        }
    }

    override fun onPlaybackStateChange(isPlaying: Boolean, isLoading: Boolean) {
        updateNotification(playerManager.currentTrack, isPlaying)
    }

    override fun onTrackChange(track: NativeTrack?) {
        updateNotification(track, playerManager.player.isPlaying)
    }

    override fun onPositionChange(positionMs: Long, durationMs: Long) {}
    override fun onQueueChange(queue: List<NativeTrack>, currentIndex: Int) {}
    override fun onError(errorMessage: String) {}

    override fun onDestroy() {
        playerManager.removeListener(this)
        mediaSession?.run {
            release()
            mediaSession = null
        }
        super.onDestroy()
    }
}
