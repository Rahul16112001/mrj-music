package com.mrj.music.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.automirrored.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.mrj.music.model.NativeTrack
import com.mrj.music.ui.theme.*
import com.mrj.music.ui.viewmodel.PlayerViewModel
import com.mrj.music.ui.viewmodel.SearchViewModel
import com.mrj.music.ui.viewmodel.StationViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SearchScreen(
    searchViewModel: SearchViewModel,
    playerViewModel: PlayerViewModel,
    stationViewModel: StationViewModel? = null,
    onArtistClick: (String) -> Unit = {},
    onStationClick: (String, String, String) -> Unit = { _, _, _ -> },
    modifier: Modifier = Modifier
) {
    val uiState by searchViewModel.uiState.collectAsState()
    val genres by (stationViewModel?.genres?.collectAsState() ?: remember { mutableStateOf(emptyList()) })
    val moods by (stationViewModel?.moods?.collectAsState() ?: remember { mutableStateOf(emptyList()) })

    val categories = listOf("All", "Songs", "Artists", "Albums", "Playlists")

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(DeepDarkBg)
    ) {
        // 1. Search Bar (Safe beneath device status bar & camera notch)
        Surface(
            modifier = Modifier
                .fillMaxWidth()
                .statusBarsPadding()
                .padding(horizontal = 16.dp, vertical = 8.dp),
            shape = RoundedCornerShape(16.dp),
            color = SurfaceDark
        ) {
            TextField(
                value = uiState.query,
                onValueChange = { searchViewModel.onQueryChange(it) },
                placeholder = {
                    Text("Search songs, lyrics, artists...", color = TextMuted, fontSize = 14.sp)
                },
                leadingIcon = {
                    Icon(Icons.Default.Search, contentDescription = "Search", tint = CrimsonRed)
                },
                trailingIcon = {
                    if (uiState.query.isNotEmpty()) {
                        IconButton(onClick = { searchViewModel.onQueryChange("") }) {
                            Icon(Icons.Default.Clear, contentDescription = "Clear", tint = TextSecondary)
                        }
                    }
                },
                singleLine = true,
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                keyboardActions = KeyboardActions(onSearch = { searchViewModel.onSearchSubmit(uiState.query) }),
                colors = TextFieldDefaults.colors(
                    focusedContainerColor = Color.Transparent,
                    unfocusedContainerColor = Color.Transparent,
                    focusedIndicatorColor = Color.Transparent,
                    unfocusedIndicatorColor = Color.Transparent,
                    focusedTextColor = TextPrimary,
                    unfocusedTextColor = TextPrimary
                ),
                modifier = Modifier.fillMaxWidth()
            )
        }

        // 2. Filter Pills
        LazyRow(
            contentPadding = PaddingValues(horizontal = 20.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier.padding(bottom = 12.dp)
        ) {
            items(categories) { category ->
                val isSelected = uiState.activeCategory == category
                FilterChip(
                    selected = isSelected,
                    onClick = { searchViewModel.setCategory(category) },
                    label = {
                        Text(
                            text = category,
                            fontSize = 12.sp,
                            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                            color = if (isSelected) Color.White else TextSecondary
                        )
                    },
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = CrimsonRed,
                        containerColor = SurfaceDark
                    ),
                    shape = RoundedCornerShape(20.dp),
                    border = null
                )
            }
        }

        // 3. Search Content (Results, Suggestions, or Explore Hub)
        if (uiState.query.isNotBlank()) {
            val displaySongs = if (uiState.songs.isNotEmpty()) uiState.songs else uiState.instantSongs

            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(start = 20.dp, end = 20.dp, bottom = 120.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                // WHEN TYPING: Show Top Prediction Hero + Typo Banner + Suggestions + Instant Songs
                if (!uiState.isSuggestionSubmitted) {
                    if (uiState.isTypoCorrected && uiState.correctedQuery != null) {
                        item {
                            Surface(
                                color = SurfaceDark,
                                shape = RoundedCornerShape(12.dp),
                                border = androidx.compose.foundation.BorderStroke(0.8.dp, CrimsonRed.copy(alpha = 0.5f)),
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable { searchViewModel.onSuggestionClick(uiState.correctedQuery!!) }
                            ) {
                                Row(
                                    modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                                ) {
                                    Icon(
                                        Icons.Default.AutoAwesome,
                                        contentDescription = null,
                                        tint = CrimsonRed,
                                        modifier = Modifier.size(18.dp)
                                    )
                                    Column {
                                        Text(
                                            text = androidx.compose.ui.text.buildAnnotatedString {
                                                append("Showing results for ")
                                                pushStyle(androidx.compose.ui.text.SpanStyle(color = CrimsonRed, fontWeight = FontWeight.Bold))
                                                append(uiState.correctedQuery!!)
                                                pop()
                                            },
                                            fontSize = 13.sp,
                                            color = TextPrimary
                                        )
                                        Text(
                                            text = "Search instead for \"${uiState.query}\"",
                                            fontSize = 11.5.sp,
                                            color = TextMuted
                                        )
                                    }
                                }
                            }
                        }
                    }

                    if (uiState.topPrediction != null) {
                        item {
                            TopPredictionHeroCard(
                                prediction = uiState.topPrediction!!,
                                onArtistClick = onArtistClick,
                                onPlayTrack = { track -> playerViewModel.playTrack(track) }
                            )
                        }
                    }

                    if (uiState.suggestions.isNotEmpty()) {
                        item {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(6.dp),
                                modifier = Modifier.padding(top = 4.dp, bottom = 2.dp)
                            ) {
                                Icon(
                                    Icons.Default.AutoAwesome,
                                    contentDescription = null,
                                    tint = CrimsonRed,
                                    modifier = Modifier.size(15.dp)
                                )
                                Text(
                                    text = "SUGGESTIONS",
                                    style = MaterialTheme.typography.titleSmall.copy(
                                        fontWeight = FontWeight.Black,
                                        letterSpacing = 1.sp,
                                        fontSize = 11.5.sp
                                    ),
                                    color = CrimsonRed
                                )
                            }
                        }

                        items(uiState.suggestions.take(7)) { suggestion ->
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(10.dp))
                                    .clickable { searchViewModel.onSuggestionClick(suggestion) }
                                    .padding(vertical = 8.dp, horizontal = 4.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                                    modifier = Modifier.weight(1f)
                                ) {
                                    Icon(
                                        Icons.Default.Search,
                                        contentDescription = null,
                                        tint = TextMuted,
                                        modifier = Modifier.size(17.dp)
                                    )
                                    Text(
                                        text = suggestion,
                                        style = MaterialTheme.typography.bodyMedium.copy(
                                            fontWeight = FontWeight.SemiBold,
                                            fontSize = 14.5.sp
                                        ),
                                        color = TextPrimary,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis
                                    )
                                }

                                IconButton(
                                    onClick = { searchViewModel.onQueryChange(suggestion) },
                                    modifier = Modifier.size(24.dp)
                                ) {
                                    Icon(
                                        Icons.Default.NorthWest,
                                        contentDescription = "Fill",
                                        tint = TextMuted,
                                        modifier = Modifier.size(14.dp)
                                    )
                                }
                            }
                        }

                        item {
                            HorizontalDivider(
                                modifier = Modifier.padding(vertical = 4.dp),
                                color = SurfaceBorder.copy(alpha = 0.4f),
                                thickness = 0.5.dp
                            )
                        }
                    }

                    if (displaySongs.isNotEmpty()) {
                        item {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(6.dp),
                                modifier = Modifier.padding(top = 4.dp, bottom = 2.dp)
                            ) {
                                Icon(
                                    Icons.Default.MusicNote,
                                    contentDescription = null,
                                    tint = CrimsonRed,
                                    modifier = Modifier.size(15.dp)
                                )
                                Text(
                                    text = "SONGS",
                                    style = MaterialTheme.typography.titleSmall.copy(
                                        fontWeight = FontWeight.Black,
                                        letterSpacing = 1.sp,
                                        fontSize = 11.5.sp
                                    ),
                                    color = CrimsonRed
                                )
                            }
                        }

                        items(displaySongs) { track ->
                            SearchResultCard(
                                track = track,
                                onPlay = { playerViewModel.playTrack(track) },
                                onArtistClick = { onArtistClick(track.artist) }
                            )
                        }
                    }
                } else {
                    // WHEN SUBMITTED: Suggestions are HIDDEN, show dedicated Categorized Result View
                    when (uiState.activeCategory) {
                        "All" -> {
                            if (uiState.topPrediction != null) {
                                item {
                                    TopPredictionHeroCard(
                                        prediction = uiState.topPrediction!!,
                                        onArtistClick = onArtistClick,
                                        onPlayTrack = { track -> playerViewModel.playTrack(track) }
                                    )
                                }
                            }

                            if (uiState.songs.isNotEmpty()) {
                                item {
                                    Text(
                                        text = "SONGS",
                                        style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold, letterSpacing = 1.sp, fontSize = 12.sp),
                                        color = CrimsonRed,
                                        modifier = Modifier.padding(top = 8.dp, bottom = 4.dp)
                                    )
                                }
                                items(uiState.songs.take(6)) { track ->
                                    SearchResultCard(
                                        track = track,
                                        onPlay = { playerViewModel.playTrack(track) },
                                        onArtistClick = { onArtistClick(track.artist) }
                                    )
                                }
                            }

                            if (uiState.artists.isNotEmpty()) {
                                item {
                                    Text(
                                        text = "ARTISTS",
                                        style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold, letterSpacing = 1.sp, fontSize = 12.sp),
                                        color = CrimsonRed,
                                        modifier = Modifier.padding(top = 8.dp, bottom = 4.dp)
                                    )
                                }
                                items(uiState.artists.take(4)) { artist ->
                                    ArtistSearchCard(artist = artist, onArtistClick = onArtistClick)
                                }
                            }

                            if (uiState.albums.isNotEmpty()) {
                                item {
                                    Text(
                                        text = "ALBUMS",
                                        style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold, letterSpacing = 1.sp, fontSize = 12.sp),
                                        color = CrimsonRed,
                                        modifier = Modifier.padding(top = 8.dp, bottom = 4.dp)
                                    )
                                }
                                items(uiState.albums.take(4)) { album ->
                                    AlbumSearchCard(album = album)
                                }
                            }

                            if (uiState.playlists.isNotEmpty()) {
                                item {
                                    Text(
                                        text = "PLAYLISTS",
                                        style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold, letterSpacing = 1.sp, fontSize = 12.sp),
                                        color = CrimsonRed,
                                        modifier = Modifier.padding(top = 8.dp, bottom = 4.dp)
                                    )
                                }
                                items(uiState.playlists.take(4)) { playlist ->
                                    PlaylistSearchCard(playlist = playlist)
                                }
                            }
                        }

                        "Songs" -> {
                            if (uiState.songs.isNotEmpty()) {
                                items(uiState.songs) { track ->
                                    SearchResultCard(
                                        track = track,
                                        onPlay = { playerViewModel.playTrack(track) },
                                        onArtistClick = { onArtistClick(track.artist) }
                                    )
                                }
                            }
                        }

                        "Artists" -> {
                            if (uiState.artists.isNotEmpty()) {
                                items(uiState.artists) { artist ->
                                    ArtistSearchCard(artist = artist, onArtistClick = onArtistClick)
                                }
                            }
                        }

                        "Albums" -> {
                            if (uiState.albums.isNotEmpty()) {
                                items(uiState.albums) { album ->
                                    AlbumSearchCard(album = album)
                                }
                            }
                        }

                        "Playlists" -> {
                            if (uiState.playlists.isNotEmpty()) {
                                items(uiState.playlists) { playlist ->
                                    PlaylistSearchCard(playlist = playlist)
                                }
                            }
                        }
                    }
                }

                if (uiState.isLoading) {
                    item {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 32.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(28.dp),
                                color = CrimsonRed,
                                strokeWidth = 2.5.dp
                            )
                        }
                    }
                } else if (uiState.songs.isEmpty() && uiState.artists.isEmpty() && uiState.albums.isEmpty() && uiState.suggestions.isEmpty() && uiState.topPrediction == null) {
                    item {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 48.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = "No results found for \"${uiState.query}\"",
                                style = MaterialTheme.typography.bodyLarge,
                                color = TextSecondary
                            )
                        }
                    }
                }
            }
        } else {
            // EXPLORE HUB: Music Genres & Vibe Radio Stations
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(start = 20.dp, end = 20.dp, bottom = 140.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // Trending Searches (Real-time Country Viral Trends)
                if (uiState.trendingKeywords.isNotEmpty()) {
                    item {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp),
                            modifier = Modifier.padding(top = 4.dp, bottom = 2.dp)
                        ) {
                            Icon(
                                Icons.Default.LocalFireDepartment,
                                contentDescription = null,
                                tint = Color(0xFFFF6D00),
                                modifier = Modifier.size(17.dp)
                            )
                            Text(
                                text = "TRENDING SEARCHES",
                                style = MaterialTheme.typography.titleSmall.copy(
                                    fontWeight = FontWeight.Black,
                                    letterSpacing = 1.sp,
                                    fontSize = 11.5.sp
                                ),
                                color = Color(0xFFFF6D00)
                            )
                        }
                    }

                    item {
                        LazyRow(
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            contentPadding = PaddingValues(bottom = 4.dp)
                        ) {
                            items(uiState.trendingKeywords) { keyword ->
                                Surface(
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(20.dp))
                                        .clickable { searchViewModel.onSuggestionClick(keyword) },
                                    color = SurfaceDark,
                                    shape = RoundedCornerShape(20.dp),
                                    border = androidx.compose.foundation.BorderStroke(0.5.dp, SurfaceBorder.copy(alpha = 0.6f))
                                ) {
                                    Row(
                                        modifier = Modifier.padding(horizontal = 14.dp, vertical = 7.dp),
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                                    ) {
                                        Icon(
                                            Icons.Default.TrendingUp,
                                            contentDescription = null,
                                            tint = Color(0xFFFF6D00),
                                            modifier = Modifier.size(13.dp)
                                        )
                                        Text(
                                            text = keyword,
                                            fontSize = 12.5.sp,
                                            fontWeight = FontWeight.SemiBold,
                                            color = TextPrimary
                                        )
                                    }
                                }
                            }
                        }
                    }
                }

                // Recent Searches (if available)
                if (uiState.recentSearches.isNotEmpty()) {
                    item {
                        Text(
                            text = "Recent Searches",
                            style = MaterialTheme.typography.titleMedium,
                            modifier = Modifier.padding(top = 4.dp, bottom = 4.dp)
                        )
                    }

                    items(uiState.recentSearches.take(4)) { suggestion ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(8.dp))
                                .clickable { searchViewModel.onSuggestionClick(suggestion) }
                                .padding(vertical = 6.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(12.dp),
                                modifier = Modifier.weight(1f)
                            ) {
                                Icon(
                                    Icons.Default.Search,
                                    contentDescription = null,
                                    tint = TextMuted,
                                    modifier = Modifier.size(18.dp)
                                )
                                Text(
                                    text = suggestion,
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = TextPrimary
                                )
                            }

                            IconButton(
                                onClick = { searchViewModel.removeRecentSearch(suggestion) },
                                modifier = Modifier.size(24.dp)
                            ) {
                                Icon(
                                    Icons.Default.Clear,
                                    contentDescription = "Remove",
                                    tint = TextMuted,
                                    modifier = Modifier.size(16.dp)
                                )
                            }
                        }
                    }
                }

                // 1. Music Genres & Languages Section
                item {
                    Text(
                        text = "Music Genres & Languages",
                        style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold),
                        modifier = Modifier.padding(top = 8.dp, bottom = 4.dp)
                    )
                }

                // 2-column Grid of Genres
                val genrePairs = genres.chunked(2)
                items(genrePairs) { pair ->
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        for (genre in pair) {
                            Surface(
                                modifier = Modifier
                                    .weight(1f)
                                    .height(96.dp)
                                    .clip(RoundedCornerShape(16.dp))
                                    .clickable { onStationClick("genre", genre.id, genre.name) },
                                color = Color.Transparent
                            ) {
                                Box(
                                    modifier = Modifier
                                        .fillMaxSize()
                                        .background(
                                            Brush.linearGradient(
                                                colors = genre.gradient
                                            )
                                        )
                                        .padding(12.dp)
                                ) {
                                    Column(
                                        modifier = Modifier.fillMaxSize(),
                                        verticalArrangement = Arrangement.SpaceBetween
                                    ) {
                                        Text(
                                            text = genre.icon,
                                            fontSize = 26.sp
                                        )
                                        Text(
                                            text = genre.name,
                                            style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold),
                                            color = Color.White,
                                            maxLines = 1,
                                            overflow = TextOverflow.Ellipsis
                                        )
                                    }
                                }
                            }
                        }
                        if (pair.size == 1) {
                            Spacer(Modifier.weight(1f))
                        }
                    }
                }

                // 2. Mood & Vibe Stations Section
                item {
                    Text(
                        text = "Mood & Vibe Radio",
                        style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold),
                        modifier = Modifier.padding(top = 16.dp, bottom = 4.dp)
                    )
                }

                // 2-column Grid of Moods
                val moodPairs = moods.chunked(2)
                items(moodPairs) { pair ->
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        for (mood in pair) {
                            Surface(
                                modifier = Modifier
                                    .weight(1f)
                                    .height(88.dp)
                                    .clip(RoundedCornerShape(16.dp))
                                    .clickable { onStationClick("mood", mood.id, mood.name) },
                                color = Color.Transparent
                            ) {
                                Box(
                                    modifier = Modifier
                                        .fillMaxSize()
                                        .background(
                                            Brush.linearGradient(
                                                colors = mood.gradient
                                            )
                                        )
                                        .padding(12.dp)
                                ) {
                                    Column(
                                        modifier = Modifier.fillMaxSize(),
                                        verticalArrangement = Arrangement.SpaceBetween
                                    ) {
                                        Row(
                                            modifier = Modifier.fillMaxWidth(),
                                            horizontalArrangement = Arrangement.SpaceBetween,
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            Text(text = mood.icon, fontSize = 22.sp)
                                            Text(
                                                text = mood.count,
                                                style = MaterialTheme.typography.bodySmall.copy(fontSize = 10.sp),
                                                color = Color.White.copy(alpha = 0.8f)
                                            )
                                        }
                                        Text(
                                            text = mood.name,
                                            style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold),
                                            color = Color.White,
                                            maxLines = 1,
                                            overflow = TextOverflow.Ellipsis
                                        )
                                    }
                                }
                            }
                        }
                        if (pair.size == 1) {
                            Spacer(Modifier.weight(1f))
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun SearchResultCard(
    track: NativeTrack,
    onPlay: () -> Unit,
    onArtistClick: (String) -> Unit = {}
) {
    val durationStr = remember(track.duration) {
        val totalSec = track.duration.toInt()
        val m = totalSec / 60
        val s = totalSec % 60
        String.format("%d:%02d", m, s)
    }

    Surface(
        onClick = onPlay,
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp)),
        color = Color.Transparent
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 6.dp, horizontal = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            AsyncImage(
                model = track.thumbnail,
                contentDescription = track.title,
                modifier = Modifier
                    .size(48.dp)
                    .clip(RoundedCornerShape(10.dp)),
                contentScale = ContentScale.Crop
            )

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = track.title,
                    style = MaterialTheme.typography.titleMedium.copy(
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Bold
                    ),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    color = TextPrimary
                )
                Text(
                    text = "Song • ${track.artist}",
                    style = MaterialTheme.typography.bodyMedium.copy(fontSize = 13.sp),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    color = TextSecondary
                )
            }

            if (track.duration > 0) {
                Text(
                    text = durationStr,
                    style = MaterialTheme.typography.bodyMedium.copy(
                        fontSize = 13.sp,
                        color = TextMuted
                    )
                )
            }
        }
    }
}

