package com.mrj.music.data.repository

import com.mrj.music.data.remote.api.MRJApiService
import com.mrj.music.data.preferences.DataStoreManager
import com.mrj.music.data.local.entities.*
import com.mrj.music.data.local.daos.*
import com.mrj.music.domain.model.*
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.runBlocking
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class MusicRepository @Inject constructor(
    private val apiService: MRJApiService,
    private val downloadedTrackDao: DownloadedTrackDao,
    private val likedTrackDao: LikedTrackDao,
    private val playlistDao: PlaylistDao,
    private val playlistTrackDao: PlaylistTrackDao,
    private val searchHistoryDao: SearchHistoryDao,
    private val dataStoreManager: DataStoreManager
) {

    // Charts
    suspend fun getTrending(region: String = "GLOBAL"): Result<Map<String, Any>> {
        return try {
            val response = apiService.getTrending(region)
            if (response.isSuccessful) Result.success(response.body()!!) else Result.failure(Exception("Failed"))
        } catch (e: Exception) { Result.failure(e) }
    }

    suspend fun getTopSongs(region: String = "GLOBAL"): Result<Map<String, Any>> {
        return try {
            val response = apiService.getTopSongs(region)
            if (response.isSuccessful) Result.success(response.body()!!) else Result.failure(Exception("Failed"))
        } catch (e: Exception) { Result.failure(e) }
    }

    suspend fun getTopArtists(region: String = "GLOBAL"): Result<Map<String, Any>> {
        return try {
            val response = apiService.getTopArtists(region)
            if (response.isSuccessful) Result.success(response.body()!!) else Result.failure(Exception("Failed"))
        } catch (e: Exception) { Result.failure(e) }
    }

    suspend fun getCategories(): Result<Map<String, Any>> {
        return try {
            val response = apiService.getCategories()
            if (response.isSuccessful) Result.success(response.body()!!) else Result.failure(Exception("Failed"))
        } catch (e: Exception) { Result.failure(e) }
    }

    // Search
    suspend fun search(query: String, type: String = "all"): Result<Map<String, Any>> {
        return try {
            val response = apiService.search(query, type)
            if (response.isSuccessful) Result.success(response.body()!!) else Result.failure(Exception("Failed"))
        } catch (e: Exception) { Result.failure(e) }
    }

    suspend fun getArtist(name: String): Result<Map<String, Any>> {
        return try {
            val response = apiService.getArtist(name)
            if (response.isSuccessful) Result.success(response.body()!!) else Result.failure(Exception("Failed"))
        } catch (e: Exception) { Result.failure(e) }
    }

    suspend fun getAlbum(id: String): Result<Map<String, Any>> {
        return try {
            val response = apiService.getAlbum(id)
            if (response.isSuccessful) Result.success(response.body()!!) else Result.failure(Exception("Failed"))
        } catch (e: Exception) { Result.failure(e) }
    }

    suspend fun getLyrics(track: String, artist: String, duration: Int? = null): Result<LyricData> {
        return try {
            val response = apiService.getLyrics(track, artist, duration)
            if (response.isSuccessful) Result.success(response.body()!!) else Result.failure(Exception("Failed"))
        } catch (e: Exception) { Result.failure(e) }
    }

    // Home
    suspend fun getHome(region: String = "IN"): Result<Map<String, Any>> {
        val token = runBlocking { dataStoreManager.authToken.first() }
        return try {
            val response = apiService.getHome(token, region)
            if (response.isSuccessful) Result.success(response.body()!!) else Result.failure(Exception("Failed"))
        } catch (e: Exception) { Result.failure(e) }
    }

    // Recommendations
    suspend fun getNextRecommendations(options: Map<String, Any?>): Result<Map<String, Any>> {
        val token = runBlocking { dataStoreManager.authToken.first() }
        return try {
            val response = apiService.getNextRecommendations(token, options)
            if (response.isSuccessful) Result.success(response.body()!!) else Result.failure(Exception("Failed"))
        } catch (e: Exception) { Result.failure(e) }
    }

    // User Data
    suspend fun getLikes(): Result<Map<String, Any>> {
        val token = runBlocking { dataStoreManager.authToken.first() } ?: return Result.failure(Exception("Not authenticated"))
        return try {
            val response = apiService.getLikes(token)
            if (response.isSuccessful) Result.success(response.body()!!) else Result.failure(Exception("Failed"))
        } catch (e: Exception) { Result.failure(e) }
    }

    suspend fun likeTrack(track: Map<String, Any>): Result<Map<String, Any>> {
        val token = runBlocking { dataStoreManager.authToken.first() } ?: return Result.failure(Exception("Not authenticated"))
        return try {
            val response = apiService.likeTrack(token, track)
            if (response.isSuccessful) Result.success(response.body()!!) else Result.failure(Exception("Failed"))
        } catch (e: Exception) { Result.failure(e) }
    }

    suspend fun unlikeTrack(trackId: String): Result<Map<String, Any>> {
        val token = runBlocking { dataStoreManager.authToken.first() } ?: return Result.failure(Exception("Not authenticated"))
        return try {
            val response = apiService.unlikeTrack(token, trackId)
            if (response.isSuccessful) Result.success(response.body()!!) else Result.failure(Exception("Failed"))
        } catch (e: Exception) { Result.failure(e) }
    }

    // Playlists
    suspend fun getPlaylists(): Result<Map<String, Any>> {
        val token = runBlocking { dataStoreManager.authToken.first() } ?: return Result.failure(Exception("Not authenticated"))
        return try {
            val response = apiService.getPlaylists(token)
            if (response.isSuccessful) Result.success(response.body()!!) else Result.failure(Exception("Failed"))
        } catch (e: Exception) { Result.failure(e) }
    }

    // Offline Storage
    fun getAllDownloadedTracks(): Flow<List<DownloadedTrackEntity>> = downloadedTrackDao.getAllTracks()
    suspend fun getDownloadedTrack(id: String): DownloadedTrackEntity? = downloadedTrackDao.getTrack(id)
    suspend fun insertDownloadedTrack(track: DownloadedTrackEntity) = downloadedTrackDao.insertTrack(track)
    suspend fun deleteDownloadedTrack(id: String) = downloadedTrackDao.deleteTrackById(id)
    suspend fun getTotalDownloadSize(): Long = downloadedTrackDao.getTotalSizeBytes() ?: 0L

    fun getAllLikes(): Flow<List<LikedTrackEntity>> = likedTrackDao.getAllLikes()
    suspend fun insertLike(track: LikedTrackEntity) = likedTrackDao.insertLike(track)
    suspend fun deleteLike(id: String) = likedTrackDao.deleteLikeById(id)
    suspend fun isLiked(id: String): Boolean = likedTrackDao.getLike(id) != null

    fun getAllPlaylists(): Flow<List<PlaylistEntity>> = playlistDao.getAllPlaylists()
    suspend fun insertPlaylist(playlist: PlaylistEntity) = playlistDao.insertPlaylist(playlist)
    suspend fun deletePlaylist(id: String) = playlistDao.deletePlaylistById(id)

    fun getRecentSearches(): Flow<List<SearchHistoryEntity>> = searchHistoryDao.getRecentSearches()
    suspend fun insertSearch(entity: SearchHistoryEntity) = searchHistoryDao.insertSearch(entity)
    suspend fun deleteSearch(entity: SearchHistoryEntity) = searchHistoryDao.deleteSearch(entity)
    suspend fun clearSearchHistory() = searchHistoryDao.deleteAll()

    // Update
    suspend fun checkUpdate(currentVersion: String): Result<UpdateInfo> {
        return try {
            val response = apiService.checkUpdate(currentVersion)
            if (response.isSuccessful && response.body() != null) {
                val body = response.body()!!
                Result.success(
                    UpdateInfo(
                        isUpdateAvailable = body["isUpdateAvailable"] as? Boolean ?: false,
                        latestVersion = body["latestVersion"] as? String ?: "",
                        versionCode = (body["buildNumber"] as? Number)?.toInt() ?: 0,
                        downloadUrl = body["apkDownloadUrl"] as? String ?: "",
                        releaseNotes = (body["changelog"] as? List<*>)?.map { it.toString() } ?: emptyList(),
                        isMandatory = body["isMandatory"] as? Boolean ?: false,
                        fileSize = body["fileSize"] as? String ?: "",
                        fileSizeBytes = (body["fileSizeBytes"] as? Number)?.toLong() ?: 0L
                    )
                )
            } else {
                Result.failure(Exception("Failed"))
            }
        } catch (e: Exception) { Result.failure(e) }
    }
}
