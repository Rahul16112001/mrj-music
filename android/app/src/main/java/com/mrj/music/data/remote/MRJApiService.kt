package com.mrj.music.data.remote

import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

interface MRJApiService {

    // ==================== DISCOVERY & CHARTS ====================
    @GET("api/recommendations/home")
    suspend fun getPersonalizedHome(
        @Query("region") region: String = "IN",
        @Header("Authorization") authHeader: String? = null
    ): Response<Map<String, Any>>

    @POST("api/recommendations/next")
    suspend fun getNextRecommendations(
        @Header("Authorization") authHeader: String? = null,
        @Body body: Map<String, @JvmSuppressWildcards Any?>
    ): Response<Map<String, Any>>

    @GET("api/recommendations/related/{trackId}")
    suspend fun getRelatedTracks(
        @Path("trackId") trackId: String,
        @Query("artist") artist: String = "",
        @Query("genre") genre: String = "",
        @Query("title") title: String = ""
    ): Response<Map<String, Any>>

    @GET("api/charts/trending")
    suspend fun getTrending(
        @Query("region") region: String = "GLOBAL"
    ): Response<Map<String, Any>>

    @GET("api/charts/top-songs")
    suspend fun getTopSongs(
        @Query("region") region: String = "GLOBAL"
    ): Response<Map<String, Any>>

    @GET("api/charts/top-artists")
    suspend fun getTopArtists(
        @Query("region") region: String = "GLOBAL"
    ): Response<Map<String, Any>>

    // ==================== SEARCH & SUGGESTIONS ====================
    @GET("api/music/search")
    suspend fun search(
        @Query("q") query: String,
        @Query("type") type: String = "all"
    ): Response<Map<String, Any>>

    @GET("api/music/suggestions")
    suspend fun getSuggestions(
        @Query("q") query: String
    ): Response<Map<String, Any>>

    @GET("api/user/search-history")
    suspend fun getSearchHistory(
        @Header("Authorization") authHeader: String
    ): Response<Map<String, Any>>

    @POST("api/user/search-history")
    suspend fun addSearchHistory(
        @Header("Authorization") authHeader: String,
        @Body body: Map<String, String>
    ): Response<Map<String, Any>>

    @DELETE("api/user/search-history/{query}")
    suspend fun removeSearchHistory(
        @Header("Authorization") authHeader: String,
        @Path("query") query: String
    ): Response<Map<String, Any>>

    @DELETE("api/user/search-history")
    suspend fun clearSearchHistory(
        @Header("Authorization") authHeader: String
    ): Response<Map<String, Any>>

    // ==================== STREAM RESOLUTION & LYRICS ====================
    @GET("api/music/resolve-source")
    suspend fun resolvePlaybackSource(
        @Query("id") id: String? = null,
        @Query("title") title: String? = null,
        @Query("artist") artist: String? = null,
        @Query("duration") duration: Double? = 210.0,
        @Query("format") format: String = "audio"
    ): Response<Map<String, Any>>

    @GET("api/music/lyrics")
    suspend fun getLyrics(
        @Query("track") track: String,
        @Query("artist") artist: String,
        @Query("duration") duration: Long? = null
    ): Response<Map<String, Any>>

    // ==================== USER CLOUD LIBRARY ====================
    @GET("api/user/likes")
    suspend fun getUserLikes(
        @Header("Authorization") authHeader: String
    ): Response<Map<String, Any>>

    @POST("api/user/likes")
    suspend fun likeTrack(
        @Header("Authorization") authHeader: String,
        @Body body: Map<String, @JvmSuppressWildcards Any?>
    ): Response<Map<String, Any>>

    @DELETE("api/user/likes/{trackId}")
    suspend fun unlikeTrack(
        @Header("Authorization") authHeader: String,
        @Path("trackId") trackId: String
    ): Response<Map<String, Any>>

    @GET("api/user/playlists")
    suspend fun getUserPlaylists(
        @Header("Authorization") authHeader: String
    ): Response<Map<String, Any>>

    @POST("api/user/playlists")
    suspend fun saveUserPlaylist(
        @Header("Authorization") authHeader: String,
        @Body body: Map<String, @JvmSuppressWildcards Any?>
    ): Response<Map<String, Any>>

    @DELETE("api/user/playlists/{playlistId}")
    suspend fun deleteUserPlaylist(
        @Header("Authorization") authHeader: String,
        @Path("playlistId") playlistId: String
    ): Response<Map<String, Any>>

    @POST("api/user/events")
    suspend fun postEvents(
        @Header("Authorization") authHeader: String?,
        @Body body: Map<String, @JvmSuppressWildcards Any?>
    ): Response<Map<String, Any>>

    // ==================== APP SYSTEM & UPDATES ====================
    @GET("api/app/check-update")
    suspend fun checkUpdate(
        @Query("platform") platform: String = "android",
        @Query("version") version: String = "3.2.0"
    ): Response<Map<String, Any>>

    // ==================== AUTHENTICATION ====================
    @POST("api/auth/login")
    suspend fun login(
        @Body body: Map<String, String>
    ): Response<Map<String, Any>>

    @POST("api/auth/register")
    suspend fun register(
        @Body body: Map<String, String>
    ): Response<Map<String, Any>>

    @POST("api/auth/signup-otp")
    suspend fun sendSignupOtp(
        @Body body: Map<String, String>
    ): Response<Map<String, Any>>

    @POST("api/auth/verify-otp")
    suspend fun verifyOtp(
        @Body body: Map<String, String>
    ): Response<Map<String, String>>

    @POST("api/auth/refresh")
    suspend fun refreshToken(
        @Body body: Map<String, String>
    ): Response<Map<String, Any>>

    @POST("api/auth/logout")
    suspend fun logout(
        @Body body: Map<String, String>
    ): Response<Map<String, Any>>

    @GET("api/auth/me")
    suspend fun getMe(
        @Header("Authorization") authHeader: String
    ): Response<Map<String, Any>>
}
