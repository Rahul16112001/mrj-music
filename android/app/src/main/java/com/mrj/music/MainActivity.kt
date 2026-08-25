package com.mrj.music

import android.content.Intent
import android.graphics.drawable.ColorDrawable
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import com.mrj.music.service.MRJMediaSessionService
import com.mrj.music.ui.MRJMusicApp
import com.mrj.music.ui.theme.MRJMusicTheme

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        super.onCreate(savedInstanceState)
        setTheme(R.style.AppTheme_NoActionBar)
        window.setBackgroundDrawable(ColorDrawable(android.graphics.Color.parseColor("#030303")))
        enableEdgeToEdge()

        // Start Foreground MediaSession playback service
        val serviceIntent = Intent(this, MRJMediaSessionService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(serviceIntent)
        } else {
            startService(serviceIntent)
        }

        setContent {
            MRJMusicTheme {
                MRJMusicApp()
            }
        }
    }
}
