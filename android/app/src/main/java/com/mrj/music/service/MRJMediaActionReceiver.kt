package com.mrj.music.service

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import com.mrj.music.player.MRJExoPlayerManager

private const val TAG = "MRJMediaActionReceiver"

class MRJMediaActionReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent?) {
        val action = intent?.action ?: return
        Log.d(TAG, "Received media action: $action")
        val playerManager = MRJExoPlayerManager.getInstance(context)

        when (action) {
            MRJMediaSessionService.ACTION_PLAY_PAUSE -> playerManager.togglePlayPause()
            MRJMediaSessionService.ACTION_PLAY -> playerManager.resume()
            MRJMediaSessionService.ACTION_PAUSE -> playerManager.pause()
            MRJMediaSessionService.ACTION_NEXT -> playerManager.playNext()
            MRJMediaSessionService.ACTION_PREVIOUS -> playerManager.playPrevious()
            MRJMediaSessionService.ACTION_STOP -> playerManager.pause()
        }
    }
}
