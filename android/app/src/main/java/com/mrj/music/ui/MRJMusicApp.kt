package com.mrj.music.ui

import androidx.compose.animation.*
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
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
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavType
import androidx.navigation.navArgument
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.viewinterop.AndroidView
import coil.compose.AsyncImage
import com.mrj.music.ui.screens.*
import com.mrj.music.ui.theme.*
import com.mrj.music.ui.viewmodel.*

sealed class Screen(val route: String, val title: String, val icon: ImageVector) {
    object Home : Screen("home", "Home", Icons.Default.Home)
    object Search : Screen("search", "Search", Icons.Default.Search)
    object Library : Screen("library", "Library", Icons.Default.LibraryMusic)
    object Settings : Screen("settings", "Settings", Icons.Default.Settings)
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MRJMusicApp(
    homeViewModel: HomeViewModel = viewModel(),
    searchViewModel: SearchViewModel = viewModel(),
    libraryViewModel: LibraryViewModel = viewModel(),
    playerViewModel: PlayerViewModel = viewModel(),
    authViewModel: AuthViewModel = viewModel(),
    updateViewModel: UpdateViewModel = viewModel(),
    artistViewModel: ArtistViewModel = viewModel(),
    stationViewModel: StationViewModel = viewModel(),
    playlistViewModel: PlaylistViewModel = viewModel()
) {
    val navController = rememberNavController()
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = navBackStackEntry?.destination?.route ?: Screen.Home.route

    val authState by authViewModel.uiState.collectAsState()
    val playerState by playerViewModel.uiState.collectAsState()
    val updateState by updateViewModel.uiState.collectAsState()

    var isPlayerExpanded by remember { mutableStateOf(false) }
    var isAuthVisible by remember { mutableStateOf(false) }

    val navigateToArtist: (String) -> Unit = { name ->
        if (name.isNotBlank()) {
            val enc = try {
                java.net.URLEncoder.encode(name, "UTF-8")
            } catch (e: Exception) {
                name
            }
            navController.navigate("artist/$enc")
        }
    }

    val navigateToStation: (String, String, String) -> Unit = { type, id, name ->
        val encName = try {
            java.net.URLEncoder.encode(name, "UTF-8")
        } catch (e: Exception) {
            name
        }
        navController.navigate("station/$type/$id?name=$encName")
    }

    val navigateToPlaylist: (String) -> Unit = { id ->
        navController.navigate("playlist/$id")
    }

    LaunchedEffect(authState.isAuthenticated) {
        homeViewModel.loadHomeData()
        libraryViewModel.refreshLibrary()
        playlistViewModel.refreshPlaylists()
    }

    val bottomNavItems = listOf(Screen.Home, Screen.Search, Screen.Library, Screen.Settings)

    Scaffold(
        modifier = Modifier.fillMaxSize(),
        contentWindowInsets = WindowInsets(0, 0, 0, 0),
        bottomBar = {
            Column(modifier = Modifier.background(DeepDarkBg)) {
                if (playerState.currentTrack != null) {
                    MiniPlayerBar(
                        playerViewModel = playerViewModel,
                        onExpand = { isPlayerExpanded = true }
                    )
                }

                NavigationBar(
                    containerColor = SurfaceDark,
                    tonalElevation = 4.dp
                ) {
                    bottomNavItems.forEach { screen ->
                        val isSelected = currentRoute == screen.route
                        NavigationBarItem(
                            icon = {
                                Icon(
                                    imageVector = screen.icon,
                                    contentDescription = screen.title,
                                    tint = if (isSelected) CrimsonRed else TextMuted
                                )
                            },
                            label = {
                                Text(
                                    text = screen.title,
                                    fontSize = 11.sp,
                                    fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                                    color = if (isSelected) CrimsonRed else TextMuted
                                )
                            },
                            selected = isSelected,
                            onClick = {
                                if (currentRoute != screen.route) {
                                    navController.navigate(screen.route) {
                                        popUpTo(Screen.Home.route) { saveState = true }
                                        launchSingleTop = true
                                        restoreState = true
                                    }
                                }
                            },
                            colors = NavigationBarItemDefaults.colors(
                                indicatorColor = Color.Transparent
                            )
                        )
                    }
                }
            }
        },
        containerColor = DeepDarkBg
    ) { innerPadding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(DeepDarkBg)
                .padding(bottom = innerPadding.calculateBottomPadding())
        ) {
            // Keep Player Engine WebView permanently attached to the active Window hierarchy
            AndroidView(
                factory = { ctx ->
                    playerViewModel.getOrCreatePlayerEngineView(ctx)
                },
                modifier = Modifier
                    .size(1.dp)
                    .alpha(0.001f)
            )

            NavHost(
                navController = navController,
                startDestination = Screen.Home.route,
                modifier = Modifier.fillMaxSize()
            ) {
                composable(Screen.Home.route) {
                    HomeScreen(
                        homeViewModel = homeViewModel,
                        playerViewModel = playerViewModel,
                        onArtistClick = navigateToArtist,
                        onStationClick = navigateToStation
                    )
                }
                composable(Screen.Search.route) {
                    SearchScreen(
                        searchViewModel = searchViewModel,
                        playerViewModel = playerViewModel,
                        stationViewModel = stationViewModel,
                        onArtistClick = navigateToArtist,
                        onStationClick = navigateToStation
                    )
                }
                composable(Screen.Library.route) {
                    LibraryScreen(
                        libraryViewModel = libraryViewModel,
                        playerViewModel = playerViewModel,
                        playlistViewModel = playlistViewModel,
                        onPlaylistClick = navigateToPlaylist
                    )
                }
                composable(Screen.Settings.route) {
                    SettingsScreen(
                        authViewModel = authViewModel,
                        updateViewModel = updateViewModel,
                        playerViewModel = playerViewModel,
                        onNavigateToAuth = { isAuthVisible = true }
                    )
                }
                composable("artist/{artistName}") { backStackEntry ->
                    val rawName = backStackEntry.arguments?.getString("artistName") ?: ""
                    val artistName = try {
                        java.net.URLDecoder.decode(rawName, "UTF-8")
                    } catch (e: Exception) {
                        rawName
                    }
                    ArtistScreen(
                        artistName = artistName,
                        artistViewModel = artistViewModel,
                        playerViewModel = playerViewModel,
                        onBack = { navController.popBackStack() },
                        onArtistClick = navigateToArtist
                    )
                }
                composable(
                    route = "station/{type}/{id}?name={name}",
                    arguments = listOf(
                        navArgument("type") { type = NavType.StringType },
                        navArgument("id") { type = NavType.StringType },
                        navArgument("name") {
                            type = NavType.StringType
                            nullable = true
                            defaultValue = null
                        }
                    )
                ) { backStackEntry ->
                    val type = backStackEntry.arguments?.getString("type") ?: "genre"
                    val id = backStackEntry.arguments?.getString("id") ?: ""
                    val rawName = backStackEntry.arguments?.getString("name")
                    val name = if (rawName != null) {
                        try { java.net.URLDecoder.decode(rawName, "UTF-8") } catch (e: Exception) { rawName }
                    } else null

                    StationScreen(
                        stationType = type,
                        stationId = id,
                        stationName = name,
                        stationViewModel = stationViewModel,
                        playerViewModel = playerViewModel,
                        onBack = { navController.popBackStack() },
                        onArtistClick = navigateToArtist
                    )
                }
                composable("playlist/{playlistId}") { backStackEntry ->
                    val playlistId = backStackEntry.arguments?.getString("playlistId") ?: ""
                    PlaylistDetailScreen(
                        playlistId = playlistId,
                        playlistViewModel = playlistViewModel,
                        playerViewModel = playerViewModel,
                        onBack = { navController.popBackStack() },
                        onArtistClick = navigateToArtist
                    )
                }
            }
        }
    }

