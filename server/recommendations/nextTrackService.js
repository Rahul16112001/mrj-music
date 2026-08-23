import { db } from '../db/schema.js';
import { contentClassifier, CONTENT_TYPES } from '../catalog/contentClassifier.js';
import { musicProvider } from '../providers/musicProvider.js';
import { chartService } from '../charts/chartService.js';
import { sessionManager, personalizationEngine } from './personalizationEngine.js';

export const nextTrackService = {
  async getNextRecommendations(userId, options = {}) {
    const {
      currentTrack = null,
      playedTrackIds = [],
      currentQueueIds = [],
      mood = null,
      sessionId = null,
      sessionSearches = [],
      tuneConfig = null,
    } = options;

    const excludedIds = new Set([
      ...(currentTrack ? [currentTrack.id] : []),
      ...(Array.isArray(playedTrackIds) ? playedTrackIds : []),
      ...(Array.isArray(currentQueueIds) ? currentQueueIds : []),
    ]);

    // 1. Gather Large Candidate Pool (100+ tracks where possible)
    let candidates = [];
    if (currentTrack) {
      candidates = await musicProvider.getCandidatePool(currentTrack);
    } else {
      const charts = await chartService.getTrending('IN');
      candidates = charts.tracks || [];
    }

    if (candidates.length < 50) {
      const globalCharts = await chartService.getTrending('GLOBAL');
      candidates = [...candidates, ...globalCharts.tracks];
    }

    // 2. Fetch User Long-Term Profile & Active Session State
    const profile = userId ? await db.getTasteProfile(userId) : null;
    const session = sessionId ? sessionManager.getSession(sessionId) : null;
    const activeTune = tuneConfig || session?.tuneConfig || { artistVariety: 50, discoveryLevel: 40, energy: 50 };

    const dislikedArtists = new Set(profile?.disliked_artists || []);
    const preferredArtists = profile?.preferred_artists || {};
    const likedArtists = new Set(profile?.liked_artists || []);
    const preferredGenres = profile?.preferred_genres || {};

    const historySearches = userId ? await db.getSearchHistory(userId) : [];
    const allSearchSignals = new Set([
      ...historySearches.map(s => s.toLowerCase()),
      ...sessionSearches.map(s => s.toLowerCase()),
      ...(session?.searches || []).map(s => s.query),
    ]);

    const seedArtist = (currentTrack?.artist || '').toLowerCase();
    const seedGenre = (currentTrack?.genre || '').toLowerCase();

    // 3. Multi-Signal Scoring Engine (Music-First + Session Intent + Long-Term Taste + Tune Controls)
    const scored = candidates
      .map(raw => contentClassifier.normalizeTrack(raw))
      .filter(t => !excludedIds.has(t.id) && !dislikedArtists.has(t.artist) && !t.isCompilation && !t.isReaction)
      .map(track => {
        let score = 0;
        const trackArtistLower = track.artist.toLowerCase();
        const trackTitleLower = track.title.toLowerCase();
        const trackGenreLower = (track.genre || '').toLowerCase();

        // A. Primary Short-Term: Seed Track & Artist Similarity (0 - 45 pts)
        if (seedArtist && (trackArtistLower.includes(seedArtist) || seedArtist.includes(trackArtistLower))) {
          score += 40;
        }
        if (seedGenre && trackGenreLower && seedGenre === trackGenreLower) {
          score += 25;
        }

        // B. Session Intent Signals with Recency (0 - 35 pts)
        for (const search of allSearchSignals) {
          if (trackArtistLower.includes(search) || trackTitleLower.includes(search)) {
            score += 25;
            break;
          }
        }
        if (session?.sessionArtists?.has(track.artist)) {
          score += Math.min(25, session.sessionArtists.get(track.artist) * 2);
        }

        // C. Long-Term User Taste Affinity (0 - 30 pts)
        const isFamiliar = likedArtists.has(track.artist) || preferredArtists[track.artist];
        if (preferredArtists[track.artist]) {
          score += Math.min(25, preferredArtists[track.artist] * 2);
        }
        if (likedArtists.has(track.artist)) {
          score += 25;
        }
        if (preferredGenres[track.genre]) {
          score += Math.min(15, preferredGenres[track.genre] * 1.5);
        }

        // D. Discovery Level Tuning (0 - 100)
        // High discovery boosts unfamiliar artists; Low discovery boosts familiar
        const discoveryRatio = (activeTune.discoveryLevel ?? 40) / 100;
        if (!isFamiliar && discoveryRatio > 0.5) {
          score += Math.round(discoveryRatio * 30);
        } else if (isFamiliar && discoveryRatio <= 0.5) {
          score += Math.round((1 - discoveryRatio) * 20);
        }

        // E. Mood Alignment (0 - 25 pts)
        const targetMood = mood || activeTune.mood || session?.currentMood;
        if (targetMood) {
          const mLower = targetMood.toLowerCase();
          if (trackGenreLower.includes(mLower) || trackTitleLower.includes(mLower)) {
            score += 25;
          }
        }

        // F. Music-First Audio Bonus
        if (track.contentType === CONTENT_TYPES.MUSIC && track.isAudioOnly) {
          score += 20;
        }

        const reason = personalizationEngine.generateAttributionReason(track, currentTrack, profile, session);

        return {
          track: {
            ...track,
            recommendationReason: reason,
          },
          score,
        };
      });

    // Deterministic Sort
    scored.sort((a, b) => b.score - a.score);

    // 4. Dynamic Artist Variety Enforcement based on Tune Settings
    // Low variety allows up to 3 per artist, high variety restricts to 1
    const maxTracksPerArtist = activeTune.artistVariety > 70 ? 1 : 2;
    const nextQueue = [];
    const artistCounts = {};

    for (const item of scored) {
      const art = item.track.artist;
      artistCounts[art] = (artistCounts[art] || 0) + 1;
      if (artistCounts[art] <= maxTracksPerArtist) {
        nextQueue.push(item.track);
      }
      if (nextQueue.length >= 25) break;
    }

    return {
      source: 'NextTrackRecommendationService',
      count: nextQueue.length,
      tracks: nextQueue,
    };
  },
};
