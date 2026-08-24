package com.mrj.music.ui

import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.*
import com.mrj.music.ui.screens.home.HomeScreen
import com.mrj.music.ui.screens.search.SearchScreen
import com.mrj.music.ui.screens.library.LibraryScreen
import com.mrj.music.ui.screens.player.PlayerScreen
import com.mrj.music.ui.screens.login.LoginScreen

sealed class Screen(val route: String, val title: String, val icon: androidx.compose.ui.graphics.vector.ImageVector) {
    object Home : Screen("home", "Home", Icons.Default.Home)
    object Search : Screen("search", "Search", Icons.Default.Search)
    object Library : Screen("library", "Library", Icons.Default.LibraryMusic)
    object Player : Screen("player", "Player", Icons.Default.PlayArrow)
    object Login : Screen("login", "Login", Icons.Default.Person)
    object Update : Screen("update", "Update", Icons.Default.SystemUpdate)
}

@Composable
fun MRJMusicApp() {
    val navController = rememberNavController()
    val items = listOf(Screen.Home, Screen.Search, Screen.Library)

    Scaffold(
        bottomBar = {
            NavigationBar {
                val navBackStackEntry by navController.currentBackStackEntryAsState()
                val currentDestination = navBackStackEntry?.destination

                items.forEach { screen ->
                    NavigationBarItem(
                        icon = { Icon(screen.icon, contentDescription = screen.title) },
                        label = { Text(screen.title) },
                        selected = currentDestination?.hierarchy?.any { it.route == screen.route } == true,
                        onClick = {
                            navController.navigate(screen.route) {
                                popUpTo(navController.graph.findStartDestination().id) {
                                    saveState = true
                                }
                                launchSingleTop = true
                                restoreState = true
                            }
                        }
                    )
                }
            }
        }
    ) { innerPadding ->
        NavHost(
            navController = navController,
            startDestination = Screen.Home.route,
            modifier = Modifier.padding(innerPadding)
        ) {
            composable(Screen.Home.route) { HomeScreen(navController) }
            composable(Screen.Search.route) { SearchScreen(navController) }
            composable(Screen.Library.route) { LibraryScreen(navController) }
            composable(Screen.Player.route) { PlayerScreen(navController) }
            composable(Screen.Login.route) { LoginScreen(navController) }
            composable(Screen.Update.route) { com.mrj.music.ui.screens.UpdateScreen() }
        }
    }
}
