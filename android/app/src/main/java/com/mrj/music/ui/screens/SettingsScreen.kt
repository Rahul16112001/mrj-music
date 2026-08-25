package com.mrj.music.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.mrj.music.smartdownload.SmartDownloadPreferences
import com.mrj.music.smartdownload.SmartDownloadScheduler
import com.mrj.music.storage.NativeOfflineStorage
import com.mrj.music.ui.components.EqualizerSheet
import com.mrj.music.ui.theme.*
import com.mrj.music.ui.viewmodel.AuthViewModel
import com.mrj.music.ui.viewmodel.PlayerViewModel
import com.mrj.music.ui.viewmodel.UpdateViewModel

@Composable
fun SettingsScreen(
    authViewModel: AuthViewModel,
    updateViewModel: UpdateViewModel,
    onNavigateToAuth: () -> Unit,
    playerViewModel: PlayerViewModel? = null,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val authState by authViewModel.uiState.collectAsState()
    val updateState by updateViewModel.uiState.collectAsState()

    val smartPrefs = remember { SmartDownloadPreferences.getInstance(context) }
    val smartConfig by smartPrefs.configFlow.collectAsState()
    val offlineStorage = remember { NativeOfflineStorage.getInstance(context) }

    var storageStats by remember { mutableStateOf(offlineStorage.getStorageBreakdown()) }
    var showNameDialog by remember { mutableStateOf(false) }
    var showEqualizerSheet by remember { mutableStateOf(false) }
    var preferredNameInput by remember { mutableStateOf(authState.preferredName ?: "") }

    fun refreshStorage() {
        storageStats = offlineStorage.getStorageBreakdown()
    }

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

        // 3. Audio & Sound FX Section
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
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
                    SettingRow(
                        icon = Icons.Default.Equalizer,
                        title = "Graphic Equalizer & FX",
                        subtitle = "5-Band EQ, Bass Boost & 3D Spatializer",
                        onClick = { showEqualizerSheet = true }
                    )

                    HorizontalDivider(color = SurfaceBorder)

                    SettingRow(
                        icon = Icons.Default.HighQuality,
                        title = "Streaming Quality",
                        subtitle = smartConfig.audioQuality + " Quality (256-320 kbps)",
                        onClick = {
                            val nextQ = when (smartConfig.audioQuality) {
                                "HIGH" -> "MEDIUM"
                                "MEDIUM" -> "LOW"
                                else -> "HIGH"
                            }
                            smartPrefs.setAudioQuality(nextQ)
                        }
                    )
                }
            }
        }

        // 4. YouTube Music-Style Smart Downloads & Storage Management
        item {
            Text(
                text = "Smart Downloads & Offline Storage",
                style = MaterialTheme.typography.titleMedium,
                color = TextSecondary
            )
        }

        item {
            val smartBytes = (storageStats["smartBytes"] as? Long) ?: 0L
            val manualBytes = (storageStats["manualBytes"] as? Long) ?: 0L
            val usableDeviceBytes = (storageStats["usableDeviceBytes"] as? Long) ?: 1L
            val totalDeviceBytes = (storageStats["totalDeviceBytes"] as? Long) ?: 1L

            Surface(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                color = SurfaceDark
            ) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                    // Toggle Switch
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                Text("Smart Downloads", style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold), color = TextPrimary)
                                Surface(
                                    shape = RoundedCornerShape(6.dp),
                                    color = CrimsonRed.copy(alpha = 0.2f)
                                ) {
                                    Text("AUTO", modifier = Modifier.padding(horizontal = 5.dp, vertical = 1.dp), color = CrimsonRed, fontSize = 9.sp, fontWeight = FontWeight.Bold)
                                }
                            }
                            Spacer(Modifier.height(2.dp))
                            Text("Automatically downloads your favorite music and daily mixes when on Wi-Fi", style = MaterialTheme.typography.bodySmall, color = TextSecondary)
                        }
                        Switch(
                            checked = smartConfig.isEnabled,
                            onCheckedChange = {
                                smartPrefs.setEnabled(it)
                                if (it) SmartDownloadScheduler.schedulePeriodicSync(context)
                                else SmartDownloadScheduler.cancelPeriodicSync(context)
                            },
                            colors = SwitchDefaults.colors(checkedThumbColor = Color.White, checkedTrackColor = CrimsonRed)
                        )
                    }

                    if (smartConfig.isEnabled) {
                        HorizontalDivider(color = SurfaceBorder)

                        // Quota Slider (25 - 500 songs)
                        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = "Download Quota Limit",
                                    style = MaterialTheme.typography.titleSmall,
                                    color = TextPrimary
                                )
                                Text(
                                    text = "${smartConfig.songCountQuota} songs (${formatBytes(smartConfig.estimatedStorageBytes)})",
                                    style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold),
                                    color = CrimsonRed
                                )
                            }

                            Slider(
                                value = smartConfig.songCountQuota.toFloat(),
                                onValueChange = { smartPrefs.setSongCountQuota(it.toInt()) },
                                valueRange = 25f..500f,
                                steps = 18,
                                colors = SliderDefaults.colors(thumbColor = CrimsonRed, activeTrackColor = CrimsonRed)
                            )
                        }

                        HorizontalDivider(color = SurfaceBorder)

                        // Wi-Fi Only Toggle
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text("Download over Wi-Fi only", style = MaterialTheme.typography.bodyMedium, color = TextPrimary)
                                Text("Prevent downloads over cellular mobile data", style = MaterialTheme.typography.bodySmall, color = TextSecondary)
                            }
                            Switch(
                                checked = smartConfig.wifiOnly,
                                onCheckedChange = { smartPrefs.setWifiOnly(it) },
                                colors = SwitchDefaults.colors(checkedThumbColor = Color.White, checkedTrackColor = CrimsonRed)
                            )
                        }

                        // Charging Only Toggle
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text("Download only while charging", style = MaterialTheme.typography.bodyMedium, color = TextPrimary)
                                Text("Conserve battery by downloading while plugged in", style = MaterialTheme.typography.bodySmall, color = TextSecondary)
                            }
                            Switch(
                                checked = smartConfig.requiresCharging,
                                onCheckedChange = { smartPrefs.setRequiresCharging(it) },
                                colors = SwitchDefaults.colors(checkedThumbColor = Color.White, checkedTrackColor = CrimsonRed)
                            )
                        }

                        HorizontalDivider(color = SurfaceBorder)

                        // Storage Breakdown Meter
                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text(
                                text = "Device Storage Breakdown",
                                style = MaterialTheme.typography.titleSmall,
                                color = TextPrimary
                            )

                            // Multi-color storage meter
                            val smartFraction = (smartBytes.toFloat() / totalDeviceBytes.toFloat()).coerceIn(0.01f, 1f)
                            val manualFraction = (manualBytes.toFloat() / totalDeviceBytes.toFloat()).coerceIn(0.01f, 1f)
                            val freeFraction = (usableDeviceBytes.toFloat() / totalDeviceBytes.toFloat()).coerceIn(0.01f, 1f)

                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(10.dp)
                                    .clip(RoundedCornerShape(5.dp))
                                    .background(Color(0xFF2A2A38))
                            ) {
                                Box(
                                    modifier = Modifier
                                        .weight(smartFraction.coerceAtLeast(0.05f))
                                        .fillMaxHeight()
                                        .background(CrimsonRed)
                                )
                                Box(
                                    modifier = Modifier
                                        .weight(manualFraction.coerceAtLeast(0.03f))
                                        .fillMaxHeight()
                                        .background(Color(0xFF388E3C))
                                )
                                Box(
                                    modifier = Modifier
                                        .weight(freeFraction.coerceAtLeast(0.2f))
                                        .fillMaxHeight()
                                        .background(Color(0xFF1E88E5))
                                )
                            }

                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                    Box(modifier = Modifier.size(8.dp).background(CrimsonRed, CircleShape))
                                    Text("Smart: ${formatBytes(smartBytes)}", fontSize = 11.sp, color = TextSecondary)
                                }
                                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                    Box(modifier = Modifier.size(8.dp).background(Color(0xFF388E3C), CircleShape))
                                    Text("Manual: ${formatBytes(manualBytes)}", fontSize = 11.sp, color = TextSecondary)
                                }
                                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                    Box(modifier = Modifier.size(8.dp).background(Color(0xFF1E88E5), CircleShape))
                                    Text("Free: ${formatBytes(usableDeviceBytes)}", fontSize = 11.sp, color = TextSecondary)
                                }
                            }
                        }

                        HorizontalDivider(color = SurfaceBorder)

                        // Action Buttons (Sync, Clear Smart, Clear All)
                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Button(
                                onClick = {
                                    SmartDownloadScheduler.triggerImmediateSync(context)
                                    android.widget.Toast.makeText(context, "Triggered smart downloads background sync", android.widget.Toast.LENGTH_SHORT).show()
                                },
                                modifier = Modifier.fillMaxWidth(),
                                colors = ButtonDefaults.buttonColors(containerColor = SurfaceElevated)
                            ) {
                                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    Icon(Icons.Default.Sync, contentDescription = null, tint = TextPrimary, modifier = Modifier.size(18.dp))
                                    Text("Sync Smart Downloads Now", color = TextPrimary)
                                }
                            }

                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                OutlinedButton(
                                    onClick = {
                                        val freed = offlineStorage.clearSmartDownloadsOnly()
                                        refreshStorage()
                                        android.widget.Toast.makeText(context, "Removed $freed smart downloads", android.widget.Toast.LENGTH_SHORT).show()
                                    },
                                    modifier = Modifier.weight(1f),
                                    colors = ButtonDefaults.outlinedButtonColors(contentColor = TextPrimary)
                                ) {
                                    Text("Clear Smart", fontSize = 11.sp)
                                }

                                OutlinedButton(
                                    onClick = {
                                        val freed = offlineStorage.clearAllDownloads()
                                        refreshStorage()
                                        android.widget.Toast.makeText(context, "Cleared all $freed downloads", android.widget.Toast.LENGTH_SHORT).show()
                                    },
                                    modifier = Modifier.weight(1f),
                                    colors = ButtonDefaults.outlinedButtonColors(contentColor = BrightRed)
                                ) {
                                    Text("Delete All", fontSize = 11.sp, color = BrightRed)
                                }
                            }
                        }
                    }
                }
            }
        }

        // 5. System & Updates Section
        item {
            Text(
                text = "System & Updates",
                style = MaterialTheme.typography.titleMedium,
                color = TextSecondary
            )
        }

        item {
            val installedVersionText = remember {
                try {
                    val pInfo = context.packageManager.getPackageInfo(context.packageName, 0)
                    val vName = pInfo.versionName ?: "3.16.0"
                    val vCode = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.P) {
                        pInfo.longVersionCode
                    } else {
                        @Suppress("DEPRECATION")
                        pInfo.versionCode.toLong()
                    }
                    "Version $vName (Build $vCode)"
                } catch (e: Exception) {
                    "Version 3.16.0 (Build 321)"
                }
            }

            Surface(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                color = if (updateState.isUpdateAvailable) SurfaceElevated else SurfaceDark,
                border = if (updateState.isUpdateAvailable) androidx.compose.foundation.BorderStroke(1.dp, CrimsonRed) else null
            ) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Column {
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                Text("MRJ Music Native Android", style = MaterialTheme.typography.titleMedium, color = TextPrimary)
                                if (updateState.isUpdateAvailable) {
                                    Surface(
                                        shape = RoundedCornerShape(8.dp),
                                        color = CrimsonRed.copy(alpha = 0.2f),
                                        border = androidx.compose.foundation.BorderStroke(1.dp, CrimsonRed)
                                    ) {
                                        Text(
                                            "v${updateState.latestVersion ?: "3.16.0"}",
                                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                                            color = CrimsonRed,
                                            fontSize = 10.sp,
                                            fontWeight = FontWeight.Bold
                                        )
                                    }
                                }
                            }
                            Text(installedVersionText, style = MaterialTheme.typography.bodyMedium, color = TextSecondary)
                        }

                        IconButton(
                            onClick = { updateViewModel.checkForUpdate(isUserInitiated = true) },
                            modifier = Modifier.size(36.dp)
                        ) {
                            if (updateState.isChecking) {
                                CircularProgressIndicator(modifier = Modifier.size(20.dp), color = CrimsonRed, strokeWidth = 2.dp)
                            } else {
                                Icon(Icons.Default.Refresh, contentDescription = "Check for Updates", tint = TextSecondary)
                            }
                        }
                    }

                    if (updateState.isUpdateAvailable) {
                        Button(
                            onClick = { updateViewModel.startDownloadAndInstall() },
                            modifier = Modifier.fillMaxWidth(),
                            colors = ButtonDefaults.buttonColors(containerColor = CrimsonRed)
                        ) {
                            Text("Download & Install Update", fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }
    }

    if (showEqualizerSheet && playerViewModel != null) {
        val equalizerState by playerViewModel.equalizerState.collectAsState()
        val dynamicThemeColor by playerViewModel.dynamicThemeColor.collectAsState()

        EqualizerSheet(
            equalizerState = equalizerState,
            accentColor = dynamicThemeColor,
            onEnabledChange = { playerViewModel.setEqualizerEnabled(it) },
            onPresetSelect = { playerViewModel.setEqualizerPreset(it) },
            onBandGainChange = { band, gain -> playerViewModel.setEqualizerBandGain(band, gain) },
            onBassBoostChange = { playerViewModel.setBassBoost(it) },
            onVirtualizerChange = { playerViewModel.setVirtualizer(it) },
            onReset = { playerViewModel.resetEqualizer() },
            onDismiss = { showEqualizerSheet = false }
        )
    }

    if (showNameDialog) {
        AlertDialog(
            onDismissRequest = { showNameDialog = false },
            title = { Text("Set Callout Name", color = TextPrimary) },
            text = {
                OutlinedTextField(
                    value = preferredNameInput,
                    onValueChange = { preferredNameInput = it },
                    label = { Text("Your Preferred Name") },
                    singleLine = true
                )
            },
            confirmButton = {
                Button(
                    onClick = {
                        authViewModel.updatePreferredName(preferredNameInput.trim())
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
            containerColor = SurfaceDark
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
            .clip(RoundedCornerShape(8.dp))
            .clickable(onClick = onClick)
            .padding(vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = CrimsonRed,
            modifier = Modifier.size(24.dp)
        )
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = title,
                style = MaterialTheme.typography.titleMedium,
                color = TextPrimary
            )
            Text(
                text = subtitle,
                style = MaterialTheme.typography.bodySmall,
                color = TextSecondary
            )
        }
        Icon(
            imageVector = Icons.Default.ChevronRight,
            contentDescription = null,
            tint = TextMuted,
            modifier = Modifier.size(20.dp)
        )
    }
}

private fun formatBytes(bytes: Long): String {
    if (bytes <= 0) return "0 MB"
    val mb = bytes.toDouble() / (1024 * 1024)
    return if (mb >= 1024) {
        String.format("%.1f GB", mb / 1024)
    } else {
        String.format("%.0f MB", mb)
    }
}
