package com.mrj.music.service

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.media3.common.Player
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

    private val CHANNEL_ID = "mrj_playback_channel"
    private val NOTIFICATION_ID = 1001

    override fun onCreate() {
        super.onCreate()
        playerManager = MRJExoPlayerManager.getInstance(this)
        playerManager.addListener(this)

        createNotificationChannel()

        // Build native Android MediaSession
        val intent = Intent(this, MainActivity::class.java)
        val pendingIntent = PendingIntent.getActivity(
            this, 0, intent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        mediaSession = MediaSession.Builder(this, playerManager.player)
            .setSessionActivity(pendingIntent)
            .build()
    }

    override fun onGetSession(controllerInfo: MediaSession.ControllerInfo): MediaSession? {
        return mediaSession
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val name = "Music Playback"
            val descriptionText = "Active media playback and controls"
            val importance = NotificationManager.IMPORTANCE_LOW
            val channel = NotificationChannel(CHANNEL_ID, name, importance).apply {
                description = descriptionText
                setShowBadge(false)
            }
            notificationManager.createNotificationChannel(channel)
        }
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
                    Intent(this@MRJMediaSessionService, MainActivity::class.java),
                    PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
                )

                val builder = NotificationCompat.Builder(this@MRJMediaSessionService, CHANNEL_ID)
                    .setContentTitle(track.title)
                    .setContentText(track.artist)
                    .setSubText(track.album ?: "MRJ Music")
                    .setSmallIcon(R.mipmap.ic_launcher)
                    .setContentIntent(openAppIntent)
                    .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                    .setPriority(NotificationCompat.PRIORITY_LOW)
                    .setOngoing(isPlaying)

                artworkBitmap?.let {
                    builder.setLargeIcon(it)
                }

                if (isPlaying) {
                    startForeground(NOTIFICATION_ID, builder.build())
                } else {
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
            player.release()
            release()
            mediaSession = null
        }
        super.onDestroy()
    }
}
