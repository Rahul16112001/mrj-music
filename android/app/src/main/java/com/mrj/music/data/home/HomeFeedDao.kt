package com.mrj.music.data.home

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query

@Dao
interface HomeFeedDao {
    @Query("SELECT * FROM home_feed_tracks ORDER BY sectionId, title")
    suspend fun getAll(): List<HomeFeedEntity>

    @Query("SELECT MAX(fetchedAt) FROM home_feed_tracks")
    suspend fun getLastFetchedAt(): Long?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(tracks: List<HomeFeedEntity>)

    @Query("DELETE FROM home_feed_tracks")
    suspend fun clear()
}

@Dao
interface QueuePersistenceDao {
    @Query("SELECT * FROM queue_persistence ORDER BY position")
    suspend fun getAll(): List<QueuePersistenceEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(items: List<QueuePersistenceEntity>)

    @Query("DELETE FROM queue_persistence")
    suspend fun clear()
}
