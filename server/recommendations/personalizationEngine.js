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
    const prefArtists = { ...(profile.preferred_artists || {}) };
    const prefGenres = { ...(profile.preferred_genres || {}) };
    const prefMoods = { ...(profile.preferred_moods || {}) };
    const likedArtists = new Set(profile.liked_artists || []);
    const dislikedArtists = new Set(profile.disliked_artists || []);
    const likedGenres = new Set(profile.liked_genres || []);
    const dislikedGenres = new Set(profile.disliked_genres || []);
    let recentSeeds = Array.isArray(profile.recent_seeds) ? [...profile.recent_seeds] : [];

    const artist = event.artist || '';
    const genre = event.genre || '';
    const trackId = event.trackId || '';
    const title = event.title || '';
    const completionPercent = Number.isFinite(event.completionPercent) ? event.completionPercent : null;
    const et = event.eventType;

    // ---- RECENCY WEIGHTING ----
    // Decay long-term affinity based on time since the profile was last touched, so
    // the profile tracks CURRENT taste rather than an all-time accumulation. Same-batch
    // events (age ~0) are effectively undecayed.
    const now = Date.now();
    const lastUpdate = Number(profile.updated_at) || now;
    const ageDays = Math.max(0, (now - lastUpdate) / 86400000);
    const HALF_LIFE_DAYS = 30;
    const decay = ageDays > 0 ? Math.pow(0.5, ageDays / HALF_LIFE_DAYS) : 1;
    if (decay < 1) {
      for (const map of [prefArtists, prefGenres, prefMoods]) {
        for (const k of Object.keys(map)) {
          const v = map[k] * decay;
          if (v < 0.5) delete map[k];
          else map[k] = Math.round(v * 100) / 100;
        }
      }
    }

    let delta = 0;
    switch (et) {
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

    // completionPercent (previously captured but ignored) nudges the affinity delta.
    if (completionPercent != null && (et === 'PLAY_COMPLETED' || et === 'PLAY_50' || et === 'PLAY_STARTED' || et === 'REPEAT' || !et)) {
      delta += Math.max(-15, Math.min(20, Math.round((completionPercent - 50) / 5)));
    }

    if (artist && !dislikedArtists.has(artist)) {
      prefArtists[artist] = Math.max(0, (prefArtists[artist] || 0) + delta);
    }
    if (genre) {
      prefGenres[genre] = Math.max(0, (prefGenres[genre] || 0) + Math.floor(delta / 2));
    }

    // ---- Preferred moods (event-supplied or inferred from genre/title) ----
    const mood = event.mood || contentClassifier.inferMood(genre, title);
    if (mood) {
      prefMoods[mood] = Math.max(0, (prefMoods[mood] || 0) + Math.floor(delta / 2));
    }

    // ---- Liked / disliked genres ----
    const POSITIVE_GENRE_EVENTS = ['LIKE', 'MORE_LIKE_THIS', 'REPEAT', 'PLAYLIST_ADD'];
    const NEGATIVE_GENRE_EVENTS = ['DONT_RECOMMEND_ARTIST', 'NOT_INTERESTED', 'DISLIKE'];
    if (genre && POSITIVE_GENRE_EVENTS.includes(et)) {
      likedGenres.add(genre);
      dislikedGenres.delete(genre);
    }
    if (genre && NEGATIVE_GENRE_EVENTS.includes(et)) {
      dislikedGenres.add(genre);
      likedGenres.delete(genre);
    }

    // ---- Play / skip / completion counters + running rates ----
    const isSkip = typeof et === 'string' && et.startsWith('SKIP');
    const isPlayAttempt = ['PLAY_STARTED', 'PLAY_50', 'PLAY_COMPLETED', 'REPEAT'].includes(et);
    const isCompletion = et === 'PLAY_COMPLETED' || (isPlayAttempt && completionPercent != null && completionPercent >= 90);
    const total_plays = (profile.total_plays || 0) + ((isPlayAttempt || isSkip) ? 1 : 0);
    const total_skips = (profile.total_skips || 0) + (isSkip ? 1 : 0);
    const total_completions = (profile.total_completions || 0) + (isCompletion ? 1 : 0);
    const denom = Math.max(1, total_plays);
    const completion_rate = Math.round((total_completions / denom) * 1000) / 1000;
    const skip_rate = Math.round((total_skips / denom) * 1000) / 1000;

    // ---- Rolling recent seeds (ids actually engaged with; used to filter "already heard") ----
    if (trackId && (isPlayAttempt || isSkip)) {
      recentSeeds = recentSeeds.filter((s) => s !== trackId);
      recentSeeds.unshift(trackId);
      recentSeeds = recentSeeds.slice(0, 50);
    }

    await db.saveTasteProfile(userId, {
      ...profile,
      preferred_artists: prefArtists,
      preferred_genres: prefGenres,
      preferred_moods: prefMoods,
      liked_artists: Array.from(likedArtists),
      disliked_artists: Array.from(dislikedArtists),
      liked_genres: Array.from(likedGenres),
      disliked_genres: Array.from(dislikedGenres),
      skip_rate,
      completion_rate,
      total_plays,
      total_skips,
      total_completions,
      recent_seeds: recentSeeds,
    });

    // Mirror to active session
    if (event.sessionId) {
      sessionManager.recordSessionEvent(event.sessionId, {
        searchQuery: et === 'SEARCH' ? event.query : null,
        artist,
        genre,
        trackId,
        weight: delta,
        isSkip,
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
