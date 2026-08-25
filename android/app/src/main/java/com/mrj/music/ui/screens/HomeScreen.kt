package com.mrj.music.ui.screens

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.tween
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
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.material3.pulltorefresh.PullToRefreshContainer
import androidx.compose.material3.pulltorefresh.rememberPullToRefreshState
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.mrj.music.model.NativeTrack
import com.mrj.music.ui.theme.*
import com.mrj.music.ui.viewmodel.DailyMixItem
import com.mrj.music.ui.viewmodel.HomeViewModel
import com.mrj.music.ui.viewmodel.PlaylistCardItem
import com.mrj.music.ui.viewmodel.PlayerViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    homeViewModel: HomeViewModel,
    playerViewModel: PlayerViewModel,
    onArtistClick: (String) -> Unit = {},
    onStationClick: (String, String, String) -> Unit = { _, _, _ -> },
    modifier: Modifier = Modifier
) {
    val uiState by homeViewModel.uiState.collectAsState()
    var selectedTrackForActions by remember { mutableStateOf<NativeTrack?>(null) }
    var showProfileSheet by remember { mutableStateOf(false) }

    // Dynamic Circadian & Mood Adapting Colors with smooth transitions
    val animatedPrimaryMood by animateColorAsState(
        targetValue = Color(uiState.circadianMood.primaryColorHex),
        animationSpec = tween(durationMillis = 800),
        label = "PrimaryMoodAnim"
    )
    val animatedSecondaryMood by animateColorAsState(
        targetValue = Color(uiState.circadianMood.secondaryColorHex),
        animationSpec = tween(durationMillis = 800),
        label = "SecondaryMoodAnim"
    )

    // Pull to Refresh State
    val pullRefreshState = rememberPullToRefreshState()
    if (pullRefreshState.isRefreshing) {
        LaunchedEffect(true) {
            homeViewModel.refreshDashboard()
        }
    }
    LaunchedEffect(uiState.isRefreshing) {
        if (!uiState.isRefreshing) {
            pullRefreshState.endRefresh()
        }
    }

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(DeepDarkBg)
            .nestedScroll(pullRefreshState.nestedScrollConnection)
    ) {
        // Dynamic Ambient Mood Glow (Adapts to circadian phase & mood filter)
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(380.dp)
                .background(
                    Brush.verticalGradient(
                        listOf(
                            animatedPrimaryMood.copy(alpha = 0.28f),
                            animatedSecondaryMood.copy(alpha = 0.12f),
                            Color.Transparent
                        )
                    )
                )
        )

        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(bottom = 120.dp)
        ) {
            // 1. Top Header Row: 0 Extra Gap (Right Underneath Status Bar Time/Battery)
            item {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .statusBarsPadding()
                        .padding(start = 16.dp, end = 16.dp, top = 2.dp, bottom = 4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    // Glowing Profile Avatar Button
                    Surface(
                        onClick = { showProfileSheet = true },
                        modifier = Modifier
                            .size(38.dp)
                            .clip(CircleShape),
                        color = SurfaceDark,
                        shape = CircleShape,
                        border = BorderStroke(1.5.dp, animatedPrimaryMood.copy(alpha = 0.85f))
                    ) {
                        if (!uiState.userAvatar.isNullOrBlank()) {
                            AsyncImage(
                                model = uiState.userAvatar,
                                contentDescription = "Profile",
                                modifier = Modifier.fillMaxSize(),
                                contentScale = ContentScale.Crop
                            )
                        } else {
                            val initial = uiState.userName.take(1).uppercase().ifBlank { "M" }
                            Box(
                                modifier = Modifier
                                    .fillMaxSize()
                                    .background(
                                        Brush.linearGradient(
                                            listOf(animatedPrimaryMood, animatedSecondaryMood)
                                        )
                                    ),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = initial,
                                    color = Color.White,
                                    fontWeight = FontWeight.Black,
                                    fontSize = 15.sp
                                )
                            }
                        }
                    }

                    // Category Filter Pills (Music, Podcasts, Energize, Relax)
                    val filters = listOf("Music", "Podcasts", "Energize", "Relax")
                    LazyRow(
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        items(filters) { filter ->
                            val isSelected = uiState.selectedFilter == filter
                            Surface(
                                onClick = { homeViewModel.selectFilter(filter) },
                                shape = RoundedCornerShape(20.dp),
                                color = if (isSelected) SurfaceElevated else SurfaceDark.copy(alpha = 0.7f),
                                border = BorderStroke(
                                    1.dp,
                                    if (isSelected) animatedPrimaryMood.copy(alpha = 0.8f) else SurfaceBorder.copy(alpha = 0.5f)
                                )
                            ) {
                                Text(
                                    text = filter,
                                    color = if (isSelected) Color.White else TextSecondary,
                                    fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                                    fontSize = 13.sp,
                                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 6.dp)
                                )
                            }
                        }
                    }
                }
            }

            // 2. "Let's Get Started" / Circadian Greeting Section
            item {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(start = 16.dp, end = 16.dp, top = 10.dp, bottom = 4.dp)
                ) {
                    Text(
                        text = if (uiState.userName != "Listener") "Let's Get Started" else uiState.greeting,
                        style = MaterialTheme.typography.headlineMedium.copy(
                            fontSize = 24.sp,
                            fontWeight = FontWeight.Black
                        ),
                        color = TextPrimary
                    )
                    Text(
                        text = "Top picks based on your favourites • ${uiState.circadianMood.targetVibe}",
                        style = MaterialTheme.typography.bodyMedium.copy(
                            fontSize = 13.sp,
                            color = TextSecondary
                        )
                    )
                }
            }

            // Daily Mixes (Top Picks Cards)
            if (uiState.featuredThisWeek.isNotEmpty()) {
                item {
                    LazyRow(
                        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                        horizontalArrangement = Arrangement.spacedBy(14.dp)
                    ) {
                        items(uiState.featuredThisWeek) { mix ->
                            DailyMixCard(
                                mix = mix,
                                onPlay = {
                                    if (mix.tracks.isNotEmpty()) {
                                        playerViewModel.playTrack(mix.tracks.first(), mix.tracks)
                                    }
                                }
                            )
                        }
                    }
                }
            }

            // 3. "Songs for You" (3-Row Multi-Column Swipable Matrix)
            if (uiState.basedOnRecents.isNotEmpty()) {
                item {
                    SectionHeader(title = "Songs for You")
                }
                item {
                    val columnChunks = uiState.basedOnRecents.chunked(3)
                    LazyRow(
                        contentPadding = PaddingValues(horizontal = 16.dp),
                        horizontalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        items(columnChunks) { columnTracks ->
                            Column(
                                modifier = Modifier.width(285.dp),
                                verticalArrangement = Arrangement.spacedBy(10.dp)
                            ) {
                                columnTracks.forEach { track ->
                                    SongsForYouRowItem(
                                        track = track,
                                        onPlay = { playerViewModel.playTrack(track, uiState.basedOnRecents) }
                                    )
                                }
                            }
                        }
                    }
                }
            }

            // 4. "Listen Again" Section (Rectangular Layout with Swipe Right)
            if (uiState.trendingSongs.isNotEmpty()) {
                item {
                    Column(
                        modifier = Modifier.padding(start = 16.dp, end = 16.dp, top = 24.dp, bottom = 4.dp)
                    ) {
                        Text(
                            text = "Listen Again",
                            style = MaterialTheme.typography.titleMedium.copy(
                                fontWeight = FontWeight.Bold,
                                fontSize = 18.5.sp
                            ),
                            color = TextPrimary
                        )
                        Text(
                            text = "Frequent and recent rotations",
                            style = MaterialTheme.typography.bodySmall.copy(
                                color = TextSecondary,
                                fontSize = 12.5.sp
                            )
                        )
                    }
                }
                item {
                    LazyRow(
                        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                        horizontalArrangement = Arrangement.spacedBy(14.dp)
                    ) {
                        items(uiState.trendingSongs.take(8)) { track ->
                            ListenAgainCard(
                                track = track,
                                onPlay = { playerViewModel.playTrack(track, uiState.trendingSongs) }
                            )
                        }
                    }
                }
            }

            // 5. 🔥 Trending on Reels & Socials
            if (uiState.popularHindiSongs.isNotEmpty()) {
                item {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                        modifier = Modifier.padding(start = 16.dp, end = 16.dp, top = 22.dp, bottom = 10.dp)
                    ) {
                        Icon(
                            Icons.Default.LocalFireDepartment,
                            contentDescription = null,
                            tint = Color(0xFFFF6D00),
                            modifier = Modifier.size(18.dp)
                        )
                        Text(
                            text = "Trending on Reels & Socials",
                            style = MaterialTheme.typography.titleMedium.copy(
                                fontWeight = FontWeight.Bold,
                                fontSize = 18.5.sp
                            ),
                            color = TextPrimary
                        )
                    }
                }
                item {
                    LazyRow(
                        contentPadding = PaddingValues(horizontal = 16.dp),
                        horizontalArrangement = Arrangement.spacedBy(14.dp)
                    ) {
                        items(uiState.popularHindiSongs.take(8)) { track ->
                            ViralReelCard(
                                track = track,
                                onPlay = { playerViewModel.playTrack(track, uiState.popularHindiSongs) }
                            )
                        }
                    }
                }
            }

            // 6. Section: Featured This Week
            if (uiState.featuredThisWeek.isNotEmpty()) {
                item {
                    SectionHeader(title = "Featured This Week")
                }
                item {
                    LazyRow(
                        contentPadding = PaddingValues(horizontal = 16.dp),
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        items(uiState.featuredThisWeek) { mix ->
                            RectangularMixCard(
                                mix = mix,
                                onPlay = {
                                    if (mix.tracks.isNotEmpty()) {
                                        playerViewModel.playTrack(mix.tracks.first(), mix.tracks)
                                    }
                                }
                            )
                        }
                    }
                }
            }

            // 7. Section: Playlists for You
            if (uiState.playlistsForYou.isNotEmpty()) {
                item {
                    SectionHeader(title = "Playlists for You")
                }
                item {
                    LazyRow(
                        contentPadding = PaddingValues(horizontal = 16.dp),
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        items(uiState.playlistsForYou) { pl ->
                            RectangularPlaylistCard(
                                playlist = pl,
                                onPlay = {
                                    if (pl.tracks.isNotEmpty()) {
                                        playerViewModel.playTrack(pl.tracks.first(), pl.tracks)
                                    }
                                }
                            )
                        }
                    }
                }
            }

            // 8. Section: Trending Playlists
            if (uiState.trendingPlaylists.isNotEmpty()) {
                item {
                    SectionHeader(title = "Trending Playlists")
                }
                item {
                    LazyRow(
                        contentPadding = PaddingValues(horizontal = 16.dp),
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        items(uiState.trendingPlaylists) { pl ->
                            RectangularPlaylistCard(
                                playlist = pl,
                                onPlay = {
                                    if (pl.tracks.isNotEmpty()) {
                                        playerViewModel.playTrack(pl.tracks.first(), pl.tracks)
                                    }
                                }
                            )
                        }
                    }
                }
            }

            // 9. Section: Hot Playlists
            if (uiState.hotPlaylists.isNotEmpty()) {
                item {
                    SectionHeader(title = "Hot Playlists")
                }
                item {
                    LazyRow(
                        contentPadding = PaddingValues(horizontal = 16.dp),
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        items(uiState.hotPlaylists) { pl ->
                            RectangularPlaylistCard(
                                playlist = pl,
                                onPlay = {
                                    if (pl.tracks.isNotEmpty()) {
                                        playerViewModel.playTrack(pl.tracks.first(), pl.tracks)
                                    }
                                }
                            )
                        }
                    }
                }
            }

            // 10. Section: Based on Your Recents (3-Row Swipable Matrix)
            if (uiState.basedOnRecents.isNotEmpty()) {
                item {
                    SectionHeader(title = "Based on Your Recents")
                }
                item {
                    val columnChunks = uiState.basedOnRecents.chunked(3)
                    LazyRow(
                        contentPadding = PaddingValues(horizontal = 16.dp),
                        horizontalArrangement = Arrangement.spacedBy(14.dp)
                    ) {
                        items(columnChunks) { columnTracks ->
                            Column(
                                modifier = Modifier.width(285.dp),
                                verticalArrangement = Arrangement.spacedBy(10.dp)
                            ) {
                                columnTracks.forEach { track ->
                                    SongsForYouRowItem(
                                        track = track,
                                        onPlay = { playerViewModel.playTrack(track, uiState.basedOnRecents) }
                                    )
                                }
                            }
                        }
                    }
                }
            }

            // 11. Section: Albums for You
            if (uiState.albumsForYou.isNotEmpty()) {
                item {
                    SectionHeader(title = "Albums for You")
                }
                item {
                    LazyRow(
                        contentPadding = PaddingValues(horizontal = 16.dp),
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        items(uiState.albumsForYou) { pl ->
                            RectangularPlaylistCard(
                                playlist = pl,
                                onPlay = {
                                    if (pl.tracks.isNotEmpty()) {
                                        playerViewModel.playTrack(pl.tracks.first(), pl.tracks)
                                    }
                                }
                            )
                        }
                    }
                }
            }

            // 12. Section: Most Loved Artists
            if (uiState.mostLovedArtists.isNotEmpty()) {
                item {
                    SectionHeader(title = "Most Loved Artists")
                }
                item {
                    LazyRow(
                        contentPadding = PaddingValues(horizontal = 16.dp),
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        items(uiState.mostLovedArtists) { artist ->
                            val name = artist["name"] as? String ?: ""
                            val subtitle = artist["subtitle"] as? String ?: ""
                            val image = artist["image"] as? String ?: ""

                            Surface(
                                onClick = { onArtistClick(name) },
                                modifier = Modifier
                                    .width(155.dp)
                                    .clip(RoundedCornerShape(12.dp)),
                                color = Color.Transparent
                            ) {
                                Column(modifier = Modifier.width(155.dp)) {
                                    AsyncImage(
                                        model = image,
                                        contentDescription = name,
                                        modifier = Modifier
                                            .size(155.dp)
                                            .clip(RoundedCornerShape(12.dp)),
                                        contentScale = ContentScale.Crop
                                    )
                                    Spacer(Modifier.height(6.dp))
                                    Text(
                                        text = name,
                                        style = MaterialTheme.typography.titleSmall.copy(
                                            fontWeight = FontWeight.Bold,
                                            fontSize = 13.5.sp
                                        ),
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis,
                                        color = TextPrimary
                                    )
                                    Text(
                                        text = subtitle,
                                        style = MaterialTheme.typography.bodySmall.copy(
                                            fontSize = 12.sp,
                                            color = TextSecondary
                                        ),
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis
                                    )
                                }
                            }
                        }
                    }
                }
            }

            // 13. Section: Popular Hindi Songs (3-Row Swipable Matrix)
            if (uiState.popularHindiSongs.isNotEmpty()) {
                item {
                    SectionHeader(title = "Popular Hindi Songs")
                }
                item {
                    val columnChunks = uiState.popularHindiSongs.chunked(3)
                    LazyRow(
                        contentPadding = PaddingValues(horizontal = 16.dp),
                        horizontalArrangement = Arrangement.spacedBy(14.dp)
                    ) {
                        items(columnChunks) { columnTracks ->
                            Column(
                                modifier = Modifier.width(285.dp),
                                verticalArrangement = Arrangement.spacedBy(10.dp)
                            ) {
                                columnTracks.forEach { track ->
                                    SongsForYouRowItem(
                                        track = track,
                                        onPlay = { playerViewModel.playTrack(track, uiState.popularHindiSongs) }
                                    )
                                }
                            }
                        }
                    }
                }
            }

            // 14. Section: Stay Upbeat
            if (uiState.stayUpbeat.isNotEmpty()) {
                item {
                    SectionHeader(title = "Stay Upbeat")
                }
                item {
                    LazyRow(
                        contentPadding = PaddingValues(horizontal = 16.dp),
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        items(uiState.stayUpbeat) { pl ->
                            RectangularPlaylistCard(
                                playlist = pl,
                                onPlay = {
                                    if (pl.tracks.isNotEmpty()) {
                                        playerViewModel.playTrack(pl.tracks.first(), pl.tracks)
                                    }
                                }
                            )
                        }
                    }
                }
            }

            // 15. Section: Because You Follow [Top Artist] (Circular Cards)
            if (uiState.becauseYouFollowArtists.isNotEmpty()) {
                item {
                    SectionHeader(title = uiState.becauseYouFollowTitle)
                }
                item {
                    LazyRow(
                        contentPadding = PaddingValues(horizontal = 16.dp),
                        horizontalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        items(uiState.becauseYouFollowArtists) { artist ->
                            val name = artist["name"] as? String ?: ""
                            val image = artist["image"] as? String ?: ""

                            Column(
                                horizontalAlignment = Alignment.CenterHorizontally,
                                modifier = Modifier
                                    .width(110.dp)
                                    .clickable { onArtistClick(name) }
                            ) {
                                AsyncImage(
                                    model = image,
                                    contentDescription = name,
                                    modifier = Modifier
                                        .size(96.dp)
                                        .clip(CircleShape),
                                    contentScale = ContentScale.Crop
                                )
                                Spacer(Modifier.height(6.dp))
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

            // 16. Section: Artist Spotlight (e.g. Shubh)
            if (uiState.artistSpotlightTracks.isNotEmpty()) {
                item {
                    SectionHeader(title = uiState.artistSpotlightTitle)
                }
                item {
                    LazyRow(
                        contentPadding = PaddingValues(horizontal = 16.dp),
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        items(uiState.artistSpotlightTracks) { track ->
                            Surface(
                                onClick = { playerViewModel.playTrack(track, uiState.artistSpotlightTracks) },
                                modifier = Modifier
                                    .width(140.dp)
                                    .clip(RoundedCornerShape(12.dp)),
                                color = Color.Transparent
                            ) {
                                Column(modifier = Modifier.width(140.dp)) {
                                    AsyncImage(
                                        model = track.thumbnail,
                                        contentDescription = track.title,
                                        modifier = Modifier
                                            .size(140.dp)
                                            .clip(RoundedCornerShape(12.dp)),
                                        contentScale = ContentScale.Crop
                                    )
                                    Spacer(Modifier.height(6.dp))
                                    Text(
                                        text = track.title,
                                        style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold, fontSize = 13.5.sp),
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis,
                                        color = TextPrimary
                                    )
                                    Text(
                                        text = track.artist,
                                        style = MaterialTheme.typography.bodySmall.copy(fontSize = 12.sp, color = TextSecondary),
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis
                                    )
                                }
                            }
                        }
                    }
                }
            }

            // 17. Section: New Releases for You
            if (uiState.newReleases.isNotEmpty()) {
                item {
                    SectionHeader(title = "New Releases for You")
                }
                item {
                    LazyRow(
                        contentPadding = PaddingValues(horizontal = 16.dp),
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        items(uiState.newReleases) { track ->
                            Surface(
                                onClick = { playerViewModel.playTrack(track, uiState.newReleases) },
                                modifier = Modifier
                                    .width(140.dp)
                                    .clip(RoundedCornerShape(12.dp)),
                                color = Color.Transparent
                            ) {
                                Column(modifier = Modifier.width(140.dp)) {
                                    AsyncImage(
                                        model = track.thumbnail,
                                        contentDescription = track.title,
                                        modifier = Modifier
                                            .size(140.dp)
                                            .clip(RoundedCornerShape(12.dp)),
                                        contentScale = ContentScale.Crop
                                    )
                                    Spacer(Modifier.height(6.dp))
                                    Text(
                                        text = track.title,
                                        style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold, fontSize = 13.5.sp),
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis,
                                        color = TextPrimary
                                    )
                                    Text(
                                        text = track.artist,
                                        style = MaterialTheme.typography.bodySmall.copy(fontSize = 12.sp, color = TextSecondary),
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis
                                    )
                                }
                            }
                        }
                    }
                }
            }

            // 18. Section: Trending Songs (3-Row Swipable Matrix)
            if (uiState.trendingSongs.isNotEmpty()) {
                item {
                    SectionHeader(title = "Trending Songs")
                }
                item {
                    val columnChunks = uiState.trendingSongs.chunked(3)
                    LazyRow(
                        contentPadding = PaddingValues(horizontal = 16.dp),
                        horizontalArrangement = Arrangement.spacedBy(14.dp)
                    ) {
                        items(columnChunks) { columnTracks ->
                            Column(
                                modifier = Modifier.width(285.dp),
                                verticalArrangement = Arrangement.spacedBy(10.dp)
                            ) {
                                columnTracks.forEach { track ->
                                    SongsForYouRowItem(
                                        track = track,
                                        onPlay = { playerViewModel.playTrack(track, uiState.trendingSongs) }
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }

        // Pull to Refresh Indicator
        PullToRefreshContainer(
            state = pullRefreshState,
            modifier = Modifier.align(Alignment.TopCenter),
            containerColor = SurfaceDark,
            contentColor = animatedPrimaryMood
        )
    }

    // Profile Dialog / Bottom Sheet
    if (showProfileSheet) {
        ModalBottomSheet(
            onDismissRequest = { showProfileSheet = false },
            containerColor = SurfaceDark,
            dragHandle = { BottomSheetDefaults.DragHandle(color = TextSecondary) }
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 24.dp, vertical = 16.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                Surface(
                    modifier = Modifier.size(72.dp),
                    shape = CircleShape,
                    color = animatedPrimaryMood,
                    border = BorderStroke(2.dp, animatedPrimaryMood.copy(alpha = 0.8f))
                ) {
                    if (!uiState.userAvatar.isNullOrBlank()) {
                        AsyncImage(
                            model = uiState.userAvatar,
                            contentDescription = "Avatar",
                            modifier = Modifier.fillMaxSize(),
                            contentScale = ContentScale.Crop
                        )
                    } else {
                        Box(
                            modifier = Modifier
                                .fillMaxSize()
                                .background(
                                    Brush.linearGradient(
                                        listOf(animatedPrimaryMood, animatedSecondaryMood)
                                    )
                                ),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = uiState.userName.take(1).uppercase().ifBlank { "M" },
                                color = Color.White,
                                style = MaterialTheme.typography.headlineMedium.copy(fontWeight = FontWeight.Bold)
                            )
                        }
                    }
                }

                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = uiState.userName,
                        style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold),
                        color = TextPrimary
                    )
                    if (!uiState.userEmail.isNullOrBlank()) {
                        Text(
                            text = uiState.userEmail!!,
                            style = MaterialTheme.typography.bodyMedium,
                            color = TextSecondary
                        )
                    }
                    Spacer(Modifier.height(6.dp))
                    Surface(
                        shape = RoundedCornerShape(12.dp),
                        color = animatedPrimaryMood.copy(alpha = 0.15f),
                        border = BorderStroke(1.dp, animatedPrimaryMood.copy(alpha = 0.4f))
                    ) {
                        Text(
                            text = "MRJ Music VIP • Active",
                            color = animatedPrimaryMood,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                        )
                    }
                }

                HorizontalDivider(color = SurfaceBorder.copy(alpha = 0.5f))

                Button(
                    onClick = {
                        homeViewModel.refreshDashboard()
                        showProfileSheet = false
                    },
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(containerColor = animatedPrimaryMood),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Icon(Icons.Default.Refresh, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(Modifier.width(8.dp))
                    Text("Refresh Personalization Data", fontWeight = FontWeight.Bold)
                }

                Spacer(Modifier.height(16.dp))
            }
        }
    }

    selectedTrackForActions?.let { track ->
        com.mrj.music.ui.components.TrackActionSheet(
            track = track,
            playerViewModel = playerViewModel,
            onDismiss = { selectedTrackForActions = null },
            onArtistClick = onArtistClick,
            onStationClick = onStationClick
        )
    }
}

@Composable
fun SectionHeader(title: String) {
    Text(
        text = title,
        style = MaterialTheme.typography.titleMedium.copy(
            fontWeight = FontWeight.Bold,
            fontSize = 18.5.sp
        ),
        color = TextPrimary,
        modifier = Modifier.padding(start = 16.dp, end = 16.dp, top = 22.dp, bottom = 10.dp)
    )
}

/**
 * Rectangular Daily Mix Card with Poster, Gradient & 1-Tap Play
 */
@Composable
fun DailyMixCard(
    mix: DailyMixItem,
    onPlay: () -> Unit
) {
    Surface(
        onClick = onPlay,
        modifier = Modifier
            .width(165.dp)
            .height(210.dp)
            .clip(RoundedCornerShape(16.dp)),
        color = SurfaceDark,
        shape = RoundedCornerShape(16.dp),
        border = BorderStroke(1.dp, SurfaceBorder.copy(alpha = 0.6f))
    ) {
        Box(modifier = Modifier.fillMaxSize()) {
            AsyncImage(
                model = mix.posterImage,
                contentDescription = mix.title,
                modifier = Modifier.fillMaxSize(),
                contentScale = ContentScale.Crop
            )

            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(
                        Brush.verticalGradient(
                            listOf(
                                Color.Transparent,
                                Color.Black.copy(alpha = 0.35f),
                                Color.Black.copy(alpha = 0.95f)
                            )
                        )
                    )
            )

            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(12.dp),
                verticalArrangement = Arrangement.SpaceBetween
            ) {
                Surface(
                    shape = RoundedCornerShape(8.dp),
                    color = Color.Black.copy(alpha = 0.65f),
                    border = BorderStroke(0.5.dp, Color.White.copy(alpha = 0.3f))
                ) {
                    Text(
                        text = mix.vibe.take(18),
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.White,
                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                    )
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.Bottom
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = mix.title,
                            style = MaterialTheme.typography.titleMedium.copy(
                                fontWeight = FontWeight.Black,
                                fontSize = 15.sp
                            ),
                            color = Color.White,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                        Text(
                            text = mix.subtitle,
                            style = MaterialTheme.typography.bodySmall.copy(fontSize = 11.sp),
                            color = Color.White.copy(alpha = 0.8f),
                            maxLines = 2,
                            overflow = TextOverflow.Ellipsis
                        )
                    }

                    Surface(
                        modifier = Modifier
                            .size(32.dp)
                            .clip(CircleShape),
                        color = CrimsonRed,
                        shape = CircleShape
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Icon(
                                Icons.Default.PlayArrow,
                                contentDescription = "Play",
                                tint = Color.White,
                                modifier = Modifier.size(18.dp)
                            )
                        }
                    }
                }
            }
        }
    }
}

