package com.mrj.music.data.local.daos

import androidx.room.*
import com.mrj.music.data.local.entities.*
import kotlinx.coroutines.flow.Flow

@Dao
interface DownloadedTrackDao {
    @Query("SELECT * FROM downloaded_tracks ORDER BY downloadedAt DESC")
    fun getAllTracks(): Flow<List<DownloadedTrackEntity>>

    @Query("SELECT * FROM downloaded_tracks WHERE id = :id LIMIT 1")
    suspend fun getTrack(id: String): DownloadedTrackEntity?

    @Query("SELECT * FROM downloaded_tracks WHERE canonicalTrackId = :id LIMIT 1")
    suspend fun getTrackByCanonicalId(id: String): DownloadedTrackEntity?

    @Query("SELECT COUNT(*) FROM downloaded_tracks")
    suspend fun getTrackCount(): Int

    @Query("SELECT SUM(fileSize) FROM downloaded_tracks")
    suspend fun getTotalSizeBytes(): Long?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertTrack(track: DownloadedTrackEntity)

    @Delete
    suspend fun deleteTrack(track: DownloadedTrackEntity)

    @Query("DELETE FROM downloaded_tracks WHERE id = :id")
    suspend fun deleteTrackById(id: String)

    @Query("DELETE FROM downloaded_tracks")
    suspend fun deleteAll()

    @Query("SELECT * FROM downloaded_tracks WHERE downloadType = 'smart' ORDER BY priorityScore ASC")
    suspend fun getSmartDownloadsSorted(): List<DownloadedTrackEntity>
}

@Dao
interface LikedTrackDao {
    @Query("SELECT * FROM liked_tracks ORDER BY likedAt DESC")
    fun getAllLikes(): Flow<List<LikedTrackEntity>>

    @Query("SELECT * FROM liked_tracks WHERE id = :id LIMIT 1")
    suspend fun getLike(id: String): LikedTrackEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertLike(track: LikedTrackEntity)

    @Delete
    suspend fun deleteLike(track: LikedTrackEntity)

    @Query("DELETE FROM liked_tracks WHERE id = :id")
    suspend fun deleteLikeById(id: String)

    @Query("DELETE FROM liked_tracks")
    suspend fun deleteAll()
}

@Dao
interface PlaylistDao {
    @Query("SELECT * FROM playlists ORDER BY updatedAt DESC")
    fun getAllPlaylists(): Flow<List<PlaylistEntity>>

    @Query("SELECT * FROM playlists WHERE id = :id LIMIT 1")
    suspend fun getPlaylist(id: String): PlaylistEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertPlaylist(playlist: PlaylistEntity)

    @Delete
    suspend fun deletePlaylist(playlist: PlaylistEntity)

    @Query("DELETE FROM playlists WHERE id = :id")
    suspend fun deletePlaylistById(id: String)
}

@Dao
interface PlaylistTrackDao {
    @Query("SELECT * FROM playlist_tracks WHERE playlistId = :playlistId ORDER BY position ASC")
    suspend fun getTracksForPlaylist(playlistId: String): List<PlaylistTrackEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertTrack(track: PlaylistTrackEntity)

    @Delete
    suspend fun deleteTrack(track: PlaylistTrackEntity)

    @Query("DELETE FROM playlist_tracks WHERE playlistId = :playlistId")
    suspend fun deleteAllForPlaylist(playlistId: String)
}

@Dao
interface SearchHistoryDao {
    @Query("SELECT * FROM search_history ORDER BY searchedAt DESC LIMIT 15")
    fun getRecentSearches(): Flow<List<SearchHistoryEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertSearch(entity: SearchHistoryEntity)

    @Delete
    suspend fun deleteSearch(entity: SearchHistoryEntity)

    @Query("DELETE FROM search_history")
    suspend fun deleteAll()
}
