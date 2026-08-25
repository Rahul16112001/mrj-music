package com.mrj.music.data.security

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken

class SecureAuthStorage private constructor(context: Context) {

    private val masterKey = MasterKey.Builder(context.applicationContext)
        .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
        .build()

    private val prefs: SharedPreferences = EncryptedSharedPreferences.create(
        context.applicationContext,
        PREFS_FILENAME,
        masterKey,
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
    )

    private val gson = Gson()

    fun saveTokens(accessToken: String, refreshToken: String) {
        prefs.edit()
            .putString(KEY_ACCESS_TOKEN, accessToken)
            .putString(KEY_REFRESH_TOKEN, refreshToken)
            .apply()
    }

    fun getAccessToken(): String? = prefs.getString(KEY_ACCESS_TOKEN, null)

    fun getRefreshToken(): String? = prefs.getString(KEY_REFRESH_TOKEN, null)

    fun saveUserProfile(userMap: Map<String, Any>) {
        val json = gson.toJson(userMap)
        prefs.edit().putString(KEY_USER_PROFILE, json).apply()
    }

    fun getUserProfile(): Map<String, Any>? {
        val json = prefs.getString(KEY_USER_PROFILE, null) ?: return null
        return try {
            val type = object : TypeToken<Map<String, Any>>() {}.type
            gson.fromJson(json, type)
        } catch (e: Exception) {
            null
        }
    }

    fun savePreferredName(name: String) {
        prefs.edit().putString(KEY_PREFERRED_NAME, name).apply()
    }

    fun getPreferredName(): String? = prefs.getString(KEY_PREFERRED_NAME, null)

    fun saveAutoplayEnabled(enabled: Boolean) {
        prefs.edit().putBoolean(KEY_AUTOPLAY_ENABLED, enabled).apply()
    }

    fun getAutoplayEnabled(): Boolean = prefs.getBoolean(KEY_AUTOPLAY_ENABLED, true)

    fun clearAuth() {
        prefs.edit()
            .remove(KEY_ACCESS_TOKEN)
            .remove(KEY_REFRESH_TOKEN)
            .remove(KEY_USER_PROFILE)
            .apply()
    }

    companion object {
        private const val PREFS_FILENAME = "mrj_secure_auth_vault"
        private const val KEY_ACCESS_TOKEN = "enc_access_token"
        private const val KEY_REFRESH_TOKEN = "enc_refresh_token"
        private const val KEY_USER_PROFILE = "enc_user_profile"
        private const val KEY_PREFERRED_NAME = "enc_preferred_name"
        private const val KEY_AUTOPLAY_ENABLED = "pref_autoplay_enabled"

        @Volatile
        private var instance: SecureAuthStorage? = null

        fun getInstance(context: Context): SecureAuthStorage {
            return instance ?: synchronized(this) {
                instance ?: SecureAuthStorage(context.applicationContext).also { instance = it }
            }
        }
    }
}
