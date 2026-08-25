package com.mrj.music.ui.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
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

            _uiState.value = LibraryUiState(
                offlineTracks = downloaded,
                likedTracks = downloaded, // Unified offline vault
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
}
