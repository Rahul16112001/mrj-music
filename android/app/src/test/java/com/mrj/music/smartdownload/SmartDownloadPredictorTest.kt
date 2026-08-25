package com.mrj.music.smartdownload

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class SmartDownloadPredictorTest {

    @Test
    fun testMathematicalPriorityScoring() {
        // Case 1: Fresh Favorite with multiple full completions
        val scoreFav = SmartDownloadPredictor.scoreTrack(
            isFavorite = true,
            playCount = 4,
            completionRate = 1.0,
            daysSinceLastPlay = 0
        )
        // 100 (fav) + 60 (plays max) + 20 (comp) - 0 = 180.0
        assertEquals(180.0, scoreFav, 0.001)

        // Case 2: Non-favorite with moderate plays
        val scoreMod = SmartDownloadPredictor.scoreTrack(
            isFavorite = false,
            playCount = 2,
            completionRate = 0.8,
            daysSinceLastPlay = 1
        )
        // 0 + 30 + 16 - 2 = 44.0
        assertEquals(44.0, scoreMod, 0.001)

        // Case 3: Stale track with heavy recency penalty
        val scoreStale = SmartDownloadPredictor.scoreTrack(
            isFavorite = false,
            playCount = 1,
            completionRate = 0.5,
            daysSinceLastPlay = 20
        )
        // 0 + 15 + 10 - 40 = 0.0 (floored at 0.0)
        assertEquals(0.0, scoreStale, 0.001)
    }

    @Test
    fun testCandidateRankingPriority() {
        val scoreA = SmartDownloadPredictor.scoreTrack(true, 5, 1.0, 0) // Fav = 180
        val scoreB = SmartDownloadPredictor.scoreTrack(false, 3, 1.0, 0) // Frequent = 65
        val scoreC = SmartDownloadPredictor.scoreTrack(false, 1, 0.5, 5) // Low = 15

        assertTrue(scoreA > scoreB)
        assertTrue(scoreB > scoreC)
    }
}
