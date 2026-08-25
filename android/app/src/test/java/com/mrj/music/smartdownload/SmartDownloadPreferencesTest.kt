package com.mrj.music.smartdownload

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class SmartDownloadPreferencesTest {

    @Test
    fun testStorageEstimationHighQuality() {
        val bytes50 = SmartDownloadPreferences.calculateEstimatedStorageBytes(50, "HIGH")
        assertEquals(50L * 5 * 1024 * 1024, bytes50) // ~250MB

        val bytes200 = SmartDownloadPreferences.calculateEstimatedStorageBytes(200, "HIGH")
        assertEquals(200L * 5 * 1024 * 1024, bytes200) // ~1GB

        val bytes500 = SmartDownloadPreferences.calculateEstimatedStorageBytes(500, "HIGH")
        assertEquals(500L * 5 * 1024 * 1024, bytes500) // ~2.5GB
    }

    @Test
    fun testStorageEstimationMediumAndLowQuality() {
        val bytesMedium = SmartDownloadPreferences.calculateEstimatedStorageBytes(100, "MEDIUM")
        assertEquals(100L * 3500 * 1024, bytesMedium) // ~350MB

        val bytesLow = SmartDownloadPreferences.calculateEstimatedStorageBytes(100, "LOW")
        assertEquals(100L * 2 * 1024 * 1024, bytesLow) // ~200MB
    }

    @Test
    fun testDefaultConfigIntegrity() {
        val defaultConfig = SmartDownloadConfig()
        assertTrue(defaultConfig.isEnabled)
        assertEquals(50, defaultConfig.songCountQuota)
        assertTrue(defaultConfig.wifiOnly)
        assertEquals(false, defaultConfig.requiresCharging)
        assertEquals("HIGH", defaultConfig.audioQuality)
    }
}
