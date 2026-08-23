import { db } from '../db/schema.js';
import { musicProvider } from '../providers/musicProvider.js';
import { searchIntentEngine } from './searchIntentEngine.js';

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
    const cleanQuery = (query || '').trim();
    const intent = searchIntentEngine.parse(cleanQuery);

    // 1. If query is empty, return Recent Searches + Popular + Top Artists
    if (!cleanQuery) {
      const recentSearches = userId ? await db.getSearchHistory(userId) : [];
      const profile = userId ? await db.getTasteProfile(userId) : null;
      const preferredArtists = Object.keys(profile?.preferred_artists || {}).slice(0, 5);

      return {
        query: '',
        recent: recentSearches.slice(0, 8),
        popular: POPULAR_SEARCH_SEEDS.slice(0, 10),
        personalized: preferredArtists,
        suggestions: recentSearches.length > 0 ? recentSearches.slice(0, 6) : POPULAR_SEARCH_SEEDS.slice(0, 6),
        songs: [],
        artists: [],
        albums: [],
        videos: [],
        podcasts: [],
      };
    }

    // 2. Generate Matching Query Suggestions from seeds and history
    const querySuggestions = new Set();

    if (userId) {
      const history = await db.getSearchHistory(userId);
      for (const h of history) {
        if (h.toLowerCase().includes(cleanQuery.toLowerCase())) {
          querySuggestions.add(h);
        }
      }
    }

    for (const seed of POPULAR_SEARCH_SEEDS) {
      if (seed.toLowerCase().includes(cleanQuery.toLowerCase())) {
        querySuggestions.add(seed);
      }
    }

    // Contextual query variations
    querySuggestions.add(cleanQuery);
    querySuggestions.add(`${cleanQuery} lyrics`);
    querySuggestions.add(`${cleanQuery} live`);
    querySuggestions.add(`${cleanQuery} slowed reverb`);

    // 3. Query Music Provider Catalog (using strict content classification & deduplication)
    let searchResults = { songs: [], videos: [], artists: [], albums: [], podcasts: [] };
    try {
      searchResults = await musicProvider.search(cleanQuery, 'all', 25);
    } catch (e) {
      console.warn('Search suggestion provider fallback:', e.message);
    }

    for (const song of searchResults.songs || []) {
      querySuggestions.add(song.title);
    }
    for (const artist of searchResults.artists || []) {
      querySuggestions.add(artist.name);
    }

    return {
      query: cleanQuery,
      intent: intent.primaryIntent,
      suggestions: Array.from(querySuggestions).slice(0, 8),
      songs: (searchResults.songs || []).slice(0, 6),
      artists: (searchResults.artists || []).slice(0, 4),
      albums: (searchResults.albums || []).slice(0, 2),
      videos: (searchResults.videos || []).slice(0, 3),
      podcasts: (searchResults.podcasts || []).slice(0, 2),
    };
  },
};
