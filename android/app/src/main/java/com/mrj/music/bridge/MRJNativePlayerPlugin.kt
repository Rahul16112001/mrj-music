package com.mrj.music.bridge

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.google.gson.Gson
import com.mrj.music.model.NativeTrack
import com.mrj.music.player.MRJExoPlayerManager
import com.mrj.music.player.PlayerEventListener
import com.mrj.music.service.MRJMediaSessionService
import com.mrj.music.storage.NativeOfflineStorage

@CapacitorPlugin(name = "MRJNativePlayer")
class MRJNativePlayerPlugin : Plugin(), PlayerEventListener {
    private val gson = Gson()
    private lateinit var playerManager: MRJExoPlayerManager
    private lateinit var offlineStorage: NativeOfflineStorage

    override fun load() {
        super.load()
        pluginInstance = this
        val ctx = context.applicationContext
        playerManager = MRJExoPlayerManager.getInstance(ctx)
        offlineStorage = NativeOfflineStorage.getInstance(ctx)
        playerManager.addListener(this)
        // NOTE: the foreground MediaSessionService is intentionally NOT started here.
        // Starting it on every launch posted a placeholder notification before any
        // playback (the stuck "MRJ Music" notification). It now starts on first
        // updateMetadata with a real track.
    }

    @PluginMethod
    fun isNativeAvailable(call: PluginCall) {
        val res = JSObject()
        res.put("available", true)
        res.put("version", "2.0.0")
        res.put("engine", "AndroidX Media3 / ExoPlayer")
        call.resolve(res)
    }

    @PluginMethod
    fun playTrack(call: PluginCall) {
        val trackObj = call.getObject("track")
        if (trackObj == null) {
            call.reject("Track object is required")
            return
        }

        val track = gson.fromJson(trackObj.toString(), NativeTrack::class.java)
        val queueArray = call.getArray("queue")
        val queueList = mutableListOf<NativeTrack>()

        if (queueArray != null) {
            for (i in 0 until queueArray.length()) {
                val item = queueArray.getJSONObject(i)
                val t = gson.fromJson(item.toString(), NativeTrack::class.java)
                queueList.add(t)
            }
        }

        playerManager.playTrack(track, if (queueList.isNotEmpty()) queueList else null)
        ensureServiceStarted()
        call.resolve()
    }

    @PluginMethod
    fun pause(call: PluginCall) {
        playerManager.pause()
        call.resolve()
    }

    @PluginMethod
    fun resume(call: PluginCall) {
        playerManager.resume()
        call.resolve()
    }

    @PluginMethod
    fun togglePlay(call: PluginCall) {
        playerManager.togglePlay()
        call.resolve()
    }

    @PluginMethod
    fun seekTo(call: PluginCall) {
        val positionSeconds = call.getDouble("position") ?: 0.0
        playerManager.seekTo((positionSeconds * 1000).toLong())
        call.resolve()
    }

    @PluginMethod
    fun playNext(call: PluginCall) {
        playerManager.playNext()
        call.resolve()
    }

    @PluginMethod
    fun playPrevious(call: PluginCall) {
        playerManager.playPrevious()
        call.resolve()
    }

    @PluginMethod
    fun setShuffle(call: PluginCall) {
        val enabled = call.getBoolean("enabled") ?: false
        playerManager.setShuffle(enabled)
        call.resolve()
    }

