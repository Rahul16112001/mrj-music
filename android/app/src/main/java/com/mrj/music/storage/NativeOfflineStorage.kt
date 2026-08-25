package com.mrj.music.storage

import android.content.Context
import android.util.Log
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import com.mrj.music.model.NativeTrack
import java.io.File
import java.io.FileOutputStream
import java.io.InputStream
import java.util.concurrent.ConcurrentHashMap

class NativeOfflineStorage(private val context: Context) {
    private val gson = Gson()
    private val vaultDir: File = File(context.filesDir, "offline_vault").apply {
        if (!exists()) mkdirs()
    }
    private val metadataFile: File = File(vaultDir, "vault_index.json")
    private val trackIndex = ConcurrentHashMap<String, NativeTrack>()

    init {
        loadIndex()
    }

    @Synchronized
    private fun loadIndex() {
        if (metadataFile.exists()) {
            try {
                val json = metadataFile.readText()
                val type = object : TypeToken<Map<String, NativeTrack>>() {}.type
                val map: Map<String, NativeTrack>? = gson.fromJson(json, type)
                if (map != null) {
                    trackIndex.clear()
                    // Filter and clean out any non-existent or corrupted files (<100KB)
                    for ((k, track) in map) {
                        val path = track.localFilePath
                        if (path != null) {
                            val f = File(path)
                            if (f.exists() && f.length() >= MIN_VALID_AUDIO_BYTES) {
                                trackIndex[k] = track
                            } else {
                                if (f.exists()) f.delete()
                            }
                        }
                    }
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    @Synchronized
    private fun saveIndex() {
        try {
            val json = gson.toJson(trackIndex)
            metadataFile.writeText(json)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    fun isTrackDownloaded(trackId: String): Boolean {
        val track = trackIndex[trackId] ?: return false
        val path = track.localFilePath ?: return false
        val file = File(path)
        if (file.exists() && file.length() >= MIN_VALID_AUDIO_BYTES) {
            return true
        }
        // Cleanup corrupt/0-byte file
        if (file.exists()) file.delete()
        deleteTrack(trackId)
        return false
    }

    fun getTrack(trackId: String): NativeTrack? {
        val track = trackIndex[trackId] ?: return null
        val path = track.localFilePath ?: return null
        val file = File(path)
        if (file.exists() && file.length() >= MIN_VALID_AUDIO_BYTES) {
            return track
        }
        if (file.exists()) file.delete()
        deleteTrack(trackId)
        return null
    }

    fun getAllDownloadedTracks(): List<NativeTrack> {
        return trackIndex.values.filter { track ->
            track.localFilePath != null && File(track.localFilePath!!).let { it.exists() && it.length() >= MIN_VALID_AUDIO_BYTES }
        }.distinctBy { it.id }.toList()
    }

    fun getManualDownloads(): List<NativeTrack> {
        return getAllDownloadedTracks().filter { it.downloadType != "smart" }
    }

    fun getSmartDownloads(): List<NativeTrack> {
        return getAllDownloadedTracks().filter { it.downloadType == "smart" }
    }

    fun saveTrackAudio(
        track: NativeTrack,
        inputStream: InputStream,
        downloadType: String = "manual",
        priorityScore: Double = 0.0,
        category: String? = null
    ): NativeTrack? {
        val cleanId = (track.canonicalTrackId ?: track.id).replace("[^a-zA-Z0-9_-]".toRegex(), "_")
        val audioFile = File(vaultDir, "$cleanId.audio")

        try {
            FileOutputStream(audioFile).use { output ->
                inputStream.copyTo(output)
            }

            if (!audioFile.exists() || audioFile.length() < MIN_VALID_AUDIO_BYTES) {
                Log.w(TAG, "Audio stream for ${track.title} was empty or corrupted (<100KB, size=${audioFile.length()}). Discarding.")
                if (audioFile.exists()) audioFile.delete()
                return null
            }

            val updatedTrack = track.copy(
                localFilePath = audioFile.absolutePath,
                downloadType = downloadType,
                priorityScore = priorityScore,
                downloadCategory = category
            )

            trackIndex[track.id] = updatedTrack
            if (!track.canonicalTrackId.isNullOrEmpty()) {
                trackIndex[track.canonicalTrackId] = updatedTrack
            }
            saveIndex()
            return updatedTrack
        } catch (e: Exception) {
            e.printStackTrace()
            if (audioFile.exists()) audioFile.delete()
            return null
        }
    }

    fun deleteTrack(trackId: String): Boolean {
        val track = trackIndex.remove(trackId) ?: return false
        track.canonicalTrackId?.let { trackIndex.remove(it) }
        saveIndex()

        track.localFilePath?.let { path ->
            val file = File(path)
            if (file.exists()) {
                file.delete()
            }
        }
        return true
    }

    fun evictLowestPrioritySmartDownloads(bytesNeeded: Long): Long {
        var bytesFreed = 0L
        val smartTracks = getSmartDownloads().sortedBy { it.priorityScore }

        for (track in smartTracks) {
            if (bytesFreed >= bytesNeeded) break
            track.localFilePath?.let { path ->
                val file = File(path)
                val size = if (file.exists()) file.length() else 0L
                if (deleteTrack(track.id)) {
                    bytesFreed += size
                }
            }
        }
        return bytesFreed
    }

    fun clearSmartDownloadsOnly(): Int {
        var count = 0
        val smartTracks = getSmartDownloads()
        for (track in smartTracks) {
            if (deleteTrack(track.id)) {
                count++
            }
        }
        return count
    }

    fun clearAllDownloads(): Int {
        var count = 0
        val allTracks = getAllDownloadedTracks()
        for (track in allTracks) {
            if (deleteTrack(track.id)) {
                count++
            }
        }
        return count
    }

    fun getStorageBreakdown(): Map<String, Any> {
        var manualBytes = 0L
        var smartBytes = 0L

        for (track in getAllDownloadedTracks()) {
            val file = File(track.localFilePath ?: "")
            val len = if (file.exists()) file.length() else 0L
            if (track.downloadType == "smart") {
                smartBytes += len
            } else {
                manualBytes += len
            }
        }

        val usableSpace = context.filesDir.usableSpace
        val totalSpace = context.filesDir.totalSpace

        return mapOf(
            "totalBytes" to (manualBytes + smartBytes),
            "manualBytes" to manualBytes,
            "smartBytes" to smartBytes,
            "totalTracks" to getAllDownloadedTracks().size,
            "manualTracks" to getManualDownloads().size,
            "smartTracks" to getSmartDownloads().size,
            "usableDeviceBytes" to usableSpace,
            "totalDeviceBytes" to totalSpace
        )
    }

    companion object {
        private const val TAG = "MRJ_OfflineStorage"
        private const val MIN_VALID_AUDIO_BYTES = 100_000L // 100 KB minimum for real playable audio

        @Volatile
        private var instance: NativeOfflineStorage? = null

        fun getInstance(context: Context): NativeOfflineStorage {
            return instance ?: synchronized(this) {
                instance ?: NativeOfflineStorage(context.applicationContext).also { instance = it }
            }
        }
    }
}
