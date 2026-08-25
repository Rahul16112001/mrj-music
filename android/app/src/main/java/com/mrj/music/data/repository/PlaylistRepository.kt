package com.mrj.music.data.repository

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import com.mrj.music.data.remote.MRJApiClient
import com.mrj.music.data.security.SecureAuthStorage
import com.mrj.music.model.NativePlaylist
import com.mrj.music.model.NativeTrack
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.util.UUID

private const val TAG = "MRJ_PlaylistRepo"
private const val PREFS_NAME = "mrj_playlists_cache"
private const val KEY_PLAYLISTS = "cached_user_playlists"

class PlaylistRepository private constructor(private val context: Context) {

    private val prefs: SharedPreferences = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    private val secureStorage = SecureAuthStorage.getInstance(context)
    private val gson = Gson()
    private val scope = CoroutineScope(Dispatchers.IO)

    private val _playlists = MutableStateFlow<List<NativePlaylist>>(emptyList())
    val playlists: StateFlow<List<NativePlaylist>> = _playlists.asStateFlow()

    init {
        loadCachedPlaylists()
        syncWithCloud()
    }

    private fun loadCachedPlaylists() {
        try {
            val json = prefs.getString(KEY_PLAYLISTS, null)
            if (!json.isNullOrBlank()) {
                val type = object : TypeToken<List<NativePlaylist>>() {}.type
                val list: List<NativePlaylist> = gson.fromJson(json, type) ?: emptyList()
                _playlists.value = list
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error loading cached playlists: ${e.message}")
        }
    }

    private fun saveCachedPlaylists(list: List<NativePlaylist>) {
        try {
            val json = gson.toJson(list)
            prefs.edit().putString(KEY_PLAYLISTS, json).apply()
        } catch (e: Exception) {
            Log.e(TAG, "Error saving cached playlists: ${e.message}")
        }
    }

    fun getPlaylistById(playlistId: String): NativePlaylist? {
        return _playlists.value.find { it.id == playlistId }
    }

    fun createPlaylist(title: String, description: String = "", onCreated: ((NativePlaylist) -> Unit)? = null) {
        val newId = "pl_" + UUID.randomUUID().toString()
        val localPlaylist = NativePlaylist(
            id = newId,
            title = title.trim(),
            description = description.trim(),
            thumbnail = null,
            trackCount = 0,
            tracks = emptyList(),
            createdAt = System.currentTimeMillis(),
            updatedAt = System.currentTimeMillis(),
            isCustom = true
        )

        val updated = listOf(localPlaylist) + _playlists.value
        _playlists.value = updated
        saveCachedPlaylists(updated)
        onCreated?.invoke(localPlaylist)

        scope.launch {
            try {
                val token = secureStorage.getAccessToken()
                if (token != null) {
                    val authHeader = "Bearer $token"
                    val body = mapOf(
                        "id" to newId,
                        "title" to title.trim(),
                        "description" to description.trim(),
                        "isCustom" to true
                    )
                    val res = MRJApiClient.apiService.saveUserPlaylist(authHeader, body)
                    if (res.isSuccessful && res.body() != null) {
                        val serverPl = (res.body()!!["playlist"] as? Map<String, Any>)
                        if (serverPl != null) {
                            val parsed = parsePlaylistMap(serverPl)
                            if (parsed != null) {
                                val current = _playlists.value.toMutableList()
                                val idx = current.indexOfFirst { it.id == newId }
                                if (idx != -1) {
                                    current[idx] = parsed
                                    _playlists.value = current
                                    saveCachedPlaylists(current)
                                }
                            }
                        }
                    }
                }
            } catch (e: Exception) {
                Log.w(TAG, "Cloud create playlist sync error: ${e.message}")
            }
        }
    }

    fun updatePlaylist(playlistId: String, title: String, description: String = "") {
        val current = _playlists.value.toMutableList()
        val idx = current.indexOfFirst { it.id == playlistId }
        if (idx != -1) {
            val old = current[idx]
            val updated = old.copy(title = title.trim(), description = description.trim(), updatedAt = System.currentTimeMillis())
            current[idx] = updated
            _playlists.value = current
            saveCachedPlaylists(current)

            scope.launch {
                try {
                    val token = secureStorage.getAccessToken()
                    if (token != null) {
                        MRJApiClient.apiService.updateUserPlaylist(
                            authHeader = "Bearer $token",
                            playlistId = playlistId,
                            body = mapOf("title" to title.trim(), "description" to description.trim())
                        )
                    }
                } catch (e: Exception) {
                    Log.w(TAG, "Cloud update playlist error: ${e.message}")
                }
            }
        }
    }

    fun deletePlaylist(playlistId: String) {
        val updated = _playlists.value.filter { it.id != playlistId }
        _playlists.value = updated
        saveCachedPlaylists(updated)

        scope.launch {
            try {
                val token = secureStorage.getAccessToken()
                if (token != null) {
                    MRJApiClient.apiService.deleteUserPlaylist("Bearer $token", playlistId)
                }
            } catch (e: Exception) {
                Log.w(TAG, "Cloud delete playlist error: ${e.message}")
            }
        }
    }

    fun addTrackToPlaylist(playlistId: String, track: NativeTrack, onResult: ((Boolean) -> Unit)? = null) {
        val current = _playlists.value.toMutableList()
        val idx = current.indexOfFirst { it.id == playlistId }
        if (idx != -1) {
            val pl = current[idx]
            if (pl.tracks.any { it.id == track.id }) {
                onResult?.invoke(true)
                return
            }

            val newTracks = pl.tracks + track
            val updatedPl = pl.copy(
                tracks = newTracks,
                trackCount = newTracks.size,
                thumbnail = pl.thumbnail ?: track.thumbnail,
                updatedAt = System.currentTimeMillis()
            )
            current[idx] = updatedPl
            _playlists.value = current
            saveCachedPlaylists(current)
            onResult?.invoke(true)

            scope.launch {
                try {
                    val token = secureStorage.getAccessToken()
                    if (token != null) {
                        val trackMap = mapOf(
                            "id" to track.id,
                            "title" to track.title,
                            "artist" to track.artist,
                            "album" to (track.album ?: "Single"),
                            "thumbnail" to track.thumbnail,
                            "duration" to track.duration,
                            "genre" to track.genre,
                            "canonicalTrackId" to track.canonicalTrackId,
                            "providerTrackId" to track.providerTrackId
                        )
                        MRJApiClient.apiService.addTrackToPlaylist(
                            authHeader = "Bearer $token",
                            playlistId = playlistId,
                            body = mapOf("track" to trackMap)
                        )
                    }
                } catch (e: Exception) {
                    Log.w(TAG, "Cloud add track error: ${e.message}")
                }
            }
        } else {
            onResult?.invoke(false)
        }
    }

    fun removeTrackFromPlaylist(playlistId: String, trackId: String) {
        val current = _playlists.value.toMutableList()
        val idx = current.indexOfFirst { it.id == playlistId }
        if (idx != -1) {
            val pl = current[idx]
            val newTracks = pl.tracks.filter { it.id != trackId }
            val updatedPl = pl.copy(
                tracks = newTracks,
                trackCount = newTracks.size,
                thumbnail = newTracks.firstOrNull()?.thumbnail,
                updatedAt = System.currentTimeMillis()
            )
            current[idx] = updatedPl
            _playlists.value = current
            saveCachedPlaylists(current)

            scope.launch {
                try {
                    val token = secureStorage.getAccessToken()
                    if (token != null) {
                        MRJApiClient.apiService.removeTrackFromPlaylist(
                            authHeader = "Bearer $token",
                            playlistId = playlistId,
                            trackId = trackId
                        )
                    }
                } catch (e: Exception) {
                    Log.w(TAG, "Cloud remove track error: ${e.message}")
                }
            }
        }
    }

    fun syncWithCloud() {
        scope.launch {
            try {
                val token = secureStorage.getAccessToken() ?: return@launch
                val res = MRJApiClient.apiService.getUserPlaylists("Bearer $token")
                if (res.isSuccessful && res.body() != null) {
                    val rawList = (res.body()!!["playlists"] as? List<Map<String, Any>>) ?: emptyList()
                    val parsed = rawList.mapNotNull { parsePlaylistMap(it) }
                    if (parsed.isNotEmpty() || _playlists.value.isEmpty()) {
                        _playlists.value = parsed
                        saveCachedPlaylists(parsed)
                    }
                }
            } catch (e: Exception) {
                Log.w(TAG, "Cloud playlists sync error: ${e.message}")
            }
        }
    }

    private fun parsePlaylistMap(map: Map<String, Any>): NativePlaylist? {
        val id = map["id"] as? String ?: return null
        val title = map["title"] as? String ?: return null
        val description = (map["description"] as? String) ?: ""
        val thumbnail = map["thumbnail"] as? String
        val trackCount = (map["trackCount"] as? Number)?.toInt() ?: 0
        val createdAt = (map["createdAt"] as? Number)?.toLong() ?: System.currentTimeMillis()
        val updatedAt = (map["updatedAt"] as? Number)?.toLong() ?: System.currentTimeMillis()
        val isCustom = (map["isCustom"] as? Boolean) ?: true

        val rawTracks = (map["tracks"] as? List<Map<String, Any>>) ?: emptyList()
        val tracks = rawTracks.mapNotNull { tMap ->
            val tId = (tMap["id"] as? String) ?: (tMap["track_id"] as? String) ?: (tMap["providerTrackId"] as? String) ?: return@mapNotNull null
            val tTitle = (tMap["title"] as? String) ?: return@mapNotNull null
            val tArtist = (tMap["artist"] as? String) ?: "Unknown Artist"
            val tThumbnail = tMap["thumbnail"] as? String
            val tDuration = (tMap["duration"] as? Number)?.toDouble() ?: 210.0
            val tAlbum = tMap["album"] as? String
            val tGenre = tMap["genre"] as? String
            val tCanonId = (tMap["canonicalTrackId"] as? String) ?: tId
            val tProviderId = (tMap["providerTrackId"] as? String) ?: (if (!tId.contains("|")) tId else null)

            NativeTrack(
                id = tId,
                canonicalTrackId = tCanonId,
                title = tTitle,
                artist = tArtist,
                album = tAlbum,
                thumbnail = tThumbnail,
                duration = tDuration,
                genre = tGenre,
                providerTrackId = tProviderId
            )
        }

        return NativePlaylist(
            id = id,
            title = title,
            description = description,
            thumbnail = thumbnail ?: tracks.firstOrNull()?.thumbnail,
            trackCount = if (tracks.isNotEmpty()) tracks.size else trackCount,
            tracks = tracks,
            createdAt = createdAt,
            updatedAt = updatedAt,
            isCustom = isCustom
        )
    }

    companion object {
        @Volatile
        private var instance: PlaylistRepository? = null

        fun getInstance(context: Context): PlaylistRepository {
            return instance ?: synchronized(this) {
                instance ?: PlaylistRepository(context.applicationContext).also { instance = it }
            }
        }
    }
}
