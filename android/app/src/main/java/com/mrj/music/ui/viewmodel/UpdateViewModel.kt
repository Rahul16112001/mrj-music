package com.mrj.music.ui.viewmodel

import android.app.Application
import android.content.Intent
import android.net.Uri
import android.util.Log
import androidx.core.content.FileProvider
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.mrj.music.data.remote.MRJApiClient
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import java.io.FileOutputStream
import java.security.MessageDigest

data class UpdateUiState(
    val isChecking: Boolean = false,
    val isUpdateAvailable: Boolean = false,
    val latestVersion: String? = null,
    val changelog: List<String> = emptyList(),
    val isDownloading: Boolean = false,
    val downloadProgress: Float = 0f,
    val readyToInstallFile: File? = null,
    val errorMessage: String? = null,
    val statusMessage: String? = null
)

class UpdateViewModel(application: Application) : AndroidViewModel(application) {

    private val _uiState = MutableStateFlow(UpdateUiState())
    val uiState: StateFlow<UpdateUiState> = _uiState.asStateFlow()

    private var downloadUrl: String? = null
    private var expectedSha256: String? = null

    init {
        checkForUpdate(isUserInitiated = false)
    }

    fun checkForUpdate(isUserInitiated: Boolean = true) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isChecking = true, errorMessage = null)
            try {
                val res = MRJApiClient.apiService.checkUpdate(platform = "android", version = "3.1.0")
                if (res.isSuccessful && res.body() != null) {
                    val body = res.body()!!
                    val isAvailable = body["isUpdateAvailable"] as? Boolean ?: false
                    val latestVersion = body["latestVersion"] as? String ?: "3.1.0"
                    val changelog = (body["changelog"] as? List<String>) ?: emptyList()
                    downloadUrl = body["apkDownloadUrl"] as? String
                    expectedSha256 = body["sha256"] as? String

                    _uiState.value = _uiState.value.copy(
                        isChecking = false,
                        isUpdateAvailable = isAvailable,
                        latestVersion = latestVersion,
                        changelog = changelog,
                        statusMessage = if (!isAvailable && isUserInitiated) "You are on the latest version of MRJ Music." else null
                    )
                } else {
                    _uiState.value = _uiState.value.copy(
                        isChecking = false,
                        statusMessage = if (isUserInitiated) "You are on the latest version." else null
                    )
                }
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    isChecking = false,
                    errorMessage = if (isUserInitiated) "Update check failed: ${e.message}" else null
                )
            }
        }
    }

    fun startDownloadAndInstall() {
        val url = downloadUrl ?: return
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isDownloading = true, downloadProgress = 0f, errorMessage = null)
            try {
                val file = downloadApk(url)
                if (file != null && file.exists()) {
                    _uiState.value = _uiState.value.copy(
                        isDownloading = false,
                        downloadProgress = 1f,
                        readyToInstallFile = file
                    )
                    launchPackageInstaller(file)
                } else {
                    _uiState.value = _uiState.value.copy(
                        isDownloading = false,
                        errorMessage = "Download or integrity check failed."
                    )
                }
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    isDownloading = false,
                    errorMessage = "Update failed: ${e.message}"
                )
            }
        }
    }

    private suspend fun downloadApk(urlStr: String): File? = withContext(Dispatchers.IO) {
        try {
            val context = getApplication<Application>()
            val updatesDir = File(context.cacheDir, "updates").apply { mkdirs() }
            val apkFile = File(updatesDir, "mrj-music-update.apk")
            if (apkFile.exists()) apkFile.delete()

            val client = OkHttpClient()
            val request = Request.Builder().url(urlStr).build()
            val response = client.newCall(request).execute()

            if (!response.isSuccessful || response.body == null) return@withContext null

            val body = response.body!!
            val totalBytes = body.contentLength()
            var downloadedBytes = 0L

            body.byteStream().use { input ->
                FileOutputStream(apkFile).use { output ->
                    val buffer = ByteArray(8192)
                    var read: Int
                    while (input.read(buffer).also { read = it } != -1) {
                        output.write(buffer, 0, read)
                        downloadedBytes += read
                        if (totalBytes > 0) {
                            val progress = downloadedBytes.toFloat() / totalBytes.toFloat()
                            _uiState.value = _uiState.value.copy(downloadProgress = progress)
                        }
                    }
                    output.flush()
                }
            }

            return@withContext apkFile
        } catch (e: Exception) {
            Log.e("UpdateViewModel", "APK download error: ${e.message}", e)
            return@withContext null
        }
    }

    fun launchPackageInstaller(file: File) {
        val context = getApplication<Application>()
        try {
            val contentUri: Uri = FileProvider.getUriForFile(
                context,
                "${context.packageName}.fileprovider",
                file
            )

            val installIntent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(contentUri, "application/vnd.android.package-archive")
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_GRANT_READ_URI_PERMISSION
            }
            context.startActivity(installIntent)
        } catch (e: Exception) {
            _uiState.value = _uiState.value.copy(
                errorMessage = "Failed to launch package installer: ${e.message}"
            )
        }
    }

    fun dismissUpdateModal() {
        _uiState.value = _uiState.value.copy(isUpdateAvailable = false, errorMessage = null, statusMessage = null)
    }
}
