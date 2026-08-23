import { db } from '../db/schema.js';
import { contentClassifier } from '../catalog/contentClassifier.js';
import { chartService } from '../charts/chartService.js';

// In-Memory Session Profile Store (Decays with activity and session timeout)
class SessionStore {
  constructor() {
    this.sessions = new Map();
  }

  getSession(sessionId) {
    if (!sessionId) return null;
    let s = this.sessions.get(sessionId);
    if (!s) {
      s = {
        sessionId,
        searches: [],
        sessionArtists: new Map(),
        sessionGenres: new Map(),
        currentMood: null,
        recentPlays: [],
        recentSkips: [],
        tuneConfig: {
          artistVariety: 50, // 0 - 100
          discoveryLevel: 40, // 0 - 100 (Familiar <-> Discover)
          energy: 50, // 0 - 100
          mood: null,
        },
        lastActiveAt: Date.now(),
      };
      this.sessions.set(sessionId, s);
    }
    s.lastActiveAt = Date.now();
    return s;
  }

  recordSessionEvent(sessionId, event = {}) {
    const s = this.getSession(sessionId);
    if (!s) return;

    if (event.searchQuery) {
      s.searches.unshift({ query: event.searchQuery.toLowerCase(), timestamp: Date.now() });
      s.searches = s.searches.slice(0, 10);
    }

    if (event.artist) {
      const curr = s.sessionArtists.get(event.artist) || 0;
      s.sessionArtists.set(event.artist, curr + (event.weight || 5));
    }

    if (event.genre) {
      const curr = s.sessionGenres.get(event.genre) || 0;
      s.sessionGenres.set(event.genre, curr + (event.weight || 5));
    }

    if (event.trackId) {
      if (event.isSkip) {
        s.recentSkips.unshift(event.trackId);
        s.recentSkips = s.recentSkips.slice(0, 20);
      } else {
        s.recentPlays.unshift(event.trackId);
        s.recentPlays = s.recentPlays.slice(0, 30);
      }
    }
  }

  setTuneConfig(sessionId, config = {}) {
    const s = this.getSession(sessionId);
    if (s) {
      s.tuneConfig = { ...s.tuneConfig, ...config };
    }
  }
}

export const sessionManager = new SessionStore();

export const personalizationEngine = {
  /**
   * Processes fine-grained behavioral events with exact hierarchical weights
   */
  async processBehavioralEvent(userId, event = {}) {
    if (!userId) return;
    const profile = await db.getTasteProfile(userId);
    const prefArtists = profile.preferred_artists || {};
    const prefGenres = profile.preferred_genres || {};
    const likedArtists = new Set(profile.liked_artists || []);
    const dislikedArtists = new Set(profile.disliked_artists || []);

    const artist = event.artist || '';
    const genre = event.genre || '';
    const trackId = event.trackId || '';

    let delta = 0;
    switch (event.eventType) {
      case 'DONT_RECOMMEND_ARTIST':
        if (artist) dislikedArtists.add(artist);
        delete prefArtists[artist];
        delta = -60;
        break;
      case 'NOT_INTERESTED':
        if (artist) prefArtists[artist] = Math.max(0, (prefArtists[artist] || 0) - 5);
        delta = -40;
        break;
      case 'DISLIKE':
      case 'UNLIKE':
        if (artist) likedArtists.delete(artist);
        delta = -30;
        break;
      case 'SKIP_EARLY': // Skipped < 15 seconds
        delta = -25;
        break;
      case 'SKIP_LATE': // Skipped > 70%
        delta = -5;
        break;
      case 'SEARCH':
        delta = 10;
        break;
      case 'PLAY_STARTED':
        delta = 5;
        break;
      case 'PLAY_50':
        delta = 10;
        break;
      case 'PLAY_COMPLETED':
        delta = 30;
        break;
      case 'REPEAT':
        delta = 40;
        break;
      case 'LIKE':
        if (artist) likedArtists.add(artist);
        delta = 45;
        break;
      case 'MORE_LIKE_THIS':
        if (artist) likedArtists.add(artist);
        delta = 35;
        break;
      case 'PLAYLIST_ADD':
        delta = 35;
        break;
      default:
        delta = 5;
    }

    if (artist && !dislikedArtists.has(artist)) {
      prefArtists[artist] = Math.max(0, (prefArtists[artist] || 0) + delta);
    }
    if (genre) {
      prefGenres[genre] = Math.max(0, (prefGenres[genre] || 0) + Math.floor(delta / 2));
    }

    await db.saveTasteProfile(userId, {
      ...profile,
      preferred_artists: prefArtists,
      preferred_genres: prefGenres,
      liked_artists: Array.from(likedArtists),
      disliked_artists: Array.from(dislikedArtists),
      total_plays: (profile.total_plays || 0) + (event.eventType === 'PLAY_COMPLETED' ? 1 : 0),
      total_skips: (profile.total_skips || 0) + (event.eventType?.startsWith('SKIP') ? 1 : 0),
      last_active: Date.now(),
    });

    // Mirror to active session
    if (event.sessionId) {
      sessionManager.recordSessionEvent(event.sessionId, {
        searchQuery: event.eventType === 'SEARCH' ? event.query : null,
        artist,
        genre,
        trackId,
        weight: delta,
        isSkip: event.eventType?.startsWith('SKIP'),
      });
    }
  },

  /**
   * Generates human-friendly recommendation reason
   */
  generateAttributionReason(track, seedTrack, userProfile, sessionContext) {
    if (seedTrack && track.artist === seedTrack.artist) {
      return `More from ${track.artist}`;
    }
    if (userProfile?.liked_artists?.includes(track.artist)) {
      return `Because you like ${track.artist}`;
    }
    if (sessionContext?.searches?.some(s => track.artist.toLowerCase().includes(s.query) || track.title.toLowerCase().includes(s.query))) {
      return `Based on your recent search`;
    }
    if (seedTrack && track.genre && seedTrack.genre && track.genre === seedTrack.genre) {
      return `Similar ${track.genre} vibes`;
    }
    return `Recommended for you`;
  },
};
