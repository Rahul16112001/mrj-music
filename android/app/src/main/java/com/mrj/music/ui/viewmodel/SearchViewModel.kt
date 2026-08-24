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

data class SearchState(
    val query: String = "",
    val isLoading: Boolean = false,
    val results: List<Map<String, Any>> = emptyList(),
    val suggestions: List<String> = emptyList(),
    val recentSearches: List<String> = emptyList(),
    val error: String? = null
)

@HiltViewModel
class SearchViewModel @Inject constructor(
    private val musicRepository: MusicRepository
) : ViewModel() {

    private val _state = MutableStateFlow(SearchState())
    val state: StateFlow<SearchState> = _state.asStateFlow()

    init {
        loadRecentSearches()
    }

    fun updateQuery(query: String) {
        _state.value = _state.value.copy(query = query)
        if (query.length >= 2) {
            fetchSuggestions(query)
        }
    }

    fun search(query: String) {
        if (query.isBlank()) return
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, error = null)
            val result = musicRepository.search(query)
            _state.value = if (result.isSuccess) {
                val body = result.getOrNull()!!
                val songs = (body["songs"] as? List<Map<String, Any>>) ?: emptyList()
                val videos = (body["videos"] as? List<Map<String, Any>>) ?: emptyList()
                val artists = (body["artists"] as? List<Map<String, Any>>) ?: emptyList()
                val albums = (body["albums"] as? List<Map<String, Any>>) ?: emptyList()
                val allResults = songs + videos + artists + albums
                _state.value.copy(isLoading = false, results = allResults)
            } else {
                _state.value.copy(isLoading = false, error = result.exceptionOrNull()?.message ?: "Search failed")
            }
        }
    }

    private fun fetchSuggestions(query: String) {
        viewModelScope.launch {
            val result = musicRepository.search(query)
            if (result.isSuccess) {
                val body = result.getOrNull()!!
                val suggestions = (body["songs"] as? List<Map<String, Any>>)?.map { it["title"] as? String ?: "" } ?: emptyList()
                _state.value = _state.value.copy(suggestions = suggestions)
            }
        }
    }

    fun loadRecentSearches() {
        viewModelScope.launch {
            val result = musicRepository.getHome()
            // Recent searches would come from a separate endpoint; placeholder for now
        }
    }

    fun clearError() {
        _state.value = _state.value.copy(error = null)
    }
}
