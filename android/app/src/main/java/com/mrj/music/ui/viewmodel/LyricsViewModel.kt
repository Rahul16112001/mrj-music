package com.mrj.music.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.mrj.music.data.repository.MusicRepository
import com.mrj.music.domain.model.Track
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class LyricsState(
    val isLoading: Boolean = false,
    val lyrics: String? = null,
    val isSynced: Boolean = false,
    val error: String? = null
)

@HiltViewModel
class LyricsViewModel @Inject constructor(
    private val musicRepository: MusicRepository
) : ViewModel() {

    private val _state = MutableStateFlow(LyricsState())
    val state: StateFlow<LyricsState> = _state.asStateFlow()

    fun loadLyrics(trackId: String) {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, error = null)
            // In a real implementation, fetch track details first, then lyrics
            // For now, this is a placeholder
            _state.value = _state.value.copy(isLoading = false, lyrics = "Lyrics loading...")
        }
    }
}
