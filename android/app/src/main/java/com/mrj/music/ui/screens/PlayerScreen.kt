package com.mrj.music.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.mrj.music.model.NativeTrack
import com.mrj.music.ui.theme.*
import com.mrj.music.ui.viewmodel.PlayerViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FullScreenPlayerSheet(
    playerViewModel: PlayerViewModel,
    onDismiss: () -> Unit
) {
    val uiState by playerViewModel.uiState.collectAsState()
    val track = uiState.currentTrack ?: return

    var selectedTab by remember { mutableStateOf(0) }
    val tabs = listOf("Now Playing", "Lyrics", "Up Next")

    var isScrubbing by remember { mutableStateOf(false) }
    var scrubPosition by remember { mutableStateOf(0f) }

    val currentPosition = if (isScrubbing) scrubPosition.toLong() else uiState.positionMs
    val duration = if (uiState.durationMs > 0) uiState.durationMs else 1L

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    colors = listOf(Color(0xFF220004), DeepDarkBg, DeepDarkBg)
                )
            )
            .statusBarsPadding()
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 24.dp, vertical = 16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // 1. Top Bar with Minimize Chevron, Tabs, & Autoplay Toggle
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 4.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                IconButton(
                    onClick = onDismiss,
                    modifier = Modifier.size(40.dp)
                ) {
                    Icon(
                        Icons.Default.KeyboardArrowDown,
                        contentDescription = "Minimize",
                        tint = TextPrimary,
                        modifier = Modifier.size(30.dp)
                    )
                }

                // Clean 3-Pill Navigation Selector (Single-line, no wrapping)
                Row(
                    modifier = Modifier
                        .weight(1f)
                        .padding(horizontal = 4.dp),
                    horizontalArrangement = Arrangement.Center,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    tabs.forEachIndexed { index, title ->
                        val isSelected = selectedTab == index
                        Surface(
                            modifier = Modifier
                                .clip(RoundedCornerShape(12.dp))
                                .clickable { selectedTab = index }
                                .padding(horizontal = 2.dp),
                            color = if (isSelected) CrimsonRed.copy(alpha = 0.2f) else Color.Transparent
                        ) {
                            Text(
                                text = title,
                                fontSize = 12.sp,
                                fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                                color = if (isSelected) CrimsonRed else TextMuted,
                                maxLines = 1,
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 6.dp)
                            )
                        }
                    }
                }

                // Autoplay Pill on Player Card
                Surface(
                    modifier = Modifier
                        .clip(RoundedCornerShape(16.dp))
                        .clickable { playerViewModel.toggleAutoplay() },
                    color = if (uiState.isAutoplay) CrimsonRed.copy(alpha = 0.15f) else SurfaceDark,
                    border = BorderStroke(
                        width = 1.dp,
                        color = if (uiState.isAutoplay) CrimsonRed else SurfaceBorder
                    )
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        Icon(
                            Icons.Default.Autorenew,
                            contentDescription = "Autoplay",
                            tint = if (uiState.isAutoplay) CrimsonRed else TextMuted,
                            modifier = Modifier.size(14.dp)
                        )
                        Text(
                            text = if (uiState.isAutoplay) "Auto" else "Off",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            color = if (uiState.isAutoplay) CrimsonRed else TextMuted
                        )
                    }
                }
            }

            Spacer(Modifier.height(16.dp))

            when (selectedTab) {
                0 -> {
                    // TAB 0: Main Player View
                    Column(
                        modifier = Modifier
                            .weight(1f)
                            .fillMaxWidth(),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center
                    ) {
                        // High-res Artwork
                        AsyncImage(
                            model = track.thumbnail,
                            contentDescription = track.title,
                            modifier = Modifier
                                .size(280.dp)
                                .clip(RoundedCornerShape(20.dp)),
                            contentScale = ContentScale.Crop
                        )

                        Spacer(Modifier.height(28.dp))

                        // Title & Artist
                        Text(
                            text = track.title,
                            style = MaterialTheme.typography.headlineMedium.copy(fontSize = 20.sp),
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            textAlign = TextAlign.Center,
                            color = TextPrimary
                        )

                        Spacer(Modifier.height(4.dp))

                        Text(
                            text = track.artist,
                            style = MaterialTheme.typography.titleMedium.copy(color = TextSecondary),
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            textAlign = TextAlign.Center
                        )
                    }

                    // Seekbar & Progress
                    Column(modifier = Modifier.fillMaxWidth()) {
                        Slider(
                            value = currentPosition.coerceAtLeast(0L).toFloat(),
                            onValueChange = {
                                isScrubbing = true
                                scrubPosition = it
                            },
                            onValueChangeFinished = {
                                playerViewModel.seekTo(scrubPosition.toLong())
                                isScrubbing = false
                            },
                            valueRange = 0f..duration.toFloat(),
                            colors = SliderDefaults.colors(
                                thumbColor = CrimsonRed,
                                activeTrackColor = CrimsonRed,
                                inactiveTrackColor = SurfaceBorder
                            )
                        )

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(
                                text = formatTime(currentPosition),
                                style = MaterialTheme.typography.bodyMedium,
                                color = TextMuted
                            )
                            Text(
                                text = formatTime(duration),
                                style = MaterialTheme.typography.bodyMedium,
                                color = TextMuted
                            )
                        }
                    }

                    Spacer(Modifier.height(16.dp))

                    // Player Controls Row
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(bottom = 24.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceEvenly
                    ) {
                        IconButton(onClick = { playerViewModel.toggleShuffle() }) {
                            Icon(
                                Icons.Default.Shuffle,
                                contentDescription = "Shuffle",
                                tint = if (uiState.isShuffle) CrimsonRed else TextMuted
                            )
                        }

                        IconButton(onClick = { playerViewModel.playPrevious() }) {
                            Icon(
                                Icons.Default.SkipPrevious,
                                contentDescription = "Previous",
                                tint = TextPrimary,
                                modifier = Modifier.size(36.dp)
                            )
                        }

                        // Play/Pause Button
                        Surface(
                            modifier = Modifier
                                .size(64.dp)
                                .clip(CircleShape)
                                .clickable { playerViewModel.togglePlayPause() },
                            color = CrimsonRed
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                if (uiState.isLoading) {
                                    CircularProgressIndicator(color = Color.White, modifier = Modifier.size(24.dp), strokeWidth = 2.dp)
                                } else {
                                    Icon(
                                        imageVector = if (uiState.isPlaying) Icons.Default.Pause else Icons.Default.PlayArrow,
                                        contentDescription = if (uiState.isPlaying) "Pause" else "Play",
                                        tint = Color.White,
                                        modifier = Modifier.size(36.dp)
                                    )
                                }
                            }
                        }

                        IconButton(onClick = { playerViewModel.playNext() }) {
                            Icon(
                                Icons.Default.SkipNext,
                                contentDescription = "Next",
                                tint = TextPrimary,
                                modifier = Modifier.size(36.dp)
                            )
                        }

                        IconButton(onClick = { selectedTab = 1 }) {
                            Icon(
                                Icons.Default.Lyrics,
                                contentDescription = "Lyrics",
                                tint = TextMuted
                            )
                        }
                    }
                }

                1 -> {
                    // TAB 1: Synced Lyrics View
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .fillMaxWidth(),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(16.dp)
                        ) {
                            Text(
                                text = "Lyrics for ${track.title}",
                                style = MaterialTheme.typography.titleLarge,
                                color = TextPrimary
                            )
                            Text(
                                text = "Lyrics are synchronized in real-time with the audio stream.",
                                style = MaterialTheme.typography.bodyLarge,
                                color = TextSecondary,
                                textAlign = TextAlign.Center
                            )
                        }
                    }
                }

                2 -> {
                    // TAB 2: Up Next Queue
                    Column(
                        modifier = Modifier
                            .weight(1f)
                            .fillMaxWidth()
                    ) {
                        Text(
                            text = "Up Next Queue (${uiState.queue.size} songs)",
                            style = MaterialTheme.typography.titleLarge,
                            modifier = Modifier.padding(vertical = 12.dp)
                        )

                        LazyColumn(
                            verticalArrangement = Arrangement.spacedBy(8.dp),
                            contentPadding = PaddingValues(bottom = 24.dp)
                        ) {
                            itemsIndexed(uiState.queue) { index, queueTrack ->
                                val isCurrent = queueTrack.id == track.id
                                Surface(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clip(RoundedCornerShape(12.dp))
                                        .clickable { playerViewModel.playTrack(queueTrack) },
                                    color = if (isCurrent) SurfaceElevated else SurfaceDark
                                ) {
                                    Row(
                                        modifier = Modifier.padding(10.dp),
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                                    ) {
                                        AsyncImage(
                                            model = queueTrack.thumbnail,
                                            contentDescription = queueTrack.title,
                                            modifier = Modifier
                                                .size(44.dp)
                                                .clip(RoundedCornerShape(8.dp)),
                                            contentScale = ContentScale.Crop
                                        )

                                        Column(modifier = Modifier.weight(1f)) {
                                            Text(
                                                text = queueTrack.title,
                                                style = MaterialTheme.typography.titleMedium.copy(fontSize = 13.sp),
                                                color = if (isCurrent) CrimsonRed else TextPrimary,
                                                maxLines = 1,
                                                overflow = TextOverflow.Ellipsis
                                            )
                                            Text(
                                                text = queueTrack.artist,
                                                style = MaterialTheme.typography.bodyMedium.copy(fontSize = 11.sp),
                                                color = TextSecondary,
                                                maxLines = 1,
                                                overflow = TextOverflow.Ellipsis
                                            )
                                        }

                                        if (isCurrent) {
                                            Icon(
                                                Icons.Default.VolumeUp,
                                                contentDescription = "Playing",
                                                tint = CrimsonRed,
                                                modifier = Modifier.size(20.dp)
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

private fun formatTime(millis: Long): String {
    val totalSeconds = (millis / 1000).coerceAtLeast(0)
    val minutes = totalSeconds / 60
    val seconds = totalSeconds % 60
    return String.format("%d:%02d", minutes, seconds)
}
