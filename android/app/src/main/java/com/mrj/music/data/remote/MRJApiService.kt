package com.mrj.music.data.remote

import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.POST
import retrofit2.http.Query

interface MRJApiService {

    @GET("api/music/personalized-home")
    suspend fun getPersonalizedHome(
        @Query("region") region: String = "IN",
        @Header("Authorization") authHeader: String? = null
    ): Response<Map<String, Any>>

    @GET("api/music/search")
    suspend fun search(
        @Query("q") query: String,
        @Query("type") type: String = "all"
    ): Response<Map<String, Any>>

    @GET("api/music/lyrics")
    suspend fun getLyrics(
        @Query("track") track: String,
        @Query("artist") artist: String,
        @Query("duration") duration: Long? = null
    ): Response<Map<String, Any>>

    @GET("api/app/check-update")
    suspend fun checkUpdate(
        @Query("platform") platform: String = "android",
        @Query("version") version: String = "3.1.0"
    ): Response<Map<String, Any>>

    @POST("api/auth/login")
    suspend fun login(
        @Body body: Map<String, String>
    ): Response<Map<String, Any>>

    @POST("api/auth/signup-otp")
    suspend fun sendSignupOtp(
        @Body body: Map<String, String>
    ): Response<Map<String, Any>>

    @POST("api/auth/verify-otp")
    suspend fun verifyOtp(
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