@Composable
fun TopPredictionHeroCard(
    prediction: com.mrj.music.ui.viewmodel.TopPrediction,
    onArtistClick: (String) -> Unit,
    onPlayTrack: (NativeTrack) -> Unit
) {
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .clickable {
                if (prediction.type == "artist") {
                    onArtistClick(prediction.title)
                } else if (prediction.track != null) {
                    onPlayTrack(prediction.track)
                }
            },
        color = SurfaceDark,
        shape = RoundedCornerShape(16.dp),
        border = androidx.compose.foundation.BorderStroke(1.dp, CrimsonRed.copy(alpha = 0.5f))
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            AsyncImage(
                model = prediction.thumbnail,
                contentDescription = prediction.title,
                modifier = Modifier
                    .size(if (prediction.type == "artist") 58.dp else 52.dp)
                    .clip(if (prediction.type == "artist") CircleShape else RoundedCornerShape(10.dp)),
                contentScale = ContentScale.Crop
            )

            Column(modifier = Modifier.weight(1f)) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Text(
                        text = "BEST MATCH",
                        style = MaterialTheme.typography.labelSmall.copy(
                            fontWeight = FontWeight.Black,
                            letterSpacing = 1.sp,
                            fontSize = 10.sp
                        ),
                        color = CrimsonRed
                    )
                    if (prediction.type == "artist") {
                        Icon(
                            Icons.Default.Verified,
                            contentDescription = "Verified",
                            tint = Color(0xFF38BDF8),
                            modifier = Modifier.size(13.dp)
                        )
                    }
                }
                Spacer(Modifier.height(2.dp))
                Text(
                    text = prediction.title,
                    style = MaterialTheme.typography.titleMedium.copy(
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Bold
                    ),
                    color = TextPrimary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Text(
                    text = prediction.subtitle,
                    style = MaterialTheme.typography.bodySmall.copy(fontSize = 12.sp),
                    color = TextSecondary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }

            IconButton(
                onClick = {
                    if (prediction.type == "artist") {
                        onArtistClick(prediction.title)
                    } else if (prediction.track != null) {
                        onPlayTrack(prediction.track)
                    }
                },
                modifier = Modifier
                    .size(40.dp)
                    .clip(CircleShape)
                    .background(CrimsonRed)
            ) {
                Icon(
                    imageVector = if (prediction.type == "artist") Icons.AutoMirrored.Filled.ArrowForward else Icons.Default.PlayArrow,
                    contentDescription = "Open",
                    tint = Color.White,
                    modifier = Modifier.size(22.dp)
                )
            }
        }
    }
}