/**
 * Rectangular Mix Card with Poster & Label
 */
@Composable
fun RectangularMixCard(
    mix: DailyMixItem,
    onPlay: () -> Unit
) {
    Surface(
        onClick = onPlay,
        modifier = Modifier
            .width(160.dp)
            .clip(RoundedCornerShape(12.dp)),
        color = Color.Transparent
    ) {
        Column(modifier = Modifier.width(160.dp)) {
            Box(
                modifier = Modifier
                    .size(160.dp)
                    .clip(RoundedCornerShape(12.dp))
            ) {
                AsyncImage(
                    model = mix.posterImage,
                    contentDescription = mix.title,
                    modifier = Modifier.fillMaxSize(),
                    contentScale = ContentScale.Crop
                )

                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .align(Alignment.BottomCenter)
                        .background(
                            Brush.verticalGradient(
                                listOf(Color.Transparent, Color.Black.copy(alpha = 0.8f))
                            )
                        )
                        .padding(horizontal = 8.dp, vertical = 6.dp)
                ) {
                    Text(
                        text = mix.title,
                        color = Color.White,
                        fontWeight = FontWeight.Black,
                        fontSize = 14.sp,
                        maxLines = 1
                    )
                }
            }

            Spacer(Modifier.height(6.dp))

            Text(
                text = mix.subtitle,
                style = MaterialTheme.typography.bodySmall.copy(
                    fontSize = 11.5.sp,
                    color = TextSecondary
                ),
                maxLines = 2,
                overflow = TextOverflow.Ellipsis
            )
        }
    }
}

