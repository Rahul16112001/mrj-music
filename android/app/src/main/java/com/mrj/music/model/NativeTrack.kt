package com.mrj.music.model

import android.net.Uri
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
    @SerializedName("downloadType") var downloadType: String? = "manual", // "manual" | "smart"
    @SerializedName("priorityScore") var priorityScore: Double = 0.0,
    @SerializedName("downloadCategory") var downloadCategory: String? = null
) {
    fun toMediaItem(): MediaItem {
        val uri = if (!localFilePath.isNullOrEmpty()) {
            Uri.parse("file://$localFilePath")
        } else if (!streamUrl.isNullOrEmpty()) {
            Uri.parse(streamUrl)
        } else {
            Uri.EMPTY
        }

        val metadataBuilder = MediaMetadata.Builder()
            .setTitle(title)
            .setArtist(artist)
            .setAlbumTitle(album ?: "Single")
            .setDisplayTitle(title)

        thumbnail?.let {
            try {
                metadataBuilder.setArtworkUri(Uri.parse(it))
            } catch (_: Exception) {}
        }

        return MediaItem.Builder()
            .setMediaId(canonicalTrackId ?: id)
            .setUri(uri)
            .setMediaMetadata(metadataBuilder.build())
            .build()
    }

    companion object {
        private val gson = Gson()

        fun fromJson(json: String): NativeTrack? {
            return try {
                gson.fromJson(json, NativeTrack::class.java)
            } catch (e: Exception) {
                null
            }
        }
    }
}
