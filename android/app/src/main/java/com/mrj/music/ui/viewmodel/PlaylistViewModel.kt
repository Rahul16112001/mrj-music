package com.mrj.music.ui.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.mrj.music.data.repository.PlaylistRepository
import com.mrj.music.model.NativePlaylist
import com.mrj.music.model.NativeTrack
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class PlaylistUiState(
    val playlists: List<NativePlaylist> = emptyList(),
    val selectedPlaylist: NativePlaylist? = null,
    val isLoading: Boolean = false,
    val message: String? = null
)

class PlaylistViewModel(application: Application) : AndroidViewModel(application) {

    private val repository = PlaylistRepository.getInstance(application)

    private val _uiState = MutableStateFlow(PlaylistUiState())
    val uiState: StateFlow<PlaylistUiState> = _uiState.asStateFlow()

    init {
        viewModelScope.launch {
            repository.playlists.collect { list ->
                val currentSelected = _uiState.value.selectedPlaylist
                val updatedSelected = if (currentSelected != null) {
                    list.find { it.id == currentSelected.id } ?: currentSelected
                } else null

                _uiState.value = _uiState.value.copy(
                    playlists = list,
                    selectedPlaylist = updatedSelected,
                    isLoading = false
                )
            }
        }
        refreshPlaylists()
    }

    fun refreshPlaylists() {
        _uiState.value = _uiState.value.copy(isLoading = true)
        repository.syncWithCloud()
    }

    fun selectPlaylist(playlistId: String) {
        val pl = repository.getPlaylistById(playlistId)
        _uiState.value = _uiState.value.copy(selectedPlaylist = pl)
    }

    fun createPlaylist(title: String, description: String = "", onCreated: ((NativePlaylist) -> Unit)? = null) {
        repository.createPlaylist(title, description, onCreated)
    }

    fun updatePlaylist(playlistId: String, title: String, description: String = "") {
        repository.updatePlaylist(playlistId, title, description)
    }

    fun deletePlaylist(playlistId: String) {
        repository.deletePlaylist(playlistId)
        if (_uiState.value.selectedPlaylist?.id == playlistId) {
            _uiState.value = _uiState.value.copy(selectedPlaylist = null)
        }
    }

    fun addTrackToPlaylist(playlistId: String, track: NativeTrack, onResult: ((Boolean) -> Unit)? = null) {
        repository.addTrackToPlaylist(playlistId, track, onResult)
    }

    fun removeTrackFromPlaylist(playlistId: String, trackId: String) {
        repository.removeTrackFromPlaylist(playlistId, trackId)
    }

    fun clearMessage() {
        _uiState.value = _uiState.value.copy(message = null)
    }
}
