import { db } from '../db/schema.js';
import { musicProvider } from '../providers/musicProvider.js';
import { contentClassifier } from './contentClassifier.js';

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
    const cleanQuery = (query || '').trim().toLowerCase();

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
      };
    }

    // 2. Fetch User Profile for Personalized Ranking
    const profile = userId ? await db.getTasteProfile(userId) : null;
    const userLikes = userId ? await db.getLikedTracks(userId) : [];
    const likedArtists = new Set(profile?.liked_artists || []);
    const preferredArtists = profile?.preferred_artists || {};

    // 3. Generate Matching Query Suggestions
    const querySuggestions = new Set();

    // Check user history matches first
    if (userId) {
      const history = await db.getSearchHistory(userId);
      for (const h of history) {
        if (h.toLowerCase().includes(cleanQuery)) {
          querySuggestions.add(h);
        }
      }
    }

    // Check popular search seeds matches
    for (const seed of POPULAR_SEARCH_SEEDS) {
      if (seed.toLowerCase().includes(cleanQuery)) {
        querySuggestions.add(seed);
      }
    }

    // 4. Query Music Provider Catalog (with timeout & fallback)
    let searchResults = { results: [], artists: [] };
    try {
      searchResults = await musicProvider.search(cleanQuery, 'all', 15);
    } catch (e) {
      console.warn('Search suggestion provider fallback:', e.message);
    }

    // 5. Categorize & Score Matching Songs, Artists & Albums
    const songs = [];
    const artists = [];
    const albums = [];

    // Extract Song suggestions and generate query completions from titles
    for (const track of searchResults.results || []) {
      if (!contentClassifier.isCompilation(track.title, track.artist, track.duration)) {
        // Scoring formula: Text relevance (0-50) + User affinity (0-30) + Popularity
        let score = 0;
        const trackTitleLower = track.title.toLowerCase();
        const trackArtistLower = track.artist.toLowerCase();

        if (trackTitleLower.startsWith(cleanQuery)) score += 50;
        else if (trackTitleLower.includes(cleanQuery)) score += 30;

        if (trackArtistLower.startsWith(cleanQuery)) score += 40;
        else if (trackArtistLower.includes(cleanQuery)) score += 25;

        // User taste personalization
        if (preferredArtists[track.artist]) {
          score += Math.min(30, preferredArtists[track.artist] * 3);
        }
        if (likedArtists.has(track.artist)) {
          score += 25;
        }

        songs.push({ ...track, score });
        querySuggestions.add(track.title);
      }
    }

    // Sort songs by combined score
    songs.sort((a, b) => (b.score || 0) - (a.score || 0));

    // Extract Artist suggestions
    for (const artist of searchResults.artists || []) {
      artists.push(artist);
      querySuggestions.add(artist.name);
    }

    // If query matches an artist name pattern, suggest album
    if (cleanQuery.length >= 3) {
      albums.push({
        id: `alb_essentials_${cleanQuery.replace(/\s+/g, '_')}`,
        title: `${cleanQuery.charAt(0).toUpperCase() + cleanQuery.slice(1)} Essentials`,
        artist: searchResults.artists?.[0]?.name || cleanQuery,
        thumbnail: searchResults.results?.[0]?.thumbnail || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300',
      });
    }

    return {
      query: cleanQuery,
      suggestions: Array.from(querySuggestions).slice(0, 8),
      songs: songs.slice(0, 6).map(({ score, ...rest }) => rest),
      artists: artists.slice(0, 4),
      albums: albums.slice(0, 2),
    };
  },
};
