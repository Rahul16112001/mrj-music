package com.mrj.music.data.repository

import com.mrj.music.data.remote.api.MRJApiService
import com.mrj.music.data.preferences.DataStoreManager
import com.mrj.music.domain.model.*
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AuthRepository @Inject constructor(
    private val apiService: MRJApiService,
    private val dataStoreManager: DataStoreManager
) {
    suspend fun login(email: String, password: String): Result<AuthResponse> {
        return try {
            val response = apiService.login(mapOf("email" to email, "password" to password))
            if (response.isSuccessful && response.body() != null) {
                val body = response.body()!!
                dataStoreManager.saveAuth(body.token, body.refreshToken, body.user.id, body.user.name, body.user.email)
                Result.success(body)
            } else {
                Result.failure(Exception(response.errorBody()?.string() ?: "Login failed"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun register(name: String, email: String, password: String, ageGroup: String? = null, gender: String? = null): Result<AuthResponse> {
        return try {
            val response = apiService.register(RegisterRequest(name, email, password, ageGroup, gender))
            if (response.isSuccessful && response.body() != null) {
                val body = response.body()!!
                dataStoreManager.saveAuth(body.token, body.refreshToken, body.user.id, body.user.name, body.user.email)
                Result.success(body)
            } else {
                Result.failure(Exception(response.errorBody()?.string() ?: "Registration failed"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun logout(): Result<Unit> {
        return try {
            val refreshToken = runBlocking { dataStoreManager.refreshToken.first() }
            apiService.logout(mapOf("refreshToken" to (refreshToken ?: "")))
            dataStoreManager.clearAuth()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun refreshToken(): Result<AuthResponse> {
        val refreshToken = runBlocking { dataStoreManager.refreshToken.first() } ?: return Result.failure(Exception("No refresh token"))
        return try {
            val response = apiService.refreshToken(mapOf("refreshToken" to refreshToken))
            if (response.isSuccessful && response.body() != null) {
                val body = response.body()!!
                dataStoreManager.saveAuth(body.token, body.refreshToken, body.user.id, body.user.name, body.user.email)
                Result.success(body)
            } else {
                Result.failure(Exception("Refresh failed"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    fun getAuthToken(): Flow<String?> = dataStoreManager.authToken
    fun getRefreshToken(): Flow<String?> = dataStoreManager.refreshToken
    fun getUserId(): Flow<String?> = dataStoreManager.userId
    fun getUserName(): Flow<String?> = dataStoreManager.userName
    fun getUserEmail(): Flow<String?> = dataStoreManager.userEmail
    fun isLoggedIn(): Flow<Boolean> = dataStoreManager.authToken.map { !it.isNullOrBlank() }
}
