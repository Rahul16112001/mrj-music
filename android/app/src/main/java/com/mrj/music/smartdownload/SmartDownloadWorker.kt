package com.mrj.music.smartdownload

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.mrj.music.model.NativeTrack
import com.mrj.music.storage.NativeOfflineStorage
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.util.concurrent.TimeUnit

class SmartDownloadWorker(
    private val context: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(context, workerParams) {

    private val offlineStorage = NativeOfflineStorage.getInstance(context)
    private val httpClient = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .build()

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        try {
            val maxStorageBytes = inputData.getLong("max_storage_bytes", 500L * 1024 * 1024)
            val maxTracks = inputData.getInt("max_tracks", 25)

            val currentDownloads = offlineStorage.getAllDownloadedTracks()
            if (currentDownloads.size >= maxTracks) {
                return@withContext Result.success()
            }

            // Cleanup any excess smart downloads before starting
            val currentStorage = offlineStorage.getStorageBreakdown()["totalBytes"] as? Long ?: 0L
            if (currentStorage > maxStorageBytes) {
                offlineStorage.evictLowestPrioritySmartDownloads(currentStorage - maxStorageBytes)
            }

            Result.success()
        } catch (e: Exception) {
            e.printStackTrace()
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
            e.printStackTrace()
            return@withContext false
        }
    }
}