/**
 * Rectangular Playlist Card
 */
@Composable
fun RectangularPlaylistCard(
    playlist: PlaylistCardItem,
    onPlay: () -> Unit
) {
    Surface(
        onClick = onPlay,
        modifier = Modifier
            .width(160.dp)
            .clip(RoundedCornerShape(12.dp)),
        color = Color.Transparent
    ) {
        Column(modifier = Modifier.width(160.dp)) {
            Box(
                modifier = Modifier
                    .size(160.dp)
                    .clip(RoundedCornerShape(12.dp))
            ) {
                AsyncImage(
                    model = playlist.posterImage,
                    contentDescription = playlist.title,
                    modifier = Modifier.fillMaxSize(),
                    contentScale = ContentScale.Crop
                )

                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .align(Alignment.BottomCenter)
                        .background(
                            Brush.verticalGradient(
                                listOf(Color.Transparent, Color.Black.copy(alpha = 0.85f))
                            )
                        )
                        .padding(horizontal = 8.dp, vertical = 6.dp)
                ) {
                    Text(
                        text = playlist.title,
                        color = Color.White,
                        fontWeight = FontWeight.Bold,
                        fontSize = 13.5.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }
            }

            Spacer(Modifier.height(6.dp))

            Text(
                text = playlist.subtitle,
                style = MaterialTheme.typography.bodySmall.copy(
                    fontSize = 11.5.sp,
                    color = TextSecondary
                ),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }
    }
}

/**
 * "Songs for You" Row Item (inside 3-row columns in horizontal swipable matrix)
 */
@Composable
fun SongsForYouRowItem(
    track: NativeTrack,
    onPlay: () -> Unit
) {
    Surface(
        onClick = onPlay,
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp)),
        color = Color.Transparent
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 3.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            AsyncImage(
                model = track.thumbnail,
                contentDescription = track.title,
                modifier = Modifier
                    .size(54.dp)
                    .clip(RoundedCornerShape(8.dp)),
                contentScale = ContentScale.Crop
            )

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = track.title,
                    style = MaterialTheme.typography.titleMedium.copy(
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold
                    ),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    color = TextPrimary
                )
                Text(
                    text = track.artist,
                    style = MaterialTheme.typography.bodyMedium.copy(
                        fontSize = 12.sp,
                        color = TextSecondary
                    ),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }
        }
    }
}

