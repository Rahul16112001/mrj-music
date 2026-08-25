package com.mrj.music.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Shuffle
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
import com.mrj.music.ui.viewmodel.ArtistViewModel
import com.mrj.music.ui.viewmodel.PlayerViewModel

@Composable
fun ArtistScreen(
    artistName: String,
    artistViewModel: ArtistViewModel,
    playerViewModel: PlayerViewModel,
    onBack: () -> Unit,
    onArtistClick: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    val uiState by artistViewModel.uiState.collectAsState()

    LaunchedEffect(artistName) {
        artistViewModel.loadArtist(artistName)
    }

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(DeepDarkBg)
    ) {
        if (uiState.isLoading) {
            Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator(color = CrimsonRed)
            }
        } else {
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(bottom = 120.dp)
            ) {
                // 1. Hero Artwork & Artist Header
                item {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(320.dp)
                    ) {
                        AsyncImage(
                            model = uiState.banner.ifBlank { uiState.image },
                            contentDescription = uiState.name,
                            modifier = Modifier.fillMaxSize(),
                            contentScale = ContentScale.Crop
                        )

                        // Gradient Fade Overlays
                        Box(
                            modifier = Modifier
                                .fillMaxSize()
                                .background(
                                    Brush.verticalGradient(
                                        colors = listOf(
                                            Color.Black.copy(alpha = 0.4f),
                                            Color.Transparent,
                                            DeepDarkBg.copy(alpha = 0.8f),
                                            DeepDarkBg
                                        )
                                    )
                                )
                        )

                        // Artist Name & Listener Stats at bottom of Hero
                        Column(
                            modifier = Modifier
                                .align(Alignment.BottomStart)
                                .padding(horizontal = 20.dp, vertical = 12.dp)
                        ) {
                            Text(
                                text = uiState.name,
                                style = MaterialTheme.typography.headlineLarge.copy(
                                    fontSize = 28.sp,
                                    fontWeight = FontWeight.Black
                                ),
                                color = Color.White
                            )

                            if (uiState.genres.isNotEmpty() || uiState.monthlyListeners.isNotBlank()) {
                                Spacer(Modifier.height(4.dp))
                                Row(
                                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    if (uiState.monthlyListeners.isNotBlank()) {
                                        Text(
                                            text = uiState.monthlyListeners,
                                            style = MaterialTheme.typography.bodySmall,
                                            color = TextSecondary
                                        )
                                    }
                                    if (uiState.genres.isNotEmpty()) {
                                        Text(
                                            text = "• ${uiState.genres.take(2).joinToString(", ")}",
                                            style = MaterialTheme.typography.bodySmall,
                                            color = CrimsonRed
                                        )
                                    }
                                }
                            }
                        }
                    }
                }

                // 2. Play & Action Controls Row
                item {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 20.dp, vertical = 12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        // Big Play Button
                        Surface(
                            modifier = Modifier
                                .size(52.dp)
                                .clip(CircleShape)
                                .clickable {
                                    if (uiState.topTracks.isNotEmpty()) {
                                        playerViewModel.playTrack(uiState.topTracks.first(), uiState.topTracks)
                                    }
                                },
                            color = CrimsonRed
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                Icon(
                                    imageVector = Icons.Default.PlayArrow,
                                    contentDescription = "Play Artist",
                                    tint = Color.White,
                                    modifier = Modifier.size(32.dp)
                                )
                            }
                        }

                        // Shuffle Button
                        Surface(
                            modifier = Modifier
                                .size(44.dp)
                                .clip(CircleShape)
                                .clickable {
                                    if (uiState.topTracks.isNotEmpty()) {
                                        val shuffled = uiState.topTracks.shuffled()
                                        playerViewModel.playTrack(shuffled.first(), shuffled)
                                    }
                                },
                            color = SurfaceDark
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                Icon(
                                    imageVector = Icons.Default.Shuffle,
                                    contentDescription = "Shuffle Artist",
                                    tint = TextPrimary,
                                    modifier = Modifier.size(22.dp)
                                )
                            }
                        }
                    }
                }

                // 3. Top Tracks Section
                if (uiState.topTracks.isNotEmpty()) {
                    item {
                        Text(
                            text = "Popular Songs",
                            style = MaterialTheme.typography.titleLarge,
                            modifier = Modifier.padding(horizontal = 20.dp, vertical = 8.dp)
                        )
                    }

                    itemsIndexed(uiState.topTracks) { index, track ->
                        Surface(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 20.dp, vertical = 4.dp)
                                .clip(RoundedCornerShape(12.dp))
                                .clickable { playerViewModel.playTrack(track, uiState.topTracks) },
                            color = SurfaceDark
                        ) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(10.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(12.dp)
                            ) {
                                // Track Rank Number
                                Text(
                                    text = "${index + 1}",
                                    style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                                    color = if (index < 3) CrimsonRed else TextMuted,
                                    modifier = Modifier.width(20.dp),
                                    textAlign = TextAlign.Center
                                )

                                AsyncImage(
                                    model = track.thumbnail,
                                    contentDescription = track.title,
                                    modifier = Modifier
                                        .size(48.dp)
                                        .clip(RoundedCornerShape(8.dp)),
                                    contentScale = ContentScale.Crop
                                )

                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        text = track.title,
                                        style = MaterialTheme.typography.titleMedium.copy(fontSize = 14.sp),
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis,
                                        color = TextPrimary
                                    )
                                    Text(
                                        text = track.album ?: track.artist,
                                        style = MaterialTheme.typography.bodyMedium.copy(fontSize = 12.sp),
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis,
                                        color = TextSecondary
                                    )
                                }

                                Icon(
                                    imageVector = Icons.Default.PlayArrow,
                                    contentDescription = "Play",
                                    tint = TextMuted,
                                    modifier = Modifier.size(20.dp)
                                )
                            }
                        }
                    }
                }

                // 4. Albums & Singles Section
                if (uiState.albums.isNotEmpty()) {
                    item {
                        Text(
                            text = "Albums & Singles",
                            style = MaterialTheme.typography.titleLarge,
                            modifier = Modifier.padding(start = 20.dp, end = 20.dp, top = 20.dp, bottom = 8.dp)
                        )
                    }

                    item {
                        LazyRow(
                            contentPadding = PaddingValues(horizontal = 20.dp),
                            horizontalArrangement = Arrangement.spacedBy(14.dp)
                        ) {
                            items(uiState.albums) { album ->
                                Column(
                                    modifier = Modifier
                                        .width(130.dp)
                                        .clip(RoundedCornerShape(12.dp))
                                        .clickable {
                                            val albumTrack = NativeTrack(
                                                id = album.id.ifBlank { "album_${album.title}" },
                                                title = album.title,
                                                artist = album.artist,
                                                album = album.title,
                                                thumbnail = album.thumbnail
                                            )
                                            playerViewModel.playTrack(albumTrack)
                                        }
                                ) {
                                    AsyncImage(
                                        model = album.thumbnail,
                                        contentDescription = album.title,
                                        modifier = Modifier
                                            .size(130.dp)
                                            .clip(RoundedCornerShape(12.dp)),
                                        contentScale = ContentScale.Crop
                                    )
                                    Spacer(Modifier.height(6.dp))
                                    Text(
                                        text = album.title,
                                        style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Bold),
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis,
                                        color = TextPrimary
                                    )
                                    Text(
                                        text = "${album.year ?: "2026"} • Album",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = TextSecondary
                                    )
                                }
                            }
                        }
                    }
                }

                // 5. Fans Also Like / Related Artists
                if (uiState.relatedArtists.isNotEmpty()) {
                    item {
                        Text(
                            text = "Fans Also Like",
                            style = MaterialTheme.typography.titleLarge,
                            modifier = Modifier.padding(start = 20.dp, end = 20.dp, top = 24.dp, bottom = 12.dp)
                        )
                    }

                    item {
                        LazyRow(
                            contentPadding = PaddingValues(horizontal = 20.dp),
                            horizontalArrangement = Arrangement.spacedBy(16.dp)
                        ) {
                            items(uiState.relatedArtists) { rel ->
                                Column(
                                    horizontalAlignment = Alignment.CenterHorizontally,
                                    modifier = Modifier
                                        .width(96.dp)
                                        .clickable { onArtistClick(rel.name) }
                                ) {
                                    AsyncImage(
                                        model = rel.thumbnail,
                                        contentDescription = rel.name,
                                        modifier = Modifier
                                            .size(86.dp)
                                            .clip(CircleShape),
                                        contentScale = ContentScale.Crop
                                    )
                                    Spacer(Modifier.height(6.dp))
                                    Text(
                                        text = rel.name,
                                        style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Medium),
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis,
                                        textAlign = TextAlign.Center,
                                        color = TextPrimary
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }

        // Top Floating Back Button
        Surface(
            modifier = Modifier
                .statusBarsPadding()
                .padding(16.dp)
                .size(40.dp)
                .clip(CircleShape)
                .clickable { onBack() },
            color = Color.Black.copy(alpha = 0.6f)
        ) {
            Box(contentAlignment = Alignment.Center) {
                Icon(
                    imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                    contentDescription = "Back",
                    tint = Color.White,
                    modifier = Modifier.size(22.dp)
                )
            }
        }
    }
}
