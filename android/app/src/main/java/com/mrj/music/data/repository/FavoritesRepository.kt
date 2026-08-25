package com.mrj.music.data.repository

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import com.mrj.music.data.remote.MRJApiClient
import com.mrj.music.data.security.SecureAuthStorage
import com.mrj.music.model.NativeTrack
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

private const val TAG = "MRJ_FavoritesRepo"
private const val PREFS_NAME = "mrj_favorites_cache"
private const val KEY_LIKED_TRACKS = "cached_liked_tracks"

class FavoritesRepository private constructor(private val context: Context) {

    private val prefs: SharedPreferences = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    private val secureStorage = SecureAuthStorage.getInstance(context)
    private val gson = Gson()
    private val scope = CoroutineScope(Dispatchers.IO)

    private val _likedTracks = MutableStateFlow<List<NativeTrack>>(emptyList())
    val likedTracks: StateFlow<List<NativeTrack>> = _likedTracks.asStateFlow()

    private val _likedTrackIds = MutableStateFlow<Set<String>>(emptySet())
    val likedTrackIds: StateFlow<Set<String>> = _likedTrackIds.asStateFlow()

    init {
        loadCachedLikes()
        syncWithCloud()
    }

    private fun loadCachedLikes() {
        try {
            val json = prefs.getString(KEY_LIKED_TRACKS, null)
            if (!json.isNullOrBlank()) {
                val type = object : TypeToken<List<NativeTrack>>() {}.type
                val list: List<NativeTrack> = gson.fromJson(json, type) ?: emptyList()
                _likedTracks.value = list
                _likedTrackIds.value = list.map { it.id }.toSet()
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error loading cached likes: ${e.message}")
        }
    }

    private fun saveCachedLikes(tracks: List<NativeTrack>) {
        try {
            val json = gson.toJson(tracks)
            prefs.edit().putString(KEY_LIKED_TRACKS, json).apply()
        } catch (e: Exception) {
            Log.e(TAG, "Error saving cached likes: ${e.message}")
        }
    }

    fun isLiked(trackId: String): Boolean {
        return _likedTrackIds.value.contains(trackId)
    }

    fun toggleLike(track: NativeTrack) {
        val currentlyLiked = isLiked(track.id)
        val currentList = _likedTracks.value.toMutableList()

        if (currentlyLiked) {
            currentList.removeAll { it.id == track.id }
        } else {
            currentList.add(0, track)
        }

        val updatedList = currentList.toList()
        _likedTracks.value = updatedList
        _likedTrackIds.value = updatedList.map { it.id }.toSet()
        saveCachedLikes(updatedList)

        if (!currentlyLiked) {
            com.mrj.music.intelligence.MRJBehaviorTracker.getInstance(context).onTrackLiked(track)
        }

        // Sync with backend asynchronously
        scope.launch {
            try {
                val token = secureStorage.getAccessToken()
                if (token != null) {
                    val authHeader = "Bearer $token"
                    if (currentlyLiked) {
                        MRJApiClient.apiService.unlikeTrack(authHeader, track.id)
                    } else {
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
                        MRJApiClient.apiService.likeTrack(authHeader, mapOf("track" to trackMap))
                    }
                }
            } catch (e: Exception) {
                Log.w(TAG, "Error syncing favorite change to cloud: ${e.message}")
            }
        }
    }

    fun syncWithCloud() {
        scope.launch {
            try {
                val token = secureStorage.getAccessToken() ?: return@launch
                val res = MRJApiClient.apiService.getUserLikes("Bearer $token")
                if (res.isSuccessful && res.body() != null) {
                    val body = res.body()!!
                    val rawLikes = (body["likes"] as? List<Map<String, Any>>) ?: emptyList()
                    val parsed = rawLikes.mapNotNull { parseTrackMap(it) }

                    if (parsed.isNotEmpty() || _likedTracks.value.isEmpty()) {
                        _likedTracks.value = parsed
                        _likedTrackIds.value = parsed.map { it.id }.toSet()
                        saveCachedLikes(parsed)
                    }
                }
            } catch (e: Exception) {
                Log.w(TAG, "Cloud favorites sync error: ${e.message}")
            }
        }
    }

    private fun parseTrackMap(map: Map<String, Any>): NativeTrack? {
        val id = (map["id"] as? String) ?: (map["providerTrackId"] as? String) ?: return null
        val title = map["title"] as? String ?: return null
        val artist = map["artist"] as? String ?: "Unknown Artist"
        val thumbnail = map["thumbnail"] as? String
        val duration = (map["duration"] as? Number)?.toDouble() ?: 210.0
        val album = map["album"] as? String
        val genre = map["genre"] as? String
        val canonicalTrackId = map["canonicalTrackId"] as? String ?: id
        val providerTrackId = (map["providerTrackId"] as? String)
            ?: (map["videoId"] as? String)
            ?: (if (!id.contains("|")) id else null)

        return NativeTrack(
            id = id,
            canonicalTrackId = canonicalTrackId,
            title = title,
            artist = artist,
            album = album,
            thumbnail = thumbnail,
            duration = duration,
            genre = genre,
            providerTrackId = providerTrackId
        )
    }

    companion object {
        @Volatile
        private var instance: FavoritesRepository? = null

        fun getInstance(context: Context): FavoritesRepository {
            return instance ?: synchronized(this) {
                instance ?: FavoritesRepository(context.applicationContext).also { instance = it }
            }
        }
    }
}
