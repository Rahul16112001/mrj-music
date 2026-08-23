import { db } from '../db/schema.js';
import { musicProvider } from '../providers/musicProvider.js';
import { searchIntentEngine } from './searchIntentEngine.js';
import { searchRelevanceEngine } from './searchRelevanceEngine.js';

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
  async getSuggestions(query = '', userId = null) {
    const rawClean = (query || '').trim();
    const normQuery = searchRelevanceEngine.normalize(rawClean);
    const intent = searchIntentEngine.parse(rawClean);

    // 1. If query is empty, return Recent Searches + Popular Seeds
    if (!normQuery) {
      const recentSearches = userId ? await db.getSearchHistory(userId) : [];
      const profile = userId ? await db.getTasteProfile(userId) : null;
      const preferredArtists = Object.keys(profile?.preferred_artists || {}).slice(0, 5);

      return {
        query: '',
        recent: recentSearches.slice(0, 8),
        popular: POPULAR_SEARCH_SEEDS.slice(0, 10),
        personalized: preferredArtists,
        suggestions: POPULAR_SEARCH_SEEDS.slice(0, 6),
        songs: [],
        artists: [],
        albums: [],
        videos: [],
        podcasts: [],
      };
    }

    // 2. Separate RECENT SEARCHES (Strictly from user history matching query prefix/tokens)
    const recentMatches = [];
    if (userId) {
      const history = await db.getSearchHistory(userId);
      for (const h of history) {
        const normH = searchRelevanceEngine.normalize(h);
        if (normH.includes(normQuery) || normQuery.includes(normH)) {
          recentMatches.push(h);
        }
      }
    }

    // 3. Progressive SUGGESTIONS: Build query completions based on prefix relevance
    const suggestionMap = new Map();

    const addSuggestion = (text, weight) => {
      if (!text) return;
      const clean = text.trim();
      const normText = searchRelevanceEngine.normalize(clean);
      if (!normText) return;

      // Progressive relevance check
      if (normText === normQuery) {
        suggestionMap.set(clean, Math.max(suggestionMap.get(clean) || 0, weight + 500));
      } else if (normText.startsWith(normQuery)) {
        suggestionMap.set(clean, Math.max(suggestionMap.get(clean) || 0, weight + 300));
      } else if (normText.includes(normQuery)) {
        suggestionMap.set(clean, Math.max(suggestionMap.get(clean) || 0, weight + 100));
      }
    };

    // Add base query & intent variations
    addSuggestion(rawClean, 200);
    addSuggestion(`${rawClean} song`, 180);
    addSuggestion(`${rawClean} lyrics`, 160);
    addSuggestion(`${rawClean} live`, 140);
    addSuggestion(`${rawClean} remix`, 120);

    // Add matching popular seeds
    for (const seed of POPULAR_SEARCH_SEEDS) {
      addSuggestion(seed, 150);
    }

    // 4. Query Catalog with Search Relevance Engine
    let searchResults = { songs: [], videos: [], artists: [], albums: [], podcasts: [] };
    try {
      searchResults = await musicProvider.search(rawClean, 'all', 20);
    } catch (e) {
      console.warn('Search suggestion provider fallback:', e.message);
    }

    // Extract title completions from top songs
    for (const song of searchResults.songs || []) {
      addSuggestion(song.title, 190);
    }
    for (const artist of searchResults.artists || []) {
      addSuggestion(artist.name, 170);
    }
    for (const alb of searchResults.albums || []) {
      addSuggestion(alb.title, 150);
    }

    // Sort suggestions descending by progressive relevance weight
    const sortedSuggestions = Array.from(suggestionMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map((entry) => entry[0])
      .slice(0, 8);

    // Apply strict search relevance engine to filter Songs in suggestions
    const relevantSongs = searchRelevanceEngine.filterAndRank(
      searchResults.songs || [],
      rawClean,
      intent,
      6
    );

    // Filter matching Artists
    const relevantArtists = (searchResults.artists || [])
      .filter((a) => {
        const normArt = searchRelevanceEngine.normalize(a.name);
        return normArt.includes(normQuery) || normQuery.includes(normArt);
      })
      .slice(0, 3);

    // Filter matching Albums
    const relevantAlbums = (searchResults.albums || [])
      .filter((a) => {
        const normAlb = searchRelevanceEngine.normalize(a.title);
        return normAlb.includes(normQuery) || normQuery.includes(normAlb);
      })
      .slice(0, 2);

    return {
      query: rawClean,
      intent: intent.primaryIntent,
      recent: recentMatches.slice(0, 4),
      suggestions: sortedSuggestions,
      songs: relevantSongs,
      artists: relevantArtists,
      albums: relevantAlbums,
      videos: (searchResults.videos || []).slice(0, 3),
      podcasts: (searchResults.podcasts || []).slice(0, 2),
    };
  },
};
