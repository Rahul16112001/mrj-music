package com.mrj.music.service

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.wifi.WifiManager
import android.os.Build
import android.os.PowerManager
import android.util.Log
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
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.net.URL

private const val TAG = "MRJMediaSessionService"

class MRJMediaSessionService : MediaSessionService(), PlayerEventListener {
    private var mediaSession: MediaSession? = null
    private lateinit var playerManager: MRJExoPlayerManager
    private val notificationManager by lazy {
        getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    }

    private var wakeLock: PowerManager.WakeLock? = null
    private var wifiLock: WifiManager.WifiLock? = null
    private var artworkJob: Job? = null
    private var cachedArtwork: Pair<String, Bitmap>? = null

    companion object {
        const val CHANNEL_ID = "mrj_playback_channel_v3"
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

        val callback = object : MediaSession.Callback {
            override fun onPlayerCommandRequest(
                session: MediaSession,
                controller: MediaSession.ControllerInfo,
                playerCommand: Int
            ): Int {
                Log.d(TAG, "onPlayerCommandRequest: $playerCommand")
                when (playerCommand) {
                    androidx.media3.common.Player.COMMAND_PLAY_PAUSE -> {
                        playerManager.togglePlayPause()
                        return androidx.media3.session.SessionResult.RESULT_SUCCESS
                    }
                    androidx.media3.common.Player.COMMAND_STOP -> {
                        playerManager.pause()
                        return androidx.media3.session.SessionResult.RESULT_SUCCESS
                    }
                    androidx.media3.common.Player.COMMAND_SEEK_TO_NEXT,
                    androidx.media3.common.Player.COMMAND_SEEK_TO_NEXT_MEDIA_ITEM -> {
                        playerManager.playNext()
                        return androidx.media3.session.SessionResult.RESULT_SUCCESS
                    }
                    androidx.media3.common.Player.COMMAND_SEEK_TO_PREVIOUS,
                    androidx.media3.common.Player.COMMAND_SEEK_TO_PREVIOUS_MEDIA_ITEM -> {
                        playerManager.playPrevious()
                        return androidx.media3.session.SessionResult.RESULT_SUCCESS
                    }
                }
                return super.onPlayerCommandRequest(session, controller, playerCommand)
            }
        }

        mediaSession = MediaSession.Builder(this, playerManager.player)
            .setCallback(callback)
            .setSessionActivity(pendingIntent)
            .build()
    }

