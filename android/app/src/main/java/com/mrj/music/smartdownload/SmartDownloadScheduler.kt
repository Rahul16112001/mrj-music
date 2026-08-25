package com.mrj.music.smartdownload

import android.content.Context
import android.util.Log
import androidx.work.*
import java.util.concurrent.TimeUnit

object SmartDownloadScheduler {
    private const val TAG = "MRJ_SmartScheduler"
    private const val UNIQUE_PERIODIC_WORK_NAME = "mrj_smart_download_periodic_sync"
    private const val UNIQUE_IMMEDIATE_WORK_NAME = "mrj_smart_download_immediate_sync"

    fun schedulePeriodicSync(context: Context) {
        val prefs = SmartDownloadPreferences.getInstance(context)
        val config = prefs.getConfig()

        if (!config.isEnabled) {
            cancelPeriodicSync(context)
            return
        }

        val networkType = if (config.wifiOnly) NetworkType.UNMETERED else NetworkType.CONNECTED
        val constraintsBuilder = Constraints.Builder()
            .setRequiredNetworkType(networkType)
            .setRequiresBatteryNotLow(true)
            .setRequiresStorageNotLow(true)

        if (config.requiresCharging) {
            constraintsBuilder.setRequiresCharging(true)
        }

        val periodicWorkRequest = PeriodicWorkRequestBuilder<SmartDownloadWorker>(
            repeatInterval = 24,
            repeatIntervalTimeUnit = TimeUnit.HOURS,
            flexTimeInterval = 4,
            flexTimeIntervalUnit = TimeUnit.HOURS
        )
            .setConstraints(constraintsBuilder.build())
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 15, TimeUnit.MINUTES)
            .build()

        WorkManager.getInstance(context).enqueueUniquePeriodicWork(
            UNIQUE_PERIODIC_WORK_NAME,
            ExistingPeriodicWorkPolicy.UPDATE,
            periodicWorkRequest
        )

        Log.d(TAG, "Scheduled 24h periodic smart downloads sync (WiFi-only: ${config.wifiOnly}, Charging-only: ${config.requiresCharging})")
    }

    fun triggerImmediateSync(context: Context) {
        val prefs = SmartDownloadPreferences.getInstance(context)
        val config = prefs.getConfig()

        if (!config.isEnabled) {
            Log.d(TAG, "Cannot trigger immediate sync: Smart downloads is disabled.")
            return
        }

        val networkType = if (config.wifiOnly) NetworkType.UNMETERED else NetworkType.CONNECTED
        val constraints = Constraints.Builder()
            .setRequiredNetworkType(networkType)
            .setRequiresStorageNotLow(true)
            .build()

        val immediateWork = OneTimeWorkRequestBuilder<SmartDownloadWorker>()
            .setConstraints(constraints)
            .build()

        WorkManager.getInstance(context).enqueueUniqueWork(
            UNIQUE_IMMEDIATE_WORK_NAME,
            ExistingWorkPolicy.REPLACE,
            immediateWork
        )

        Log.d(TAG, "Enqueued immediate smart download sync.")
    }

    fun cancelPeriodicSync(context: Context) {
        WorkManager.getInstance(context).cancelUniqueWork(UNIQUE_PERIODIC_WORK_NAME)
        Log.d(TAG, "Cancelled periodic smart download sync.")
    }
}
