package com.mrj.music.search

import com.mrj.music.model.NativeTrack
import com.mrj.music.ui.viewmodel.TopPrediction
import kotlin.math.max
import kotlin.math.min

enum class EntityType {
    ARTIST, SONG, ALBUM, GENRE
}

data class SearchEntity(
    val name: String,
    val type: EntityType,
    val subtitle: String,
    val thumbnail: String,
    val category: String,
    val aliases: List<String> = emptyList(),
    val popularCompletions: List<String> = emptyList(),
    val sampleTracks: List<NativeTrack> = emptyList()
)

data class FuzzySearchResult(
    val correctedQuery: String?,
    val isTypoCorrected: Boolean,
    val topPrediction: TopPrediction?,
    val suggestions: List<String>,
    val instantSongs: List<NativeTrack>
)

object FuzzySearchEngine {

    private val ENTITY_KNOWLEDGE_BASE = listOf(
        // Artists
        SearchEntity(
            name = "Arijit Singh",
            type = EntityType.ARTIST,
            subtitle = "Artist • 95M+ Listeners • Bollywood",
            thumbnail = "https://c.saavncdn.com/artists/Arijit_Singh_002_20230323062147_500x500.jpg",
            category = "Bollywood",
            aliases = listOf("arjit singh", "arjit", "arijet", "arijitt", "afijit singh", "afijit", "arjit shingh", "arijit"),
            popularCompletions = listOf(
                "Arijit Singh",
                "Arijit Singh Romantic Songs",
                "Arijit Singh All Songs",
                "Arijit Singh Sad Songs",
                "Arijit Singh & Shreya Ghoshal",
                "Arijit Singh Mashup",
                "Arijit Singh New Song 2026",
                "Arijit Singh Live Acoustic"
            ),
            sampleTracks = listOf(
                NativeTrack("apna_bana_le", "apna_bana_le", "Apna Bana Le", "Arijit Singh & Sachin-Jigar", "Bhediya", "https://c.saavncdn.com/026/Bhediya-Hindi-2022-20230203140228-500x500.jpg", 260.0, "Bollywood", "u2NAuswnTKs", "https://mrj-music.vercel.app/api/music/stream/u2NAuswnTKs"),
                NativeTrack("kesariya", "kesariya", "Kesariya", "Arijit Singh", "Brahmastra", "https://c.saavncdn.com/807/Kesariya-From-Brahmastra-Hindi-2022-20220717092820-500x500.jpg", 268.0, "Bollywood", "BddP6PYo2gs", "https://mrj-music.vercel.app/api/music/stream/BddP6PYo2gs"),
                NativeTrack("heeriye", "heeriye", "Heeriye", "Jasleen Royal & Arijit Singh", "Heeriye", "https://c.saavncdn.com/022/Heeriye-feat-Arijit-Singh-Hindi-2023-20230928050405-500x500.jpg", 194.0, "Bollywood", "RLzC55ai0eo", "https://mrj-music.vercel.app/api/music/stream/RLzC55ai0eo"),
                NativeTrack("ve_kamleya", "ve_kamleya", "Ve Kamleya", "Arijit Singh & Shreya Ghoshal", "Rocky Aur Rani Kii Prem Kahaani", "https://c.saavncdn.com/932/Ve-Kamleya-From-Rocky-Aur-Rani-Kii-Prem-Kahaani-Hindi-2023-20230718131006-500x500.jpg", 247.0, "Bollywood", "s_m8yqH2k7s", "https://mrj-music.vercel.app/api/music/stream/s_m8yqH2k7s")
            )
        ),
        SearchEntity(
            name = "Karan Aujla",
            type = EntityType.ARTIST,
            subtitle = "Artist • Punjabi Superstar",
            thumbnail = "https://c.saavncdn.com/artists/Karan_Aujla_003_20230622081014_500x500.jpg",
            category = "Punjabi",
            aliases = listOf("karan ojla", "karun aujla", "karn aujla", "karan ujla", "karan", "aujla"),
            popularCompletions = listOf(
                "Karan Aujla",
                "Karan Aujla Tauba Tauba",
                "Karan Aujla Songs",
                "Karan Aujla Softly",
                "Karan Aujla Winning Speech",
                "Karan Aujla New Song 2026",
                "Karan Aujla All Songs",
                "Karan Aujla Four Me"
            ),
            sampleTracks = listOf(
                NativeTrack("tauba_tauba", "tauba_tauba", "Tauba Tauba", "Karan Aujla", "Bad Newz", "https://c.saavncdn.com/807/Tauba-Tauba-From-Bad-Newz-Hindi-2024-20240702111004-500x500.jpg", 210.0, "Punjabi", "krE-g9IzPqs", "https://mrj-music.vercel.app/api/music/stream/krE-g9IzPqs"),
                NativeTrack("softly", "softly", "Softly", "Karan Aujla & Ikky", "Four Me", "https://i.ytimg.com/vi/h_k14yNonzA/hqdefault.jpg", 154.0, "Punjabi", "h_k14yNonzA", "https://mrj-music.vercel.app/api/music/stream/h_k14yNonzA"),
                NativeTrack("winning_speech", "winning_speech", "Winning Speech", "Karan Aujla", "Street Dreams", "https://i.ytimg.com/vi/0pWsCd_tffs/hqdefault.jpg", 195.0, "Punjabi", "0pWsCd_tffs", "https://mrj-music.vercel.app/api/music/stream/0pWsCd_tffs")
            )
        ),
        SearchEntity(
            name = "Diljit Dosanjh",
            type = EntityType.ARTIST,
            subtitle = "Artist • Global Icon • Punjabi",
            thumbnail = "https://c.saavncdn.com/artists/Diljit_Dosanjh_004_20221007180447_500x500.jpg",
            category = "Punjabi",
            aliases = listOf("diljet dosanjh", "diljeet dosanjh", "daljit dosanjh", "diljit", "dosanjh", "diljeet"),
            popularCompletions = listOf(
                "Diljit Dosanjh",
                "Diljit Dosanjh Songs",
                "Diljit Dosanjh Lover",
                "Diljit Dosanjh Born To Shine",
                "Diljit Dosanjh Ghost Album",
                "Diljit Dosanjh Live Concert",
                "Diljit Dosanjh Naina",
                "Diljit Dosanjh G.O.A.T."
            ),
            sampleTracks = listOf(
                NativeTrack("lover", "lover", "Lover", "Diljit Dosanjh", "MoonChild Era", "https://c.saavncdn.com/512/MoonChild-Era-Punjabi-2021-20210822051608-500x500.jpg", 185.0, "Punjabi", "mH_LFkW338c", "https://mrj-music.vercel.app/api/music/stream/mH_LFkW338c"),
                NativeTrack("goat", "goat", "G.O.A.T.", "Diljit Dosanjh", "G.O.A.T.", "https://c.saavncdn.com/712/G-O-A-T-Punjabi-2020-20200729124408-500x500.jpg", 223.0, "Punjabi", "cl0a3i2wFcc", "https://mrj-music.vercel.app/api/music/stream/cl0a3i2wFcc")
            )
        ),
        SearchEntity(
            name = "Sidhu Moose Wala",
            type = EntityType.ARTIST,
            subtitle = "Artist • Punjabi Legend",
            thumbnail = "https://c.saavncdn.com/artists/Sidhu_Moose_Wala_003_20230613093228_500x500.jpg",
            category = "Punjabi",
            aliases = listOf("sidhu", "moosewala", "moosawala", "mosewala", "sidhu moosewala", "sidhumoosewala"),
            popularCompletions = listOf(
                "Sidhu Moose Wala",
                "Sidhu Moose Wala All Songs",
                "Sidhu Moose Wala 295",
                "Sidhu Moose Wala The Last Ride",
                "Sidhu Moose Wala Levels",
                "Sidhu Moose Wala Moosetape",
                "Sidhu Moose Wala So High"
            )
        ),
        SearchEntity(
            name = "Shreya Ghoshal",
            type = EntityType.ARTIST,
            subtitle = "Artist • Melody Queen • Bollywood",
            thumbnail = "https://c.saavncdn.com/artists/Shreya_Ghoshal_003_20221118090547_500x500.jpg",
            category = "Bollywood",
            aliases = listOf("shreya goshal", "shrya ghoshal", "shreya gosal", "shreya"),
            popularCompletions = listOf(
                "Shreya Ghoshal",
                "Shreya Ghoshal Romantic Hits",
                "Shreya Ghoshal All Songs",
                "Shreya Ghoshal Guli Mata",
                "Shreya Ghoshal & Arijit Singh",
                "Shreya Ghoshal Classical"
            )
        ),
        SearchEntity(
            name = "Anirudh Ravichander",
            type = EntityType.ARTIST,
            subtitle = "Artist • Rockstar • South Mass",
            thumbnail = "https://c.saavncdn.com/artists/Anirudh_Ravichander_003_20230914101416_500x500.jpg",
            category = "South",
            aliases = listOf("anirudh", "anirud", "aniruth", "anirudh ravichandran"),
            popularCompletions = listOf(
                "Anirudh Ravichander",
                "Anirudh Ravichander Hukum",
                "Anirudh Ravichander Jawan",
                "Anirudh Ravichander Leo",
                "Anirudh Ravichander Mass Hits",
                "Anirudh Ravichander BGM"
            )
        ),
        SearchEntity(
            name = "Taylor Swift",
            type = EntityType.ARTIST,
            subtitle = "Artist • Global Pop Icon",
            thumbnail = "https://i.scdn.co/image/ab6761610000e5eb5a00969a4698c3132a15fbb0",
            category = "Pop",
            aliases = listOf("taylor", "tayler swift", "taylor swif", "taylor switf"),
            popularCompletions = listOf(
                "Taylor Swift",
                "Taylor Swift Cruel Summer",
                "Taylor Swift All Songs",
                "Taylor Swift Blank Space",
                "Taylor Swift Lover Album",
                "Taylor Swift 1989"
            )
        ),
        SearchEntity(
            name = "AP Dhillon",
            type = EntityType.ARTIST,
            subtitle = "Artist • Punjabi Pop Icon",
            thumbnail = "https://c.saavncdn.com/artists/AP_Dhillon_002_20211118152726_500x500.jpg",
            category = "Punjabi",
            aliases = listOf("ap dhillon", "ap dhilon", "dhillon", "ap dhillan", "with you"),
            popularCompletions = listOf(
                "AP Dhillon",
                "AP Dhillon With You",
                "AP Dhillon Excuses",
                "AP Dhillon Brown Munde",
                "AP Dhillon Summer High",
                "AP Dhillon All Songs"
            )
        ),
        SearchEntity(
            name = "Atif Aslam",
            type = EntityType.ARTIST,
            subtitle = "Artist • King of Romance",
            thumbnail = "https://c.saavncdn.com/artists/Atif_Aslam_002_20220311053427_500x500.jpg",
            category = "Bollywood",
            aliases = listOf("atif", "aatif aslam", "atif aslem", "ateef aslam"),
            popularCompletions = listOf(
                "Atif Aslam",
                "Atif Aslam Romantic Songs",
                "Atif Aslam All Time Hits",
                "Atif Aslam Mashup",
                "Atif Aslam Sad Songs",
                "Atif Aslam Live"
            )
        ),
        SearchEntity(
            name = "Badshah",
            type = EntityType.ARTIST,
            subtitle = "Artist • Desi Hip-Hop & Pop",
            thumbnail = "https://c.saavncdn.com/artists/Badshah_005_20230613093234_500x500.jpg",
            category = "Hip-Hop",
            aliases = listOf("badsha", "baadshah", "badshsh", "badshah songs"),
            popularCompletions = listOf(
                "Badshah",
                "Badshah Party Songs",
                "Badshah New Song 2026",
                "Badshah Soulmate",
                "Badshah Jugnu",
                "Badshah Paagal"
            )
        ),
        // Superhit Songs
        SearchEntity(
            name = "Tauba Tauba",
            type = EntityType.SONG,
            subtitle = "Song • Karan Aujla • Bad Newz",
            thumbnail = "https://c.saavncdn.com/807/Tauba-Tauba-From-Bad-Newz-Hindi-2024-20240702111004-500x500.jpg",
            category = "Punjabi",
            aliases = listOf("toba toba", "taba taba", "tauba", "toba", "tauba tauba song", "tauba tauba dance", "toba toba song"),
            popularCompletions = listOf(
                "Tauba Tauba",
                "Tauba Tauba Karan Aujla",
                "Tauba Tauba Bad Newz",
                "Tauba Tauba Dance Video",
                "Tauba Tauba Lofi Remix",
                "Tauba Tauba Lyrics",
                "Tauba Tauba Full Song"
            ),
            sampleTracks = listOf(
                NativeTrack("tauba_tauba", "tauba_tauba", "Tauba Tauba", "Karan Aujla", "Bad Newz", "https://c.saavncdn.com/807/Tauba-Tauba-From-Bad-Newz-Hindi-2024-20240702111004-500x500.jpg", 210.0, "Punjabi", "krE-g9IzPqs", "https://mrj-music.vercel.app/api/music/stream/krE-g9IzPqs")
            )
        ),
        SearchEntity(
            name = "Apna Bana Le",
            type = EntityType.SONG,
            subtitle = "Song • Arijit Singh • Bhediya",
            thumbnail = "https://c.saavncdn.com/026/Bhediya-Hindi-2022-20230203140228-500x500.jpg",
            category = "Bollywood",
            aliases = listOf("apna bna le", "apna bana", "apna bna", "apna bana le arijit"),
            popularCompletions = listOf(
                "Apna Bana Le",
                "Apna Bana Le Arijit Singh",
                "Apna Bana Le Lyrics",
                "Apna Bana Le Lofi Remix",
                "Apna Bana Le Bhediya"
            ),
            sampleTracks = listOf(
                NativeTrack("apna_bana_le", "apna_bana_le", "Apna Bana Le", "Arijit Singh & Sachin-Jigar", "Bhediya", "https://c.saavncdn.com/026/Bhediya-Hindi-2022-20230203140228-500x500.jpg", 260.0, "Bollywood", "u2NAuswnTKs", "https://mrj-music.vercel.app/api/music/stream/u2NAuswnTKs")
            )
        ),
        SearchEntity(
            name = "Kesariya",
            type = EntityType.SONG,
            subtitle = "Song • Arijit Singh • Brahmastra",
            thumbnail = "https://c.saavncdn.com/807/Kesariya-From-Brahmastra-Hindi-2022-20220717092820-500x500.jpg",
            category = "Bollywood",
            aliases = listOf("kesriya", "ksariya", "kesariya tera", "kesariya arijit"),
            popularCompletions = listOf(
                "Kesariya",
                "Kesariya Arijit Singh",
                "Kesariya Brahmastra",
                "Kesariya Lofi Remix",
                "Kesariya Dance Mix"
            ),
            sampleTracks = listOf(
                NativeTrack("kesariya", "kesariya", "Kesariya", "Arijit Singh", "Brahmastra", "https://c.saavncdn.com/807/Kesariya-From-Brahmastra-Hindi-2022-20220717092820-500x500.jpg", 268.0, "Bollywood", "BddP6PYo2gs", "https://mrj-music.vercel.app/api/music/stream/BddP6PYo2gs")
            )
        ),
        SearchEntity(
            name = "Heeriye",
            type = EntityType.SONG,
            subtitle = "Song • Jasleen Royal & Arijit Singh",
            thumbnail = "https://c.saavncdn.com/022/Heeriye-feat-Arijit-Singh-Hindi-2023-20230928050405-500x500.jpg",
            category = "Bollywood",
            aliases = listOf("heriye", "heeriye jasleen", "heeriye arijit", "heeriye song"),
            popularCompletions = listOf(
                "Heeriye",
                "Heeriye Jasleen Royal & Arijit Singh",
                "Heeriye Acoustic Version",
                "Heeriye Lofi Remix",
                "Heeriye Lyrics"
            ),
            sampleTracks = listOf(
                NativeTrack("heeriye", "heeriye", "Heeriye", "Jasleen Royal & Arijit Singh", "Heeriye", "https://c.saavncdn.com/022/Heeriye-feat-Arijit-Singh-Hindi-2023-20230928050405-500x500.jpg", 194.0, "Bollywood", "RLzC55ai0eo", "https://mrj-music.vercel.app/api/music/stream/RLzC55ai0eo")
            )
        ),
        SearchEntity(
            name = "Aaj Ki Raat",
            type = EntityType.SONG,
            subtitle = "Song • Sachin-Jigar, Madhubanti • Stree 2",
            thumbnail = "https://c.saavncdn.com/264/Aaj-Ki-Raat-From-Stree-2-Hindi-2024-20240724141005-500x500.jpg",
            category = "Bollywood",
            aliases = listOf("aj ki rat", "aaj ki raat stree 2", "aj ki raat", "tamannaah song", "stree 2 song"),
            popularCompletions = listOf(
                "Aaj Ki Raat",
                "Aaj Ki Raat Stree 2",
                "Aaj Ki Raat Tamannaah",
                "Aaj Ki Raat Dance Video",
                "Aaj Ki Raat Full Song"
            )
        ),
        SearchEntity(
            name = "Mi Amor",
            type = EntityType.SONG,
            subtitle = "Song • Sharn • Punjabi Viral",
            thumbnail = "https://i.ytimg.com/vi/VNs_cCtdbPc/hqdefault.jpg",
            category = "Punjabi",
            aliases = listOf("me amor", "miamor", "mi armor", "mi amor sharn"),
            popularCompletions = listOf(
                "Mi Amor",
                "Mi Amor Sharn",
                "Mi Amor The Paul",
                "Mi Amor Slowed Reverb",
                "Mi Amor Reels Song"
            )
        ),
        SearchEntity(
            name = "Nadaaniyan",
            type = EntityType.SONG,
            subtitle = "Song • Akshath • Indie Romantic",
            thumbnail = "https://i.ytimg.com/vi/gPpQNzQP6gE/hqdefault.jpg",
            category = "Indie",
            aliases = listOf("nadaniyan", "nadaniya", "nadanian", "nadaniyan akshath"),
            popularCompletions = listOf(
                "Nadaaniyan",
                "Nadaaniyan Akshath",
                "Nadaaniyan Acoustic",
                "Nadaaniyan Lofi",
                "Nadaaniyan Lyrics"
            )
        )
    )

