package com.mrj.music.player

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.media.AudioManager
import android.os.Build
import android.telephony.PhoneStateListener
import android.telephony.TelephonyCallback
import android.telephony.TelephonyManager
import android.util.Log

private const val TAG = "MRJ_AudioFocusManager"

interface AudioFocusCallback {
    fun onAudioFocusPause()
    fun onAudioFocusResume()
    fun onAudioFocusDuck(duckRatio: Float)
    fun onAudioFocusUnduck()
}

/**
 * Enterprise Audio Focus and System Interruption Manager.
 * Responsibilities:
 * 1. Incoming and Active Phone Calls (Pauses immediately on ring/answer, auto-resumes when hung up).
 * 2. Headphone & Bluetooth Disconnects (ACTION_AUDIO_BECOMING_NOISY).
 * 3. Coordinates smoothly with Chromium WebView's internal MediaSession engine without internal focus collisions.
 */
class MRJAudioFocusManager(
    private val context: Context,
    private val callback: AudioFocusCallback
) {
    private var wasPlayingBeforeCall = false
    private val noisyFilter = IntentFilter(AudioManager.ACTION_AUDIO_BECOMING_NOISY)
    private var isNoisyReceiverRegistered = false

    private val noisyReceiver = object : BroadcastReceiver() {
        override fun onReceive(ctx: Context?, intent: Intent?) {
            if (intent?.action == AudioManager.ACTION_AUDIO_BECOMING_NOISY) {
                Log.d(TAG, "Headphones/Bluetooth disconnected (ACTION_AUDIO_BECOMING_NOISY) -> Pausing music")
                callback.onAudioFocusPause()
            }
        }
    }

    init {
        registerNoisyReceiver()
        registerTelephonyCallListener()
    }

    fun onPlaybackStarted() {
        registerNoisyReceiver()
    }

    fun onPlaybackStopped() {
        unregisterNoisyReceiver()
    }

    private fun registerNoisyReceiver() {
        if (!isNoisyReceiverRegistered) {
            try {
                context.registerReceiver(noisyReceiver, noisyFilter)
                isNoisyReceiverRegistered = true
                Log.d(TAG, "Noisy audio receiver registered")
            } catch (e: Exception) {
                Log.w(TAG, "Error registering noisy receiver: ${e.message}")
            }
        }
    }

    private fun unregisterNoisyReceiver() {
        if (isNoisyReceiverRegistered) {
            try {
                context.unregisterReceiver(noisyReceiver)
                isNoisyReceiverRegistered = false
                Log.d(TAG, "Noisy audio receiver unregistered")
            } catch (e: Exception) {
                Log.w(TAG, "Error unregistering noisy receiver: ${e.message}")
            }
        }
    }

    private fun registerTelephonyCallListener() {
        try {
            val telephonyManager = context.getSystemService(Context.TELEPHONY_SERVICE) as? TelephonyManager ?: return

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val executor = context.mainExecutor
                telephonyManager.registerTelephonyCallback(
                    executor,
                    object : TelephonyCallback(), TelephonyCallback.CallStateListener {
                        override fun onCallStateChanged(state: Int) {
                            handleCallState(state)
                        }
                    }
                )
            } else {
                @Suppress("DEPRECATION")
                telephonyManager.listen(object : PhoneStateListener() {
                    @Deprecated("Deprecated in Java")
                    override fun onCallStateChanged(state: Int, phoneNumber: String?) {
                        handleCallState(state)
                    }
                }, PhoneStateListener.LISTEN_CALL_STATE)
            }
        } catch (e: Exception) {
            Log.d(TAG, "Telephony listener registration note: ${e.message}")
        }
    }

    private fun handleCallState(state: Int) {
        when (state) {
            TelephonyManager.CALL_STATE_RINGING,
            TelephonyManager.CALL_STATE_OFFHOOK -> {
                Log.d(TAG, "Incoming/Active Phone Call detected (state: $state) -> Pausing music")
                wasPlayingBeforeCall = true
                callback.onAudioFocusPause()
            }
            TelephonyManager.CALL_STATE_IDLE -> {
                Log.d(TAG, "Phone Call Ended (CALL_STATE_IDLE)")
                if (wasPlayingBeforeCall) {
                    wasPlayingBeforeCall = false
                    Log.d(TAG, "Resuming music playback after phone call ended")
                    callback.onAudioFocusResume()
                }
            }
        }
    }
}
