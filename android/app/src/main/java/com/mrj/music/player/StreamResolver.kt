package com.mrj.music.player

import android.util.Log
import com.mrj.music.data.remote.MRJApiClient
import com.mrj.music.model.NativeTrack
import com.google.gson.JsonParser
import kotlinx.coroutines.channels.Channel
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
import java.net.URLDecoder
import java.net.URLEncoder
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
        .connectTimeout(2500, TimeUnit.MILLISECONDS)
        .readTimeout(2500, TimeUnit.MILLISECONDS)
        .callTimeout(3500, TimeUnit.MILLISECONDS)
        .build()

    suspend fun resolve(track: NativeTrack): ResolvedStream? = withContext(Dispatchers.IO) {
        val key = track.canonicalTrackId ?: track.id
        val now = System.currentTimeMillis()
        val cached = synchronized(recent) { recent[key] }
        if (cached != null && now - cached.cachedAt < CACHE_TTL_MS && (cached.stream.expiresAt == null || cached.stream.expiresAt > now + 15_000L)) {
            return@withContext cached.stream
        }

        // Both paths start together. The first valid direct stream wins. This
        // deliberately keeps the JioSaavn fast path intact: if its backend
        // response arrives first it remains the selected source.
        val resolved = coroutineScope {
            val winner = Channel<ResolvedStream>(Channel.RENDEZVOUS)
            val backendJob = async {
                runCatching {
                    withTimeout(4_000L) {
                        val response = MRJApiClient.apiService.resolveStream(
                            id = key,
                            title = track.title,
                            artist = track.artist,
                            duration = track.duration,
                            provider = track.provider
                        )
                        if (response.isSuccessful) {
                            val body = response.body()
                            val streamUrl = (body?.get("streamUrl") as? String ?: body?.get("url") as? String)?.trim()
                                ?.takeIf { it.startsWith("https://") || it.startsWith("http://") }
                            if (streamUrl != null && body != null) {
                                winner.send(ResolvedStream(
                                    url = streamUrl,
                                    provider = body["provider"] as? String,
                                    providerTrackId = body["providerTrackId"] as? String ?: body["videoId"] as? String,
                                    expiresAt = (body["expiresAt"] as? Number)?.toLong()
                                        ?: (System.currentTimeMillis() + 4 * 60 * 1000L),
                                    mimeType = body["mimeType"] as? String,
                                    codec = body["codec"] as? String,
                                    bitrate = body["bitrate"]?.toString(),
                                    sampleRate = body["sampleRate"]?.toString()
                                ))
                            } else null
                        } else null
                    }
                }.getOrNull()
            }

            val deviceJob = async {
                if (isYouTubeTrack(track)) {
                    runCatching {
                        withTimeout(3_000L) { resolveYouTubeOnDevice(track) }
                            ?.also { winner.send(it) }
                    }.getOrNull()
                } else null
            }
            val result = kotlinx.coroutines.withTimeoutOrNull(4_000L) { winner.receive() }
            backendJob.cancel()
            deviceJob.cancel()
            result
        }

        if (resolved != null) {
            synchronized(recent) { recent[key] = Cached(resolved, System.currentTimeMillis()) }
            return@withContext resolved
        }
        return@withContext null
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
            Triple("ANDROID", "19.29.37", "com.google.android.youtube/19.29.37 (Linux; U; Android 14; en_US)"),
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
        val endpoint = if (clientName == "ANDROID") "https://www.youtube.com/youtubei/v1/player?prettyPrint=false"
                       else "https://music.youtube.com/youtubei/v1/player?prettyPrint=false"
        val payload = """{"context":{"client":{"clientName":"$clientName","clientVersion":"$clientVersion","hl":"en","gl":"IN"}},"videoId":"$videoId","contentCheckOk":true,"racyCheckOk":true}"""
        val request = Request.Builder()
            .url(endpoint)
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
                .filter { it.get("url")?.asString?.isNotBlank() == true ||
                    it.get("signatureCipher")?.asString?.isNotBlank() == true ||
                    it.get("cipher")?.asString?.isNotBlank() == true }
                .maxByOrNull { it.get("bitrate")?.asInt ?: 0 }
                ?: return null

            val url = directUrlForFormat(format, root)
                ?: return null
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

    /** Builds a direct CDN URL from either url or YouTube's cipher fields. */
    private fun directUrlForFormat(format: com.google.gson.JsonObject, root: com.google.gson.JsonObject): String? {
        format.get("url")?.asString?.trim()?.takeIf { it.startsWith("http") }?.let { return it }
        val encodedCipher = format.get("signatureCipher")?.asString
            ?: format.get("cipher")?.asString
            ?: return null
        val params = parseQuery(encodedCipher)
        val baseUrl = params["url"]?.takeIf { it.startsWith("http") } ?: return null
        val signature = params["sig"] ?: params["signature"] ?: params["s"]
        if (signature.isNullOrBlank()) return baseUrl
        val finalSignature = if (params["s"] != null) {
            val jsUrl = root.getAsJsonObject("assets")?.get("js")?.asString
                ?: root.getAsJsonObject("playerConfig")?.getAsJsonObject("assets")?.get("js")?.asString
            if (jsUrl.isNullOrBlank()) return null
            decipherSignature(signature, jsUrl) ?: return null
        } else signature
        val separator = if (baseUrl.contains('?')) '&' else '?'
        val key = params["sp"]?.takeIf { it.matches(Regex("[A-Za-z]+")) } ?: "sig"
        return "$baseUrl$separator${URLEncoder.encode(key, "UTF-8")}=${URLEncoder.encode(finalSignature, "UTF-8")}"
    }

    private fun parseQuery(value: String): Map<String, String> = value.split('&')
        .mapNotNull { part ->
            val pair = part.split('=', limit = 2)
            if (pair.size != 2) null else URLDecoder.decode(pair[0], "UTF-8") to URLDecoder.decode(pair[1], "UTF-8")
        }.toMap()

    /**
     * Handles the small, stable operation set used by YouTube's signature
     * transform (reverse, splice and swap). Unknown transforms fail closed.
     */
    private fun decipherSignature(signature: String, jsUrl: String): String? {
        val scriptRequest = Request.Builder().url(if (jsUrl.startsWith("http")) jsUrl else "https://music.youtube.com$jsUrl").build()
        val script = youtubeClient.newCall(scriptRequest).execute().use { response ->
            if (!response.isSuccessful) return null
            response.body?.string().orEmpty()
        }
        val functionMatch = Regex("(?:function\\s+([\\$\\w]+)\\s*\\(\\w+\\)|([\\$\\w]+)\\s*=\\s*function\\s*\\(\\w+\\))\\s*\\{", RegexOption.MULTILINE).find(script)
            ?: return null
        val functionName = functionMatch.groupValues[1].ifBlank { functionMatch.groupValues[2] }
        val bodyStart = functionMatch.range.last + 1
        val bodyEnd = matchingBrace(script, bodyStart) ?: return null
        val body = script.substring(bodyStart, bodyEnd)
        val helperObject = Regex("(?:var|const|let)\\s+([\\$\\w]+)\\s*=\\s*\\{([^{}]+)\\}").find(script)
        val helpers = helperObject?.groupValues?.get(2)?.let { objectBody ->
            Regex("([\\$\\w]+)\\s*:\\s*function\\s*\\([^)]*\\)\\s*\\{([^{}]*)\\}").findAll(objectBody)
                .associate { it.groupValues[1] to it.groupValues[2] }
        }.orEmpty()
        if (functionName.isBlank() || body.isBlank()) return null

        val chars = signature.toMutableList()
        if (!body.contains("split(\"\")") && !body.contains("split('')")) return null
        body.split(';').map { it.trim() }.forEach { statement ->
            when {
                statement.contains(".reverse()") -> chars.reverse()
                Regex("\\.splice\\(0\\s*,\\s*(\\d+)\\)").containsMatchIn(statement) -> {
                    val count = Regex("\\.splice\\(0\\s*,\\s*(\\d+)\\)").find(statement)!!.groupValues[1].toInt()
                    repeat(count.coerceAtMost(chars.size)) { chars.removeAt(0) }
                }
                Regex("\\.splice\\(0\\s*,\\s*(\\w+)\\)").containsMatchIn(statement) -> return null
                Regex("([\\$\\w]+)\\.([\\$\\w]+)\\(\\w+,\\s*(\\d+)\\)").containsMatchIn(statement) -> {
                    val call = Regex("([\\$\\w]+)\\.([\\$\\w]+)\\(\\w+,\\s*(\\d+)\\)").find(statement)!!
                    val helper = helpers[call.groupValues[2]] ?: return null
                    val index = call.groupValues[3].toInt()
                    when {
                        helper.contains("reverse") -> chars.reverse()
                        helper.contains("splice") -> repeat(index.coerceAtMost(chars.size)) { chars.removeAt(0) }
                        helper.contains("var c") || helper.contains("=a[0]") -> if (chars.isNotEmpty()) {
                            val safe = index % chars.size
                            val first = chars[0]
                            chars[0] = chars[safe]
                            chars[safe] = first
                        }
                        else -> return null
                    }
                }
                statement.contains("join(\"\")") || statement.contains("join('')") || statement.startsWith("return") -> Unit
                statement.isBlank() || statement == "a=a.split(\"\")" || statement == "a=a.split('')" -> Unit
                else -> return null
            }
        }
        return chars.joinToString("")
    }

    private fun matchingBrace(value: String, start: Int): Int? {
        var depth = 1
        for (index in start until value.length) {
            when (value[index]) {
                '{' -> depth++
                '}' -> {
                    depth--
                    if (depth == 0) return index
                }
            }
        }
        return null
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
