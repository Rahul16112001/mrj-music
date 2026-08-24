package com.mrj.music.storage

import android.content.Context
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
                    trackIndex.putAll(map)
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
        return File(path).exists()
    }

    fun getTrack(trackId: String): NativeTrack? {
        return trackIndex[trackId]
    }

    fun getAllDownloadedTracks(): List<NativeTrack> {
        return trackIndex.values.filter { track ->
            track.localFilePath != null && File(track.localFilePath!!).exists()
        }.toList()
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

        return mapOf(
            "totalBytes" to (manualBytes + smartBytes),
            "manualBytes" to manualBytes,
            "smartBytes" to smartBytes,
            "totalTracks" to getAllDownloadedTracks().size,
            "manualTracks" to getManualDownloads().size,
            "smartTracks" to getSmartDownloads().size
        )
    }

    companion object {
        @Volatile
        private var instance: NativeOfflineStorage? = null

        fun getInstance(context: Context): NativeOfflineStorage {
            return instance ?: synchronized(this) {
                instance ?: NativeOfflineStorage(context.applicationContext).also { instance = it }
            }
        }
    }
}
