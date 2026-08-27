package com.mrj.music

import android.app.Application
import com.mrj.music.smartdownload.SmartDownloadScheduler

class MRJApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        try {
            SmartDownloadScheduler.schedulePeriodicSync(this)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }
}
