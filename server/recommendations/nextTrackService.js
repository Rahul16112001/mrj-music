import { db } from '../db/schema.js';
import { contentClassifier, CONTENT_TYPES } from '../catalog/contentClassifier.js';
import { musicProvider } from '../providers/musicProvider.js';
import { chartService } from '../charts/chartService.js';
import { sessionManager, personalizationEngine } from './personalizationEngine.js';

// Ranks preference maps ({name: score}) into a descending list of names.
function topKeysByScore(map = {}, limit = 8) {
  return Object.entries(map)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name)
    .slice(0, limit);
}

// Local, network-free taste corpus drawn from the verified catalog and filtered by
// the user's top artists / genres / recent searches / mood. Guarantees taste-sourced
// candidates even when live retrieval is unavailable.
function buildLocalTasteCorpus({ artists = [], genres = [], searches = [], mood = null }) {
  let catalog = [];
  try {
    catalog = chartService.getVerifiedCatalog() || [];
  } catch {
    catalog = [];
  }
  const artistLc = artists.map((a) => (a || '').toLowerCase()).filter(Boolean);
  const genreLc = new Set(genres.map((g) => (g || '').toLowerCase()).filter(Boolean));
  const searchLc = searches.map((s) => (s || '').toLowerCase()).filter(Boolean);
  const moodLc = (mood || '').toLowerCase();

  return catalog.filter((t) => {
    const art = (t.artist || '').toLowerCase();
    const gen = (t.genre || '').toLowerCase();
    const title = (t.title || '').toLowerCase();
    if (artistLc.some((a) => art.includes(a) || a.includes(art))) return true;
    if (genreLc.has(gen)) return true;
    if (searchLc.some((s) => s && (art.includes(s) || title.includes(s) || gen.includes(s)))) return true;
    if (moodLc && (gen.includes(moodLc) || title.includes(moodLc))) return true;
    return false;
  });
}

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

    // Defensive normalization of optional params (may arrive undefined from callers)
    const safeSessionSearches = Array.isArray(sessionSearches) ? sessionSearches : [];

    // 1. Fetch User Long-Term Profile & Active Session State
    const profile = userId ? await db.getTasteProfile(userId) : null;
    const session = sessionId ? sessionManager.getSession(sessionId) : null;
    const activeTune = tuneConfig || session?.tuneConfig || { artistVariety: 50, discoveryLevel: 40, energy: 50 };

    const dislikedArtists = new Set(profile?.disliked_artists || []);
    const dislikedGenres = new Set((profile?.disliked_genres || []).map((g) => (g || '').toLowerCase()));
    const preferredArtists = profile?.preferred_artists || {};
    const likedArtists = new Set(profile?.liked_artists || []);
    const preferredGenres = profile?.preferred_genres || {};
    const likedGenres = new Set((profile?.liked_genres || []).map((g) => (g || '').toLowerCase()));
    const preferredMoods = profile?.preferred_moods || {};
    const recentSeeds = Array.isArray(profile?.recent_seeds) ? profile.recent_seeds : [];

    // Derived "top taste" — liked entities first, then highest-scored preferences.
    const topArtists = [...new Set([...likedArtists, ...topKeysByScore(preferredArtists, 8)])].slice(0, 8);
    const topGenres = [...new Set([...(profile?.liked_genres || []), ...topKeysByScore(preferredGenres, 6)])].slice(0, 6);
    const topMood = mood || activeTune.mood || session?.currentMood || topKeysByScore(preferredMoods, 1)[0] || null;

    const historySearches = userId ? await db.getSearchHistory(userId) : [];
    const searchSignalList = [
      ...historySearches,
      ...safeSessionSearches,
      ...(session?.searches || []).map((s) => s.query),
    ].filter(Boolean);
    const allSearchSignals = new Set(searchSignalList.map((s) => s.toLowerCase()));

    // Cold-start: profile carries essentially no learned taste and no search intent.
    const tasteSignalCount =
      Object.keys(preferredArtists).length + likedArtists.size + Object.keys(preferredGenres).length + topGenres.length;
    const isColdStart = tasteSignalCount < 2 && allSearchSignals.size === 0;

    // 2. Assemble a BLENDED candidate pool
    //    (a) seed-derived from the current song  (b) taste-derived from the user's top
    //    artists/searches  (c) a local taste corpus  (d) trending fill / cold-start.
    const poolById = new Map();
    const addCandidates = (list) => {
      for (const t of list || []) {
        const id = t?.id || t?.videoId;
        if (id && !poolById.has(id)) poolById.set(id, t);
      }
    };

    if (currentTrack) {
      try {
        addCandidates(await musicProvider.getCandidatePool(currentTrack));
      } catch {}
    }

    if (!isColdStart && (topArtists.length || allSearchSignals.size || topGenres.length)) {
      try {
        addCandidates(
          await musicProvider.getTasteCandidatePool({
            artists: topArtists,
            searches: Array.from(allSearchSignals),
            genres: topGenres,
            mood: topMood,
          })
        );
      } catch {}
      addCandidates(buildLocalTasteCorpus({ artists: topArtists, genres: topGenres, searches: Array.from(allSearchSignals), mood: topMood }));
    }

    // Trending fill (also the explicit cold-start / onboarding fallback: regional first)
    if (isColdStart || poolById.size < 40) {
      try {
        const regional = await chartService.getTrending('IN');
        addCandidates(regional.tracks || []);
      } catch {}
    }
    if (poolById.size < 60) {
      try {
        const globalCharts = await chartService.getTrending('GLOBAL');
        addCandidates(globalCharts.tracks || []);
      } catch {}
    }

    const candidates = Array.from(poolById.values());

    // Already-heard + explicit exclusions
    const excludedIds = new Set([
      ...(currentTrack ? [currentTrack.id] : []),
      ...(Array.isArray(playedTrackIds) ? playedTrackIds : []),
      ...(Array.isArray(currentQueueIds) ? currentQueueIds : []),
      ...recentSeeds,
    ]);

    const seedArtist = (currentTrack?.artist || '').toLowerCase();
    const seedGenre = (currentTrack?.genre || '').toLowerCase();

    // 3. Multi-Signal Scoring Engine (Music-First + Session Intent + Long-Term Taste + Tune Controls)
    let normalized = candidates
      .map((raw) => contentClassifier.normalizeTrack(raw))
      .filter((t) => !excludedIds.has(t.id) && !dislikedArtists.has(t.artist) && !t.isCompilation && !t.isReaction);

    // Safety net: if the already-heard filter emptied the pool, relax it (still exclude the seed/queue).
    if (normalized.length === 0) {
      const softExcluded = new Set([
        ...(currentTrack ? [currentTrack.id] : []),
        ...(Array.isArray(currentQueueIds) ? currentQueueIds : []),
      ]);
      normalized = candidates
        .map((raw) => contentClassifier.normalizeTrack(raw))
        .filter((t) => !softExcluded.has(t.id) && !dislikedArtists.has(t.artist) && !t.isCompilation && !t.isReaction);
    }

    const scored = normalized.map((track) => {
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
      // Genre affinity from explicit liked/disliked genre lists
      if (likedGenres.has(trackGenreLower)) {
        score += 18;
      }
      if (dislikedGenres.has(trackGenreLower)) {
        score -= 40;
      }

      // D. Discovery Level Tuning (0 - 100)
      const discoveryRatio = (activeTune.discoveryLevel ?? 40) / 100;
      if (!isFamiliar && discoveryRatio > 0.5) {
        score += Math.round(discoveryRatio * 30);
      } else if (isFamiliar && discoveryRatio <= 0.5) {
        score += Math.round((1 - discoveryRatio) * 20);
      }

      // E. Mood Alignment (0 - 25 pts)
      const targetMood = topMood;
      if (targetMood) {
        const mLower = targetMood.toLowerCase();
        if (trackGenreLower.includes(mLower) || trackTitleLower.includes(mLower) || (track.mood || '').toLowerCase() === mLower) {
          score += 25;
        }
      }

      // F. Music-First Audio Bonus
      if (track.contentType === CONTENT_TYPES.MUSIC && track.isAudioOnly) {
        score += 20;
      }

      // G. Popularity / freshness micro-signal (now that popularity is numeric)
      if (track.popularity > 0) {
        score += Math.min(10, Math.log10(track.popularity + 1) * 1.2);
      }

      const reason = personalizationEngine.generateAttributionReason(track, currentTrack, profile, session);

      return {
        track: { ...track, recommendationReason: reason },
        score,
      };
    });

    // Deterministic Sort
    scored.sort((a, b) => b.score - a.score);

    // 4. Dynamic Artist Variety Enforcement (per-artist diversity cap) based on Tune Settings
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
      source: isColdStart ? 'NextTrackRecommendationService:cold-start' : 'NextTrackRecommendationService',
      count: nextQueue.length,
      tracks: nextQueue,
    };
  },
};
