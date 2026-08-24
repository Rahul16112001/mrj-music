package com.mrj.music.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.mrj.music.BuildConfig
import com.mrj.music.data.repository.MusicRepository
import com.mrj.music.domain.model.UpdateInfo
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class UpdateState(
    val isLoading: Boolean = false,
    val updateAvailable: Boolean = false,
    val latestVersion: String = "",
    val versionCode: Int = 0,
    val downloadUrl: String = "",
    val releaseNotes: List<String> = emptyList(),
    val isMandatory: Boolean = false,
    val error: String? = null
)

@HiltViewModel
class UpdateViewModel @Inject constructor(
    private val musicRepository: MusicRepository
) : ViewModel() {

    private val _state = MutableStateFlow(UpdateState())
    val state: StateFlow<UpdateState> = _state.asStateFlow()

    init {
        checkForUpdate()
    }

    fun checkForUpdate() {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, error = null)
            val result = musicRepository.checkUpdate(BuildConfig.VERSION_NAME)
            _state.value = if (result.isSuccess) {
                val update = result.getOrNull()!!
                _state.value.copy(
                    isLoading = false,
                    updateAvailable = update.isUpdateAvailable,
                    latestVersion = update.latestVersion,
                    versionCode = update.versionCode,
                    downloadUrl = update.downloadUrl,
                    releaseNotes = update.releaseNotes,
                    isMandatory = update.isMandatory
                )
            } else {
                _state.value.copy(isLoading = false, error = result.exceptionOrNull()?.message ?: "Failed to check update")
            }
        }
    }

    fun downloadUpdate() {
        // Trigger APK download via Android DownloadManager or in-app browser
        // Implementation depends on update download URL
    }
}
