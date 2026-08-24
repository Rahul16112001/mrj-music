package com.mrj.music.data.preferences

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.*
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

private val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "mrj_settings")

class DataStoreManager(private val context: Context) {
    private object PreferencesKeys {
        val AUTH_TOKEN = stringPreferencesKey("auth_token")
        val REFRESH_TOKEN = stringPreferencesKey("refresh_token")
        val USER_ID = stringPreferencesKey("user_id")
        val USER_NAME = stringPreferencesKey("user_name")
        val USER_EMAIL = stringPreferencesKey("user_email")
        val THEME = stringPreferencesKey("theme")
        val AUDIO_QUALITY = stringPreferencesKey("audio_quality")
        val AUTOPLAY_ENABLED = booleanPreferencesKey("autoplay_enabled")
        val LAST_AUTH_EMAIL = stringPreferencesKey("last_auth_email")
    }

    val authToken: Flow<String?> = context.dataStore.data.map { it[PreferencesKeys.AUTH_TOKEN] }
    val refreshToken: Flow<String?> = context.dataStore.data.map { it[PreferencesKeys.REFRESH_TOKEN] }
    val userId: Flow<String?> = context.dataStore.data.map { it[PreferencesKeys.USER_ID] }
    val userName: Flow<String?> = context.dataStore.data.map { it[PreferencesKeys.USER_NAME] }
    val userEmail: Flow<String?> = context.dataStore.data.map { it[PreferencesKeys.USER_EMAIL] }
    val theme: Flow<String> = context.dataStore.data.map { it[PreferencesKeys.THEME] ?: "oled-dark" }
    val audioQuality: Flow<String> = context.dataStore.data.map { it[PreferencesKeys.AUDIO_QUALITY] ?: "high" }
    val autoplayEnabled: Flow<Boolean> = context.dataStore.data.map { it[PreferencesKeys.AUTOPLAY_ENABLED] ?: true }

    suspend fun saveAuth(token: String, refreshToken: String, userId: String, userName: String, userEmail: String) {
        context.dataStore.edit { prefs ->
            prefs[PreferencesKeys.AUTH_TOKEN] = token
            prefs[PreferencesKeys.REFRESH_TOKEN] = refreshToken
            prefs[PreferencesKeys.USER_ID] = userId
            prefs[PreferencesKeys.USER_NAME] = userName
            prefs[PreferencesKeys.USER_EMAIL] = userEmail
        }
    }

    suspend fun clearAuth() {
        context.dataStore.edit { prefs ->
            prefs.remove(PreferencesKeys.AUTH_TOKEN)
            prefs.remove(PreferencesKeys.REFRESH_TOKEN)
            prefs.remove(PreferencesKeys.USER_ID)
            prefs.remove(PreferencesKeys.USER_NAME)
            prefs.remove(PreferencesKeys.USER_EMAIL)
        }
    }

    suspend fun saveTheme(theme: String) {
        context.dataStore.edit { it[PreferencesKeys.THEME] = theme }
    }

    suspend fun saveAudioQuality(quality: String) {
        context.dataStore.edit { it[PreferencesKeys.AUDIO_QUALITY] = quality }
    }

    suspend fun saveAutoplayEnabled(enabled: Boolean) {
        context.dataStore.edit { it[PreferencesKeys.AUTOPLAY_ENABLED] = enabled }
    }

    companion object {
        @Volatile
        private var INSTANCE: DataStoreManager? = null
        fun getInstance(context: Context): DataStoreManager {
            return INSTANCE ?: synchronized(this) {
                INSTANCE ?: DataStoreManager(context.applicationContext).also { INSTANCE = it }
            }
        }
    }
}
