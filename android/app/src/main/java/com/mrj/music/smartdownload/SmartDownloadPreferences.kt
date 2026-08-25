package com.mrj.music.smartdownload

import android.content.Context
import android.content.SharedPreferences
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

data class SmartDownloadConfig(
    val isEnabled: Boolean = true,
    val songCountQuota: Int = 50, // 25 to 500
    val wifiOnly: Boolean = true,
    val requiresCharging: Boolean = false,
    val audioQuality: String = "HIGH", // "HIGH", "MEDIUM", "LOW"
    val estimatedStorageBytes: Long = 250L * 1024 * 1024,
    val lastSyncTimestamp: Long = 0L
)

class SmartDownloadPreferences(context: Context) {
    private val prefs: SharedPreferences = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    private val _configFlow = MutableStateFlow(loadConfig())
    val configFlow: StateFlow<SmartDownloadConfig> = _configFlow.asStateFlow()

    fun getConfig(): SmartDownloadConfig {
        return _configFlow.value
    }

    private fun loadConfig(): SmartDownloadConfig {
        val enabled = prefs.getBoolean(KEY_ENABLED, true)
        val quota = prefs.getInt(KEY_QUOTA, 50).coerceIn(25, 500)
        val wifiOnly = prefs.getBoolean(KEY_WIFI_ONLY, true)
        val charging = prefs.getBoolean(KEY_CHARGING, false)
        val quality = prefs.getString(KEY_QUALITY, "HIGH") ?: "HIGH"
        val lastSync = prefs.getLong(KEY_LAST_SYNC, 0L)
        val estimatedBytes = calculateEstimatedStorageBytes(quota, quality)

        return SmartDownloadConfig(
            isEnabled = enabled,
            songCountQuota = quota,
            wifiOnly = wifiOnly,
            requiresCharging = charging,
            audioQuality = quality,
            estimatedStorageBytes = estimatedBytes,
            lastSyncTimestamp = lastSync
        )
    }

    fun setEnabled(enabled: Boolean) {
        prefs.edit().putBoolean(KEY_ENABLED, enabled).apply()
        refreshConfig()
    }

    fun setSongCountQuota(quota: Int) {
        val safeQuota = quota.coerceIn(25, 500)
        prefs.edit().putInt(KEY_QUOTA, safeQuota).apply()
        refreshConfig()
    }

    fun setWifiOnly(wifiOnly: Boolean) {
        prefs.edit().putBoolean(KEY_WIFI_ONLY, wifiOnly).apply()
        refreshConfig()
    }

    fun setRequiresCharging(requiresCharging: Boolean) {
        prefs.edit().putBoolean(KEY_CHARGING, requiresCharging).apply()
        refreshConfig()
    }

    fun setAudioQuality(quality: String) {
        prefs.edit().putString(KEY_QUALITY, quality).apply()
        refreshConfig()
    }

    fun setLastSyncTimestamp(timestamp: Long) {
        prefs.edit().putLong(KEY_LAST_SYNC, timestamp).apply()
        refreshConfig()
    }

    private fun refreshConfig() {
        _configFlow.value = loadConfig()
    }

    companion object {
        private const val PREFS_NAME = "mrj_smart_download_prefs"
        private const val KEY_ENABLED = "smart_downloads_enabled"
        private const val KEY_QUOTA = "smart_downloads_quota"
        private const val KEY_WIFI_ONLY = "smart_downloads_wifi_only"
        private const val KEY_CHARGING = "smart_downloads_requires_charging"
        private const val KEY_QUALITY = "smart_downloads_audio_quality"
        private const val KEY_LAST_SYNC = "smart_downloads_last_sync"

        @Volatile
        private var instance: SmartDownloadPreferences? = null

        fun getInstance(context: Context): SmartDownloadPreferences {
            return instance ?: synchronized(this) {
                instance ?: SmartDownloadPreferences(context.applicationContext).also { instance = it }
            }
        }

        fun calculateEstimatedStorageBytes(songCount: Int, quality: String): Long {
            val avgBytesPerSong = when (quality.uppercase()) {
                "LOW" -> 2L * 1024 * 1024        // ~2 MB
                "MEDIUM" -> 3500L * 1024         // ~3.5 MB
                else -> 5L * 1024 * 1024         // ~5 MB (High 256-320kbps)
            }
            return songCount * avgBytesPerSong
        }
    }
}