    fun processQuery(rawQuery: String): FuzzySearchResult {
        val query = rawQuery.trim().lowercase()
        if (query.isBlank()) {
            return FuzzySearchResult(
                correctedQuery = null,
                isTypoCorrected = false,
                topPrediction = null,
                suggestions = emptyList(),
                instantSongs = emptyList()
            )
        }

        var matchedEntity: SearchEntity? = null
        var isTypoOrAlias = false

        // 1. Check Exact Match
        val exactMatch = ENTITY_KNOWLEDGE_BASE.firstOrNull { it.name.equals(query, ignoreCase = true) }
        if (exactMatch != null) {
            matchedEntity = exactMatch
            isTypoOrAlias = false
        } else {
            // Check Alias match (e.g. "toba toba" -> "Tauba Tauba", "afijit" -> "Arijit Singh")
            val aliasMatch = ENTITY_KNOWLEDGE_BASE.firstOrNull { entity ->
                entity.aliases.any { it.equals(query, ignoreCase = true) }
            }
            if (aliasMatch != null) {
                matchedEntity = aliasMatch
                isTypoOrAlias = true
            }
        }

        // 2. Check Prefix Match
        if (matchedEntity == null) {
            val prefixMatch = ENTITY_KNOWLEDGE_BASE.firstOrNull { entity ->
                entity.name.lowercase().startsWith(query)
            }
            if (prefixMatch != null) {
                matchedEntity = prefixMatch
                isTypoOrAlias = false
            } else {
                val aliasPrefixMatch = ENTITY_KNOWLEDGE_BASE.firstOrNull { entity ->
                    entity.aliases.any { it.startsWith(query) }
                }
                if (aliasPrefixMatch != null) {
                    matchedEntity = aliasPrefixMatch
                    isTypoOrAlias = true
                }
            }
        }

        // 3. Check Levenshtein / Fuzzy Typo Distance
        if (matchedEntity == null && query.length >= 3) {
            var bestScore = 0.0
            var bestEntity: SearchEntity? = null

            for (entity in ENTITY_KNOWLEDGE_BASE) {
                val nameScore = computeFuzzyScore(query, entity.name.lowercase())
                if (nameScore > bestScore && nameScore >= 0.65) {
                    bestScore = nameScore
                    bestEntity = entity
                }
                for (alias in entity.aliases) {
                    val aliasScore = computeFuzzyScore(query, alias.lowercase())
                    if (aliasScore > bestScore && aliasScore >= 0.65) {
                        bestScore = aliasScore
                        bestEntity = entity
                    }
                }
            }

            if (bestEntity != null) {
                matchedEntity = bestEntity
                isTypoOrAlias = true
            }
        }

        // 4. Construct AI Intent Suggestions & Predictions
        if (matchedEntity != null) {
            val predType = if (matchedEntity.type == EntityType.SONG) "song" else "artist"
            val topPred = TopPrediction(
                type = predType,
                title = matchedEntity.name,
                subtitle = matchedEntity.subtitle,
                thumbnail = matchedEntity.thumbnail,
                category = matchedEntity.category,
                track = matchedEntity.sampleTracks.firstOrNull()
            )

            val suggestions = matchedEntity.popularCompletions.take(7)

            return FuzzySearchResult(
                correctedQuery = if (isTypoOrAlias) matchedEntity.name else null,
                isTypoCorrected = isTypoOrAlias,
                topPrediction = topPred,
                suggestions = suggestions,
                instantSongs = matchedEntity.sampleTracks
            )
        }

        // 5. Fallback for Open Queries: Generate smart contextual music predictions
        val cleanWord = rawQuery.trim().replace(Regex("""\s+"""), " ")
        val smartSuggestions = listOf(
            cleanWord,
            "$cleanWord Songs",
            "$cleanWord Romantic",
            "$cleanWord All Songs",
            "$cleanWord Sad Songs",
            "$cleanWord Lo-Fi Remix",
            "$cleanWord Mashup"
        ).distinct().take(6)

        return FuzzySearchResult(
            correctedQuery = null,
            isTypoCorrected = false,
            topPrediction = null,
            suggestions = smartSuggestions,
            instantSongs = emptyList()
        )
    }