@Composable
fun ArtistSearchCard(
    artist: Map<String, Any>,
    onArtistClick: (String) -> Unit
) {
    val name = artist["name"] as? String ?: "Artist"
    val image = artist["image"] as? String ?: artist["thumbnail"] as? String
    val category = artist["category"] as? String ?: "Artist"
    val followers = artist["followerCount"] as? String ?: "Artist"

    Surface(
        onClick = { onArtistClick(name) },
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp)),
        color = Color.Transparent
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 6.dp, horizontal = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            AsyncImage(
                model = image,
                contentDescription = name,
                modifier = Modifier
                    .size(52.dp)
                    .clip(CircleShape),
                contentScale = ContentScale.Crop
            )

            Column(modifier = Modifier.weight(1f)) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Text(
                        text = name,
                        style = MaterialTheme.typography.titleMedium.copy(
                            fontSize = 15.sp,
                            fontWeight = FontWeight.Bold
                        ),
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        color = TextPrimary
                    )
                    Icon(
                        Icons.Default.Verified,
                        contentDescription = "Verified",
                        tint = Color(0xFF38BDF8),
                        modifier = Modifier.size(13.dp)
                    )
                }
                Text(
                    text = "$category • $followers",
                    style = MaterialTheme.typography.bodySmall.copy(fontSize = 12.5.sp),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    color = TextSecondary
                )
            }

            Icon(
                imageVector = Icons.AutoMirrored.Filled.ArrowForward,
                contentDescription = "Open",
                tint = TextMuted,
                modifier = Modifier.size(18.dp)
            )
        }
    }
}

