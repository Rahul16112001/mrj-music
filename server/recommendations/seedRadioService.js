import { db } from '../db/schema.js';
import { contentClassifier } from '../catalog/contentClassifier.js';
import { musicProvider } from '../providers/musicProvider.js';

export const seedRadioService = {
  async generateRadio(userId, seedTrack, customPool = null) {
    if (!seedTrack || !seedTrack.id) return [];

    const seedId = seedTrack.id;
    const seedArtist = (seedTrack.artist || '').trim().toLowerCase();
    const seedTitle = (seedTrack.title || '').trim().toLowerCase();
    const seedGenre = (seedTrack.genre || '').trim().toLowerCase();

    // 1. Gather Candidate Pool (>= 50 candidates)
    let candidatePool = customPool;
    if (!candidatePool || candidatePool.length < 20) {
      candidatePool = await musicProvider.getCandidatePool({
        id: seedId,
        artist: seedTrack.artist || '',
        title: seedTrack.title || '',
        genre: seedTrack.genre || '',
      });
    }

    console.log(`[SeedRadio] Candidate pool size: ${candidatePool.length} for seed: "${seedTrack.title || seedId}"`);

    // 2. Fetch User Profile for Affinity & Penalties
    const profile = userId ? await db.getTasteProfile(userId) : null;
    const history = userId ? await db.getUserHistory(userId) : [];
    const recentTrackIds = new Set(history.slice(0, 25).map(h => h.track_id));
    const dislikedArtists = new Set(profile?.disliked_artists || []);

    // 3. Filter and Score Candidates
    const scored = candidatePool
      .filter(t => {
        if (!t || !t.id) return false;
        if (t.id === seedId) return false;
        if (dislikedArtists.has(t.artist)) return false;
        if (contentClassifier.isCompilation(t.title, t.artist, t.duration)) return false;
        return true;
      })
      .map(track => {
        let score = 0;
        const trackArtist = (track.artist || '').toLowerCase();
        const trackGenre = (track.genre || '').toLowerCase();
        const trackTitle = (track.title || '').toLowerCase();

        // Metadata similarity to seed
        if (seedArtist && trackArtist) {
          if (trackArtist === seedArtist || trackArtist.includes(seedArtist) || seedArtist.includes(trackArtist)) {
            score += 50;
          }
        }
        if (seedGenre && trackGenre && seedGenre === trackGenre) {
          score += 30;
        }

        // User taste profile affinity
        if (profile?.preferred_artists?.[track.artist]) {
          score += Math.min(25, profile.preferred_artists[track.artist] * 3);
        }
        if (profile?.liked_artists?.includes(track.artist)) {
          score += 25;
        }
        if (profile?.preferred_genres?.[track.genre]) {
          score += Math.min(15, profile.preferred_genres[track.genre] * 2);
        }

        // History & Skip penalties
        if (recentTrackIds.has(track.id)) {
          score -= 30;
        }

        return { track, score };
      });

    // Deterministic ranking
    scored.sort((a, b) => b.score - a.score);

    // 4. Artist Diversity Enforcement: Maximum 2 tracks per artist in queue
    const radioQueue = [];
    const artistCounts = {};

    for (const item of scored) {
      const art = item.track.artist || 'Unknown';
      artistCounts[art] = (artistCounts[art] || 0) + 1;
      if (artistCounts[art] <= 2) {
        radioQueue.push(item.track);
      }
      if (radioQueue.length >= 35) break;
    }

    return radioQueue;
  },
};
