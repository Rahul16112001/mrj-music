import { db } from '../db/schema.js';
import { musicProvider } from '../providers/musicProvider.js';
import { searchIntentEngine } from './searchIntentEngine.js';
import { searchRelevanceEngine } from './searchRelevanceEngine.js';
import { getYoutubeMusicSuggestions } from './youtubeScraper.js';

// Popular trending search seeds for instant fallback
const POPULAR_SEARCH_SEEDS = [
  'Arijit Singh',
  'Taylor Swift',
  'The Weeknd',
  'Anirudh Ravichander',
  'Shreya Ghoshal',
  'Ed Sheeran',
  'Dua Lipa',
  'Pritam',
  'Badshah',
  'Guru Randhawa',
  'Diljit Dosanjh',
  'Karan Aujla',
  'Imagine Dragons',
  'Harry Styles',
  'King',
  'Desi Kalakaar',
  'Desi Girl',
  'Desi Boyz',
  'Kesariya',
  'Chaleya',
  'Apna Bana Le',
  'Blinding Lights',
  'Levitating',
  'Shape of You',
  'Heeriye',
  'Maan Meri Jaan',
];

export const searchSuggestionService = {
  /**
   * Generates persona-aware and region-aware search suggestions
   */
  async getSuggestions(query = '', userId = null, options = {}) {
    const rawClean = (query || '').trim();
    const normQuery = searchRelevanceEngine.normalize(rawClean);
    const intent = searchIntentEngine.parse(rawClean);

    // 1. Fetch User Profile, History, Likes & Session Signals
    let profile = null;
    let searchHistory = [];
    let recentlyPlayed = [];
    let likedTracks = [];

    if (userId) {
      try {
        const [p, sh, rh, lt] = await Promise.allSettled([
          db.getTasteProfile(userId),
          db.getSearchHistory(userId),
          db.getUserHistory(userId),
          db.getLikedTracks(userId),
        ]);
        profile = p.status === 'fulfilled' ? p.value : null;
        searchHistory = sh.status === 'fulfilled' ? sh.value || [] : [];
        recentlyPlayed = rh.status === 'fulfilled' ? rh.value || [] : [];
        likedTracks = lt.status === 'fulfilled' ? lt.value || [] : [];
      } catch (err) {
        console.warn('Taste profile fetch notice:', err.message);
      }
    }

    const preferredArtists = new Set(Object.keys(profile?.preferred_artists || {}));
    const likedArtists = new Set(profile?.liked_artists || []);
    const preferredGenres = new Set(Object.keys(profile?.preferred_genres || {}));
    const preferredLanguages = new Set(profile?.preferred_languages || []);
    const userRegion = options.region || profile?.region || 'GLOBAL';

    const sessionSearches = options.sessionContext?.sessionSearches || [];
    const sessionArtists = options.sessionContext?.sessionArtists || [];

    // 2. EMPTY QUERY: Return Recent Searches + Popular Seeds + Preferred Artists
    if (!normQuery) {
      const topArtists = Array.from(new Set([...preferredArtists, ...likedArtists])).slice(0, 5);
      return {
        query: '',
        recent: searchHistory.slice(0, 8),
        popular: POPULAR_SEARCH_SEEDS.slice(0, 10),
        personalized: topArtists,
        suggestions: POPULAR_SEARCH_SEEDS.slice(0, 6),
        songs: [],
        artists: [],
        albums: [],
        videos: [],
        podcasts: [],
      };
    }

    // 3. SEPARATE RECENT SEARCHES (Strictly User History matching query)
    const recentMatches = [];
    for (const h of searchHistory) {
      const normH = searchRelevanceEngine.normalize(h);
      if (normH.startsWith(normQuery) || normH.includes(normQuery) || normQuery.includes(normH)) {
        if (!recentMatches.includes(h)) recentMatches.push(h);
      }
    }

    // 4. CANDIDATE QUERY SUGGESTIONS POOL
    const rawSuggestions = new Set();

    // Base query + natural intent completions
    rawSuggestions.add(rawClean);
    rawSuggestions.add(`${rawClean} song`);
    rawSuggestions.add(`${rawClean} songs`);
    rawSuggestions.add(`${rawClean} lyrics`);
    rawSuggestions.add(`${rawClean} live`);
    rawSuggestions.add(`${rawClean} remix`);

    // Popular seeds matching query
    for (const seed of POPULAR_SEARCH_SEEDS) {
      const normSeed = searchRelevanceEngine.normalize(seed);
      if (normSeed.includes(normQuery) || normQuery.includes(normSeed)) {
        rawSuggestions.add(seed);
        rawSuggestions.add(`${seed} songs`);
      }
    }

    // User's liked artists or preferred artists matching query
    for (const art of [...preferredArtists, ...likedArtists]) {
      const normArt = searchRelevanceEngine.normalize(art);
      if (normArt.includes(normQuery) || normQuery.includes(normArt)) {
        rawSuggestions.add(art);
        rawSuggestions.add(`${art} songs`);
        rawSuggestions.add(`${art} new songs`);
      }
    }

    // 5. INSTANT YOUTUBE MUSIC PREDICTIONS (Sub-200ms Autocomplete)
    const ytMusicRes = await getYoutubeMusicSuggestions(rawClean).catch(() => ({ suggestions: [], songs: [] }));

    for (const q of ytMusicRes.suggestions || []) {
      rawSuggestions.add(q);
    }
    for (const song of ytMusicRes.songs || []) {
      rawSuggestions.add(song.title);
      if (song.artist) rawSuggestions.add(`${song.title} ${song.artist}`);
    }

    // 6. MULTI-SIGNAL SUGGESTION SCORING (Query Relevance Dominates + Persona Boost)
    const scoredSuggestions = [];
    const queryTokens = searchRelevanceEngine.tokenize(normQuery);

    for (const text of rawSuggestions) {
      const clean = text.trim();
      const normText = searchRelevanceEngine.normalize(clean);
      if (!normText) continue;

      let score = 0;

      // A. Query Relevance (Dominant Weight)
      if (normText === normQuery) {
        score += 600; // Exact match
      } else if (normText.startsWith(normQuery)) {
        score += 400; // Prefix match
      } else if (normText.includes(normQuery)) {
        score += 250; // Phrase match
      }

      // Token match
      const textTokens = searchRelevanceEngine.tokenize(normText);
      let matchedTokens = 0;
      for (const qt of queryTokens) {
        if (textTokens.includes(qt)) matchedTokens++;
      }
      score += Math.round((matchedTokens / Math.max(1, queryTokens.length)) * 180);

      // B. User History & Persona Signals (Tie-Breaking & Relevant Boost)
      if (searchHistory.some((h) => searchRelevanceEngine.normalize(h) === normText)) {
        score += 150;
      }
      if (recentlyPlayed.some((r) => normText.includes(searchRelevanceEngine.normalize(r.artist || r.title)))) {
        score += 120;
      }
      for (const art of [...preferredArtists, ...likedArtists]) {
        const normArt = searchRelevanceEngine.normalize(art);
        if (normText.includes(normArt)) {
          score += 160;
          break;
        }
      }

      // C. Genre / Language Signals
      for (const genre of preferredGenres) {
        if (normText.includes(genre.toLowerCase())) {
          score += 100;
          break;
        }
      }

      // D. Session Context
      for (const sArt of sessionArtists) {
        if (normText.includes(searchRelevanceEngine.normalize(sArt))) {
          score += 120;
          break;
        }
      }

      // E. Popularity Tie-Breaker
      if (POPULAR_SEARCH_SEEDS.some((s) => searchRelevanceEngine.normalize(s) === normText)) {
        score += 30;
      }

      scoredSuggestions.push({ text: clean, score });
    }

    // Sort descending by score and deduplicate
    scoredSuggestions.sort((a, b) => b.score - a.score);
    const finalSuggestions = [];
    const seenTexts = new Set();
    for (const item of scoredSuggestions) {
      const lower = item.text.toLowerCase();
      if (!seenTexts.has(lower)) {
        seenTexts.add(lower);
        finalSuggestions.push(item.text);
      }
      if (finalSuggestions.length >= 8) break;
    }

    // 7. REAL MUSIC TRACKS FUSION (YT Music Official Tracks)
    const fusedSongs = ytMusicRes.songs || [];

    return {
      query: rawClean,
      intent: intent.primaryIntent,
      recent: recentMatches.slice(0, 4),
      suggestions: finalSuggestions,
      songs: fusedSongs.slice(0, 6),
      artists: [],
      albums: [],
      videos: [],
      podcasts: [],
    };
  },
};
