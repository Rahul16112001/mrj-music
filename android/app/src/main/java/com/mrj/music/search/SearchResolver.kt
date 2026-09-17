package com.mrj.music.search

import com.google.gson.JsonElement
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import com.mrj.music.model.NativeTrack
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.concurrent.TimeUnit

/** Device-side YouTube Music catalogue search. Backend results remain a fallback. */
class SearchResolver {
    private val client = OkHttpClient.Builder()
        .connectTimeout(2500, TimeUnit.MILLISECONDS)
        .readTimeout(2500, TimeUnit.MILLISECONDS)
        .callTimeout(3500, TimeUnit.MILLISECONDS)
        .build()

    suspend fun search(query: String, limit: Int = 50): List<NativeTrack> = coroutineScope {
        if (query.isBlank()) return@coroutineScope emptyList()
        val clients = listOf(
            Triple("WEB_REMIX", "1.20240918.01.00", "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/131 Mobile Safari/537.36"),
            Triple("ANDROID_MUSIC", "6.41.52", "com.google.android.apps.youtube.music/6.41.52 (Linux; U; Android 14; en_US)")
        )
        clients.map { (name, version, userAgent) ->
            async { runCatching { request(query.trim(), limit, name, version, userAgent) }.getOrDefault(emptyList()) }
        }.awaitAll().flatten()
            .distinctBy { it.canonicalTrackId ?: it.id }
            .take(limit)
    }

    private fun request(query: String, limit: Int, clientName: String, clientVersion: String, userAgent: String): List<NativeTrack> {
        val payload = """{"context":{"client":{"clientName":"$clientName","clientVersion":"$clientVersion","hl":"en","gl":"IN"}},"query":${com.google.gson.Gson().toJson(query)},"params":"EgWKAQIIAWoKEAkQBRAEEAoQBQ%3D%3D"}"""
        val request = Request.Builder()
            .url("https://music.youtube.com/youtubei/v1/search?prettyPrint=false")
            .post(payload.toRequestBody("application/json".toMediaType()))
            .header("Content-Type", "application/json")
            .header("Accept", "application/json")
            .header("User-Agent", userAgent)
            .build()
        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) return emptyList()
            val root = JsonParser.parseString(response.body?.string().orEmpty())
            val renderers = mutableListOf<JsonObject>()
            collectRenderers(root, renderers)
            return renderers.asSequence().mapNotNull { parseTrack(it) }.distinctBy { it.id }.take(limit).toList()
        }
    }

    private fun collectRenderers(element: JsonElement, output: MutableList<JsonObject>) {
        if (element.isJsonObject) {
            val jsonObject = element.asJsonObject
            if (jsonObject.has("musicResponsiveListItemRenderer")) {
                output += jsonObject.getAsJsonObject("musicResponsiveListItemRenderer")
            }
            jsonObject.entrySet().forEach { collectRenderers(it.value, output) }
        } else if (element.isJsonArray) {
            element.asJsonArray.forEach { collectRenderers(it, output) }
        }
    }

    private fun parseTrack(renderer: JsonObject): NativeTrack? {
        val videoId = findString(renderer, "videoId") ?: return null
        if (!videoId.matches(Regex("[A-Za-z0-9_-]{11}"))) return null
        val columns = renderer.getAsJsonArray("flexColumns")?.mapNotNull { column ->
            textRuns(column.asJsonObject.getAsJsonObject("musicResponsiveListItemFlexColumnRenderer")?.get("text"))
        }.orEmpty()
        val title = columns.getOrNull(0)?.takeIf { it.isNotBlank() } ?: return null
        val artist = columns.getOrNull(1)?.takeIf { it.isNotBlank() } ?: "Unknown Artist"
        val album = columns.getOrNull(2)
        val duration = renderer.getAsJsonArray("fixedColumns")?.firstOrNull()?.let { fixed ->
            textRuns(fixed.asJsonObject.getAsJsonObject("musicResponsiveListItemFixedColumnRenderer")?.get("text"))
        }?.let(::parseDuration) ?: 0.0
        val artwork = renderer.getAsJsonObject("thumbnail")
            ?.getAsJsonObject("musicThumbnailRenderer")
            ?.getAsJsonArray("thumbnail")?.lastOrNull()
            ?.asJsonObject?.get("url")?.asString
        val canonical = "ytm_$videoId"
        return NativeTrack(
            id = canonical,
            canonicalTrackId = canonical,
            title = title,
            artist = artist,
            album = album,
            thumbnail = artwork,
            duration = duration,
            providerTrackId = videoId,
            provider = "youtube_music"
        )
    }

    private fun textRuns(element: JsonElement?): String {
        if (element == null || element.isJsonNull) return ""
        if (element.isJsonPrimitive) return element.asString.trim()
        if (element.isJsonArray) return element.asJsonArray.joinToString(" ") { textRuns(it) }.trim()
        val jsonObject = element.asJsonObject
        return textRuns(jsonObject.get("simpleText")).ifBlank { textRuns(jsonObject.get("runs")) }
    }

    private fun findString(element: JsonElement, key: String): String? {
        if (element.isJsonObject) {
            val jsonObject = element.asJsonObject
            jsonObject.get(key)?.asString?.takeIf { it.isNotBlank() }?.let { return it }
            jsonObject.entrySet().forEach { findString(it.value, key)?.let { value -> return value } }
        } else if (element.isJsonArray) {
            element.asJsonArray.forEach { findString(it, key)?.let { value -> return value } }
        }
        return null
    }

    private fun parseDuration(value: String): Double {
        val parts = value.split(':').mapNotNull { it.toLongOrNull() }
        if (parts.isEmpty()) return 0.0
        return parts.fold(0L) { total, part -> total * 60 + part }.toDouble()
    }
}
