package com.mrj.music

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.drawable.ColorDrawable
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import com.mrj.music.service.MRJMediaSessionService
import com.mrj.music.ui.MRJMusicApp
import com.mrj.music.ui.theme.MRJMusicTheme

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        super.onCreate(savedInstanceState)
        window.setBackgroundDrawable(ColorDrawable(android.graphics.Color.parseColor("#030303")))
        androidx.core.view.WindowCompat.getInsetsController(window, window.decorView).apply {
            isAppearanceLightStatusBars = false
            isAppearanceLightNavigationBars = false
        }
        enableEdgeToEdge()

        // Request POST_NOTIFICATIONS runtime permission on Android 13+ (API 33+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(
                    this,
                    arrayOf(Manifest.permission.POST_NOTIFICATIONS),
                    1001
                )
            }
        }

        // Start MediaSession playback service
        val serviceIntent = Intent(this, MRJMediaSessionService::class.java)
        try {
            startService(serviceIntent)
        } catch (e: Exception) {
            // Service startup handled gracefully
        }

        // Schedule Smart Downloads periodic sync (24h Wi-Fi/Charging)
        com.mrj.music.smartdownload.SmartDownloadScheduler.schedulePeriodicSync(this)

        setContent {
            MRJMusicTheme {
                MRJMusicApp()
            }
        }
    }
}
