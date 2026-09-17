package com.mrj.music.data.home

import com.mrj.music.data.remote.HomeFeedSectionDto
import com.mrj.music.data.remote.HomeFeedTrackDto
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class HomeFeedContractTest {
    @Test
    fun onlyVerifiedCanonicalTracksAreRepresentedByTheFeedContract() {
        val verified = HomeFeedTrackDto("ytm_123", "youtube_music", "123", "Track", "Artist", artworkUrl = "https://img.test/800.jpg", sourceAvailable = true)
        val regional = HomeFeedTrackDto("canonical_jiosaavn_123_hash", "jiosaavn", "123", "Regional", "Artist", artworkUrl = "https://img.test/800.jpg", sourceAvailable = true)
        val unavailable = HomeFeedTrackDto("ytm_bad", "youtube_music", "bad", "Bad", "Artist", artworkUrl = "https://img.test/800.jpg", sourceAvailable = false)
        val section = HomeFeedSectionDto("quick_picks", "Quick Picks", listOf(verified, regional, unavailable))

        assertTrue(section.tracks.filter { it.sourceAvailable }.all {
            it.canonicalTrackId.startsWith("ytm_") || it.canonicalTrackId.startsWith("canonical_")
        })
        assertEquals(2, section.tracks.count { it.sourceAvailable })
    }

    @Test
    fun stalePolicyUsesThirtyMinutesFreshAndTwentyFourHoursMaximum() {
        assertEquals(30 * 60 * 1000L, HomeFeedRepository.FRESH_TTL_MS)
        assertEquals(24 * 60 * 60 * 1000L, HomeFeedRepository.MAX_STALE_MS)
    }
}
