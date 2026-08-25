package com.mrj.music.smartdownload

import android.content.Context
import android.util.Log
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
    private val smartPrefs = SmartDownloadPreferences.getInstance(context)
    private val predictor = SmartDownloadPredictor.getInstance(context)

    private val httpClient = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .build()

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        try {
            val config = smartPrefs.getConfig()
            if (!config.isEnabled) {
                Log.d(TAG, "Smart Downloads is disabled by user. Skipping sync.")
                return@withContext Result.success()
            }

            Log.d(TAG, "Starting Smart Downloads background sync (Quota: ${config.songCountQuota} songs)...")

            // 1. Check if user reduced quota or storage is constrained; evict excess smart tracks
            val currentSmartDownloads = offlineStorage.getSmartDownloads()
            if (currentSmartDownloads.size > config.songCountQuota) {
                val excess = currentSmartDownloads.size - config.songCountQuota
                val sortedSmart = currentSmartDownloads.sortedBy { it.priorityScore }
                for (i in 0 until excess) {
                    offlineStorage.deleteTrack(sortedSmart[i].id)
                    Log.d(TAG, "Evicted lowest-priority smart download: ${sortedSmart[i].title}")
                }
            }

            // 2. Fetch AI-predicted candidates up to remaining quota slots
            val candidates = predictor.predictTracksToDownload(config.songCountQuota)
            if (candidates.isEmpty()) {
                Log.d(TAG, "No new candidate tracks to smart download. Sync complete.")
                smartPrefs.setLastSyncTimestamp(System.currentTimeMillis())
                return@withContext Result.success()
            }

            var successCount = 0
            for (track in candidates) {
                if (isStopped) {
                    Log.w(TAG, "Worker stopped by OS constraint.")
                    break
                }

                val streamUrl = track.streamUrl ?: "https://mrj-music.vercel.app/api/music/stream/${track.id}"
                val downloaded = downloadAndSaveTrack(track, streamUrl)
                if (downloaded) {
                    successCount++
                    Log.d(TAG, "Successfully smart-cached ($successCount/${candidates.size}): ${track.title} by ${track.artist}")
                }
            }

            smartPrefs.setLastSyncTimestamp(System.currentTimeMillis())
            Log.d(TAG, "Smart Downloads sync finished. Downloaded $successCount new tracks.")
            Result.success()
        } catch (e: Exception) {
            Log.e(TAG, "SmartDownloadWorker encountered error: ${e.message}", e)
            Result.retry()
        }
    }

    private suspend fun downloadAndSaveTrack(track: NativeTrack, streamUrl: String): Boolean = withContext(Dispatchers.IO) {
        try {
            val request = Request.Builder()
                .url(streamUrl)
                .addHeader("User-Agent", "MRJMusic/3.16.0 (Android; SmartDownloader)")
                .build()

            val response = httpClient.newCall(request).execute()
            val body = response.body
            if (!response.isSuccessful || body == null) {
                Log.w(TAG, "Stream download failed with HTTP ${response.code} for: ${track.title}")
                return@withContext false
            }

            val contentType = body.contentType()?.toString() ?: ""
            if (contentType.contains("text/html") || contentType.contains("application/json")) {
                Log.w(TAG, "Server returned non-audio ($contentType) for: ${track.title}")
                return@withContext false
            }

            val inputStream = body.byteStream()
            val savedTrack = offlineStorage.saveTrackAudio(
                track = track,
                inputStream = inputStream,
                downloadType = "smart",
                priorityScore = track.priorityScore,
                category = track.downloadCategory ?: "recommendation"
            )

            return@withContext savedTrack != null
        } catch (e: Exception) {
            Log.e(TAG, "Error downloading audio stream for ${track.title}: ${e.message}")
            return@withContext false
        }
    }

    companion object {
        private const val TAG = "MRJ_SmartDownloadWorker"
    }
}
