import { db } from '../db/schema.js';
import { musicProvider } from '../providers/musicProvider.js';
import { contentClassifier, CONTENT_TYPES } from './contentClassifier.js';
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

    // 2. Fetch User Profile for Personalized Ranking
    const profile = userId ? await db.getTasteProfile(userId) : null;
    const likedArtists = new Set(profile?.liked_artists || []);
    const preferredArtists = profile?.preferred_artists || {};

    // 3. Generate Matching Query Suggestions
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

    // 4. Query Music Provider Catalog
    let searchResults = { results: [], artists: [] };
    try {
      searchResults = await musicProvider.search(cleanQuery, 'all', 25);
    } catch (e) {
      console.warn('Search suggestion provider fallback:', e.message);
    }

    // 5. Categorize into Music-First Groups: Songs, Videos, Podcasts, Artists, Albums
    const songs = [];
    const videos = [];
    const podcasts = [];
    const artists = [];
    const albums = [];

    for (const rawTrack of searchResults.results || []) {
      const track = contentClassifier.normalizeTrack(rawTrack);
      if (track.isCompilation || track.isReaction) continue;

      let score = contentClassifier.scoreCandidate(track, intent);

      // User taste boost (preserves text relevance as primary)
      if (preferredArtists[track.artist]) {
        score += Math.min(25, preferredArtists[track.artist] * 2.5);
      }
      if (likedArtists.has(track.artist)) {
        score += 20;
      }

      track.searchScore = score;
      querySuggestions.add(track.title);

      if (track.isPodcast) {
        podcasts.push(track);
      } else if (track.isMusicVideo || track.contentType === CONTENT_TYPES.VIDEO) {
        videos.push(track);
      } else {
        songs.push(track);
      }
    }

    // Sort songs and videos by calculated music score
    songs.sort((a, b) => (b.searchScore || 0) - (a.searchScore || 0));
    videos.sort((a, b) => (b.searchScore || 0) - (a.searchScore || 0));

    // Extract Artists
    for (const artist of searchResults.artists || []) {
      artists.push(artist);
      querySuggestions.add(artist.name);
    }

    // Generate Contextual Albums
    if (cleanQuery.length >= 3) {
      albums.push({
        id: `alb_essentials_${cleanQuery.toLowerCase().replace(/\s+/g, '_')}`,
        title: `${cleanQuery.charAt(0).toUpperCase() + cleanQuery.slice(1)} Essentials`,
        artist: searchResults.artists?.[0]?.name || cleanQuery,
        thumbnail: songs[0]?.thumbnail || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300',
        trackCount: 12,
      });
    }

    return {
      query: cleanQuery,
      intent: intent.primaryIntent,
      suggestions: Array.from(querySuggestions).slice(0, 8),
      songs: songs.slice(0, 6).map(({ searchScore, ...rest }) => rest),
      artists: artists.slice(0, 4),
      albums: albums.slice(0, 2),
      videos: videos.slice(0, 3).map(({ searchScore, ...rest }) => rest),
      podcasts: podcasts.slice(0, 2).map(({ searchScore, ...rest }) => rest),
    };
  },
};
