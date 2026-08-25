package com.mrj.music.ui.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.mrj.music.data.remote.MRJApiClient
import com.mrj.music.data.security.SecureAuthStorage
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class AuthUiState(
    val isAuthenticated: Boolean = false,
    val isLoading: Boolean = false,
    val userName: String? = null,
    val userEmail: String? = null,
    val preferredName: String? = null,
    val errorMessage: String? = null,
    val otpSent: Boolean = false,
    val successMessage: String? = null
)

class AuthViewModel(application: Application) : AndroidViewModel(application) {

    private val secureStorage = SecureAuthStorage.getInstance(application)
    private val _uiState = MutableStateFlow(AuthUiState())
    val uiState: StateFlow<AuthUiState> = _uiState.asStateFlow()

    init {
        checkSession()
    }

    fun checkSession() {
        val token = secureStorage.getAccessToken()
        val profile = secureStorage.getUserProfile()
        val preferred = secureStorage.getPreferredName()

        if (token != null && profile != null) {
            _uiState.value = _uiState.value.copy(
                isAuthenticated = true,
                userName = profile["name"] as? String,
                userEmail = profile["email"] as? String,
                preferredName = preferred
            )
        }
    }

    fun login(email: String, password: String) {
        if (email.isBlank() || password.isBlank()) {
            _uiState.value = _uiState.value.copy(errorMessage = "Please enter email and password.")
            return
        }

        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null)
            try {
                val res = MRJApiClient.apiService.login(mapOf("email" to email.trim(), "password" to password))
                if (res.isSuccessful && res.body() != null) {
                    val body = res.body()!!
                    val token = body["token"] as? String ?: ""
                    val refreshToken = body["refreshToken"] as? String ?: ""
                    val user = (body["user"] as? Map<String, Any>) ?: emptyMap()

                    secureStorage.saveTokens(token, refreshToken)
                    secureStorage.saveUserProfile(user)

                    _uiState.value = AuthUiState(
                        isAuthenticated = true,
                        isLoading = false,
                        userName = user["name"] as? String,
                        userEmail = user["email"] as? String,
                        preferredName = secureStorage.getPreferredName()
                    )
                } else {
                    val errBody = res.errorBody()?.string() ?: ""
                    val msg = if (errBody.contains("Invalid email or password")) {
                        "Invalid email or password. Please check and try again."
                    } else {
                        "Login failed. Please verify your credentials."
                    }
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        errorMessage = msg
                    )
                }
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    errorMessage = e.message ?: "Authentication failed."
                )
            }
        }
    }

    fun requestSignupOtp(email: String, name: String) {
        if (email.isBlank()) {
            _uiState.value = _uiState.value.copy(errorMessage = "Email is required.")
            return
        }

        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null)
            try {
                val res = MRJApiClient.apiService.sendSignupOtp(mapOf("email" to email.trim(), "name" to name.trim()))
                if (res.isSuccessful) {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        otpSent = true,
                        successMessage = "6-digit verification code sent to $email"
                    )
                } else {
                    val errBody = res.errorBody()?.string() ?: ""
                    val msg = if (errBody.contains("already exists")) {
                        "An account with this email address already exists. Please Sign In."
                    } else {
                        "Failed to send code. Please try again."
                    }
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        errorMessage = msg
                    )
                }
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(isLoading = false, errorMessage = e.message ?: "Failed to send code.")
            }
        }
    }

    fun verifySignupOtp(email: String, otp: String, password: String, name: String, preferredCalloutName: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null)
            try {
                val res = MRJApiClient.apiService.verifyOtp(mapOf(
                    "email" to email.trim(),
                    "otp" to otp.trim(),
                    "password" to password,
                    "name" to name.trim(),
                    "ageGroup" to "18-24",
                    "gender" to "Prefer not to say"
                ))
                if (res.isSuccessful && res.body() != null) {
                    val body = res.body()!!
                    val token = body["token"] as? String ?: ""
                    val refreshToken = body["refreshToken"] as? String ?: ""
                    val user = (body["user"] as? Map<String, Any>) ?: emptyMap()

                    secureStorage.saveTokens(token, refreshToken)
                    secureStorage.saveUserProfile(user)
                    if (preferredCalloutName.isNotBlank()) {
                        secureStorage.savePreferredName(preferredCalloutName.trim())
                    }

                    _uiState.value = AuthUiState(
                        isAuthenticated = true,
                        isLoading = false,
                        userName = user["name"] as? String,
                        userEmail = user["email"] as? String,
                        preferredName = preferredCalloutName.ifBlank { null }
                    )
                } else {
                    val errBody = res.errorBody()?.string() ?: ""
                    val msg = if (errBody.contains("Invalid verification code")) {
                        "Invalid verification code. Please check your email and try again."
                    } else if (errBody.contains("expired")) {
                        "Verification code has expired. Please request a new code."
                    } else {
                        "Verification failed. Please try again."
                    }
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        errorMessage = msg
                    )
                }
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(isLoading = false, errorMessage = e.message ?: "Verification failed.")
            }
        }
    }

    fun registerDirect(name: String, email: String, password: String, preferredCalloutName: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null)
            try {
                val res = MRJApiClient.apiService.register(mapOf(
                    "name" to name.trim(),
                    "email" to email.trim(),
                    "password" to password,
                    "ageGroup" to "18-24",
                    "gender" to "Prefer not to say"
                ))
                if (res.isSuccessful && res.body() != null) {
                    val body = res.body()!!
                    val token = body["token"] as? String ?: ""
                    val refreshToken = body["refreshToken"] as? String ?: ""
                    val user = (body["user"] as? Map<String, Any>) ?: emptyMap()

                    secureStorage.saveTokens(token, refreshToken)
                    secureStorage.saveUserProfile(user)
                    if (preferredCalloutName.isNotBlank()) {
                        secureStorage.savePreferredName(preferredCalloutName.trim())
                    }

                    _uiState.value = AuthUiState(
                        isAuthenticated = true,
                        isLoading = false,
                        userName = user["name"] as? String,
                        userEmail = user["email"] as? String,
                        preferredName = preferredCalloutName.ifBlank { null }
                    )
                } else {
                    val errBody = res.errorBody()?.string() ?: ""
                    val msg = if (errBody.contains("already exists")) {
                        "An account with this email address already exists. Please Sign In."
                    } else {
                        "Registration failed. Please try again."
                    }
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        errorMessage = msg
                    )
                }
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(isLoading = false, errorMessage = e.message ?: "Registration failed.")
            }
        }
    }

    fun updatePreferredName(name: String) {
        secureStorage.savePreferredName(name)
        _uiState.value = _uiState.value.copy(
            preferredName = name.ifBlank { null },
            successMessage = "Preferred callout name updated!"
        )
    }

    fun logout() {
        val refreshToken = secureStorage.getRefreshToken()
        viewModelScope.launch {
            if (refreshToken != null) {
                try {
                    MRJApiClient.apiService.logout(mapOf("refreshToken" to refreshToken))
                } catch (_: Exception) {}
            }
            secureStorage.clearAuth()
            _uiState.value = AuthUiState()
        }
    }
}
