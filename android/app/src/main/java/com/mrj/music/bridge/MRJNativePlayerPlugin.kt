package com.mrj.music.bridge

import android.content.Context
import android.util.Log
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.mrj.music.model.NativeTrack
import com.mrj.music.player.MRJAudioFocusManager
import com.mrj.music.player.AudioFocusCallback
import com.mrj.music.player.MRJExoPlayerManager
import com.mrj.music.player.PlayerEventListener
import org.json.JSONObject

private const val TAG = "MRJ_NativePlayerPlugin"

@CapacitorPlugin(name = "MRJNativePlayer")
class MRJNativePlayerPlugin : Plugin(), PlayerEventListener, AudioFocusCallback {

    private lateinit var exoPlayerManager: MRJExoPlayerManager
    private var audioFocusManager: MRJAudioFocusManager? = null

    override fun load() {
        super.load()
        val ctx = context ?: return
        exoPlayerManager = MRJExoPlayerManager.getInstance(ctx)
        exoPlayerManager.addListener(this)
        
        // Initialize Audio Focus Call Interruption Manager
        audioFocusManager = MRJAudioFocusManager(ctx, this)
        Log.d(TAG, "MRJNativePlayerPlugin loaded with AudioFocus and ExoPlayer listener")
    }

    // ==================== AUDIO FOCUS CALLBACKS (Bug 6) ====================

    override fun onAudioFocusPause() {
        Log.d(TAG, "Phone call ringing / Audio focus lost -> Notifying WebView to pause")
        val data = JSObject().put("state", "paused").put("reason", "call_interruption")
        notifyListeners("audioFocusLoss", data)
        notifyListeners("playbackStateChange", JSObject().put("isPlaying", false).put("isLoading", false))

        try {
            bridge?.triggerJSEvent("mrj-audio-focus-loss", "window", data.toString())
        } catch (e: Exception) {
            Log.w(TAG, "Notice triggering JS event: ${e.message}")
        }
    }

    override fun onAudioFocusResume() {
        Log.d(TAG, "Phone call ended / Audio focus restored -> Notifying WebView to resume")
        val data = JSObject().put("state", "resumed").put("reason", "call_ended")
        notifyListeners("audioFocusGain", data)

        try {
            bridge?.triggerJSEvent("mrj-audio-focus-gain", "window", data.toString())
        } catch (e: Exception) {
            Log.w(TAG, "Notice triggering JS event: ${e.message}")
        }
    }

    override fun onAudioFocusDuck(duckRatio: Float) {
        val data = JSObject().put("ratio", duckRatio)
        notifyListeners("audioFocusDuck", data)
    }

    override fun onAudioFocusUnduck() {
        val data = JSObject().put("ratio", 1.0f)
        notifyListeners("audioFocusUnduck", data)
    }

    // ==================== EXOPLAYER EVENT LISTENERS ====================

    override fun onPlaybackStateChange(isPlaying: Boolean, isLoading: Boolean) {
        val data = JSObject()
        data.put("isPlaying", isPlaying)
        data.put("isLoading", isLoading)
        notifyListeners("playbackStateChange", data)
    }

    override fun onTrackChange(track: NativeTrack?) {
        val data = JSObject()
        if (track != null) {
            data.put("track", trackToJSObject(track))
        } else {
            data.put("track", JSONObject.NULL)
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
        val arr = JSArray()
        for (t in queue) {
            arr.put(trackToJSObject(t))
        }
        data.put("queue", arr)
        data.put("queueIndex", currentIndex)
        notifyListeners("queueChange", data)
    }

    override fun onError(errorMessage: String) {
        val data = JSObject()
        data.put("error", errorMessage)
        notifyListeners("playbackError", data)
    }

    // ==================== CAPACITOR PLUGIN METHODS ====================

    @PluginMethod
    fun isNativeAvailable(call: PluginCall) {
        val ret = JSObject()
        ret.put("available", true)
        ret.put("version", "1.0.0")
        ret.put("engine", "MRJ_ExoPlayer_Hybrid")
        call.resolve(ret)
    }

    @PluginMethod
    fun getAppVersion(call: PluginCall) {
        val ret = JSObject()
        try {
            val pInfo = context.packageManager.getPackageInfo(context.packageName, 0)
            ret.put("version", pInfo.versionName ?: "1.0.0")
            ret.put("buildNumber", if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.P) pInfo.longVersionCode else pInfo.versionCode.toLong())
        } catch (e: Exception) {
            ret.put("version", "1.0.0")
            ret.put("buildNumber", 1)
        }
        call.resolve(ret)
    }

