package com.mrj.music.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.mrj.music.ui.theme.*
import com.mrj.music.ui.viewmodel.AuthViewModel
import com.mrj.music.ui.viewmodel.UpdateViewModel

@Composable
fun SettingsScreen(
    authViewModel: AuthViewModel,
    updateViewModel: UpdateViewModel,
    onNavigateToAuth: () -> Unit,
    modifier: Modifier = Modifier
) {
    val authState by authViewModel.uiState.collectAsState()
    val updateState by updateViewModel.uiState.collectAsState()

    var audioQuality by remember { mutableStateOf("High (320 kbps)") }
    var smartDownloads by remember { mutableStateOf(true) }
    var showNameDialog by remember { mutableStateOf(false) }
    var preferredNameInput by remember { mutableStateOf(authState.preferredName ?: "") }

    LazyColumn(
        modifier = modifier
            .fillMaxSize()
            .background(DeepDarkBg),
        contentPadding = PaddingValues(start = 20.dp, end = 20.dp, top = 16.dp, bottom = 120.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // 1. Header
        item {
            Text(
                text = "Settings",
                style = MaterialTheme.typography.headlineMedium
            )
        }

        // 2. Account Profile Section
        item {
            Surface(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                color = SurfaceDark
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Icon(
                            Icons.Default.AccountCircle,
                            contentDescription = null,
                            tint = CrimsonRed,
                            modifier = Modifier.size(40.dp)
                        )
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = authState.preferredName ?: authState.userName ?: "Guest Listener",
                                style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                                color = TextPrimary
                            )
                            Text(
                                text = authState.userEmail ?: "Sign in to sync your library across devices",
                                style = MaterialTheme.typography.bodyMedium,
                                color = TextSecondary
                            )
                        }
                    }

                    Spacer(Modifier.height(12.dp))

                    if (authState.isAuthenticated) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            OutlinedButton(
                                onClick = {
                                    preferredNameInput = authState.preferredName ?: authState.userName ?: ""
                                    showNameDialog = true
                                },
                                modifier = Modifier.weight(1f),
                                colors = ButtonDefaults.outlinedButtonColors(contentColor = TextPrimary)
                            ) {
                                Text("Callout Name", fontSize = 12.sp)
                            }

                            Button(
                                onClick = { authViewModel.logout() },
                                modifier = Modifier.weight(1f),
                                colors = ButtonDefaults.buttonColors(containerColor = SurfaceElevated)
                            ) {
                                Text("Sign Out", fontSize = 12.sp, color = BrightRed)
                            }
                        }
                    } else {
                        Button(
                            onClick = onNavigateToAuth,
                            modifier = Modifier.fillMaxWidth(),
                            colors = ButtonDefaults.buttonColors(containerColor = CrimsonRed)
                        ) {
                            Text("Sign In or Register", fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }

        // 3. Audio & Streaming Quality
        item {
            Text(
                text = "Audio & Playback",
                style = MaterialTheme.typography.titleMedium,
                color = TextSecondary
            )
        }

        item {
            Surface(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                color = SurfaceDark
            ) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                    SettingRow(
                        icon = Icons.Default.HighQuality,
                        title = "Streaming Quality",
                        subtitle = audioQuality,
                        onClick = {
                            audioQuality = when (audioQuality) {
                                "High (320 kbps)" -> "Lossless (Flac/Opus)"
                                "Lossless (Flac/Opus)" -> "Standard (160 kbps)"
                                else -> "High (320 kbps)"
                            }
                        }
                    )

                    Divider(color = SurfaceBorder)

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text("Smart Downloads", style = MaterialTheme.typography.titleMedium, color = TextPrimary)
                            Text("Automatically cache favorite songs for offline listening", style = MaterialTheme.typography.bodyMedium, color = TextSecondary)
                        }
                        Switch(
                            checked = smartDownloads,
                            onCheckedChange = { smartDownloads = it },
                            colors = SwitchDefaults.colors(checkedThumbColor = Color.White, checkedTrackColor = CrimsonRed)
                        )
                    }
                }
            }
        }

        // 4. In-App Updates & App Info
        item {
            Text(
                text = "System & Updates",
                style = MaterialTheme.typography.titleMedium,
                color = TextSecondary
            )
        }

        item {
            val context = androidx.compose.ui.platform.LocalContext.current
            val installedVersionText = remember {
                try {
                    val pInfo = context.packageManager.getPackageInfo(context.packageName, 0)
                    val vName = pInfo.versionName ?: "3.1.0"
                    val vCode = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.P) {
                        pInfo.longVersionCode
                    } else {
                        @Suppress("DEPRECATION")
                        pInfo.versionCode.toLong()
                    }
                    "Version $vName (Build $vCode)"
                } catch (e: Exception) {
                    "Version 3.1.0 (Build 301)"
                }
            }

            Surface(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                color = SurfaceDark
            ) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Column {
                            Text("MRJ Music Native Android", style = MaterialTheme.typography.titleMedium, color = TextPrimary)
                            Text(installedVersionText, style = MaterialTheme.typography.bodyMedium, color = TextSecondary)
                        }

                        Button(
                            onClick = { updateViewModel.checkForUpdate(isUserInitiated = true) },
                            colors = ButtonDefaults.buttonColors(containerColor = CrimsonRed),
                            enabled = !updateState.isChecking && !updateState.isDownloading
                        ) {
                            if (updateState.isChecking) {
                                CircularProgressIndicator(color = Color.White, modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
                            } else {
                                Icon(Icons.Default.SystemUpdate, contentDescription = null, modifier = Modifier.size(16.dp))
                                Spacer(Modifier.width(6.dp))
                                Text("Check Update", fontSize = 12.sp)
                            }
                        }
                    }

                    if (updateState.statusMessage != null) {
                        Text(
                            text = updateState.statusMessage!!,
                            style = MaterialTheme.typography.bodyMedium,
                            color = AccentGreen
                        )
                    }

                    if (updateState.errorMessage != null) {
                        Text(
                            text = updateState.errorMessage!!,
                            style = MaterialTheme.typography.bodyMedium,
                            color = BrightRed
                        )
                    }
                }
            }
        }
    }

    // Callout Name Dialog
    if (showNameDialog) {
        AlertDialog(
            onDismissRequest = { showNameDialog = false },
            title = { Text("Set Preferred Callout Name", style = MaterialTheme.typography.titleMedium) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        "How should MRJ Music address you on the dashboard?",
                        style = MaterialTheme.typography.bodyMedium,
                        color = TextSecondary
                    )
                    OutlinedTextField(
                        value = preferredNameInput,
                        onValueChange = { preferredNameInput = it },
                        placeholder = { Text("e.g. Shivam") },
                        singleLine = true,
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = CrimsonRed,
                            unfocusedBorderColor = SurfaceBorder
                        )
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        authViewModel.updatePreferredName(preferredNameInput)
                        showNameDialog = false
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = CrimsonRed)
                ) {
                    Text("Save")
                }
            },
            dismissButton = {
                TextButton(onClick = { showNameDialog = false }) {
                    Text("Cancel", color = TextSecondary)
                }
            },
            containerColor = SurfaceElevated
        )
    }
}

@Composable
fun SettingRow(
    icon: ImageVector,
    title: String,
    subtitle: String,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onClick() },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        Icon(icon, contentDescription = null, tint = CrimsonRed, modifier = Modifier.size(24.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(title, style = MaterialTheme.typography.titleMedium, color = TextPrimary)
            Text(subtitle, style = MaterialTheme.typography.bodyMedium, color = TextSecondary)
        }
        Icon(Icons.Default.ChevronRight, contentDescription = null, tint = TextMuted)
    }
}