    @PluginMethod
    fun updateMetadata(call: PluginCall) {
        val trackObj = call.getObject("track")
        val isPlaying = call.getBoolean("isPlaying") ?: true
        // isLocal is informational: local tracks may carry a non-http thumbnail (blob/file),
        // in which case the service's artwork fetch simply degrades to no large-icon.
        val isLocal = call.getBoolean("isLocal") ?: false
        if (trackObj != null) {
            try {
                val track = gson.fromJson(trackObj.toString(), NativeTrack::class.java)
                // Set the track FIRST so the service (once created) sees it synchronously
                // in onCreate and can satisfy the ~5s startForeground rule.
                playerManager.notifyTrackChange(track, isPlaying)
                ensureServiceStarted()
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
        call.resolve()
    }

    @PluginMethod
    fun setPlaybackState(call: PluginCall) {
        val isPlaying = call.getBoolean("isPlaying") ?: true
        playerManager.notifyPlaybackState(isPlaying)
        call.resolve()
    }

    @PluginMethod
    fun stop(call: PluginCall) {
        try {
            val intent = Intent(context, MRJMediaSessionService::class.java).apply {
                action = MRJMediaSessionService.ACTION_STOP
            }
            // startService (not startForegroundService): pure teardown, no FGS obligation.
            context.startService(intent)
        } catch (e: Exception) {
            e.printStackTrace()
        }
        call.resolve()
    }

    @PluginMethod
    fun requestNotificationPermission(call: PluginCall) {
        val res = JSObject()
        if (android.os.Build.VERSION.SDK_INT >= 33) {
            val granted = ContextCompat.checkSelfPermission(
                context, Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED
            if (!granted) {
                try {
                    activity?.let {
                        ActivityCompat.requestPermissions(
                            it, arrayOf(Manifest.permission.POST_NOTIFICATIONS), 9911
                        )
                    }
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }
            res.put("granted", granted)
        } else {
            res.put("granted", true)
        }
        call.resolve(res)
    }

    @PluginMethod
    fun getNativeStorageBreakdown(call: PluginCall) {
        val breakdown = offlineStorage.getStorageBreakdown()
        val res = JSObject()
        breakdown.forEach { (k, v) ->
            when (v) {
                is Long -> res.put(k, v)
                is Int -> res.put(k, v)
                is String -> res.put(k, v)
            }
        }
        call.resolve(res)
    }

    @PluginMethod
    fun getNativeDownloads(call: PluginCall) {
        val tracks = offlineStorage.getAllDownloadedTracks()
        val jsonArray = JSArray()
        tracks.forEach {
            jsonArray.put(JSObject(gson.toJson(it)))
        }
        val res = JSObject()
        res.put("tracks", jsonArray)
        call.resolve(res)
    }

    @PluginMethod
    fun deleteDownloadedTrack(call: PluginCall) {
        val trackId = call.getString("trackId")
        if (trackId == null) {
            call.reject("trackId required")
            return
        }
        val success = offlineStorage.deleteTrack(trackId)
        val res = JSObject()
        res.put("success", success)
        call.resolve(res)
    }

    private fun ensureServiceStarted() {
        try {
            val serviceIntent = Intent(context, MRJMediaSessionService::class.java)
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                context.startForegroundService(serviceIntent)
            } else {
                context.startService(serviceIntent)
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    // ---- PlayerEventListener ----
    // Metadata-only: the WebView (YouTube / HTML5 Audio) is the single source of truth, so
    // native playback/track/position/queue changes are NOT forwarded to JS — doing so let
    // the idle native engine fight the web player's state. Only errors are surfaced.
    override fun onPlaybackStateChange(isPlaying: Boolean, isLoading: Boolean) {}
    override fun onTrackChange(track: NativeTrack?) {}
    override fun onPositionChange(positionMs: Long, durationMs: Long) {}
    override fun onQueueChange(queue: List<NativeTrack>, currentIndex: Int) {}

    override fun onError(errorMessage: String) {
        val data = JSObject()
        data.put("error", errorMessage)
        notifyListeners("playbackError", data)
    }

    override fun handleOnDestroy() {
        playerManager.removeListener(this)
        if (pluginInstance === this) pluginInstance = null
        super.handleOnDestroy()
    }

    companion object {
        @Volatile
        private var pluginInstance: MRJNativePlayerPlugin? = null

        /**
         * Bridge from the notification service to JS. Emits the `remoteCommand` event the
         * web layer listens for. Commands are UPPERCASE to match the web bridge's dispatch
         * table: PLAY_PAUSE | PLAY | PAUSE | NEXT | PREVIOUS | SEEK | STOP.
         */
        fun emitRemoteCommand(command: String, value: Double? = null) {
            val plugin = pluginInstance ?: return
            val data = JSObject()
            data.put("command", command)
            if (value != null) data.put("value", value)
            plugin.notifyListeners("remoteCommand", data)
        }
    }
}