    @PluginMethod
    fun playTrack(call: PluginCall) {
        val trackObj = call.getObject("track")
        if (trackObj == null) {
            call.reject("Track object is required")
            return
        }

        val queueArray = call.getArray("queue")
        val track = jsObjectToTrack(trackObj)
        val queue = mutableListOf<NativeTrack>()

        if (queueArray != null) {
            for (i in 0 until queueArray.length()) {
                val item = queueArray.optJSONObject(i)
                if (item != null) {
                    queue.add(jsObjectToTrack(JSObject.fromJSONObject(item)))
                }
            }
        }

        audioFocusManager?.onPlaybackStarted()
        exoPlayerManager.playTrack(track, if (queue.isNotEmpty()) queue else listOf(track))
        call.resolve()
    }

    @PluginMethod
    fun pause(call: PluginCall) {
        exoPlayerManager.pause()
        call.resolve()
    }

    @PluginMethod
    fun resume(call: PluginCall) {
        audioFocusManager?.onPlaybackStarted()
        exoPlayerManager.resume()
        call.resolve()
    }

    @PluginMethod
    fun togglePlay(call: PluginCall) {
        exoPlayerManager.togglePlay()
        call.resolve()
    }

    @PluginMethod
    fun seekTo(call: PluginCall) {
        val position = call.getDouble("position")
        if (position != null) {
            exoPlayerManager.seekTo((position * 1000).toLong())
            call.resolve()
        } else {
            call.reject("Position parameter is required")
        }
    }

    @PluginMethod
    fun playNext(call: PluginCall) {
        exoPlayerManager.playNext()
        call.resolve()
    }

    @PluginMethod
    fun playPrevious(call: PluginCall) {
        exoPlayerManager.playPrevious()
        call.resolve()
    }

    @PluginMethod
    fun setShuffle(call: PluginCall) {
        val enabled = call.getBoolean("enabled") ?: false
        exoPlayerManager.setShuffle(enabled)
        call.resolve()
    }

    @PluginMethod
    fun updateMetadata(call: PluginCall) {
        call.resolve()
    }

    @PluginMethod
    fun getNativeStorageBreakdown(call: PluginCall) {
        val ret = JSObject()
        ret.put("totalBytes", 0)
        ret.put("formatted", "0 MB")
        call.resolve(ret)
    }

    @PluginMethod
    fun getNativeDownloads(call: PluginCall) {
        val ret = JSObject()
        ret.put("tracks", JSArray())
        call.resolve(ret)
    }

    @PluginMethod
    fun deleteDownloadedTrack(call: PluginCall) {
        val ret = JSObject()
        ret.put("success", true)
        call.resolve(ret)
    }

    // ==================== HELPERS ====================

    private fun jsObjectToTrack(obj: JSObject): NativeTrack {
        val id = obj.optString("id", "")
        val providerTrackId = obj.optString("providerTrackId", id)
        return NativeTrack(
            id = id.ifBlank { providerTrackId },
            title = obj.optString("title", "Unknown Title"),
            artist = obj.optString("artist", "Unknown Artist"),
            album = obj.optString("album", ""),
            thumbnail = obj.optString("thumbnail", ""),
            duration = obj.optDouble("duration", 210.0),
            streamUrl = obj.optString("streamUrl", ""),
            providerTrackId = providerTrackId,
            genre = obj.optString("genre", "")
        )
    }

    private fun trackToJSObject(t: NativeTrack): JSObject {
        val obj = JSObject()
        obj.put("id", t.id)
        obj.put("title", t.title)
        obj.put("artist", t.artist)
        obj.put("album", t.album)
        obj.put("thumbnail", t.thumbnail)
        obj.put("duration", t.duration)
        obj.put("streamUrl", t.streamUrl)
        obj.put("providerTrackId", t.providerTrackId)
        obj.put("genre", t.genre)
        return obj
    }
}
