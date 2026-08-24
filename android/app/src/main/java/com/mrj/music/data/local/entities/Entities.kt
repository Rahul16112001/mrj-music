package com.mrj.music.data.local.entities

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "downloaded_tracks")
data class DownloadedTrackEntity(
    @PrimaryKey val id: String,
    val canonicalTrackId: String?,
    val title: String,
    val artist: String,
    val album: String?,
    val thumbnail: String?,
    val duration: Double,
    val genre: String?,
    val localFilePath: String?,
    val streamUrl: String?,
    val downloadType: String = "manual",
    val priorityScore: Double = 0.0,
    val downloadCategory: String?,
    val providerTrackId: String?,
    val downloadedAt: Long = System.currentTimeMillis(),
    val fileSize: Long = 0,
    val quality: String?,
    val bitrate: String?,
    val lyrics: String?,
    val isOffline: Boolean = true
)

@Entity(tableName = "liked_tracks")
data class LikedTrackEntity(
    @PrimaryKey val id: String,
    val title: String,
    val artist: String,
    val album: String?,
    val thumbnail: String?,
    val duration: Double,
    val likedAt: Long = System.currentTimeMillis()
)

@Entity(tableName = "playlists")
data class PlaylistEntity(
    @PrimaryKey val id: String,
    val userId: String?,
    val title: String,
    val description: String?,
    val thumbnail: String?,
    val createdAt: Long,
    val updatedAt: Long,
    val isCustom: Boolean = true
)

@Entity(tableName = "playlist_tracks")
data class PlaylistTrackEntity(
    @PrimaryKey val id: String,
    val playlistId: String,
    val trackId: String,
    val title: String,
    val artist: String,
    val album: String?,
    val thumbnail: String?,
    val duration: Double,
    val position: Int,
    val addedAt: Long
)

@Entity(tableName = "search_history")
data class SearchHistoryEntity(
    @PrimaryKey val id: String,
    val query: String,
    val searchedAt: Long = System.currentTimeMillis()
)