/**
 * Rectangular Listen Again Card (Swipable to the right)
 */
@Composable
fun ListenAgainCard(
    track: NativeTrack,
    onPlay: () -> Unit
) {
    Column(
        modifier = Modifier
            .width(140.dp)
            .clip(RoundedCornerShape(14.dp))
            .clickable { onPlay() }
    ) {
        Box(
            modifier = Modifier
                .size(140.dp)
                .clip(RoundedCornerShape(14.dp))
        ) {
            AsyncImage(
                model = track.thumbnail,
                contentDescription = track.title,
                modifier = Modifier.fillMaxSize(),
                contentScale = ContentScale.Crop
            )

            Box(
                modifier = Modifier
                    .align(Alignment.BottomEnd)
                    .padding(8.dp)
                    .size(28.dp)
                    .background(CrimsonRed, CircleShape),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    Icons.Default.PlayArrow,
                    contentDescription = "Play",
                    tint = Color.White,
                    modifier = Modifier.size(16.dp)
                )
            }
        }

        Spacer(Modifier.height(6.dp))

        Text(
            text = track.title,
            style = MaterialTheme.typography.titleSmall.copy(
                fontWeight = FontWeight.Bold,
                fontSize = 13.5.sp
            ),
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            color = TextPrimary
        )
        Text(
            text = track.artist,
            style = MaterialTheme.typography.bodySmall.copy(
                fontSize = 12.sp,
                color = TextSecondary
            ),
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
        )
    }
}

