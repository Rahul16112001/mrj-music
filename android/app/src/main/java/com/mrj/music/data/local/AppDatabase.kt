package com.mrj.music.data.local

import androidx.room.Database
import androidx.room.RoomDatabase
import com.mrj.music.data.local.daos.*
import com.mrj.music.data.local.entities.*

@Database(
    entities = [
        DownloadedTrackEntity::class,
        LikedTrackEntity::class,
        PlaylistEntity::class,
        PlaylistTrackEntity::class,
        SearchHistoryEntity::class
    ],
    version = 1,
    exportSchema = false
)
abstract class AppDatabase : RoomDatabase() {
    abstract fun downloadedTrackDao(): DownloadedTrackDao
    abstract fun likedTrackDao(): LikedTrackDao
    abstract fun playlistDao(): PlaylistDao
    abstract fun playlistTrackDao(): PlaylistTrackDao
    abstract fun searchHistoryDao(): SearchHistoryDao
}
