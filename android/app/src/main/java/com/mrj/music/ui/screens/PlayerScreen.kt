package com.mrj.music.ui.screens

import androidx.activity.compose.BackHandler
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.*
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.basicMarquee
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.automirrored.filled.*
import androidx.compose.material3.*
import com.mrj.music.ui.components.EqualizerSheet
import com.mrj.music.ui.components.SleepTimerSheet
import com.mrj.music.ui.components.TrackActionSheet
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
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
import kotlin.math.cos
import kotlin.math.sin

@OptIn(androidx.compose.foundation.ExperimentalFoundationApi::class, ExperimentalMaterial3Api::class)
@Composable
fun FullScreenPlayerSheet(
    playerViewModel: PlayerViewModel,
    onDismiss: () -> Unit,
    onArtistClick: (String) -> Unit = {},
    playlistViewModel: com.mrj.music.ui.viewmodel.PlaylistViewModel = androidx.lifecycle.viewmodel.compose.viewModel()
) {
    val context = androidx.compose.ui.platform.LocalContext.current
    val uiState by playerViewModel.uiState.collectAsState()
    val equalizerState by playerViewModel.equalizerState.collectAsState()
    val dynamicThemeColor by playerViewModel.dynamicThemeColor.collectAsState()
    val track = uiState.currentTrack ?: return

    var selectedTab by remember { mutableStateOf(0) } // 0: Playing Now, 1: Lyrics, 2: Up Next
    var mediaMode by remember { mutableStateOf("Song") } // "Song" or "Video"

    // Intercept Hardware / Gesture Back Button:
    // If inside Lyrics / Queue tab -> return to player (Tab 0)
    // If inside player -> smoothly minimize full player to bottom MiniPlayer
    BackHandler(enabled = true) {
        if (selectedTab != 0) {
            selectedTab = 0
        } else {
            onDismiss()
        }
    }

    val animatedAccentColor by animateColorAsState(
        targetValue = dynamicThemeColor,
        animationSpec = tween(700),
        label = "animatedAccentColor"
    )

    val bgTopColor by animateColorAsState(
        targetValue = dynamicThemeColor.copy(alpha = 0.25f),
        animationSpec = tween(700),
        label = "bgTopColor"
    )

    var isScrubbing by remember { mutableStateOf(false) }
    var scrubPosition by remember { mutableStateOf(0f) }
    var showTrackActions by remember { mutableStateOf(false) }
    var showEqualizer by remember { mutableStateOf(false) }
    var showSleepTimer by remember { mutableStateOf(false) }

    var totalDragX by remember { mutableFloatStateOf(0f) }
    var totalDragY by remember { mutableFloatStateOf(0f) }

    val currentPosition = if (isScrubbing) scrubPosition.toLong() else uiState.positionMs
    val duration = if (uiState.durationMs > 0) uiState.durationMs else 1L
    val progress = (currentPosition.toFloat() / duration.toFloat()).coerceIn(0f, 1f)

    val artworkScale by animateFloatAsState(
        targetValue = if (uiState.isPlaying) 1.0f else 0.94f,
        animationSpec = spring(dampingRatio = 0.72f, stiffness = Spring.StiffnessLow),
        label = "artworkScale"
    )

    val playButtonScale by animateFloatAsState(
        targetValue = if (uiState.isPlaying) 1.0f else 0.94f,
        animationSpec = spring(dampingRatio = 0.65f, stiffness = Spring.StiffnessMedium),
        label = "playButtonScale"
    )

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF07070A))
            .background(
                Brush.verticalGradient(
                    colors = listOf(bgTopColor, Color(0xFF0F0103), Color(0xFF07070A))
                )
            )
            .statusBarsPadding()
            .navigationBarsPadding()
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 20.dp, vertical = 6.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.SpaceBetween
        ) {
            // 1. Top Bar: Minimize Button, [ 🎵 Song | 📹 Video ] Switcher & Equalizer/Tune Button
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 2.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                // Minimize Button
                Surface(
                    modifier = Modifier
                        .size(38.dp)
                        .clip(CircleShape)
                        .clickable(onClick = onDismiss),
                    color = SurfaceDark.copy(alpha = 0.8f),
                    shape = CircleShape
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Icon(
                            Icons.Default.KeyboardArrowDown,
                            contentDescription = "Minimize",
                            tint = TextPrimary,
                            modifier = Modifier.size(24.dp)
                        )
                    }
                }

                // [ 🎵 Song | 📹 Video ] Segmented Pill Control
                Surface(
                    modifier = Modifier.clip(RoundedCornerShape(22.dp)),
                    color = SurfaceDark.copy(alpha = 0.85f),
                    shape = RoundedCornerShape(22.dp),
                    border = BorderStroke(1.dp, SurfaceBorder.copy(alpha = 0.5f))
                ) {
                    Row(
                        modifier = Modifier.padding(3.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        // Song Pill
                        Surface(
                            modifier = Modifier
                                .clip(RoundedCornerShape(18.dp))
                                .clickable {
                                    mediaMode = "Song"
                                    selectedTab = 0
                                },
                            color = if (mediaMode == "Song" && selectedTab == 0) Color.White else Color.Transparent,
                            shape = RoundedCornerShape(18.dp)
                        ) {
                            Row(
                                modifier = Modifier.padding(horizontal = 14.dp, vertical = 5.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(4.dp)
                            ) {
                                Icon(
                                    Icons.Default.MusicNote,
                                    contentDescription = null,
                                    tint = if (mediaMode == "Song" && selectedTab == 0) Color.Black else TextMuted,
                                    modifier = Modifier.size(14.dp)
                                )
                                Text(
                                    text = "Song",
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = if (mediaMode == "Song" && selectedTab == 0) Color.Black else TextMuted
                                )
                            }
                        }

                        // Video Pill
                        Surface(
                            modifier = Modifier
                                .clip(RoundedCornerShape(18.dp))
                                .clickable {
                                    mediaMode = "Video"
                                    android.widget.Toast.makeText(context, "Switching to video stream playback", android.widget.Toast.LENGTH_SHORT).show()
                                },
                            color = if (mediaMode == "Video") Color.White else Color.Transparent,
                            shape = RoundedCornerShape(18.dp)
                        ) {
                            Row(
                                modifier = Modifier.padding(horizontal = 14.dp, vertical = 5.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(4.dp)
                            ) {
                                Icon(
                                    Icons.Default.Videocam,
                                    contentDescription = null,
                                    tint = if (mediaMode == "Video") Color.Black else TextMuted,
                                    modifier = Modifier.size(15.dp)
                                )
                                Text(
                                    text = "Video",
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = if (mediaMode == "Video") Color.Black else TextMuted
                                )
                            }
                        }
                    }
                }

                // Equalizer / Tune Settings Button
                Surface(
                    modifier = Modifier
                        .size(38.dp)
                        .clip(CircleShape)
                        .clickable { showEqualizer = true },
                    color = SurfaceDark.copy(alpha = 0.8f),
                    shape = CircleShape
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Icon(
                            Icons.Default.Tune,
                            contentDescription = "Equalizer & Sound FX",
                            tint = if (equalizerState.isEnabled) animatedAccentColor else TextPrimary,
                            modifier = Modifier.size(19.dp)
                        )
                    }
                }
            }

            when (selectedTab) {
                0 -> {
                    // TAB 0: Main Player View (Proportional Full Height YouTube Music Style)
                    Column(
                        modifier = Modifier
                            .weight(1f)
                            .fillMaxWidth(),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.SpaceBetween
                    ) {
                        // 2. Large Centered Rounded Square Artwork with Ambient Glow
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .weight(1f)
                                .padding(vertical = 10.dp)
                                .pointerInput(Unit) {
                                    detectDragGestures(
                                        onDragStart = {
                                            totalDragX = 0f
                                            totalDragY = 0f
                                        },
                                        onDrag = { change, dragAmount ->
                                            change.consume()
                                            totalDragX += dragAmount.x
                                            totalDragY += dragAmount.y
                                        },
                                        onDragEnd = {
                                            val threshold = 80f
                                            if (kotlin.math.abs(totalDragX) > kotlin.math.abs(totalDragY)) {
                                                if (totalDragX > threshold) {
                                                    playerViewModel.playNext()
                                                } else if (totalDragX < -threshold) {
                                                    playerViewModel.playPrevious()
                                                }
                                            } else {
                                                if (totalDragY < -threshold) {
                                                    selectedTab = 2 // Swipe UP -> see queue
                                                } else if (totalDragY > threshold) {
                                                    onDismiss() // Swipe DOWN -> minimize
                                                }
                                            }
                                            totalDragX = 0f
                                            totalDragY = 0f
                                        },
                                        onDragCancel = {
                                            totalDragX = 0f
                                            totalDragY = 0f
                                        }
                                    )
                                },
                            contentAlignment = Alignment.Center
                        ) {
                            // Ambient Dynamic Glow
                            Box(
                                modifier = Modifier
                                    .fillMaxHeight(0.95f)
                                    .aspectRatio(1f)
                                    .background(
                                        Brush.radialGradient(
                                            colors = listOf(animatedAccentColor.copy(alpha = 0.45f), Color.Transparent)
                                        ),
                                        shape = CircleShape
                                    )
                            )

                            // Responsive Square Card (Expands naturally to fill upper half)
                            Surface(
                                modifier = Modifier
                                    .fillMaxHeight(0.92f)
                                    .aspectRatio(1f)
                                    .graphicsLayer {
                                        scaleX = artworkScale
                                        scaleY = artworkScale
                                    }
                                    .shadow(elevation = 20.dp, shape = RoundedCornerShape(24.dp), spotColor = animatedAccentColor)
                                    .clip(RoundedCornerShape(24.dp)),
                                shape = RoundedCornerShape(24.dp),
                                color = SurfaceDark
                            ) {
                                AsyncImage(
                                    model = track.thumbnail,
                                    contentDescription = track.title,
                                    modifier = Modifier.fillMaxSize(),
                                    contentScale = ContentScale.Crop
                                )
                            }
                        }

                        // 3. Track Metadata & Action Row: Title, Artist, Heart, Download, 3-Dots
                        val likedTrackIds by playerViewModel.likedTrackIds.collectAsState()
                        val isLiked = likedTrackIds.contains(track.id)

                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 4.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = track.title,
                                    style = MaterialTheme.typography.headlineSmall.copy(
                                        fontSize = 20.sp,
                                        fontWeight = FontWeight.ExtraBold
                                    ),
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis,
                                    color = TextPrimary,
                                    modifier = Modifier.basicMarquee()
                                )
                                Spacer(Modifier.height(2.dp))
                                Text(
                                    text = track.artist,
                                    style = MaterialTheme.typography.bodyMedium.copy(
                                        color = TextSecondary,
                                        fontSize = 14.sp
                                    ),
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis,
                                    modifier = Modifier.clickable {
                                        onDismiss()
                                        onArtistClick(track.artist)
                                    }
                                )
                            }

                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(2.dp)
                            ) {
                                // Like / Favorite
                                IconButton(
                                    onClick = { playerViewModel.toggleLike(track) },
                                    modifier = Modifier.size(38.dp)
                                ) {
                                    Icon(
                                        imageVector = if (isLiked) Icons.Default.Favorite else Icons.Default.FavoriteBorder,
                                        contentDescription = "Like",
                                        tint = if (isLiked) CrimsonRed else TextSecondary,
                                        modifier = Modifier.size(24.dp)
                                    )
                                }

                                // Download
                                IconButton(
                                    onClick = {
                                        android.widget.Toast.makeText(context, "Saved \"${track.title}\" for offline playback", android.widget.Toast.LENGTH_SHORT).show()
                                    },
                                    modifier = Modifier.size(38.dp)
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.Download,
                                        contentDescription = "Download",
                                        tint = TextSecondary,
                                        modifier = Modifier.size(22.dp)
                                    )
                                }

                                // 3-Dot Options Menu
                                IconButton(
                                    onClick = { showTrackActions = true },
                                    modifier = Modifier.size(38.dp)
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.MoreVert,
                                        contentDescription = "More Options",
                                        tint = TextSecondary,
                                        modifier = Modifier.size(22.dp)
                                    )
                                }
                            }
                        }

                        Spacer(Modifier.height(4.dp))

                        // 4. Centered Audio Frequency Waveform Visualizer
                        WaveformVisualizerScrubber(
                            progress = progress,
                            isPlaying = uiState.isPlaying,
                            currentPositionMs = currentPosition,
                            durationMs = duration,
                            accentColor = animatedAccentColor,
                            onSeek = { newPositionMs ->
                                playerViewModel.seekTo(newPositionMs)
                            }
                        )

                        Spacer(Modifier.height(6.dp))

                        // 5. Playback Controls Row (Elevated & Symmetrical)
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 4.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            // Shuffle Toggle
                            IconButton(
                                onClick = { playerViewModel.toggleShuffle() },
                                modifier = Modifier.size(42.dp)
                            ) {
                                Icon(
                                    Icons.Default.Shuffle,
                                    contentDescription = "Shuffle",
                                    tint = if (uiState.isShuffle) animatedAccentColor else TextMuted,
                                    modifier = Modifier.size(22.dp)
                                )
                            }

                            // Skip Previous
                            IconButton(
                                onClick = { playerViewModel.playPrevious() },
                                modifier = Modifier.size(46.dp)
                            ) {
                                Icon(
                                    Icons.Default.SkipPrevious,
                                    contentDescription = "Previous",
                                    tint = TextPrimary,
                                    modifier = Modifier.size(34.dp)
                                )
                            }

                            // 66dp Circular White Play/Pause Button
                            Surface(
                                modifier = Modifier
                                    .size(66.dp)
                                    .graphicsLayer {
                                        scaleX = playButtonScale
                                        scaleY = playButtonScale
                                    }
                                    .shadow(elevation = 16.dp, shape = CircleShape, spotColor = Color.White)
                                    .clip(CircleShape)
                                    .clickable { playerViewModel.togglePlayPause() },
                                color = Color.White
                            ) {
                                Box(
                                    modifier = Modifier.fillMaxSize(),
                                    contentAlignment = Alignment.Center
                                ) {
                                    if (uiState.isLoading) {
                                        CircularProgressIndicator(
                                            color = Color.Black,
                                            modifier = Modifier.size(26.dp),
                                            strokeWidth = 3.dp
                                        )
                                    } else {
                                        Icon(
                                            imageVector = if (uiState.isPlaying) Icons.Default.Pause else Icons.Default.PlayArrow,
                                            contentDescription = if (uiState.isPlaying) "Pause" else "Play",
                                            tint = Color.Black,
                                            modifier = Modifier.size(34.dp)
                                        )
                                    }
                                }
                            }

                            // Skip Next
                            IconButton(
                                onClick = { playerViewModel.playNext() },
                                modifier = Modifier.size(46.dp)
                            ) {
                                Icon(
                                    Icons.Default.SkipNext,
                                    contentDescription = "Next",
                                    tint = TextPrimary,
                                    modifier = Modifier.size(34.dp)
                                )
                            }

                            // Repeat / Loop Toggle
                            IconButton(
                                onClick = { playerViewModel.toggleAutoplay() },
                                modifier = Modifier.size(42.dp)
                            ) {
                                Icon(
                                    Icons.Default.Repeat,
                                    contentDescription = "Repeat",
                                    tint = if (uiState.isAutoplay) animatedAccentColor else TextMuted,
                                    modifier = Modifier.size(22.dp)
                                )
                            }
                        }

                        Spacer(Modifier.height(10.dp))

                        // 6. Bottom Docked Action Bar [ 📑 Up Next | 🎵 Lyrics | ✨ Similar ]
                        BottomDockedPill(
                            selectedTab = selectedTab,
                            onSelectTab = { selectedTab = it },
                            onSimilarClick = {
                                android.widget.Toast.makeText(context, "Playing Song Radio for \"${track.title}\"", android.widget.Toast.LENGTH_SHORT).show()
                            }
                        )

                        Spacer(Modifier.height(4.dp))
                    }
                }

                1 -> {
                    // TAB 1: Real-Time Synced Lyrics View
                    val lyricsState by playerViewModel.lyricsState.collectAsState()
                    val lyricsListState = androidx.compose.foundation.lazy.rememberLazyListState()

                    val activeLyricIndex = remember(lyricsState.syncedLines, uiState.positionMs) {
                        if (lyricsState.syncedLines.isEmpty()) -1
                        else {
                            var idx = 0
                            for (i in lyricsState.syncedLines.indices) {
                                if (uiState.positionMs >= lyricsState.syncedLines[i].timeMs - 250) {
                                    idx = i
                                } else {
                                    break
                                }
                            }
                            idx
                        }
                    }

                    LaunchedEffect(activeLyricIndex) {
                        if (activeLyricIndex >= 0 && !lyricsListState.isScrollInProgress) {
                            try {
                                lyricsListState.animateScrollToItem(
                                    index = (activeLyricIndex - 2).coerceAtLeast(0)
                                )
                            } catch (_: Exception) {}
                        }
                    }

                    Column(
                        modifier = Modifier
                            .weight(1f)
                            .fillMaxWidth()
                    ) {
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .fillMaxWidth(),
                            contentAlignment = Alignment.Center
                        ) {
                            if (lyricsState.isLoading) {
                                Column(
                                    horizontalAlignment = Alignment.CenterHorizontally,
                                    verticalArrangement = Arrangement.spacedBy(12.dp)
                                ) {
                                    CircularProgressIndicator(color = CrimsonRed)
                                    Text(
                                        text = "Finding real-time synced lyrics...",
                                        style = MaterialTheme.typography.bodyMedium,
                                        color = TextSecondary
                                    )
                                }
                            } else if (lyricsState.syncedLines.isNotEmpty()) {
                                LazyColumn(
                                    state = lyricsListState,
                                    modifier = Modifier.fillMaxSize(),
                                    contentPadding = PaddingValues(top = 40.dp, bottom = 40.dp, start = 16.dp, end = 16.dp),
                                    horizontalAlignment = Alignment.CenterHorizontally,
                                    verticalArrangement = Arrangement.spacedBy(18.dp)
                                ) {
                                    itemsIndexed(lyricsState.syncedLines) { idx, line ->
                                        val isActive = idx == activeLyricIndex
                                        val isPast = idx < activeLyricIndex

                                        Text(
                                            text = line.text,
                                            style = if (isActive) {
                                                MaterialTheme.typography.titleLarge.copy(
                                                    fontSize = 22.sp,
                                                    fontWeight = FontWeight.Black
                                                )
                                            } else {
                                                MaterialTheme.typography.titleMedium.copy(
                                                    fontSize = 17.sp,
                                                    fontWeight = FontWeight.SemiBold
                                                )
                                            },
                                            color = if (isActive) {
                                                Color.White
                                            } else if (isPast) {
                                                TextSecondary.copy(alpha = 0.6f)
                                            } else {
                                                TextMuted.copy(alpha = 0.4f)
                                            },
                                            textAlign = TextAlign.Center,
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .clip(RoundedCornerShape(8.dp))
                                                .clickable {
                                                    playerViewModel.seekToLyric(line.timeMs)
                                                }
                                                .padding(vertical = 3.dp, horizontal = 8.dp)
                                        )
                                    }
                                }
                            } else if (!lyricsState.plainLyrics.isNullOrBlank()) {
                                LazyColumn(
                                    modifier = Modifier.fillMaxSize(),
                                    contentPadding = PaddingValues(vertical = 20.dp, horizontal = 18.dp),
                                    horizontalAlignment = Alignment.CenterHorizontally
                                ) {
                                    item {
                                        Text(
                                            text = lyricsState.plainLyrics!!,
                                            style = MaterialTheme.typography.bodyLarge.copy(
                                                fontSize = 16.sp,
                                                fontWeight = FontWeight.Medium,
                                                lineHeight = 26.sp
                                            ),
                                            color = TextPrimary,
                                            textAlign = TextAlign.Center
                                        )
                                    }
                                }
                            } else {
                                Column(
                                    horizontalAlignment = Alignment.CenterHorizontally,
                                    verticalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    Icon(
                                        Icons.Default.Lyrics,
                                        contentDescription = null,
                                        tint = TextMuted,
                                        modifier = Modifier.size(44.dp)
                                    )
                                    Text(
                                        text = "Lyrics not available for this track",
                                        style = MaterialTheme.typography.titleMedium,
                                        color = TextPrimary
                                    )
                                    Text(
                                        text = "Enjoy the High-Definition audio stream",
                                        style = MaterialTheme.typography.bodyMedium,
                                        color = TextSecondary
                                    )
                                }
                            }
                        }

                        Spacer(Modifier.height(8.dp))

                        BottomDockedPill(
                            selectedTab = selectedTab,
                            onSelectTab = { selectedTab = it },
                            onSimilarClick = {
                                android.widget.Toast.makeText(context, "Playing Song Radio for \"${track.title}\"", android.widget.Toast.LENGTH_SHORT).show()
                            }
                        )

                        Spacer(Modifier.height(4.dp))
                    }
                }

                2 -> {
                    // TAB 2: Interactive Up Next Queue
                    Column(
                        modifier = Modifier
                            .weight(1f)
                            .fillMaxWidth()
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 6.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(
                                text = "Queue (${uiState.queue.size} songs)",
                                style = MaterialTheme.typography.titleLarge.copy(fontSize = 18.sp, fontWeight = FontWeight.Bold),
                                color = TextPrimary
                            )

                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(4.dp)
                            ) {
                                if (uiState.queue.size > 1) {
                                    TextButton(
                                        onClick = { playerViewModel.clearQueue() },
                                        contentPadding = PaddingValues(horizontal = 8.dp, vertical = 2.dp)
                                    ) {
                                        Text("Clear", color = CrimsonRed, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                                    }
                                }

                                IconButton(
                                    onClick = { playerViewModel.toggleShuffle() },
                                    modifier = Modifier.size(34.dp)
                                ) {
                                    Icon(
                                        Icons.Default.Shuffle,
                                        contentDescription = "Shuffle Queue",
                                        tint = if (uiState.isShuffle) CrimsonRed else TextSecondary,
                                        modifier = Modifier.size(19.dp)
                                    )
                                }
                            }
                        }

                        if (uiState.queue.isEmpty()) {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .weight(1f),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = "Queue is empty",
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = TextMuted
                                )
                            }
                        } else {
                            LazyColumn(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .weight(1f),
                                verticalArrangement = Arrangement.spacedBy(6.dp),
                                contentPadding = PaddingValues(bottom = 16.dp)
                            ) {
                                itemsIndexed(uiState.queue, key = { index, item -> "${item.id}_$index" }) { index, queueTrack ->
                                    val isCurrent = index == uiState.currentIndex || (queueTrack.id == track.id && index == uiState.currentIndex)
                                    Surface(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .clip(RoundedCornerShape(12.dp))
                                            .clickable { playerViewModel.playTrackAtIndex(index) },
                                        color = if (isCurrent) animatedAccentColor.copy(alpha = 0.18f) else Color(0xFF16161E),
                                        shape = RoundedCornerShape(12.dp),
                                        border = if (isCurrent) androidx.compose.foundation.BorderStroke(1.dp, animatedAccentColor.copy(alpha = 0.6f)) else androidx.compose.foundation.BorderStroke(0.5.dp, SurfaceBorder.copy(alpha = 0.3f))
                                    ) {
                                        Row(
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .padding(horizontal = 10.dp, vertical = 7.dp),
                                            verticalAlignment = Alignment.CenterVertically,
                                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                                        ) {
                                            AsyncImage(
                                                model = queueTrack.thumbnail,
                                                contentDescription = queueTrack.title,
                                                modifier = Modifier
                                                    .size(42.dp)
                                                    .clip(RoundedCornerShape(8.dp)),
                                                contentScale = ContentScale.Crop
                                            )

                                            Column(modifier = Modifier.weight(1f)) {
                                                Text(
                                                    text = queueTrack.title,
                                                    style = MaterialTheme.typography.titleMedium.copy(
                                                        fontSize = 13.sp,
                                                        fontWeight = if (isCurrent) FontWeight.Bold else FontWeight.Medium
                                                    ),
                                                    color = if (isCurrent) animatedAccentColor else TextPrimary,
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

                                            // Reorder & Delete Actions
                                            Row(
                                                verticalAlignment = Alignment.CenterVertically,
                                                horizontalArrangement = Arrangement.spacedBy(2.dp)
                                            ) {
                                                if (index > 0) {
                                                    IconButton(
                                                        onClick = { playerViewModel.reorderQueue(index, index - 1) },
                                                        modifier = Modifier.size(28.dp)
                                                    ) {
                                                        Icon(
                                                            Icons.Default.KeyboardArrowUp,
                                                            contentDescription = "Move Up",
                                                            tint = TextSecondary,
                                                            modifier = Modifier.size(18.dp)
                                                        )
                                                    }
                                                }

                                                if (index < uiState.queue.size - 1) {
                                                    IconButton(
                                                        onClick = { playerViewModel.reorderQueue(index, index + 1) },
                                                        modifier = Modifier.size(28.dp)
                                                    ) {
                                                        Icon(
                                                            Icons.Default.KeyboardArrowDown,
                                                            contentDescription = "Move Down",
                                                            tint = TextSecondary,
                                                            modifier = Modifier.size(18.dp)
                                                        )
                                                    }
                                                }

                                                IconButton(
                                                    onClick = { playerViewModel.removeTrackFromQueue(index) },
                                                    modifier = Modifier.size(28.dp)
                                                ) {
                                                    Icon(
                                                        Icons.Default.Close,
                                                        contentDescription = "Remove from Queue",
                                                        tint = TextMuted,
                                                        modifier = Modifier.size(15.dp)
                                                    )
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }

                        Spacer(Modifier.height(8.dp))

                        BottomDockedPill(
                            selectedTab = selectedTab,
                            onSelectTab = { selectedTab = it },
                            onSimilarClick = {
                                android.widget.Toast.makeText(context, "Playing Song Radio for \"${track.title}\"", android.widget.Toast.LENGTH_SHORT).show()
                            }
                        )

                        Spacer(Modifier.height(4.dp))
                    }
                }
            }
        }
    }

    // Modal Bottom Sheets
    if (showEqualizer) {
        EqualizerSheet(
            equalizerState = equalizerState,
            accentColor = animatedAccentColor,
            onEnabledChange = { playerViewModel.setEqualizerEnabled(it) },
            onPresetSelect = { playerViewModel.setEqualizerPreset(it) },
            onBandGainChange = { band, gain -> playerViewModel.setEqualizerBandGain(band, gain) },
            onBassBoostChange = { playerViewModel.setBassBoost(it) },
            onVirtualizerChange = { playerViewModel.setVirtualizer(it) },
            onReset = { playerViewModel.resetEqualizer() },
            onDismiss = { showEqualizer = false }
        )
    }

    if (showTrackActions) {
        TrackActionSheet(
            track = track,
            playerViewModel = playerViewModel,
            playlistViewModel = playlistViewModel,
            onDismiss = { showTrackActions = false },
            onArtistClick = onArtistClick
        )
    }

    if (showSleepTimer) {
        SleepTimerSheet(
            playerViewModel = playerViewModel,
            onDismiss = { showSleepTimer = false }
        )
    }
}

@Composable
fun BottomDockedPill(
    selectedTab: Int,
    onSelectTab: (Int) -> Unit,
    onSimilarClick: () -> Unit
) {
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(22.dp)),
        color = SurfaceDark.copy(alpha = 0.95f),
        shape = RoundedCornerShape(22.dp),
        border = BorderStroke(1.dp, SurfaceBorder.copy(alpha = 0.5f))
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 6.dp, horizontal = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceEvenly
        ) {
            // Up Next
            val isUpNextActive = selectedTab == 2
            Row(
                modifier = Modifier
                    .clip(RoundedCornerShape(16.dp))
                    .clickable { onSelectTab(if (isUpNextActive) 0 else 2) }
                    .padding(horizontal = 10.dp, vertical = 5.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(5.dp)
            ) {
                Icon(
                    Icons.AutoMirrored.Filled.QueueMusic,
                    contentDescription = "Up Next",
                    tint = if (isUpNextActive) CrimsonRed else TextSecondary,
                    modifier = Modifier.size(17.dp)
                )
                Text(
                    text = "Up Next",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = if (isUpNextActive) CrimsonRed else TextSecondary
                )
            }

            Box(
                modifier = Modifier
                    .width(1.dp)
                    .height(16.dp)
                    .background(SurfaceBorder.copy(alpha = 0.5f))
            )

            // Lyrics
            val isLyricsActive = selectedTab == 1
            Row(
                modifier = Modifier
                    .clip(RoundedCornerShape(16.dp))
                    .clickable { onSelectTab(if (isLyricsActive) 0 else 1) }
                    .padding(horizontal = 10.dp, vertical = 5.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(5.dp)
            ) {
                Icon(
                    Icons.Default.GraphicEq,
                    contentDescription = "Lyrics",
                    tint = if (isLyricsActive) CrimsonRed else TextSecondary,
                    modifier = Modifier.size(17.dp)
                )
                Text(
                    text = "Lyrics",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = if (isLyricsActive) CrimsonRed else TextSecondary
                )
            }

            Box(
                modifier = Modifier
                    .width(1.dp)
                    .height(16.dp)
                    .background(SurfaceBorder.copy(alpha = 0.5f))
            )

            // Similar / Radio
            Row(
                modifier = Modifier
                    .clip(RoundedCornerShape(16.dp))
                    .clickable(onClick = onSimilarClick),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(5.dp)
            ) {
                Icon(
                    Icons.Default.AutoAwesome,
                    contentDescription = "Similar",
                    tint = TextSecondary,
                    modifier = Modifier.size(16.dp)
                )
                Text(
                    text = "Similar",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = TextSecondary
                )
            }
        }
    }
}

@Composable
fun WaveformVisualizerScrubber(
    progress: Float,
    isPlaying: Boolean,
    currentPositionMs: Long,
    durationMs: Long,
    accentColor: Color,
    onSeek: (Long) -> Unit
) {
    val infiniteTransition = rememberInfiniteTransition(label = "waveformTransition")
    val waveAnimPhase by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = 6.283f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 1400, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "waveAnimPhase"
    )

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 6.dp)
    ) {
        Canvas(
            modifier = Modifier
                .fillMaxWidth()
                .height(36.dp)
                .pointerInput(durationMs) {
                    detectTapGestures { offset ->
                        val ratio = (offset.x / size.width).coerceIn(0f, 1f)
                        val targetMs = (ratio * durationMs).toLong()
                        onSeek(targetMs)
                    }
                }
                .pointerInput(durationMs) {
                    detectDragGestures { change, _ ->
                        change.consume()
                        val ratio = (change.position.x / size.width).coerceIn(0f, 1f)
                        val targetMs = (ratio * durationMs).toLong()
                        onSeek(targetMs)
                    }
                }
        ) {
            val canvasWidth = size.width
            val canvasHeight = size.height
            val barCount = 44
            val barSpacing = canvasWidth / barCount
            val barWidth = barSpacing * 0.55f

            for (i in 0 until barCount) {
                val x = i * barSpacing + (barSpacing - barWidth) / 2f
                val fraction = i.toFloat() / barCount.toFloat()
                val isPast = fraction <= progress

                val baseHeightFactor = (sin(i * 0.45f) * 0.35f + cos(i * 0.25f) * 0.45f + 0.5f).coerceIn(0.2f, 1.0f)
                val dynamicBounce = if (isPlaying && isPast) {
                    (sin(waveAnimPhase + i * 0.4f) * 0.22f)
                } else 0f

                val finalHeight = ((baseHeightFactor + dynamicBounce).coerceIn(0.18f, 1.0f)) * (canvasHeight - 6.dp.toPx())
                val topY = (canvasHeight - finalHeight) / 2f

                val barColor = if (isPast) accentColor else Color.White.copy(alpha = 0.22f)

                drawRoundRect(
                    color = barColor,
                    topLeft = Offset(x, topY),
                    size = Size(barWidth, finalHeight),
                    cornerRadius = androidx.compose.ui.geometry.CornerRadius(4.dp.toPx(), 4.dp.toPx())
                )
            }

            // Current progress glowing indicator circle
            val scrubberX = progress * canvasWidth
            drawCircle(
                color = Color.White,
                radius = 5.dp.toPx(),
                center = Offset(scrubberX, canvasHeight / 2f)
            )
            drawCircle(
                color = accentColor,
                radius = 3.dp.toPx(),
                center = Offset(scrubberX, canvasHeight / 2f)
            )
        }

        Spacer(Modifier.height(2.dp))

        // Timestamp row: 0:37 / 3:08
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text(
                text = formatDuration(currentPositionMs),
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold,
                color = TextSecondary
            )
            Text(
                text = formatDuration(durationMs),
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold,
                color = TextSecondary
            )
        }
    }
}

private fun formatDuration(millis: Long): String {
    val totalSeconds = (millis / 1000).coerceAtLeast(0)
    val minutes = totalSeconds / 60
    val seconds = totalSeconds % 60
    return String.format("%d:%02d", minutes, seconds)
}
