package com.mrj.music.smartdownload

import android.content.Context
import android.util.Log
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.mrj.music.data.local.entities.DownloadedTrackEntity
import com.mrj.music.data.repository.MusicRepository
import com.mrj.music.model.NativeTrack
import com.mrj.music.storage.NativeOfflineStorage
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.util.concurrent.TimeUnit
import javax.inject.Inject

class SmartDownloadWorker @Inject constructor(
    private val context: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(context, workerParams) {

    private val offlineStorage = NativeOfflineStorage.getInstance(context)
    private val httpClient = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .build()

    @Inject
    lateinit var musicRepository: MusicRepository

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        try {
            val maxStorageBytes = inputData.getLong("max_storage_bytes", 500L * 1024 * 1024)
            val maxTracks = inputData.getInt("max_tracks", 25)

            val currentDownloads = offlineStorage.getAllDownloadedTracks()
            if (currentDownloads.size >= maxTracks) {
                return@withContext Result.success()
            }

            val currentStorage = offlineStorage.getStorageBreakdown()["totalBytes"] as? Long ?: 0L
            if (currentStorage > maxStorageBytes) {
                offlineStorage.evictLowestPrioritySmartDownloads(currentStorage - maxStorageBytes)
            }

            val tracksToDownload = currentDownloads.size
            if (tracksToDownload >= maxTracks) {
                return@withContext Result.success()
            }

            val homeResult = musicRepository.getHome()
            if (homeResult.isSuccess) {
                val homeData = homeResult.getOrNull()!!
                val quickPicks = (homeData["personalized"] as? Map<String, Any>)?.get("quickPicks") as? List<Map<String, Any>> ?: emptyList()
                val recommended = (homeData["personalized"] as? Map<String, Any>)?.get("recommendedForYou") as? List<Map<String, Any>> ?: emptyList()
                val allTracks = (quickPicks + recommended).distinctBy { it["id"] }

                var downloaded = 0
                for (trackMap in allTracks) {
                    if (downloaded >= maxTracks - currentDownloads.size) break

                    val trackId = trackMap["id"] as? String ?: continue
                    if (offlineStorage.getTrack(trackId) != null) continue

                    val title = trackMap["title"] as? String ?: continue
                    val artist = trackMap["artist"] as? String ?: continue
                    val thumbnail = trackMap["thumbnail"] as? String
                    val duration = (trackMap["duration"] as? Number)?.toDouble() ?: 0.0
                    val providerTrackId = trackMap["providerTrackId"] as? String ?: trackId

                    val resolveResult = musicRepository.search("$title $artist")
                    if (resolveResult.isSuccess) {
                        val searchData = resolveResult.getOrNull()!!
                        val songs = (searchData["songs"] as? List<Map<String, Any>>) ?: emptyList()
                        val firstSong = songs.firstOrNull()
                        val streamUrl = firstSong?.get("audioUrl") as? String
                            ?: "https://mrj-music.vercel.app/api/music/stream/$providerTrackId"

                        val nativeTrack = NativeTrack(
                            id = trackId,
                            canonicalTrackId = trackMap["canonicalTrackId"] as? String,
                            title = title,
                            artist = artist,
                            album = trackMap["album"] as? String,
                            thumbnail = thumbnail,
                            duration = duration,
                            genre = trackMap["genre"] as? String,
                            providerTrackId = providerTrackId,
                            streamUrl = streamUrl,
                            downloadType = "smart",
                            priorityScore = 50.0
                        )

                        val success = downloadTrackDirectly(nativeTrack, streamUrl, "smart", 50.0, "recommendation")
                        if (success) {
                            downloaded++
                            Log.d(TAG, "Smart downloaded: $title - $artist")
                        }
                    }
                }
            }

            Result.success()
        } catch (e: Exception) {
            Log.e(TAG, "Smart download worker error: ${e.message}", e)
            Result.retry()
        }
    }

    suspend fun downloadTrackDirectly(
        track: NativeTrack,
        streamUrl: String,
        downloadType: String = "manual",
        priorityScore: Double = 0.0,
        category: String? = null
    ): Boolean = withContext(Dispatchers.IO) {
        try {
            val request = Request.Builder().url(streamUrl).build()
            val response = httpClient.newCall(request).execute()

            if (!response.isSuccessful || response.body == null) {
                return@withContext false
            }

            val inputStream = response.body!!.byteStream()
            val savedTrack = offlineStorage.saveTrackAudio(
                track = track,
                inputStream = inputStream,
                downloadType = downloadType,
                priorityScore = priorityScore,
                category = category
            )

            return@withContext savedTrack != null
        } catch (e: Exception) {
            Log.e(TAG, "Direct download error: ${e.message}", e)
            return@withContext false
        }
    }

    companion object {
        private const val TAG = "MRJ_SmartDownloadWorker"
    }
}
