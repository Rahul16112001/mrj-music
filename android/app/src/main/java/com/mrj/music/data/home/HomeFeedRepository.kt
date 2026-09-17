package com.mrj.music.data.home

import android.content.Context
import com.mrj.music.data.remote.HomeFeedResponse
import com.mrj.music.data.remote.MRJApiClient
import com.mrj.music.data.remote.HomeFeedSectionDto
import com.mrj.music.data.security.SecureAuthStorage
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.delay
import kotlinx.coroutines.withTimeout

sealed class HomeFeedState {
    data object Loading : HomeFeedState()
    data class Success(val response: HomeFeedResponse, val stale: Boolean) : HomeFeedState()
    data class Error(val message: String) : HomeFeedState()
}

class HomeFeedRepository(context: Context) {
    private val secureStorage = SecureAuthStorage.getInstance(context)
    private val dao = HomeFeedDatabase.getInstance(context).homeFeedDao()
    private val _state = MutableStateFlow<HomeFeedState>(HomeFeedState.Loading)
    val state: StateFlow<HomeFeedState> = _state.asStateFlow()

    suspend fun load(userId: String?, region: String, forceRefresh: Boolean = false) {
        val cached = dao.getAll()
        val fetchedAt = dao.getLastFetchedAt() ?: 0L
        val age = System.currentTimeMillis() - fetchedAt
        val cachedResponse = cachedResponse(cached, region)
        if (!forceRefresh && cachedResponse.sections.isNotEmpty() && age <= MAX_STALE_MS) {
            _state.value = HomeFeedState.Success(cachedResponse, stale = age > FRESH_TTL_MS)
            if (age <= FRESH_TTL_MS) return
        } else if (forceRefresh && cachedResponse.sections.isNotEmpty() && age <= MAX_STALE_MS) {
            // Keep the existing feed visible while the forced network refresh
            // is running; do not emit it again and end the refresh indicator.
        }

        try {
            val token = secureStorage.getAccessToken()
            val authHeader = token?.let { "Bearer $it" }
            val response = withTimeout(NETWORK_TIMEOUT_MS) {
                MRJApiClient.apiService.getHomeFeed(userId, region, authHeader)
            }
            if (!response.isSuccessful || response.body() == null) throw IllegalStateException("Home feed HTTP ${response.code()}")
            val body = response.body()!!
            val verified = body.copy(sections = body.sections.map { section ->
                section.copy(tracks = section.tracks.filter { it.sourceAvailable })
            })
            val timestamp = System.currentTimeMillis()
            val entities = verified.sections.flatMap { section ->
                section.tracks.map { HomeFeedEntity.fromDto(section.id, section.title, it, timestamp) }
            }
            if (entities.isNotEmpty()) {
                dao.clear()
                dao.insertAll(entities)
            }
            if ((body.ready || body.status.equals("success", ignoreCase = true)) && verified.sections.any { it.tracks.isNotEmpty() }) {
                _state.value = HomeFeedState.Success(verified, stale = false)
            } else {
                // Cold backend response: keep the skeleton state visible and
                // poll briefly for the background verification result.
                val becameReady = pollUntilReady(userId, region)
                if (!becameReady) {
                    // Always terminate pull-to-refresh. Keep usable cached data when
                    // the backend is warming up or temporarily offline.
                    if (cachedResponse.sections.isNotEmpty() && age <= MAX_STALE_MS) {
                        _state.value = HomeFeedState.Success(cachedResponse, stale = true)
                    } else {
                        _state.value = HomeFeedState.Error("Home feed is still warming up")
                    }
                }
            }
        } catch (error: Exception) {
            if (cachedResponse.sections.isNotEmpty() && age <= MAX_STALE_MS) {
                _state.value = HomeFeedState.Success(cachedResponse, stale = true)
            } else {
                _state.value = HomeFeedState.Error(error.message ?: "Unable to load Home")
            }
        }
    }

    private suspend fun pollUntilReady(userId: String?, region: String): Boolean {
        repeat(MAX_WARMUP_POLLS) {
            delay(WARMUP_POLL_INTERVAL_MS)
            try {
                val token = secureStorage.getAccessToken()
                val response = withTimeout(NETWORK_TIMEOUT_MS) {
                    MRJApiClient.apiService.getHomeFeed(userId, region, token?.let { "Bearer $it" })
                }
                val body = response.body() ?: return@repeat
                if (!response.isSuccessful || !(body.ready || body.status.equals("success", ignoreCase = true)) || body.sections.none { it.tracks.isNotEmpty() }) return@repeat
                val verified = body.copy(sections = body.sections.map { section -> section.copy(tracks = section.tracks.filter { it.sourceAvailable }) })
                val timestamp = System.currentTimeMillis()
                val entities = verified.sections.flatMap { section -> section.tracks.map { HomeFeedEntity.fromDto(section.id, section.title, it, timestamp) } }
                if (entities.isNotEmpty()) {
                    dao.clear()
                    dao.insertAll(entities)
                }
                _state.value = HomeFeedState.Success(verified, stale = false)
                return true
            } catch (_: Exception) {
                // Keep the skeleton/cached Home visible while retrying.
            }
        }
        return false
    }

    private fun cachedResponse(rows: List<HomeFeedEntity>, region: String): HomeFeedResponse {
        return HomeFeedResponse(
            status = "success",
            region = region,
            sections = rows.groupBy { it.sectionId }.map { (id, tracks) ->
                HomeFeedSectionDto(id, tracks.firstOrNull()?.sectionTitle ?: id, tracks.filter { it.sourceAvailable }.map { it.toDto() })
            }
        )
    }

    companion object {
        const val FRESH_TTL_MS = 30 * 60 * 1000L
        const val MAX_STALE_MS = 24 * 60 * 60 * 1000L
        const val NETWORK_TIMEOUT_MS = 7000L
        const val WARMUP_POLL_INTERVAL_MS = 1000L
        const val MAX_WARMUP_POLLS = 2
    }
}
