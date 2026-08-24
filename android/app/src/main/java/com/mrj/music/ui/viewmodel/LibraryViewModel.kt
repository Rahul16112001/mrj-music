package com.mrj.music.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.mrj.music.data.repository.MusicRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class LibraryState(
    val downloadedTracks: List<com.mrj.music.data.local.entities.DownloadedTrackEntity> = emptyList(),
    val likedTracks: List<com.mrj.music.data.local.entities.LikedTrackEntity> = emptyList(),
    val playlists: List<com.mrj.music.data.local.entities.PlaylistEntity> = emptyList(),
    val isLoading: Boolean = false,
    val error: String? = null
)

@HiltViewModel
class LibraryViewModel @Inject constructor(
    private val musicRepository: MusicRepository
) : ViewModel() {

    private val _state = MutableStateFlow(LibraryState())
    val state: StateFlow<LibraryState> = _state.asStateFlow()

    init {
        loadLibrary()
    }

    fun loadLibrary() {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true)
            musicRepository.getAllDownloadedTracks().collect { downloads ->
                musicRepository.getAllLikes().collect { likes ->
                    musicRepository.getAllPlaylists().collect { playlists ->
                        _state.value = _state.value.copy(
                            downloadedTracks = downloads,
                            likedTracks = likes,
                            playlists = playlists,
                            isLoading = false
                        )
                    }
                }
            }
        }
    }
}
