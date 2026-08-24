package com.mrj.music.ui.screens.lyrics

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.hilt.navigation.compose.hiltViewModel
import com.mrj.music.ui.viewmodel.LyricsViewModel

@Composable
fun LyricsScreen(trackId: String, viewModel: LyricsViewModel = hiltViewModel()) {
    val state by viewModel.state.collectAsState()

    LaunchedEffect(trackId) {
        viewModel.loadLyrics(trackId)
    }

    Column(
        modifier = Modifier.fillMaxSize(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        if (state.isLoading) {
            CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
        } else if (state.error != null) {
            Text(text = state.error ?: "", color = MaterialTheme.colorScheme.error)
        } else {
            Text(
                text = state.lyrics ?: "No lyrics available",
                style = MaterialTheme.typography.bodyLarge,
                modifier = Modifier.padding(16.dp).verticalScroll(rememberScrollState())
            )
        }
    }
}
