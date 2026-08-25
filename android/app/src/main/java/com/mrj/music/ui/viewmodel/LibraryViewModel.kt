package com.mrj.music.ui.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.mrj.music.data.remote.MRJApiClient
import com.mrj.music.data.security.SecureAuthStorage
import com.mrj.music.model.NativeTrack
import com.mrj.music.storage.NativeOfflineStorage
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class LibraryUiState(
    val offlineTracks: List<NativeTrack> = emptyList(),
    val likedTracks: List<NativeTrack> = emptyList(),
    val totalStorageFormatted: String = "0 MB",
    val totalTracksCount: Int = 0,
    val isLoading: Boolean = false
)

class LibraryViewModel(application: Application) : AndroidViewModel(application) {

    private val offlineStorage = NativeOfflineStorage.getInstance(application)
    private val secureStorage = SecureAuthStorage.getInstance(application)
    private val _uiState = MutableStateFlow(LibraryUiState())
    val uiState: StateFlow<LibraryUiState> = _uiState.asStateFlow()

    init {
        refreshLibrary()
    }

    fun refreshLibrary() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true)
            val downloaded = offlineStorage.getAllDownloadedTracks()
            val breakdown = offlineStorage.getStorageBreakdown()
            val formatted = breakdown["formatted"] as? String ?: "0 MB"

            var cloudLikes: List<NativeTrack> = emptyList()
            try {
                val token = secureStorage.getAccessToken()
                if (token != null) {
                    val res = MRJApiClient.apiService.getUserLikes("Bearer $token")
                    if (res.isSuccessful && res.body() != null) {
                        val rawLikes = (res.body()!!["likes"] as? List<Map<String, Any>>) ?: emptyList()
                        cloudLikes = rawLikes.mapNotNull { parseTrack(it) }
                    }
                }
            } catch (_: Exception) {}

            val unifiedLikes = if (cloudLikes.isNotEmpty()) {
                val downloadedIds = downloaded.map { it.id }.toSet()
                val merged = downloaded.toMutableList()
                cloudLikes.forEach { if (it.id !in downloadedIds) merged.add(it) }
                merged
            } else {
                downloaded
            }

            _uiState.value = LibraryUiState(
                offlineTracks = downloaded,
                likedTracks = unifiedLikes,
                totalStorageFormatted = formatted,
                totalTracksCount = downloaded.size,
                isLoading = false
            )
        }
    }

    fun deleteTrack(trackId: String) {
        viewModelScope.launch {
            offlineStorage.deleteTrack(trackId)
            refreshLibrary()
        }
    }

    private fun parseTrack(map: Map<String, Any>): NativeTrack? {
        val id = (map["id"] as? String) ?: (map["providerTrackId"] as? String) ?: return null
        val title = map["title"] as? String ?: return null
        val artist = map["artist"] as? String ?: "Unknown Artist"
        val thumbnail = map["thumbnail"] as? String
        val duration = (map["duration"] as? Number)?.toDouble() ?: 210.0
        val album = map["album"] as? String
        val genre = map["genre"] as? String
        val canonicalTrackId = map["canonicalTrackId"] as? String ?: id

        val audioSource = map["audioSource"] as? Map<*, *>
        val providerTrackId = (audioSource?.get("providerTrackId") as? String)
            ?: (map["providerTrackId"] as? String)
            ?: (map["videoId"] as? String)
            ?: (map["youtubeId"] as? String)
            ?: (if (!id.contains("|")) id else null)

        val streamUrl = map["streamUrl"] as? String 
            ?: "https://mrj-music.vercel.app/api/music/stream/${providerTrackId ?: id}"

        return NativeTrack(
            id = id,
            canonicalTrackId = canonicalTrackId,
            title = title,
            artist = artist,
            album = album,
            thumbnail = thumbnail,
            duration = duration,
            genre = genre,
            providerTrackId = providerTrackId,
            streamUrl = streamUrl
        )
    }
}
