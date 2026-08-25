package com.mrj.music.model

import android.net.Uri
import android.util.Log
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import com.google.gson.Gson
import com.google.gson.annotations.SerializedName

data class NativeTrack(
    @SerializedName("id") val id: String,
    @SerializedName("canonicalTrackId") val canonicalTrackId: String? = null,
    @SerializedName("title") val title: String,
    @SerializedName("artist") val artist: String,
    @SerializedName("album") val album: String? = null,
    @SerializedName("thumbnail") val thumbnail: String? = null,
    @SerializedName("duration") val duration: Double = 0.0,
    @SerializedName("streamUrl") var streamUrl: String? = null,
    @SerializedName("localFilePath") var localFilePath: String? = null,
    @SerializedName("genre") val genre: String? = null,
    @SerializedName("downloadType") var downloadType: String? = "manual",
    @SerializedName("priorityScore") var priorityScore: Double = 0.0,
    @SerializedName("downloadCategory") var downloadCategory: String? = null,
    // Additional fields from React Track type
    @SerializedName("providerTrackId") val providerTrackId: String? = null,
) {
    companion object {
        private val gson = Gson()
        private const val TAG = "MRJ_NativeTrack"
        private const val BACKEND_BASE = "https://mrj-music.vercel.app/api"

        fun fromJson(json: String): NativeTrack? {
            return try {
                gson.fromJson(json, NativeTrack::class.java)
            } catch (e: Exception) {
                Log.e(TAG, "fromJson failed: ${e.message}")
                null
            }
        }
    }

    /**
     * Returns the best available stream URI for this track.
     * Priority: localFilePath > resolved streamUrl > backend proxy URL
     * NEVER returns Uri.EMPTY — that crashes ExoPlayer.
     */
    fun resolveStreamUri(): Uri {
        // 1. Local offline file
        if (!localFilePath.isNullOrBlank()) {
            val file = java.io.File(localFilePath!!)
            if (file.exists() && file.length() >= 100_000L) {
                val uri = Uri.parse("file://$localFilePath")
                Log.d(TAG, "Using verified local file URI for: $title (${file.length()} bytes)")
                return uri
            } else {
                Log.w(TAG, "Local file for '$title' is missing or <100KB, ignoring bad local path.")
            }
        }

        // 2. Direct stream URL from React (must not be a YouTube watch page URL)
        if (!streamUrl.isNullOrBlank()) {
            val url = streamUrl!!.trim()
            // Reject YouTube watch page URLs — ExoPlayer cannot play those
            if (!url.contains("youtube.com/watch") && !url.contains("youtu.be/")) {
                Log.d(TAG, "Using direct stream URL for: $title -> ${url.take(80)}")
                return Uri.parse(url)
            }
        }

        // 3. Backend raw audio stream redirect as safe fallback
        val trackId = canonicalTrackId ?: providerTrackId ?: id
        val fallbackUrl = "$BACKEND_BASE/music/stream-raw/${Uri.encode(trackId)}"
        Log.w(TAG, "Using backend raw audio stream for: $title -> $fallbackUrl")
        return Uri.parse(fallbackUrl)
    }

    fun toMediaItem(): MediaItem {
        val uri = resolveStreamUri()

        val metadataBuilder = MediaMetadata.Builder()
            .setTitle(title.ifBlank { "Unknown Track" })
            .setArtist(artist.ifBlank { "Unknown Artist" })
            .setAlbumTitle(album ?: "Single")
            .setDisplayTitle(title.ifBlank { "Unknown Track" })

        if (!thumbnail.isNullOrBlank()) {
            try {
                metadataBuilder.setArtworkUri(Uri.parse(thumbnail))
            } catch (e: Exception) {
                Log.w(TAG, "Failed to set artwork URI: ${e.message}")
            }
        }

        return MediaItem.Builder()
            .setMediaId(canonicalTrackId ?: id)
            .setUri(uri)
            .setMediaMetadata(metadataBuilder.build())
            .build()
    }
}
