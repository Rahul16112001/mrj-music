import { db } from '../db/schema.js';
import { contentClassifier } from '../catalog/contentClassifier.js';
import { musicProvider } from '../providers/musicProvider.js';
import { chartService } from '../charts/chartService.js';

export const seedRadioService = {
  // 1. Generate Deterministic Seed Radio with Multi-Signal Scoring & Diversity
  async generateRadio(userId, seedTrack, customPool = null) {
    const seedArtist = (seedTrack.artist || '').toLowerCase();
    const seedGenre = (seedTrack.genre || '').toLowerCase();
    const seedId = seedTrack.id;

    // 1. Gather Candidate Pool (Logged during development)
    let candidates = customPool;
    if (!candidates || candidates.length < 20) {
      candidates = await musicProvider.getCandidatePool(seedTrack);
    }

    if (process.env.NODE_ENV !== 'production') {
      console.log(`[SeedRadio] Candidate pool size: ${candidates.length} for seed: "${seedTrack.title || seedTrack.id}"`);
    }

    // 2. Fetch User Taste Profile & Listening History
    const profile = userId ? await db.getTasteProfile(userId) : null;
    const history = userId ? await db.getUserHistory(userId) : [];
    const dislikedArtists = new Set(profile?.disliked_artists || []);
    const recentTrackIds = new Set(history.slice(0, 15).map(h => h.id));

    // 3. Multi-Signal Scoring
    const scored = candidates
      .filter(t => t.id !== seedId && !dislikedArtists.has(t.artist) && !contentClassifier.isCompilation(t.title, t.artist, t.duration))
      .map(track => {
        let score = 0;
        const trackArtist = (track.artist || '').toLowerCase();
        const trackGenre = (track.genre || '').toLowerCase();

        // Seed Similarity Signal (0 - 40 pts)
        if (trackArtist && (trackArtist.includes(seedArtist) || seedArtist.includes(trackArtist))) {
          score += 35;
        }
        if (trackGenre && seedGenre && trackGenre === seedGenre) {
          score += 20;
        }

        // User Taste Affinity Signal (0 - 30 pts)
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

    // 5. Backfill if needed to ensure at least 15 tracks
    if (radioQueue.length < 15) {
      const charts = await chartService.getTrending('GLOBAL');
      for (const track of charts.tracks) {
        if (track.id !== seedId && !radioQueue.some(r => r.id === track.id)) {
          const art = track.artist || 'Unknown';
          if ((artistCounts[art] || 0) < 2) {
            artistCounts[art] = (artistCounts[art] || 0) + 1;
            radioQueue.push(track);
          }
        }
        if (radioQueue.length >= 25) break;
      }
    }

    return radioQueue;
  },
};