    private fun computeFuzzyScore(input: String, target: String): Double {
        if (input == target) return 1.0
        if (target.contains(input)) return 0.88 + (input.length.toDouble() / target.length) * 0.1
        if (input.contains(target)) return 0.85

        val inputTokens = input.split(" ").filter { it.isNotBlank() }
        val targetTokens = target.split(" ").filter { it.isNotBlank() }

        if (inputTokens.isNotEmpty() && targetTokens.isNotEmpty()) {
            var tokenScoreSum = 0.0
            for (inTok in inputTokens) {
                var maxTokScore = 0.0
                for (tarTok in targetTokens) {
                    val dist = levenshtein(inTok, tarTok)
                    val maxLen = max(inTok.length, tarTok.length)
                    val sim = if (maxLen > 0) 1.0 - (dist.toDouble() / maxLen) else 0.0
                    if (sim > maxTokScore) maxTokScore = sim
                }
                tokenScoreSum += maxTokScore
            }
            val avgTokenScore = tokenScoreSum / inputTokens.size
            if (avgTokenScore >= 0.70) return avgTokenScore
        }

        val dist = levenshtein(input, target)
        val maxLen = max(input.length, target.length)
        return if (maxLen > 0) 1.0 - (dist.toDouble() / maxLen) else 0.0
    }

    private fun levenshtein(s1: String, s2: String): Int {
        val dp = Array(s1.length + 1) { IntArray(s2.length + 1) }
        for (i in 0..s1.length) dp[i][0] = i
        for (j in 0..s2.length) dp[0][j] = j

        for (i in 1..s1.length) {
            for (j in 1..s2.length) {
                val cost = if (s1[i - 1] == s2[j - 1]) 0 else 1
                dp[i][j] = min(
                    dp[i - 1][j] + 1,
                    min(
                        dp[i][j - 1] + 1,
                        dp[i - 1][j - 1] + cost
                    )
                )
            }
        }
        return dp[s1.length][s2.length]
    }
}
