package com.mrj.music.audiofx

import android.content.Context
import android.content.SharedPreferences
import android.media.audiofx.BassBoost
import android.media.audiofx.Equalizer
import android.media.audiofx.Virtualizer
import android.util.Log
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

private const val TAG = "MRJ_AudioEffectManager"
private const val PREFS_NAME = "mrj_audio_effects_prefs"

data class EqualizerBand(
    val index: Int,
    val centerFreqHz: Int,
    val gainDb: Int,
    val minDb: Int = -12,
    val maxDb: Int = 12
)

data class EqualizerState(
    val isEnabled: Boolean = true,
    val activePreset: String = "Flat",
    val bandGains: List<Int> = listOf(0, 0, 0, 0, 0),
    val bassBoostStrength: Int = 0, // 0 to 1000
    val virtualizerStrength: Int = 0, // 0 to 1000
    val availablePresets: List<String> = listOf("Flat", "Bass Boost", "Vocal Boost", "Electronic", "Rock", "Pop", "Classical", "Custom")
)

class MRJAudioEffectManager private constructor(private val context: Context) {

    companion object {
        @Volatile
        private var INSTANCE: MRJAudioEffectManager? = null

        fun getInstance(context: Context): MRJAudioEffectManager {
            return INSTANCE ?: synchronized(this) {
                INSTANCE ?: MRJAudioEffectManager(context.applicationContext).also { INSTANCE = it }
            }
        }

        val PRESET_MAP = mapOf(
            "Flat" to listOf(0, 0, 0, 0, 0),
            "Bass Boost" to listOf(6, 4, 0, 1, 2),
            "Vocal Boost" to listOf(-2, 3, 6, 3, 0),
            "Electronic" to listOf(5, 3, 0, 2, 4),
            "Rock" to listOf(4, 2, -1, 3, 5),
            "Pop" to listOf(-1, 2, 5, 3, -1),
            "Classical" to listOf(4, 2, -1, 2, 4)
        )
    }

    private val prefs: SharedPreferences = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    private var equalizer: Equalizer? = null
    private var bassBoost: BassBoost? = null
    private var virtualizer: Virtualizer? = null
    private var currentAudioSessionId: Int = 0

    private val _equalizerState = MutableStateFlow(loadPersistedState())
    val equalizerState: StateFlow<EqualizerState> = _equalizerState.asStateFlow()