/**
 * Rectangular Viral Reel Sound Card with 🔥 Badge
 */
@Composable
fun ViralReelCard(
    track: NativeTrack,
    onPlay: () -> Unit
) {
    Surface(
        onClick = onPlay,
        modifier = Modifier
            .width(140.dp)
            .clip(RoundedCornerShape(14.dp)),
        color = Color.Transparent
    ) {
        Column(modifier = Modifier.width(140.dp)) {
            Box(
                modifier = Modifier
                    .size(140.dp)
                    .clip(RoundedCornerShape(14.dp))
            ) {
                AsyncImage(
                    model = track.thumbnail,
                    contentDescription = track.title,
                    modifier = Modifier.fillMaxSize(),
                    contentScale = ContentScale.Crop
                )

                Surface(
                    shape = RoundedCornerShape(6.dp),
                    color = Color.Black.copy(alpha = 0.7f),
                    modifier = Modifier
                        .align(Alignment.TopStart)
                        .padding(6.dp)
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(3.dp),
                        modifier = Modifier.padding(horizontal = 5.dp, vertical = 2.dp)
                    ) {
                        Icon(
                            Icons.Default.LocalFireDepartment,
                            contentDescription = null,
                            tint = Color(0xFFFF6D00),
                            modifier = Modifier.size(11.dp)
                        )
                        Text(
                            text = "REEL AUDIO",
                            fontSize = 9.sp,
                            fontWeight = FontWeight.Black,
                            color = Color.White
                        )
                    }
                }
            }

            Spacer(Modifier.height(6.dp))

            Text(
                text = track.title,
                style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold, fontSize = 13.5.sp),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                color = TextPrimary
            )
            Text(
                text = track.artist,
                style = MaterialTheme.typography.bodySmall.copy(fontSize = 12.sp, color = TextSecondary),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }
    }
}
