package com.mrj.music.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Autorenew
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.mrj.music.R
import com.mrj.music.model.NativeTrack
import com.mrj.music.ui.theme.*
import com.mrj.music.ui.viewmodel.HomeViewModel
import com.mrj.music.ui.viewmodel.PlayerViewModel

@Composable
fun HomeScreen(
    homeViewModel: HomeViewModel,
    playerViewModel: PlayerViewModel,
    modifier: Modifier = Modifier
) {
    val uiState by homeViewModel.uiState.collectAsState()

    LazyColumn(
        modifier = modifier
            .fillMaxSize()
            .background(DeepDarkBg),
        contentPadding = PaddingValues(bottom = 120.dp)
    ) {
        // 1. Top Header with MRJ Logo & Greeting (with safe status bar padding)
        item {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .statusBarsPadding()
                    .padding(horizontal = 20.dp, vertical = 12.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    androidx.compose.foundation.Image(
                        painter = painterResource(id = R.drawable.mrj_logo),
                        contentDescription = "MRJ Music",
                        modifier = Modifier
                            .size(38.dp)
                            .clip(CircleShape)
                    )
                    Column {
                        Text(
                            text = uiState.greeting,
                            style = MaterialTheme.typography.titleMedium.copy(color = TextSecondary, fontSize = 13.sp)
                        )
                        Text(
                            text = uiState.userName,
                            style = MaterialTheme.typography.headlineMedium.copy(fontSize = 20.sp)
                        )
                    }
                }
            }
        }

        // Loading or Error State
        if (uiState.isLoading) {
            item {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(200.dp),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator(color = CrimsonRed)
                }
            }
        } else if (uiState.errorMessage != null) {
            item {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Text(
                        text = uiState.errorMessage!!,
                        color = TextSecondary,
                        style = MaterialTheme.typography.bodyLarge
                    )
                    Button(
                        onClick = { homeViewModel.loadHomeData() },
                        colors = ButtonDefaults.buttonColors(containerColor = CrimsonRed)
                    ) {
                        Icon(Icons.Default.Refresh, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(Modifier.width(8.dp))
                        Text("Retry")
                    }
                }
            }
        } else {
            // 2. Quick Picks Grid (Clean without repetitive Autoplay buttons)
            if (uiState.quickPicks.isNotEmpty()) {
                item {
                    Text(
                        text = "Quick Picks",
                        style = MaterialTheme.typography.titleLarge,
                        modifier = Modifier.padding(horizontal = 20.dp, vertical = 10.dp)
                    )
                }

                item {
                    Column(
                        modifier = Modifier.padding(horizontal = 20.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        uiState.quickPicks.take(6).forEach { track ->
                            QuickPickCard(
                                track = track,
                                onPlay = { playerViewModel.playTrack(track, uiState.quickPicks) }
                            )
                        }
                    }
                }
            }

            // 3. Trending Artists Carousel
            if (uiState.trendingArtists.isNotEmpty()) {
                item {
                    Text(
                        text = "Featured Artists",
                        style = MaterialTheme.typography.titleLarge,
                        modifier = Modifier.padding(start = 20.dp, end = 20.dp, top = 28.dp, bottom = 12.dp)
                    )
                }

                item {
                    LazyRow(
                        contentPadding = PaddingValues(horizontal = 20.dp),
                        horizontalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        items(uiState.trendingArtists) { artist ->
                            val name = artist["name"] as? String ?: ""
                            val image = artist["image"] as? String ?: ""

                            Column(
                                horizontalAlignment = Alignment.CenterHorizontally,
                                modifier = Modifier
                                    .width(96.dp)
                                    .clickable { }
                            ) {
                                AsyncImage(
                                    model = image,
                                    contentDescription = name,
                                    modifier = Modifier
                                        .size(86.dp)
                                        .clip(CircleShape),
                                    contentScale = ContentScale.Crop
                                )
                                Spacer(Modifier.height(8.dp))
                                Text(
                                    text = name,
                                    style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Bold),
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis,
                                    color = TextPrimary
                                )
                            }
                        }
                    }
                }
            }

            // 4. Recommended For You
            if (uiState.recommended.isNotEmpty()) {
                item {
                    Text(
                        text = "Recommended For You",
                        style = MaterialTheme.typography.titleLarge,
                        modifier = Modifier.padding(start = 20.dp, end = 20.dp, top = 28.dp, bottom = 12.dp)
                    )
                }

                item {
                    LazyRow(
                        contentPadding = PaddingValues(horizontal = 20.dp),
                        horizontalArrangement = Arrangement.spacedBy(14.dp)
                    ) {
                        items(uiState.recommended) { track ->
                            RecommendedTrackCard(
                                track = track,
                                onPlay = { playerViewModel.playTrack(track, uiState.recommended) }
                            )
                        }
                    }
                }
            }

            // 5. Moods & Genres Exploration
            item {
                Text(
                    text = "Explore Vibes & Genres",
                    style = MaterialTheme.typography.titleLarge,
                    modifier = Modifier.padding(start = 20.dp, end = 20.dp, top = 28.dp, bottom = 12.dp)
                )
            }

            item {
                val genres = listOf(
                    "Bollywood Hits" to Brush.horizontalGradient(listOf(Color(0xFF831843), Color(0xFFBE185D))),
                    "Punjabi Beats" to Brush.horizontalGradient(listOf(Color(0xFF7C2D12), Color(0xFFC2410C))),
                    "Bhojpuri Tadka" to Brush.horizontalGradient(listOf(Color(0xFF701A75), Color(0xFFA21CAF))),
                    "Haryanvi Ragni" to Brush.horizontalGradient(listOf(Color(0xFF1E3A8A), Color(0xFF2563EB))),
                    "Lo-Fi Chill" to Brush.horizontalGradient(listOf(Color(0xFF134E4A), Color(0xFF0F766E))),
                    "Global Pop" to Brush.horizontalGradient(listOf(Color(0xFF4C1D95), Color(0xFF7C3AED)))
                )

                Column(
                    modifier = Modifier.padding(horizontal = 20.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    genres.chunked(2).forEach { row ->
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            row.forEach { (genreTitle, gradient) ->
                                Box(
                                    modifier = Modifier
                                        .weight(1f)
                                        .height(72.dp)
                                        .clip(RoundedCornerShape(16.dp))
                                        .background(gradient)
                                        .clickable { }
                                        .padding(14.dp),
                                    contentAlignment = Alignment.CenterStart
                                ) {
                                    Text(
                                        text = genreTitle,
                                        style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Black),
                                        color = Color.White
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

@Composable
fun QuickPickCard(
    track: NativeTrack,
    onPlay: () -> Unit
) {
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .clickable { onPlay() },
        color = SurfaceDark,
        tonalElevation = 2.dp
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
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
                    text = track.artist,
                    style = MaterialTheme.typography.bodyMedium,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    color = TextSecondary
                )
            }

            IconButton(
                onClick = onPlay,
                modifier = Modifier.size(36.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.PlayArrow,
                    contentDescription = "Play",
                    tint = CrimsonRed,
                    modifier = Modifier.size(24.dp)
                )
            }
        }
    }
}

@Composable
fun RecommendedTrackCard(track: NativeTrack, onPlay: () -> Unit) {
    Column(
        modifier = Modifier
            .width(140.dp)
            .clip(RoundedCornerShape(14.dp))
            .clickable { onPlay() }
    ) {
        AsyncImage(
            model = track.thumbnail,
            contentDescription = track.title,
            modifier = Modifier
                .size(140.dp)
                .clip(RoundedCornerShape(14.dp)),
            contentScale = ContentScale.Crop
        )
        Spacer(Modifier.height(8.dp))
        Text(
            text = track.title,
            style = MaterialTheme.typography.titleMedium.copy(fontSize = 13.sp),
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            color = TextPrimary
        )
        Text(
            text = track.artist,
            style = MaterialTheme.typography.bodyMedium.copy(fontSize = 11.sp),
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            color = TextSecondary
        )
    }
}