    fun attachAudioSession(audioSessionId: Int) {
        if (audioSessionId <= 0 || audioSessionId == currentAudioSessionId) return
        currentAudioSessionId = audioSessionId
        releaseEffects()

        try {
            equalizer = Equalizer(0, audioSessionId).apply {
                enabled = _equalizerState.value.isEnabled
            }
        } catch (e: Exception) {
            Log.w(TAG, "Failed to initialize Equalizer: ${e.message}")
        }

        try {
            bassBoost = BassBoost(0, audioSessionId).apply {
                enabled = _equalizerState.value.isEnabled
                if (strengthSupported) {
                    setStrength(_equalizerState.value.bassBoostStrength.toShort())
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "Failed to initialize BassBoost: ${e.message}")
        }

        try {
            virtualizer = Virtualizer(0, audioSessionId).apply {
                enabled = _equalizerState.value.isEnabled
                if (strengthSupported) {
                    setStrength(_equalizerState.value.virtualizerStrength.toShort())
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "Failed to initialize Virtualizer: ${e.message}")
        }

        applyCurrentStateToHardware()
    }

    fun setEnabled(enabled: Boolean) {
        _equalizerState.value = _equalizerState.value.copy(isEnabled = enabled)
        try {
            equalizer?.enabled = enabled
            bassBoost?.enabled = enabled
            virtualizer?.enabled = enabled
        } catch (e: Exception) {
            Log.w(TAG, "Error setting effect enabled: ${e.message}")
        }
        persistState()
    }

    fun setPreset(presetName: String) {
        val gains = PRESET_MAP[presetName] ?: _equalizerState.value.bandGains
        _equalizerState.value = _equalizerState.value.copy(
            activePreset = presetName,
            bandGains = gains
        )
        applyCurrentStateToHardware()
        persistState()
    }

    fun setBandGain(bandIndex: Int, gainDb: Int) {
        val currentGains = _equalizerState.value.bandGains.toMutableList()
        if (bandIndex in currentGains.indices) {
            currentGains[bandIndex] = gainDb.coerceIn(-12, 12)
            _equalizerState.value = _equalizerState.value.copy(
                activePreset = "Custom",
                bandGains = currentGains
            )
            applyCurrentStateToHardware()
            persistState()
        }
    }

    fun setBassBoost(strengthPercent: Int) {
        val rawStrength = (strengthPercent.coerceIn(0, 100) * 10).toInt() // 0 to 1000
        _equalizerState.value = _equalizerState.value.copy(bassBoostStrength = rawStrength)
        try {
            if (bassBoost?.strengthSupported == true) {
                bassBoost?.setStrength(rawStrength.toShort())
            }
        } catch (e: Exception) {
            Log.w(TAG, "Error applying bass boost: ${e.message}")
        }
        persistState()
    }

    fun setVirtualizer(strengthPercent: Int) {
        val rawStrength = (strengthPercent.coerceIn(0, 100) * 10).toInt() // 0 to 1000
        _equalizerState.value = _equalizerState.value.copy(virtualizerStrength = rawStrength)
        try {
            if (virtualizer?.strengthSupported == true) {
                virtualizer?.setStrength(rawStrength.toShort())
            }
        } catch (e: Exception) {
            Log.w(TAG, "Error applying virtualizer: ${e.message}")
        }
        persistState()
    }

    fun resetToFlat() {
        setPreset("Flat")
        setBassBoost(0)
        setVirtualizer(0)
    }

    private fun applyCurrentStateToHardware() {
        val state = _equalizerState.value
        try {
            equalizer?.let { eq ->
                val numBands = eq.numberOfBands.toInt()
                for (i in 0 until numBands) {
                    if (i < state.bandGains.size) {
                        val gainMb = (state.bandGains[i] * 100).toShort()
                        eq.setBandLevel(i.toShort(), gainMb)
                    }
                }
            }
            if (bassBoost?.strengthSupported == true) {
                bassBoost?.setStrength(state.bassBoostStrength.toShort())
            }
            if (virtualizer?.strengthSupported == true) {
                virtualizer?.setStrength(state.virtualizerStrength.toShort())
            }
        } catch (e: Exception) {
            Log.w(TAG, "Error applying state to hardware: ${e.message}")
        }
    }

    private fun persistState() {
        val state = _equalizerState.value
        prefs.edit().apply {
            putBoolean("eq_enabled", state.isEnabled)
            putString("eq_preset", state.activePreset)
            putString("eq_gains", state.bandGains.joinToString(","))
            putInt("eq_bass", state.bassBoostStrength)
            putInt("eq_virtualizer", state.virtualizerStrength)
            apply()
        }
    }

    private fun loadPersistedState(): EqualizerState {
        val enabled = prefs.getBoolean("eq_enabled", true)
        val preset = prefs.getString("eq_preset", "Flat") ?: "Flat"
        val gainsStr = prefs.getString("eq_gains", "0,0,0,0,0") ?: "0,0,0,0,0"
        val gains = try {
            gainsStr.split(",").map { it.trim().toInt() }
        } catch (e: Exception) {
            listOf(0, 0, 0, 0, 0)
        }
        val bass = prefs.getInt("eq_bass", 0)
        val virt = prefs.getInt("eq_virtualizer", 0)

        return EqualizerState(
            isEnabled = enabled,
            activePreset = preset,
            bandGains = if (gains.size == 5) gains else listOf(0, 0, 0, 0, 0),
            bassBoostStrength = bass,
            virtualizerStrength = virt
        )
    }

    fun releaseEffects() {
        try {
            equalizer?.release()
            equalizer = null
            bassBoost?.release()
            bassBoost = null
            virtualizer?.release()
            virtualizer = null
        } catch (e: Exception) {
            Log.w(TAG, "Error releasing audio effects: ${e.message}")
        }
    }
}