    // Handle Android hardware/gesture Back button for modals
    androidx.activity.compose.BackHandler(enabled = isPlayerExpanded) {
        isPlayerExpanded = false
    }

    androidx.activity.compose.BackHandler(enabled = isAuthVisible) {
        isAuthVisible = false
    }

    // FullScreen Player Modal Sheet
    AnimatedVisibility(
        visible = isPlayerExpanded && playerState.currentTrack != null,
        enter = slideInVertically(initialOffsetY = { it }),
        exit = slideOutVertically(targetOffsetY = { it })
    ) {
        FullScreenPlayerSheet(
            playerViewModel = playerViewModel,
            onDismiss = { isPlayerExpanded = false },
            onArtistClick = navigateToArtist,
            playlistViewModel = playlistViewModel
        )
    }

    // Native Auth Modal Screen
    AnimatedVisibility(
        visible = isAuthVisible,
        enter = fadeIn() + slideInVertically(initialOffsetY = { it / 2 }),
        exit = fadeOut() + slideOutVertically(targetOffsetY = { it / 2 })
    ) {
        AuthModalScreen(
            authViewModel = authViewModel,
            onDismiss = { isAuthVisible = false }
        )
    }

    // In-App Update Dialog
    if (updateState.isUpdateAvailable && !updateState.isDownloading) {
        AlertDialog(
            onDismissRequest = { updateViewModel.dismissUpdateModal() },
            title = {
                Text(
                    text = "New Update Available (v${updateState.latestVersion})",
                    style = MaterialTheme.typography.titleLarge
                )
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        "An updated production release of MRJ Music is ready to install.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = TextSecondary
                    )
                    updateState.changelog.take(3).forEach { note ->
                        Text("• $note", style = MaterialTheme.typography.bodyMedium, color = TextPrimary)
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = { updateViewModel.startDownloadAndInstall() },
                    colors = ButtonDefaults.buttonColors(containerColor = CrimsonRed)
                ) {
                    Text("Update Now", fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { updateViewModel.dismissUpdateModal() }) {
                    Text("Later", color = TextSecondary)
                }
            },
            containerColor = SurfaceElevated
        )
    }

