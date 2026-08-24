package com.mrj.music.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.mrj.music.data.repository.AuthRepository
import com.mrj.music.data.repository.MusicRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class AuthState(
    val isLoading: Boolean = false,
    val isLoggedIn: Boolean = false,
    val userName: String? = null,
    val userEmail: String? = null,
    val error: String? = null
)

@HiltViewModel
class AuthViewModel @Inject constructor(
    private val authRepository: AuthRepository,
    private val musicRepository: MusicRepository
) : ViewModel() {

    private val _state = MutableStateFlow(AuthState())
    val state: StateFlow<AuthState> = _state.asStateFlow()

    init {
        viewModelScope.launch {
            authRepository.isLoggedIn().collect { isLoggedIn ->
                _state.value = _state.value.copy(isLoggedIn = isLoggedIn)
            }
        }
        viewModelScope.launch {
            authRepository.getUserName().collect { name ->
                _state.value = _state.value.copy(userName = name)
            }
        }
        viewModelScope.launch {
            authRepository.getUserEmail().collect { email ->
                _state.value = _state.value.copy(userEmail = email)
            }
        }
    }

    fun login(email: String, password: String) {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, error = null)
            val result = authRepository.login(email, password)
            _state.value = if (result.isSuccess) {
                _state.value.copy(isLoading = false, isLoggedIn = true)
            } else {
                _state.value.copy(isLoading = false, error = result.exceptionOrNull()?.message ?: "Login failed")
            }
        }
    }

    fun register(name: String, email: String, password: String) {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, error = null)
            val result = authRepository.register(name, email, password)
            _state.value = if (result.isSuccess) {
                _state.value.copy(isLoading = false, isLoggedIn = true)
            } else {
                _state.value.copy(isLoading = false, error = result.exceptionOrNull()?.message ?: "Registration failed")
            }
        }
    }

    fun logout() {
        viewModelScope.launch {
            authRepository.logout()
            _state.value = AuthState()
        }
    }

    fun clearError() {
        _state.value = _state.value.copy(error = null)
    }
}
