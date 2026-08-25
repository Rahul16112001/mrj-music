package com.mrj.music.smartdownload

import android.content.Context
import android.util.Log
import com.google.gson.Gson
import com.mrj.music.data.repository.FavoritesRepository
import com.mrj.music.model.NativeTrack
import com.mrj.music.storage.NativeOfflineStorage
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.util.concurrent.TimeUnit

class SmartDownloadPredictor(private val context: Context) {

    private val favoritesRepository = FavoritesRepository.getInstance(context)
    private val offlineStorage = NativeOfflineStorage.getInstance(context)
    private val smartPrefs = SmartDownloadPreferences.getInstance(context)
    private val gson = Gson()
    private val httpClient = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .build()

    suspend fun predictTracksToDownload(maxToFetch: Int? = null): List<NativeTrack> = withContext(Dispatchers.IO) {
        val config = smartPrefs.getConfig()
        if (!config.isEnabled) {
            Log.d(TAG, "Smart downloads is disabled in preferences.")
            return@withContext emptyList()
        }

        val currentSmartDownloads = offlineStorage.getSmartDownloads()
        val totalAllowed = maxToFetch ?: config.songCountQuota
        val slotsAvailable = (totalAllowed - currentSmartDownloads.size).coerceAtLeast(0)

        if (slotsAvailable <= 0) {
            Log.d(TAG, "Smart download quota reached: ${currentSmartDownloads.size}/$totalAllowed")
            return@withContext emptyList()
        }

        val downloadedIds = offlineStorage.getAllDownloadedTracks().map { it.id }.toSet()
        val candidateMap = mutableMapOf<String, Pair<NativeTrack, Double>>()

        // 1. Source A: Liked / Favorite Tracks (Top Priority: 100.0 pts)
        val likedTracks = favoritesRepository.likedTracks.value
        for (track in likedTracks) {
            if (!downloadedIds.contains(track.id)) {
                candidateMap[track.id] = Pair(track.copy(downloadType = "smart"), 100.0)
            }
        }

        // 2. Source B: Personalized Home Feed Candidates (Quick Picks, Daily Mixes, Songs For You)
        try {
            val request = Request.Builder()
                .url("https://mrj-music.vercel.app/api/music/personalized-home?region=IN")
                .build()
            val response = httpClient.newCall(request).execute()
            if (response.isSuccessful && response.body != null) {
                val bodyStr = response.body!!.string()
                val rootMap = gson.fromJson(bodyStr, Map::class.java)

                // A. Quick Picks (+40.0 pts)
                val personalized = rootMap["personalized"] as? Map<*, *>
                val quickPicks = (personalized?.get("quickPicks") as? List<Map<*, *>>) ?: emptyList()
                parseAndAddCandidates(quickPicks, 40.0, candidateMap, downloadedIds)

                // B. Daily Mixes & Songs For You (+30.0 pts)
                val discovery = rootMap["discovery"] as? Map<*, *>
                val dailyMixes = (discovery?.get("dailyMixes") as? List<Map<*, *>>) ?: emptyList()
                for (mix in dailyMixes) {
                    val mixTracks = (mix["tracks"] as? List<Map<*, *>>) ?: emptyList()
                    parseAndAddCandidates(mixTracks, 30.0, candidateMap, downloadedIds)
                }

                // C. Charts / Trending (+20.0 pts)
                val charts = rootMap["charts"] as? Map<*, *>
                val trending = (charts?.get("trendingRegional") as? List<Map<*, *>>) ?: emptyList()
                parseAndAddCandidates(trending, 20.0, candidateMap, downloadedIds)
            }
        } catch (e: Exception) {
            Log.w(TAG, "Could not fetch online candidates for smart downloads: ${e.message}")
        }

        // 3. Score Sorting and Top Slot Slicing
        val rankedCandidates = candidateMap.values
            .sortedByDescending { it.second }
            .take(slotsAvailable)
            .map { (track, score) ->
                track.copy(
                    downloadType = "smart",
                    priorityScore = score,
                    downloadCategory = if (score >= 90.0) "favorite" else "recommendation"
                )
            }

        Log.d(TAG, "Predicted ${rankedCandidates.size} candidate tracks for smart caching (Quota: $totalAllowed)")
        return@withContext rankedCandidates
    }

    private fun parseAndAddCandidates(
        rawList: List<Map<*, *>>,
        baseScore: Double,
        candidateMap: MutableMap<String, Pair<NativeTrack, Double>>,
        downloadedIds: Set<String>
    ) {
        for (item in rawList) {
            val id = item["id"] as? String ?: continue
            if (downloadedIds.contains(id)) continue

            val title = item["title"] as? String ?: continue
            val artist = item["artist"] as? String ?: continue
            val thumbnail = item["thumbnail"] as? String
            val duration = (item["duration"] as? Number)?.toDouble() ?: 0.0
            val genre = item["genre"] as? String

            val track = NativeTrack(
                id = id,
                title = title,
                artist = artist,
                album = item["album"] as? String ?: "Single",
                thumbnail = thumbnail,
                duration = duration,
                genre = genre,
                streamUrl = "https://mrj-music.vercel.app/api/music/stream/$id",
                downloadType = "smart",
                priorityScore = baseScore
            )

            val existingScore = candidateMap[id]?.second ?: 0.0
            if (baseScore > existingScore) {
                candidateMap[id] = Pair(track, baseScore)
            }
        }
    }

    companion object {
        private const val TAG = "MRJ_SmartPredictor"

        @Volatile
        private var instance: SmartDownloadPredictor? = null

        fun getInstance(context: Context): SmartDownloadPredictor {
            return instance ?: synchronized(this) {
                instance ?: SmartDownloadPredictor(context.applicationContext).also { instance = it }
            }
        }

        fun scoreTrack(isFavorite: Boolean, playCount: Int, completionRate: Double, daysSinceLastPlay: Int): Double {
            val favScore = if (isFavorite) 100.0 else 0.0
            val playScore = (playCount * 15.0).coerceAtMost(60.0)
            val compScore = (completionRate * 20.0).coerceAtMost(20.0)
            val recencyPenalty = (daysSinceLastPlay * 2.0).coerceAtMost(40.0)
            return (favScore + playScore + compScore - recencyPenalty).coerceAtLeast(0.0)
        }
    }
}
