package com.mrj.music.data.remote.api

import com.mrj.music.domain.model.*
import retrofit2.Response
import retrofit2.http.*

interface MRJApiService {

    // Auth
    @POST("auth/signup-otp")
    suspend fun sendSignupOtp(@Body request: Map<String, String>): Response<Map<String, Any>>

    @POST("auth/verify-otp")
    suspend fun verifySignupOtp(@Body request: Map<String, String>): Response<AuthResponse>

    @POST("auth/register")
    suspend fun register(@Body request: RegisterRequest): Response<AuthResponse>

    @POST("auth/login")
    suspend fun login(@Body request: AuthRequest): Response<AuthResponse>

    @POST("auth/refresh")
    suspend fun refreshToken(@Body request: Map<String, String>): Response<AuthResponse>

    @POST("auth/logout")
    suspend fun logout(@Body request: Map<String, String>): Response<Map<String, Any>>

    @GET("auth/me")
    suspend fun getMe(@Header("Authorization") token: String): Response<Map<String, Any>>

    @POST("auth/change-password")
    suspend fun changePassword(@Header("Authorization") token: String, @Body request: Map<String, String>): Response<Map<String, Any>>

    @DELETE("auth/account")
    suspend fun deleteAccount(@Header("Authorization") token: String, @Body request: Map<String, String>): Response<Map<String, Any>>

    @POST("auth/forgot-password")
    suspend fun forgotPassword(@Body request: Map<String, String>): Response<Map<String, Any>>

    @POST("auth/reset-password")
    suspend fun resetPassword(@Body request: Map<String, String>): Response<Map<String, Any>>

    // Charts
    @GET("charts/trending")
    suspend fun getTrending(@Query("region") region: String = "GLOBAL"): Response<Map<String, Any>>

    @GET("charts/top-songs")
    suspend fun getTopSongs(@Query("region") region: String = "GLOBAL"): Response<Map<String, Any>>

    @GET("charts/top-artists")
    suspend fun getTopArtists(@Query("region") region: String = "GLOBAL"): Response<Map<String, Any>>

    @GET("charts/categories")
    suspend fun getCategories(): Response<Map<String, Any>>

    @GET("charts/category/{categoryId}")
    suspend fun getCategoryTracks(@Path("categoryId") categoryId: String): Response<Map<String, Any>>

    // Recommendations
    @GET("recommendations/home")
    suspend fun getHome(@Header("Authorization") token: String? = null, @Query("region") region: String = "IN"): Response<Map<String, Any>>

    @GET("recommendations/radio/{videoId}")
    suspend fun getRadio(@Path("videoId") videoId: String, @Header("Authorization") token: String? = null): Response<Map<String, Any>>

    @GET("recommendations/related/{trackId}")
    suspend fun getRelated(@Path("trackId") trackId: String, @Query("artist") artist: String? = null, @Query("genre") genre: String? = null, @Query("title") title: String? = null): Response<Map<String, Any>>

    @POST("recommendations/next")
    suspend fun getNextRecommendations(@Header("Authorization") token: String? = null, @Body options: Map<String, Any?>): Response<Map<String, Any>>

    @POST("recommendations/tune")
    suspend fun tuneRecommendations(@Header("Authorization") token: String? = null, @Body request: Map<String, Any?>): Response<Map<String, Any>>

    @POST("recommendations/feedback")
    suspend fun sendFeedback(@Header("Authorization") token: String? = null, @Body request: Map<String, Any?>): Response<Map<String, Any>>

    @GET("recommendations/mood/{mood}")
    suspend fun getMoodStation(@Path("mood") mood: String, @Header("Authorization") token: String? = null): Response<Map<String, Any>>

    // Music
    @GET("music/charts")
    suspend fun getCharts(): Response<Map<String, Any>>

    @GET("music/search")
    suspend fun search(@Query("q") query: String, @Query("type") type: String = "all"): Response<Map<String, Any>>

    @GET("music/artist/{name}")
    suspend fun getArtist(@Path("name") name: String): Response<Map<String, Any>>

    @GET("music/album/{id}")
    suspend fun getAlbum(@Path("id") id: String): Response<Map<String, Any>>

    @GET("music/resolve-source")
    suspend fun resolveSource(@Query("id") id: String? = null, @Query("title") title: String? = null, @Query("artist") artist: String? = null, @Query("duration") duration: Int? = null, @Query("format") format: String = "audio"): Response<Map<String, Any>>

    @GET("music/lyrics")
    suspend fun getLyrics(@Query("track") track: String, @Query("artist") artist: String, @Query("duration") duration: Int? = null): Response<LyricData>

    // User
    @GET("user/likes")
    suspend fun getLikes(@Header("Authorization") token: String): Response<Map<String, Any>>

    @POST("user/likes")
    suspend fun likeTrack(@Header("Authorization") token: String, @Body track: Map<String, Any>): Response<Map<String, Any>>

    @DELETE("user/likes/{trackId}")
    suspend fun unlikeTrack(@Header("Authorization") token: String, @Path("trackId") trackId: String): Response<Map<String, Any>>

    @GET("user/playlists")
    suspend fun getPlaylists(@Header("Authorization") token: String): Response<Map<String, Any>>

    @POST("user/playlists")
    suspend fun savePlaylist(@Header("Authorization") token: String, @Body playlist: Map<String, Any>): Response<Map<String, Any>>

    @DELETE("user/playlists/{id}")
    suspend fun deletePlaylist(@Header("Authorization") token: String, @Path("id") id: String): Response<Map<String, Any>>

    @GET("user/history")
    suspend fun getHistory(@Header("Authorization") token: String): Response<Map<String, Any>>

    @DELETE("user/history")
    suspend fun clearHistory(@Header("Authorization") token: String): Response<Map<String, Any>>

    @POST("user/events")
    suspend fun postEvents(@Header("Authorization") token: String? = null, @Body request: Map<String, Any>): Response<Map<String, Any>>

    @POST("user/migrate")
    suspend fun migrateLocalData(@Header("Authorization") token: String, @Body request: Map<String, Any>): Response<Map<String, Any>>

    // Search History
    @GET("user/search-history")
    suspend fun getSearchHistory(@Header("Authorization") token: String): Response<Map<String, Any>>

    @POST("user/search-history")
    suspend fun addSearchHistory(@Header("Authorization") token: String, @Body request: Map<String, String>): Response<Map<String, Any>>

    @DELETE("user/search-history/{query}")
    suspend fun removeSearchHistory(@Header("Authorization") token: String, @Path("query") query: String): Response<Map<String, Any>>

    @DELETE("user/search-history")
    suspend fun clearSearchHistory(@Header("Authorization") token: String): Response<Map<String, Any>>

    // Update
    @GET("app/release")
    suspend fun getAppRelease(): Response<Map<String, Any>>

    @GET("app/check-update")
    suspend fun checkUpdate(@Query("version") version: String): Response<Map<String, Any>>

    // Ads
    @GET("ads/bundle")
    suspend fun getAdBundle(): Response<Map<String, Any>>
}
