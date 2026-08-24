package com.mrj.music.bridge

import android.content.Intent
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
import com.mrj.music.smartdownload.SmartDownloadWorker
import com.mrj.music.storage.NativeOfflineStorage
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

@CapacitorPlugin(name = "MRJNativePlayer")
class MRJNativePlayerPlugin : Plugin(), PlayerEventListener {
    private val gson = Gson()
    private lateinit var playerManager: MRJExoPlayerManager
    private lateinit var offlineStorage: NativeOfflineStorage

    override fun load() {
        super.load()
        val context = context.applicationContext
        playerManager = MRJExoPlayerManager.getInstance(context)
        offlineStorage = NativeOfflineStorage.getInstance(context)
        playerManager.addListener(this)

        // Ensure MediaSessionService is started
        try {
            val serviceIntent = Intent(context, MRJMediaSessionService::class.java)
            context.startService(serviceIntent)
        } catch (e: Exception) {
            e.printStackTrace()
        }
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

    // PlayerEventListener Implementation
    override fun onPlaybackStateChange(isPlaying: Boolean, isLoading: Boolean) {
        val data = JSObject()
        data.put("isPlaying", isPlaying)
        data.put("isLoading", isLoading)
        notifyListeners("playbackStateChange", data)
    }

    override fun onTrackChange(track: NativeTrack?) {
        val data = JSObject()
        if (track != null) {
            data.put("track", JSObject(gson.toJson(track)))
        } else {
            data.put("track", null)
        }
        notifyListeners("trackChange", data)
    }

    override fun onPositionChange(positionMs: Long, durationMs: Long) {
        val data = JSObject()
        data.put("currentTime", positionMs / 1000.0)
        data.put("duration", durationMs / 1000.0)
        notifyListeners("positionChange", data)
    }

    override fun onQueueChange(queue: List<NativeTrack>, currentIndex: Int) {
        val data = JSObject()
        val array = JSArray()
        queue.forEach { array.put(JSObject(gson.toJson(it))) }
        data.put("queue", array)
        data.put("queueIndex", currentIndex)
        notifyListeners("queueChange", data)
    }

    override fun onError(errorMessage: String) {
        val data = JSObject()
        data.put("error", errorMessage)
        notifyListeners("playbackError", data)
    }

    override fun handleOnDestroy() {
        playerManager.removeListener(this)
        super.handleOnDestroy()
    }
}