@Composable
fun AlbumSearchCard(
    album: Map<String, Any>
) {
    val title = album["title"] as? String ?: album["name"] as? String ?: "Album"
    val artist = album["artist"] as? String ?: "Various Artists"
    val thumbnail = album["thumbnail"] as? String ?: album["image"] as? String
    val year = album["year"] as? String ?: "2024"
    val trackCount = (album["trackCount"] as? Number)?.toInt() ?: 10

    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp)),
        color = Color.Transparent
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 6.dp, horizontal = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            AsyncImage(
                model = thumbnail,
                contentDescription = title,
                modifier = Modifier
                    .size(52.dp)
                    .clip(RoundedCornerShape(10.dp)),
                contentScale = ContentScale.Crop
            )

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = title,
                    style = MaterialTheme.typography.titleMedium.copy(
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Bold
                    ),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    color = TextPrimary
                )
                Text(
                    text = "Album • $artist • $year • $trackCount tracks",
                    style = MaterialTheme.typography.bodySmall.copy(fontSize = 12.5.sp),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    color = TextSecondary
                )
            }
        }
    }
}

@Composable
fun PlaylistSearchCard(
    playlist: Map<String, Any>
) {
    val title = playlist["title"] as? String ?: playlist["name"] as? String ?: "Playlist"
    val author = playlist["author"] as? String ?: playlist["creator"] as? String ?: "MRJ Music"
    val thumbnail = playlist["thumbnail"] as? String ?: playlist["image"] as? String
    val trackCount = (playlist["trackCount"] as? Number)?.toInt() ?: 25

    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp)),
        color = Color.Transparent
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 6.dp, horizontal = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            AsyncImage(
                model = thumbnail,
                contentDescription = title,
                modifier = Modifier
                    .size(52.dp)
                    .clip(RoundedCornerShape(10.dp)),
                contentScale = ContentScale.Crop
            )

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = title,
                    style = MaterialTheme.typography.titleMedium.copy(
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Bold
                    ),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    color = TextPrimary
                )
                Text(
                    text = "Playlist • $author • $trackCount tracks",
                    style = MaterialTheme.typography.bodySmall.copy(fontSize = 12.5.sp),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    color = TextSecondary
                )
            }
        }
    }
}
