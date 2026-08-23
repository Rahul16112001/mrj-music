import { db } from '../db/schema.js';
import { contentClassifier } from '../catalog/contentClassifier.js';
import { musicProvider } from '../providers/musicProvider.js';
import { chartService } from '../charts/chartService.js';

export const nextTrackService = {
  async getNextRecommendations(userId, options = {}) {
    const {
      currentTrack = null,
      playedTrackIds = [],
      currentQueueIds = [],
      mood = null,
      sessionSearches = [],
    } = options;

    const excludedIds = new Set([
      ...(currentTrack ? [currentTrack.id] : []),
      ...(Array.isArray(playedTrackIds) ? playedTrackIds : []),
      ...(Array.isArray(currentQueueIds) ? currentQueueIds : []),
    ]);

    // 1. Gather Candidates
    let candidates = [];
    if (currentTrack) {
      candidates = await musicProvider.getCandidatePool(currentTrack);
    } else {
      const charts = await chartService.getTrending('IN');
      candidates = charts.tracks || [];
    }

    if (candidates.length < 25) {
      const globalCharts = await chartService.getTrending('GLOBAL');
      candidates = [...candidates, ...globalCharts.tracks];
    }

    // 2. Fetch User Profile, History & Search Signals
    const profile = userId ? await db.getTasteProfile(userId) : null;
    const historySearches = userId ? await db.getSearchHistory(userId) : [];
    const allSearchSignals = new Set([
      ...historySearches.map(s => s.toLowerCase()),
      ...sessionSearches.map(s => s.toLowerCase()),
    ]);

    const dislikedArtists = new Set(profile?.disliked_artists || []);
    const preferredArtists = profile?.preferred_artists || {};
    const likedArtists = new Set(profile?.liked_artists || []);
    const preferredGenres = profile?.preferred_genres || {};

    const seedArtist = (currentTrack?.artist || '').toLowerCase();
    const seedGenre = (currentTrack?.genre || '').toLowerCase();

    // 3. Multi-Signal Scoring Engine
    const scored = candidates
      .filter(t => !excludedIds.has(t.id) && !dislikedArtists.has(t.artist) && !contentClassifier.isCompilation(t.title, t.artist, t.duration))
      .map(track => {
        let score = 0;
        const trackArtistLower = (track.artist || '').toLowerCase();
        const trackTitleLower = (track.title || '').toLowerCase();
        const trackGenreLower = (track.genre || '').toLowerCase();

        // A. Seed Track & Artist Similarity Signal (0 - 40 pts)
        if (seedArtist && (trackArtistLower.includes(seedArtist) || seedArtist.includes(trackArtistLower))) {
          score += 35;
        }
        if (seedGenre && trackGenreLower && seedGenre === trackGenreLower) {
          score += 20;
        }

        // B. User Taste Affinity Signal (0 - 30 pts)
        if (preferredArtists[track.artist]) {
          score += Math.min(25, preferredArtists[track.artist] * 3);
        }
        if (likedArtists.has(track.artist)) {
          score += 25;
        }
        if (preferredGenres[track.genre]) {
          score += Math.min(15, preferredGenres[track.genre] * 2);
        }

        // C. Search History Signal (0 - 15 pts)
        for (const search of allSearchSignals) {
          if (trackArtistLower.includes(search) || trackTitleLower.includes(search)) {
            score += 15;
            break;
          }
        }

        // D. Mood Alignment Signal (0 - 20 pts)
        if (mood && (track.genre?.toLowerCase().includes(mood.toLowerCase()) || track.title.toLowerCase().includes(mood.toLowerCase()))) {
          score += 20;
        }

        // E. Discovery & Popularity Baseline (5 - 15 pts)
        score += 10;

        return { track, score };
      });

    // Deterministic ranking
    scored.sort((a, b) => b.score - a.score);

    // 4. Artist Diversity Enforcement: Maximum 2 tracks per artist in generated chunk
    const nextQueue = [];
    const artistCounts = {};

    for (const item of scored) {
      const art = item.track.artist || 'Unknown';
      artistCounts[art] = (artistCounts[art] || 0) + 1;
      if (artistCounts[art] <= 2) {
        nextQueue.push(item.track);
      }
      if (nextQueue.length >= 20) break;
    }

    return {
      source: 'NextTrackRecommendationService',
      count: nextQueue.length,
      tracks: nextQueue,
    };
  },
};
