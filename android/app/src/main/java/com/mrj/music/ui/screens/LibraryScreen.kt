package com.mrj.music.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
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
import com.mrj.music.storage.NativeOfflineStorage
import com.mrj.music.ui.theme.*
import com.mrj.music.ui.viewmodel.LibraryViewModel
import com.mrj.music.ui.viewmodel.PlayerViewModel
import com.mrj.music.ui.viewmodel.PlaylistViewModel

@Composable
fun LibraryScreen(
    libraryViewModel: LibraryViewModel,
    playerViewModel: PlayerViewModel,
    playlistViewModel: PlaylistViewModel = androidx.lifecycle.viewmodel.compose.viewModel(),
    onPlaylistClick: (String) -> Unit = {},
    modifier: Modifier = Modifier
) {
    val context = androidx.compose.ui.platform.LocalContext.current
    val uiState by libraryViewModel.uiState.collectAsState()
    val playlistUiState by playlistViewModel.uiState.collectAsState()
    val offlineStorage = remember { NativeOfflineStorage.getInstance(context) }

    var selectedTab by remember { mutableStateOf(0) } // 0 = Playlists, 1 = Liked Songs, 2 = Downloaded
    val tabs = listOf(
        "Playlists (${playlistUiState.playlists.size})",
        "Liked Songs (${uiState.likedTracks.size})",
        "Downloaded (${uiState.offlineTracks.size})"
    )

    var downloadSubFilter by remember { mutableStateOf("ALL") } // ALL, SMART, MANUAL
    var showCreateDialog by remember { mutableStateOf(false) }
    var newPlaylistTitle by remember { mutableStateOf("") }
    var newPlaylistDesc by remember { mutableStateOf("") }

    val smartTracks = remember(uiState.offlineTracks) {
        uiState.offlineTracks.filter { it.downloadType == "smart" }
    }
    val manualTracks = remember(uiState.offlineTracks) {
        uiState.offlineTracks.filter { it.downloadType != "smart" }
    }

    val displayedOfflineTracks = remember(downloadSubFilter, uiState.offlineTracks) {
        when (downloadSubFilter) {
            "SMART" -> smartTracks
            "MANUAL" -> manualTracks
            else -> uiState.offlineTracks
        }
    }

    LazyColumn(
        modifier = modifier
            .fillMaxSize()
            .background(DeepDarkBg),
        contentPadding = PaddingValues(bottom = 120.dp)
    ) {
        // 1. Library Header
        item {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .statusBarsPadding()
                    .padding(horizontal = 20.dp, vertical = 12.dp)
            ) {
                Text(
                    text = "Your Library",
                    style = MaterialTheme.typography.headlineMedium
                )
                Spacer(Modifier.height(4.dp))
                Text(
                    text = "${playlistUiState.playlists.size} playlists • ${uiState.likedTracks.size} favorites • ${uiState.offlineTracks.size} downloaded",
                    style = MaterialTheme.typography.bodyMedium,
                    color = TextSecondary
                )
            }
        }

        // 2. Segmented Pill Tabs
        item {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                tabs.forEachIndexed { index, title ->
                    val isSelected = selectedTab == index
                    Surface(
                        modifier = Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(12.dp))
                            .clickable { selectedTab = index },
                        color = if (isSelected) CrimsonRed else SurfaceDark,
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Box(
                            contentAlignment = Alignment.Center,
                            modifier = Modifier.padding(vertical = 10.dp)
                        ) {
                            Text(
                                text = title,
                                style = MaterialTheme.typography.bodySmall.copy(
                                    fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                                    fontSize = 12.sp
                                ),
                                color = if (isSelected) Color.White else TextSecondary,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                        }
                    }
                }
            }
        }

        // 3. TAB 0: PLAYLISTS
        if (selectedTab == 0) {
            item {
                Surface(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 20.dp, vertical = 8.dp)
                        .clip(RoundedCornerShape(14.dp))
                        .clickable { showCreateDialog = true },
                    color = SurfaceElevated,
                    shape = RoundedCornerShape(14.dp)
                ) {
                    Row(
                        modifier = Modifier.padding(14.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Icon(
                            Icons.Default.Add,
                            contentDescription = "New Playlist",
                            tint = CrimsonRed,
                            modifier = Modifier.size(28.dp)
                        )
                        Text(
                            text = "Create New Playlist",
                            style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                            color = TextPrimary
                        )
                    }
                }
            }

            if (playlistUiState.playlists.isEmpty()) {
                item {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(260.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Text(
                                text = "No playlists found",
                                style = MaterialTheme.typography.titleMedium,
                                color = TextPrimary
                            )
                            Text(
                                text = "Tap 'Create New Playlist' to curate your favorite music.",
                                style = MaterialTheme.typography.bodyMedium,
                                color = TextSecondary
                            )
                        }
                    }
                }
            } else {
                items(playlistUiState.playlists) { playlist ->
                    Surface(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 20.dp, vertical = 4.dp)
                            .clip(RoundedCornerShape(12.dp))
                            .clickable { onPlaylistClick(playlist.id) },
                        color = SurfaceDark
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(12.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(14.dp)
                        ) {
                            Surface(
                                modifier = Modifier.size(48.dp),
                                shape = RoundedCornerShape(8.dp),
                                color = SurfaceElevated
                            ) {
                                Box(contentAlignment = Alignment.Center) {
                                    Icon(
                                        Icons.Default.QueueMusic,
                                        contentDescription = null,
                                        tint = CrimsonRed,
                                        modifier = Modifier.size(24.dp)
                                    )
                                }
                            }

                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = playlist.title,
                                    style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                                    color = TextPrimary,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis
                                )
                                Text(
                                    text = "${playlist.trackCount} songs" + if (playlist.description.isNotBlank()) " • ${playlist.description}" else "",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = TextSecondary,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis
                                )
                            }

                            if (playlist.tracks.isNotEmpty()) {
                                IconButton(
                                    onClick = {
                                        playerViewModel.playTrack(playlist.tracks.first(), newQueue = playlist.tracks)
                                    },
                                    modifier = Modifier.size(40.dp)
                                ) {
                                    Icon(
                                        Icons.Default.PlayArrow,
                                        contentDescription = "Play",
                                        tint = CrimsonRed,
                                        modifier = Modifier.size(28.dp)
                                    )
                                }
                            }

                            Icon(
                                Icons.Default.ChevronRight,
                                contentDescription = "Open",
                                tint = TextMuted,
                                modifier = Modifier.size(22.dp)
                            )
                        }
                    }
                }
            }
        }

        // 4. TAB 1: LIKED SONGS
        else if (selectedTab == 1) {
            if (uiState.likedTracks.isEmpty()) {
                item {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(280.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(10.dp),
                            modifier = Modifier.padding(24.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.FavoriteBorder,
                                contentDescription = null,
                                tint = CrimsonRed,
                                modifier = Modifier.size(54.dp)
                            )
                            Text(
                                text = "No liked songs yet",
                                style = MaterialTheme.typography.titleLarge,
                                color = TextPrimary
                            )
                            Text(
                                text = "Tap the heart icon on any track while playing to save it to your cloud library.",
                                style = MaterialTheme.typography.bodyMedium,
                                color = TextSecondary,
                                textAlign = TextAlign.Center
                            )
                        }
                    }
                }
            } else {
                // Hero Liked Songs Banner
                item {
                    Surface(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 20.dp, vertical = 8.dp),
                        shape = RoundedCornerShape(18.dp),
                        color = Color.Transparent
                    ) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(18.dp))
                                .background(
                                    Brush.horizontalGradient(
                                        colors = listOf(Color(0xFF8B0000), Color(0xFF3B0000))
                                    )
                                )
                                .padding(18.dp)
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(14.dp)
                                ) {
                                    Surface(
                                        modifier = Modifier.size(52.dp),
                                        shape = RoundedCornerShape(10.dp),
                                        color = CrimsonRed
                                    ) {
                                        Box(contentAlignment = Alignment.Center) {
                                            Icon(
                                                Icons.Default.Favorite,
                                                contentDescription = null,
                                                tint = Color.White,
                                                modifier = Modifier.size(28.dp)
                                            )
                                        }
                                    }

                                    Column {
                                        Text(
                                            text = "Auto Playlist",
                                            style = MaterialTheme.typography.bodySmall,
                                            color = Color.White.copy(alpha = 0.8f)
                                        )
                                        Text(
                                            text = "Liked Songs",
                                            style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.ExtraBold),
                                            color = Color.White
                                        )
                                        Text(
                                            text = "${uiState.likedTracks.size} tracks",
                                            style = MaterialTheme.typography.bodySmall,
                                            color = Color.White.copy(alpha = 0.7f)
                                        )
                                    }
                                }

                                FloatingActionButton(
                                    onClick = {
                                        if (uiState.likedTracks.isNotEmpty()) {
                                            playerViewModel.playTrack(uiState.likedTracks.first(), newQueue = uiState.likedTracks)
                                        }
                                    },
                                    containerColor = Color.White,
                                    contentColor = CrimsonRed,
                                    shape = CircleShape,
                                    modifier = Modifier.size(48.dp)
                                ) {
                                    Icon(Icons.Default.PlayArrow, contentDescription = "Play All", modifier = Modifier.size(28.dp))
                                }
                            }
                        }
                    }
                }

                // Liked Tracks List
                items(uiState.likedTracks) { track ->
                    Surface(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 20.dp, vertical = 4.dp)
                            .clip(RoundedCornerShape(12.dp))
                            .clickable { playerViewModel.playTrack(track, uiState.likedTracks) },
                        color = SurfaceDark
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
                                    style = MaterialTheme.typography.bodyMedium.copy(fontSize = 12.sp),
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis,
                                    color = TextSecondary
                                )
                            }

                            IconButton(onClick = { libraryViewModel.toggleLike(track) }) {
                                Icon(
                                    imageVector = Icons.Default.Favorite,
                                    contentDescription = "Unlike",
                                    tint = CrimsonRed,
                                    modifier = Modifier.size(22.dp)
                                )
                            }
                        }
                    }
                }
            }
        }

        // 5. TAB 2: DOWNLOADED (OFFLINE VAULT & SMART DOWNLOADS)
        else {
            // Sub-filter Chips: [ All (N) | ⚡ Smart Downloads (S) | 💾 Manual (M) ]
            item {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 20.dp, vertical = 6.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    FilterChip(
                        selected = downloadSubFilter == "ALL",
                        onClick = { downloadSubFilter = "ALL" },
                        label = { Text("All (${uiState.offlineTracks.size})", fontSize = 12.sp) },
                        colors = FilterChipDefaults.filterChipColors(selectedContainerColor = CrimsonRed, selectedLabelColor = Color.White)
                    )

                    FilterChip(
                        selected = downloadSubFilter == "SMART",
                        onClick = { downloadSubFilter = "SMART" },
                        label = { Text("⚡ Smart (${smartTracks.size})", fontSize = 12.sp) },
                        colors = FilterChipDefaults.filterChipColors(selectedContainerColor = CrimsonRed, selectedLabelColor = Color.White)
                    )

                    FilterChip(
                        selected = downloadSubFilter == "MANUAL",
                        onClick = { downloadSubFilter = "MANUAL" },
                        label = { Text("💾 Manual (${manualTracks.size})", fontSize = 12.sp) },
                        colors = FilterChipDefaults.filterChipColors(selectedContainerColor = CrimsonRed, selectedLabelColor = Color.White)
                    )
                }
            }

            // Hero Smart Downloads Card
            item {
                Surface(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 20.dp, vertical = 6.dp),
                    shape = RoundedCornerShape(18.dp),
                    color = Color.Transparent
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(18.dp))
                            .background(
                                Brush.horizontalGradient(
                                    colors = listOf(Color(0xFF1E293B), Color(0xFF0F172A))
                                )
                            )
                            .padding(18.dp)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                    Icon(Icons.Default.AutoAwesome, contentDescription = null, tint = Color(0xFF38BDF8), modifier = Modifier.size(18.dp))
                                    Text(
                                        text = "Smart Offline Vault",
                                        style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                                        color = Color.White
                                    )
                                }
                                Spacer(Modifier.height(4.dp))
                                Text(
                                    text = "${smartTracks.size} smart-cached • ${manualTracks.size} manual • ${uiState.totalStorageFormatted}",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = Color.White.copy(alpha = 0.7f)
                                )
                            }

                            if (displayedOfflineTracks.isNotEmpty()) {
                                FloatingActionButton(
                                    onClick = {
                                        playerViewModel.playTrack(displayedOfflineTracks.first(), newQueue = displayedOfflineTracks)
                                    },
                                    containerColor = Color.White,
                                    contentColor = Color.Black,
                                    shape = CircleShape,
                                    modifier = Modifier.size(46.dp)
                                ) {
                                    Icon(Icons.Default.PlayArrow, contentDescription = "Play Offline", modifier = Modifier.size(26.dp))
                                }
                            }
                        }
                    }
                }
            }

            if (displayedOfflineTracks.isEmpty()) {
                item {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(240.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(8.dp),
                            modifier = Modifier.padding(24.dp)
                        ) {
                            Icon(
                                Icons.Default.CloudDownload,
                                contentDescription = null,
                                tint = TextMuted,
                                modifier = Modifier.size(48.dp)
                            )
                            Text(
                                text = if (downloadSubFilter == "SMART") "No smart downloads cached" else "No offline downloads found",
                                style = MaterialTheme.typography.titleMedium,
                                color = TextPrimary
                            )
                            Text(
                                text = "Smart Downloads automatically caches your favorite tracks when on Wi-Fi.",
                                style = MaterialTheme.typography.bodyMedium,
                                color = TextSecondary,
                                textAlign = TextAlign.Center
                            )
                        }
                    }
                }
            } else {
                items(displayedOfflineTracks) { track ->
                    val isSmart = track.downloadType == "smart"
                    Surface(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 20.dp, vertical = 4.dp)
                            .clip(RoundedCornerShape(12.dp))
                            .clickable { playerViewModel.playTrack(track, displayedOfflineTracks) },
                        color = SurfaceDark
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
                                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                    Text(
                                        text = track.title,
                                        style = MaterialTheme.typography.titleMedium.copy(fontSize = 14.sp),
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis,
                                        color = TextPrimary
                                    )
                                    if (isSmart) {
                                        Surface(
                                            shape = RoundedCornerShape(4.dp),
                                            color = Color(0xFF0284C7).copy(alpha = 0.25f)
                                        ) {
                                            Text(
                                                text = "SMART",
                                                modifier = Modifier.padding(horizontal = 4.dp, vertical = 1.dp),
                                                fontSize = 9.sp,
                                                fontWeight = FontWeight.Bold,
                                                color = Color(0xFF38BDF8)
                                            )
                                        }
                                    }
                                }
                                Text(
                                    text = track.artist,
                                    style = MaterialTheme.typography.bodyMedium.copy(fontSize = 12.sp),
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis,
                                    color = TextSecondary
                                )
                            }

                            // Delete / Remove Download Icon
                            IconButton(
                                onClick = {
                                    libraryViewModel.deleteTrack(track.id)
                                    android.widget.Toast.makeText(context, "Removed from offline vault", android.widget.Toast.LENGTH_SHORT).show()
                                },
                                modifier = Modifier.size(36.dp)
                            ) {
                                Icon(
                                    Icons.Default.DeleteOutline,
                                    contentDescription = "Delete Offline Track",
                                    tint = TextMuted,
                                    modifier = Modifier.size(20.dp)
                                )
                            }
                        }
                    }
                }
            }
        }
    }

    if (showCreateDialog) {
        AlertDialog(
            onDismissRequest = { showCreateDialog = false },
            title = { Text("New Playlist", color = TextPrimary) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    OutlinedTextField(
                        value = newPlaylistTitle,
                        onValueChange = { newPlaylistTitle = it },
                        label = { Text("Playlist Name") },
                        singleLine = true
                    )
                    OutlinedTextField(
                        value = newPlaylistDesc,
                        onValueChange = { newPlaylistDesc = it },
                        label = { Text("Description (Optional)") },
                        singleLine = false,
                        maxLines = 2
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        if (newPlaylistTitle.isNotBlank()) {
                            playlistViewModel.createPlaylist(newPlaylistTitle.trim(), newPlaylistDesc.trim())
                            newPlaylistTitle = ""
                            newPlaylistDesc = ""
                            showCreateDialog = false
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = CrimsonRed)
                ) {
                    Text("Create")
                }
            },
            dismissButton = {
                TextButton(onClick = { showCreateDialog = false }) {
                    Text("Cancel", color = TextSecondary)
                }
            },
            containerColor = SurfaceDark
        )
    }
}
