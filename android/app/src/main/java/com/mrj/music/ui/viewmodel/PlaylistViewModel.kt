package com.mrj.music.ui.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.mrj.music.data.remote.MRJApiClient
import com.mrj.music.data.repository.PlaylistRepository
import com.mrj.music.data.security.SecureAuthStorage
import com.mrj.music.model.NativePlaylist
import com.mrj.music.model.NativeTrack
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.Dispatchers

data class PlaylistUiState(
    val playlists: List<NativePlaylist> = emptyList(),
    val selectedPlaylist: NativePlaylist? = null,
    val isLoading: Boolean = false,
    val message: String? = null
)

class PlaylistViewModel(application: Application) : AndroidViewModel(application) {

    private val repository = PlaylistRepository.getInstance(application)
    private val authStorage = SecureAuthStorage.getInstance(application)

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

    fun loadPlaylistDetails(playlistId: String) {
        if (playlistId.isBlank()) return
        val cached = repository.getPlaylistById(playlistId)
        if (cached != null) {
            _uiState.value = _uiState.value.copy(selectedPlaylist = cached, isLoading = false)
            return
        }

        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(selectedPlaylist = null, isLoading = true, message = null)
            val fetched = withContext(Dispatchers.IO) {
                runCatching {
                    val token = authStorage.getAccessToken()
                    val auth = token?.let { "Bearer $it" }
                    val detail = if (auth != null) {
                        MRJApiClient.apiService.getPlaylistDetail(auth, playlistId)
                    } else null
                    val detailMap = detail?.takeIf { it.isSuccessful }?.body()?.get("playlist") as? Map<*, *>
                    parsePlaylist(detailMap, playlistId)
                        ?: run {
                            val search = MRJApiClient.apiService.search(playlistId, "playlists")
                            val playlists = search.body()?.get("playlists") as? List<*>
                            parsePlaylist(playlists?.firstOrNull() as? Map<*, *>, playlistId)
                        }
                }.getOrNull()
            }
            _uiState.value = _uiState.value.copy(
                selectedPlaylist = fetched,
                isLoading = false,
                message = if (fetched == null) "Playlist not found" else null
            )
        }
    }

    private fun parsePlaylist(raw: Map<*, *>?, fallbackId: String): NativePlaylist? {
        if (raw == null) return null
        val id = raw["id"]?.toString() ?: raw["playlistId"]?.toString() ?: fallbackId
        val title = raw["title"]?.toString() ?: raw["name"]?.toString() ?: return null
        val description = raw["description"]?.toString().orEmpty()
        val thumbnail = (raw["thumbnail"] ?: raw["image"] ?: raw["artworkUrl"])?.toString()
        val rawTracks = raw["tracks"] as? List<*> ?: raw["songs"] as? List<*> ?: emptyList<Any>()
        val tracks = rawTracks.mapNotNull { parseTrack(it as? Map<*, *>) }
        val count = (raw["trackCount"] as? Number)?.toInt() ?: tracks.size
        return NativePlaylist(id, title, description, thumbnail, count, tracks, isCustom = false)
    }

    private fun parseTrack(raw: Map<*, *>?): NativeTrack? {
        if (raw == null) return null
        val id = raw["id"]?.toString() ?: raw["canonicalTrackId"]?.toString() ?: return null
        val title = raw["title"]?.toString() ?: raw["name"]?.toString() ?: return null
        val artist = raw["artist"]?.toString() ?: raw["artistName"]?.toString() ?: "Unknown Artist"
        return NativeTrack(
            id = id,
            canonicalTrackId = raw["canonicalTrackId"]?.toString() ?: id,
            title = title,
            artist = artist,
            album = raw["album"]?.toString(),
            thumbnail = (raw["thumbnail"] ?: raw["artworkUrl"] ?: raw["image"])?.toString(),
            duration = (raw["duration"] as? Number)?.toDouble() ?: 0.0,
            providerTrackId = raw["providerTrackId"]?.toString(),
            provider = raw["provider"]?.toString()
        )
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