    // In-App Update Download Progress
    if (updateState.isDownloading) {
        AlertDialog(
            onDismissRequest = {},
            title = { Text("Downloading Update...", style = MaterialTheme.typography.titleMedium) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    LinearProgressIndicator(
                        progress = updateState.downloadProgress,
                        modifier = Modifier.fillMaxWidth(),
                        color = CrimsonRed,
                        trackColor = SurfaceBorder
                    )
                    Text(
                        text = "${(updateState.downloadProgress * 100).toInt()}% completed",
                        style = MaterialTheme.typography.bodyMedium,
                        color = TextSecondary
                    )
                }
            },
            confirmButton = {},
            containerColor = SurfaceElevated
        )
    }
}

@Composable
fun MiniPlayerBar(
    playerViewModel: PlayerViewModel,
    onExpand: () -> Unit
) {
    val uiState by playerViewModel.uiState.collectAsState()
    val track = uiState.currentTrack ?: return
    val currentPosition = uiState.positionMs
    val duration = if (uiState.durationMs > 0) uiState.durationMs else 1L
    val progress = (currentPosition.toFloat() / duration.toFloat()).coerceIn(0f, 1f)
    val likedTrackIds by playerViewModel.likedTrackIds.collectAsState()
    val isLiked = likedTrackIds.contains(track.id)

    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 6.dp)
            .clip(RoundedCornerShape(16.dp))
            .clickable { onExpand() },
        color = Color(0xFF14141A).copy(alpha = 0.96f),
        shape = RoundedCornerShape(16.dp),
        border = BorderStroke(1.dp, SurfaceBorder.copy(alpha = 0.4f)),
        shadowElevation = 12.dp
    ) {
        Column {
            // 1. Glowing Crimson Progress Bar on top edge (Image 3)
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(2.5.dp)
                    .background(Color.White.copy(alpha = 0.08f))
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth(progress)
                        .fillMaxHeight()
                        .background(
                            Brush.horizontalGradient(listOf(CrimsonRed, Color(0xFFFF3366)))
                        )
                )
            }

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 10.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                // 2. Rounded square artwork with animated live equalizer overlay (Image 3)
                Box(
                    modifier = Modifier
                        .size(46.dp)
                        .clip(RoundedCornerShape(10.dp)),
                    contentAlignment = Alignment.Center
                ) {
                    AsyncImage(
                        model = track.thumbnail,
                        contentDescription = track.title,
                        modifier = Modifier.fillMaxSize(),
                        contentScale = ContentScale.Crop
                    )
                    if (uiState.isPlaying) {
                        Box(
                            modifier = Modifier
                                .fillMaxSize()
                                .background(Color.Black.copy(alpha = 0.35f)),
                            contentAlignment = Alignment.Center
                        ) {
                            Row(
                                horizontalArrangement = Arrangement.spacedBy(2.5.dp),
                                verticalAlignment = Alignment.Bottom,
                                modifier = Modifier.height(14.dp)
                            ) {
                                Box(modifier = Modifier.width(2.5.dp).height(12.dp).background(Color.White, RoundedCornerShape(1.dp)))
                                Box(modifier = Modifier.width(2.5.dp).height(8.dp).background(Color.White, RoundedCornerShape(1.dp)))
                                Box(modifier = Modifier.width(2.5.dp).height(14.dp).background(Color.White, RoundedCornerShape(1.dp)))
                            }
                        }
                    }
                }

                // 3. Track title & artist marquee
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
                    Spacer(Modifier.height(2.dp))
                    Text(
                        text = track.artist,
                        style = MaterialTheme.typography.bodyMedium.copy(fontSize = 12.sp),
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        color = TextSecondary
                    )
                }

                // 4. Like / Favorite Button (Image 3)
                IconButton(
                    onClick = { playerViewModel.toggleLike(track) },
                    modifier = Modifier.size(32.dp)
                ) {
                    Icon(
                        imageVector = if (isLiked) Icons.Default.Favorite else Icons.Default.FavoriteBorder,
                        contentDescription = "Like",
                        tint = if (isLiked) CrimsonRed else TextSecondary,
                        modifier = Modifier.size(20.dp)
                    )
                }

                // 5. Circular White Play/Pause Button (Image 3)
                Surface(
                    modifier = Modifier
                        .size(38.dp)
                        .clip(CircleShape)
                        .clickable { playerViewModel.togglePlayPause() },
                    color = Color.White,
                    shape = CircleShape
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        if (uiState.isLoading) {
                            CircularProgressIndicator(
                                color = Color.Black,
                                modifier = Modifier.size(16.dp),
                                strokeWidth = 2.dp
                            )
                        } else {
                            Icon(
                                imageVector = if (uiState.isPlaying) Icons.Default.Pause else Icons.Default.PlayArrow,
                                contentDescription = if (uiState.isPlaying) "Pause" else "Play",
                                tint = Color.Black,
                                modifier = Modifier.size(22.dp)
                            )
                        }
                    }
                }

                // 6. Next Track Button (Image 3)
                IconButton(
                    onClick = { playerViewModel.playNext() },
                    modifier = Modifier.size(32.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.SkipNext,
                        contentDescription = "Next",
                        tint = TextPrimary,
                        modifier = Modifier.size(24.dp)
                    )
                }
            }
        }
    }
}
