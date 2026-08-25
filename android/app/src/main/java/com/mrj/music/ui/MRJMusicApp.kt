package com.mrj.music.ui

import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
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
    updateViewModel: UpdateViewModel = viewModel()
) {
    val navController = rememberNavController()
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = navBackStackEntry?.destination?.route ?: Screen.Home.route

    val playerState by playerViewModel.uiState.collectAsState()
    val updateState by updateViewModel.uiState.collectAsState()

    var isPlayerExpanded by remember { mutableStateOf(false) }
    var isAuthVisible by remember { mutableStateOf(false) }

    val bottomNavItems = listOf(Screen.Home, Screen.Search, Screen.Library, Screen.Settings)

    Scaffold(
        modifier = Modifier.fillMaxSize(),
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
        ) {
            NavHost(
                navController = navController,
                startDestination = Screen.Home.route,
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding)
            ) {
                composable(Screen.Home.route) {
                    HomeScreen(
                        homeViewModel = homeViewModel,
                        playerViewModel = playerViewModel
                    )
                }
                composable(Screen.Search.route) {
                    SearchScreen(
                        searchViewModel = searchViewModel,
                        playerViewModel = playerViewModel
                    )
                }
                composable(Screen.Library.route) {
                    LibraryScreen(
                        libraryViewModel = libraryViewModel,
                        playerViewModel = playerViewModel
                    )
                }
                composable(Screen.Settings.route) {
                    SettingsScreen(
                        authViewModel = authViewModel,
                        updateViewModel = updateViewModel,
                        onNavigateToAuth = { isAuthVisible = true }
                    )
                }
            }

            // Background YouTube Audio Engine (Attached to window hierarchy for continuous streaming, off-screen so no touches are consumed)
            AndroidView(
                factory = { ctx ->
                    playerViewModel.getOrCreatePlayerEngineView(ctx)
                },
                modifier = Modifier
                    .size(240.dp)
                    .offset(x = (-3000).dp, y = (-3000).dp)
                    .alpha(0.001f)
            )
        }
    }

    // FullScreen Player Modal Sheet
    AnimatedVisibility(
        visible = isPlayerExpanded && playerState.currentTrack != null,
        enter = slideInVertically(initialOffsetY = { it }),
        exit = slideOutVertically(targetOffsetY = { it })
    ) {
        FullScreenPlayerSheet(
            playerViewModel = playerViewModel,
            onDismiss = { isPlayerExpanded = false }
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

    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 6.dp)
            .clip(RoundedCornerShape(14.dp))
            .clickable { onExpand() },
        color = SurfaceElevated,
        tonalElevation = 6.dp
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            AsyncImage(
                model = track.thumbnail,
                contentDescription = track.title,
                modifier = Modifier
                    .size(44.dp)
                    .clip(RoundedCornerShape(8.dp)),
                contentScale = ContentScale.Crop
            )

            Column(modifier = Modifier.weight(1f)) {
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

            // Autoplay toggle button on MiniPlayerBar
            IconButton(onClick = { playerViewModel.toggleAutoplay() }) {
                Icon(
                    imageVector = Icons.Default.Autorenew,
                    contentDescription = if (uiState.isAutoplay) "Autoplay is ON" else "Autoplay is OFF",
                    tint = if (uiState.isAutoplay) CrimsonRed else TextMuted.copy(alpha = 0.6f),
                    modifier = Modifier.size(22.dp)
                )
            }

            IconButton(onClick = { playerViewModel.togglePlayPause() }) {
                if (uiState.isLoading) {
                    CircularProgressIndicator(color = CrimsonRed, modifier = Modifier.size(20.dp), strokeWidth = 2.dp)
                } else {
                    Icon(
                        imageVector = if (uiState.isPlaying) Icons.Default.Pause else Icons.Default.PlayArrow,
                        contentDescription = if (uiState.isPlaying) "Pause" else "Play",
                        tint = CrimsonRed,
                        modifier = Modifier.size(28.dp)
                    )
                }
            }

            IconButton(onClick = { playerViewModel.playNext() }) {
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