    private fun acquireLocks() {
        try {
            if (wakeLock == null) {
                val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
                wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "MRJMusic:PlaybackWakeLock").apply {
                    setReferenceCounted(false)
                }
            }
            if (wakeLock?.isHeld == false) {
                wakeLock?.acquire(24 * 60 * 60 * 1000L) // 24 hours max
                Log.d(TAG, "WakeLock acquired for background playback")
            }

            if (wifiLock == null) {
                val wm = applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
                wifiLock = wm.createWifiLock(WifiManager.WIFI_MODE_FULL_HIGH_PERF, "MRJMusic:PlaybackWifiLock").apply {
                    setReferenceCounted(false)
                }
            }
            if (wifiLock?.isHeld == false) {
                wifiLock?.acquire()
                Log.d(TAG, "WifiLock acquired for background streaming")
            }
        } catch (e: Exception) {
            Log.w(TAG, "Error acquiring locks: ${e.message}")
        }
    }

    private fun releaseLocks() {
        try {
            if (wakeLock?.isHeld == true) {
                wakeLock?.release()
                Log.d(TAG, "WakeLock released")
            }
            if (wifiLock?.isHeld == true) {
                wifiLock?.release()
                Log.d(TAG, "WifiLock released")
            }
        } catch (e: Exception) {
            Log.w(TAG, "Error releasing locks: ${e.message}")
        }
    }

    override fun onGetSession(controllerInfo: MediaSession.ControllerInfo): MediaSession? {
        return mediaSession
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        Log.d(TAG, "onStartCommand action: ${intent?.action}")
        when (intent?.action) {
            ACTION_PLAY_PAUSE -> playerManager.togglePlayPause()
            ACTION_PLAY -> playerManager.resume()
            ACTION_PAUSE -> playerManager.pause()
            ACTION_NEXT -> playerManager.playNext()
            ACTION_PREVIOUS -> playerManager.playPrevious()
            ACTION_STOP -> {
                playerManager.pause()
                releaseLocks()
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                    stopForeground(STOP_FOREGROUND_REMOVE)
                } else {
                    @Suppress("DEPRECATION")
                    stopForeground(true)
                }
                notificationManager.cancel(NOTIFICATION_ID)
                stopSelf()
            }
        }
        return START_STICKY
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
                enableVibration(false)
                lockscreenVisibility = NotificationCompat.VISIBILITY_PUBLIC
            }
            notificationManager.createNotificationChannel(channel)
        }
    }

    private fun getActionPendingIntent(action: String, requestCode: Int): PendingIntent {
        val intent = Intent(this, MRJMediaActionReceiver::class.java).apply {
            this.action = action
        }
        return PendingIntent.getBroadcast(
            this, requestCode, intent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
    }

    private var currentLoadingTrackId: String? = null

    private fun updateNotification(track: NativeTrack?, isPlaying: Boolean) {
        if (track == null) {
            releaseLocks()
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                stopForeground(STOP_FOREGROUND_REMOVE)
            } else {
                @Suppress("DEPRECATION")
                stopForeground(true)
            }
            notificationManager.cancel(NOTIFICATION_ID)
            return
        }

        if (isPlaying) {
            acquireLocks()
        } else {
            releaseLocks()
        }

        val openAppIntent = PendingIntent.getActivity(
            this, 0,
            Intent(this, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
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

        // Use cached bitmap if ready, else use default app icon
        val currentArtwork = cachedArtwork?.takeIf { it.first == track.id }?.second
            ?: BitmapFactory.decodeResource(resources, R.mipmap.ic_launcher)

        val mediaStyle = MediaStyle()
            .setShowActionsInCompactView(0, 1, 2)

        mediaSession?.sessionCompatToken?.let { token ->
            mediaStyle.setMediaSession(token)
        }

        val builder = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(track.title)
            .setContentText(track.artist)
            .setSubText(track.album ?: "MRJ Music")
            .setSmallIcon(R.mipmap.ic_launcher)
            .setLargeIcon(currentArtwork)
            .setContentIntent(openAppIntent)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setOngoing(isPlaying)
            .addAction(android.R.drawable.ic_media_previous, "Previous", prevIntent)
            .addAction(playPauseIcon, if (isPlaying) "Pause" else "Play", playPauseIntent)
            .addAction(android.R.drawable.ic_media_next, "Next", nextIntent)
            .setStyle(mediaStyle)

        val notification = builder.build()

        try {
            if (isPlaying) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
                } else {
                    startForeground(NOTIFICATION_ID, notification)
                }
            } else {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                    stopForeground(STOP_FOREGROUND_DETACH)
                }
                notificationManager.notify(NOTIFICATION_ID, notification)
            }
        } catch (e: Exception) {
            Log.w(TAG, "Notification post failed: ${e.message}")
        }

        // Fetch high-res artwork asynchronously if not already cached for this track
        val thumbUrl = track.thumbnail
        if (!thumbUrl.isNullOrBlank() && cachedArtwork?.first != track.id && currentLoadingTrackId != track.id) {
            currentLoadingTrackId = track.id
            CoroutineScope(Dispatchers.IO).launch {
                try {
                    val url = URL(thumbUrl)
                    val conn = url.openConnection()
                    conn.connectTimeout = 3000
                    conn.readTimeout = 3000
                    val bmp = BitmapFactory.decodeStream(conn.getInputStream())
                    if (bmp != null) {
                        cachedArtwork = Pair(track.id, bmp)
                        withContext(Dispatchers.Main) {
                            if (playerManager.currentTrack.value?.id == track.id) {
                                builder.setLargeIcon(bmp)
                                val updatedNotification = builder.build()
                                if (playerManager.isPlaying.value) {
                                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                                        startForeground(NOTIFICATION_ID, updatedNotification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
                                    } else {
                                        startForeground(NOTIFICATION_ID, updatedNotification)
                                    }
                                } else {
                                    notificationManager.notify(NOTIFICATION_ID, updatedNotification)
                                }
                            }
                        }
                    }
                } catch (e: Exception) {
                    Log.w(TAG, "Artwork fetch failed: ${e.message}")
                }
            }
        }
    }

    override fun onPlaybackStateChange(isPlaying: Boolean, isLoading: Boolean) {
        updateNotification(playerManager.currentTrack.value, isPlaying)
    }

    override fun onTrackChange(track: NativeTrack?) {
        updateNotification(track, playerManager.isPlaying.value)
    }

    override fun onPositionChange(positionMs: Long, durationMs: Long) {}
    override fun onQueueChange(queue: List<NativeTrack>, currentIndex: Int) {}
    override fun onError(errorMessage: String) {}

    override fun onDestroy() {
        releaseLocks()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            stopForeground(STOP_FOREGROUND_REMOVE)
        } else {
            @Suppress("DEPRECATION")
            stopForeground(true)
        }
        notificationManager.cancel(NOTIFICATION_ID)
        playerManager.removeListener(this)
        artworkJob?.cancel()
        mediaSession?.run {
            release()
            mediaSession = null
        }
        super.onDestroy()
    }
}
