package com.mrj.music.player

import android.util.Log
import com.mrj.music.data.remote.MRJApiClient
import com.mrj.music.model.NativeTrack
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeout
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.concurrent.TimeUnit

data class ResolvedStream(
    val url: String,
    val provider: String?,
    val providerTrackId: String?,
    val expiresAt: Long?,
    val mimeType: String?,
    val codec: String?,
    val bitrate: String?,
    val sampleRate: String?
)

/** Resolves transient playback URLs. Direct URLs are never treated as identity. */
class StreamResolver {
    private data class Cached(val stream: ResolvedStream, val cachedAt: Long)
    private val recent = mutableMapOf<String, Cached>()
    private val youtubeClient = OkHttpClient.Builder()
        .connectTimeout(3, TimeUnit.SECONDS)
        .readTimeout(4, TimeUnit.SECONDS)
        .callTimeout(5, TimeUnit.SECONDS)
        .build()

    suspend fun resolve(track: NativeTrack): ResolvedStream? = withContext(Dispatchers.IO) {
        val key = track.canonicalTrackId ?: track.id
        val now = System.currentTimeMillis()
        val cached = synchronized(recent) { recent[key] }
        if (cached != null && now - cached.cachedAt < CACHE_TTL_MS && (cached.stream.expiresAt == null || cached.stream.expiresAt > now + 15_000L)) {
            return@withContext cached.stream
        }

        // Try the user's network first for YouTube Music tracks. Cloud
        // InnerTube requests are commonly challenged by Google; this path
        // keeps the exact selected YouTube media instead of substituting a
        // different catalog recording. It fails fast and falls through to
        // the backend's verified provider chain.
        if (isYouTubeTrack(track)) {
            val deviceStream = runCatching { resolveYouTubeOnDevice(track) }.getOrNull()
            if (deviceStream != null) {
                synchronized(recent) { recent[key] = Cached(deviceStream, System.currentTimeMillis()) }
                return@withContext deviceStream
            }
        }

        val response = runCatching {
            withTimeout(6_500L) {
                MRJApiClient.apiService.resolveStream(
                    id = key,
                    title = track.title,
                    artist = track.artist,
                    duration = track.duration,
                    provider = track.provider
                )
            }
        }.getOrNull() ?: return@withContext null
        if (!response.isSuccessful) return@withContext null
        val body = response.body() ?: return@withContext null
        val streamUrl = (body["streamUrl"] as? String ?: body["url"] as? String)?.trim()
            ?.takeIf { it.startsWith("https://") || it.startsWith("http://") }
            ?: return@withContext null
        val resolved = ResolvedStream(
            url = streamUrl,
            provider = body["provider"] as? String,
            providerTrackId = body["providerTrackId"] as? String ?: body["videoId"] as? String,
            // Never cache a provider URL indefinitely when the backend omits
            // expiry metadata. Provider URLs are transient by contract.
            expiresAt = (body["expiresAt"] as? Number)?.toLong()
                ?: (System.currentTimeMillis() + 4 * 60 * 1000L),
            mimeType = body["mimeType"] as? String,
            codec = body["codec"] as? String,
            bitrate = body["bitrate"]?.toString(),
            sampleRate = body["sampleRate"]?.toString()
        )
        synchronized(recent) { recent[key] = Cached(resolved, System.currentTimeMillis()) }
        resolved
    }

    private fun isYouTubeTrack(track: NativeTrack): Boolean {
        val provider = track.provider?.lowercase()
        val id = track.canonicalTrackId ?: track.id
        return id.startsWith("ytm_") || provider == "youtube_music" || provider == "youtube_video"
    }

    private suspend fun resolveYouTubeOnDevice(track: NativeTrack): ResolvedStream? = coroutineScope {
        val videoId = (track.providerTrackId ?: track.id).removePrefix("ytm_")
        if (!videoId.matches(Regex("[A-Za-z0-9_-]{11}"))) return@coroutineScope null

        val clients = listOf(
            Triple("ANDROID_MUSIC", "6.41.52", "com.google.android.apps.youtube.music/6.41.52 (Linux; U; Android 14; en_US)"),
            Triple("WEB_REMIX", "1.20240918.01.00", "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/131 Mobile Safari/537.36")
        )
        val result = clients.map { (name, version, userAgent) ->
            async {
                runCatching { requestYouTubePlayer(videoId, name, version, userAgent) }.getOrNull()
            }
        }.awaitAll().firstNotNullOfOrNull { it }
        if (result == null) Log.d(TAG, "Device YouTube resolver unavailable for ${track.id}; using backend fallback")
        result
    }

    private fun requestYouTubePlayer(videoId: String, clientName: String, clientVersion: String, userAgent: String): ResolvedStream? {
        val payload = """{"context":{"client":{"clientName":"$clientName","clientVersion":"$clientVersion","hl":"en","gl":"IN"}},"videoId":"$videoId","contentCheckOk":true,"racyCheckOk":true}"""
        val request = Request.Builder()
            .url("https://music.youtube.com/youtubei/v1/player?prettyPrint=false")
            .post(payload.toRequestBody("application/json".toMediaType()))
            .header("Content-Type", "application/json")
            .header("User-Agent", userAgent)
            .build()
        youtubeClient.newCall(request).execute().use { response ->
            if (!response.isSuccessful) return null
            val root = JsonParser.parseString(response.body?.string().orEmpty()).asJsonObject
            if (root.getAsJsonObject("playabilityStatus")?.get("status")?.asString != "OK") return null
            val formats = buildList {
                root.getAsJsonObject("streamingData")?.getAsJsonArray("adaptiveFormats")?.forEach { add(it.asJsonObject) }
                root.getAsJsonObject("streamingData")?.getAsJsonArray("formats")?.forEach { add(it.asJsonObject) }
            }
            val format = formats.asSequence()
                .filter { it.get("mimeType")?.asString?.startsWith("audio/") == true }
                .filter { it.get("url")?.asString?.isNotBlank() == true }
                .maxByOrNull { it.get("bitrate")?.asInt ?: 0 }
                ?: return null
            val url = format.get("url").asString
            if (url.contains("youtube.com/watch") || url.contains("youtube.com/embed")) return null
            val expiresAt = Regex("(?:[?&])expire=(\\d+)").find(url)?.groupValues?.get(1)?.toLongOrNull()?.times(1000L)
            return ResolvedStream(
                url = url,
                provider = "youtube_music",
                providerTrackId = videoId,
                expiresAt = expiresAt ?: (System.currentTimeMillis() + DIRECT_CACHE_TTL_MS),
                mimeType = format.get("mimeType")?.asString?.substringBefore(';'),
                codec = format.get("codecs")?.asString,
                bitrate = format.get("bitrate")?.asInt?.toString(),
                sampleRate = format.get("audioSampleRate")?.asString
            )
        }
    }

    suspend fun invalidate(track: NativeTrack) {
        synchronized(recent) { recent.remove(track.canonicalTrackId ?: track.id) }
    }

    companion object {
        private const val TAG = "MRJ_StreamResolver"
        private const val CACHE_TTL_MS = 4 * 60 * 60 * 1000L
        private const val DIRECT_CACHE_TTL_MS = 4 * 60 * 60 * 1000L
    }
}
