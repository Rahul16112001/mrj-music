package com.mrj.music.data.home

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

@Database(entities = [HomeFeedEntity::class, QueuePersistenceEntity::class], version = 3, exportSchema = false)
abstract class HomeFeedDatabase : RoomDatabase() {
    abstract fun homeFeedDao(): HomeFeedDao
    abstract fun queuePersistenceDao(): QueuePersistenceDao

    companion object {
        @Volatile private var instance: HomeFeedDatabase? = null

        fun getInstance(context: Context): HomeFeedDatabase = instance ?: synchronized(this) {
            instance ?: Room.databaseBuilder(
                context.applicationContext,
                HomeFeedDatabase::class.java,
                "home_feed.db"
            ).fallbackToDestructiveMigration().build().also { instance = it }
        }
    }
}
