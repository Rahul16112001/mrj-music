import { db } from '../db/schema.js';

const MOOD_METADATA = {
  chill: { name: 'Chill & Relax', genres: ['Lofi', 'Ambient', 'Indie', 'Acoustic'], energy: 0.3, valence: 0.6 },
  relax: { name: 'Relax & Unwind', genres: ['Acoustic', 'Soul', 'Soft Pop'], energy: 0.3, valence: 0.5 },
  focus: { name: 'Focus & Study', genres: ['Lofi Beats', 'Instrumental', 'Classical', 'Ambient'], energy: 0.4, valence: 0.5 },
  study: { name: 'Deep Study', genres: ['Lofi Beats', 'Piano', 'Binaural'], energy: 0.3, valence: 0.5 },
  workout: { name: 'Workout & High Energy', genres: ['EDM', 'Hip-Hop', 'Rock', 'Pop Dance'], energy: 0.9, valence: 0.8 },
  energy: { name: 'Pure Energy', genres: ['Electronic', 'Dance', 'Club'], energy: 0.9, valence: 0.9 },
  party: { name: 'Party & Club Hits', genres: ['Pop', 'Reggaeton', 'Hip-Hop', 'Dance'], energy: 0.85, valence: 0.9 },
  romance: { name: 'Romance & Love', genres: ['Romantic', 'Bollywood', 'R&B', 'Ballad'], energy: 0.4, valence: 0.7 },
  sleep: { name: 'Deep Sleep & Ambient', genres: ['Ambient', 'Nature', 'Binaural', 'Soft Piano'], energy: 0.1, valence: 0.3 },
  commute: { name: 'Daily Commute', genres: ['Pop', 'Indie Rock', 'Podcasts', 'Hits'], energy: 0.6, valence: 0.6 },
  sad: { name: 'Melancholy & Healing', genres: ['Acoustic', 'Slow Pop', 'Indie Folk'], energy: 0.3, valence: 0.2 },
  happy: { name: 'Feel Good & Uplifting', genres: ['Pop', 'Funk', 'Disco', 'Upbeat'], energy: 0.8, valence: 0.9 },
  motivation: { name: 'Motivation & Drive', genres: ['Epic', 'Soundtrack', 'Rock', 'Rap'], energy: 0.85, valence: 0.8 },
  nostalgia: { name: 'Throwback & Classics', genres: ['80s', '90s', '2000s Hits', 'Classic Rock'], energy: 0.6, valence: 0.7 },
  instrumental: { name: 'Pure Instrumental', genres: ['Orchestral', 'Guitar', 'Piano', 'Synthwave'], energy: 0.5, valence: 0.5 },
};

export const cloudRecommendationService = {
  // 1. Process Event Batch & Update Taste Profile
  async processEvents(userId, events) {
    if (!Array.isArray(events) || events.length === 0) return;

    await db.addEvents(userId, events);
    const profile = await db.getTasteProfile(userId);

    for (const evt of events) {
      const artist = (evt.artist || '').trim();
      const genre = (evt.genre || '').trim();

      if (evt.eventType === 'PLAY_STARTED') {
        profile.total_plays = (profile.total_plays || 0) + 1;
        if (evt.trackId) {
          if (!profile.recent_seeds) profile.recent_seeds = [];
          if (!profile.recent_seeds.includes(evt.trackId)) {
            profile.recent_seeds = [evt.trackId, ...profile.recent_seeds].slice(0, 30);
          }
        }
      }

      if (evt.eventType === 'PLAY_COMPLETED' || (evt.completionPercent && evt.completionPercent >= 75)) {
        profile.total_completions = (profile.total_completions || 0) + 1;
        if (artist) {
          if (!profile.preferred_artists) profile.preferred_artists = {};
          profile.preferred_artists[artist] = (profile.preferred_artists[artist] || 0) + 2;
        }
        if (genre) {
          if (!profile.preferred_genres) profile.preferred_genres = {};
          profile.preferred_genres[genre] = (profile.preferred_genres[genre] || 0) + 2;
        }
      }

      if (evt.eventType === 'SKIP') {
        profile.total_skips = (profile.total_skips || 0) + 1;
        if (artist && profile.preferred_artists?.[artist]) {
          profile.preferred_artists[artist] = Math.max(0, profile.preferred_artists[artist] - 1);
        }
      }

      if (evt.eventType === 'LIKE') {
        if (!profile.liked_artists) profile.liked_artists = [];
        if (!profile.preferred_artists) profile.preferred_artists = {};
        if (artist && !profile.liked_artists.includes(artist)) {
          profile.liked_artists.push(artist);
          profile.preferred_artists[artist] = (profile.preferred_artists[artist] || 0) + 5;
        }
      }

      if (evt.eventType === 'UNLIKE') {
        if (profile.liked_artists) {
          profile.liked_artists = profile.liked_artists.filter(a => a !== artist);
        }
      }

      if (evt.eventType === 'DISLIKE' || evt.eventType === 'NOT_INTERESTED') {
        if (!profile.disliked_artists) profile.disliked_artists = [];
        if (artist && !profile.disliked_artists.includes(artist)) {
          profile.disliked_artists.push(artist);
        }
      }
    }

    if (profile.total_plays > 0) {
      profile.skip_rate = +(profile.total_skips / profile.total_plays).toFixed(2);
      profile.completion_rate = +(profile.total_completions / profile.total_plays).toFixed(2);
    }

    await db.saveTasteProfile(userId, profile);
    return profile;
  },

  // 2. Generate Seed-Based Radio from Large Candidate Pool
  async getSeedRadio(userId, seedTrack, candidatePool = []) {
    const profile = userId ? await db.getTasteProfile(userId) : null;
    const history = userId ? await db.getUserHistory(userId) : [];
    const recentTrackIds = new Set(history.slice(0, 20).map(h => h.track_id));
    const dislikedArtists = new Set(profile?.disliked_artists || []);

    const seedArtist = (seedTrack?.artist || '').toLowerCase();
    const seedGenre = (seedTrack?.genre || '').toLowerCase();

    const scored = candidatePool
      .filter(t => t.id !== seedTrack?.id && !dislikedArtists.has(t.artist))
      .map(track => {
        let score = 0;
        const trackArtist = (track.artist || '').toLowerCase();
        const trackGenre = (track.genre || '').toLowerCase();

        // 1. Metadata & Artist similarity
        if (trackArtist && seedArtist && (trackArtist.includes(seedArtist) || seedArtist.includes(trackArtist))) {
          score += 45;
        }
        if (trackGenre && seedGenre && trackGenre === seedGenre) {
          score += 35;
        }

        // 2. User taste affinity
        if (profile?.preferred_artists?.[track.artist]) {
          score += Math.min(30, profile.preferred_artists[track.artist] * 3);
        }
        if (profile?.liked_artists?.includes(track.artist)) {
          score += 25;
        }

        // 3. History & Skip penalties
        if (recentTrackIds.has(track.id)) score -= 35;

        // 4. Freshness jitter
        score += Math.random() * 8;

        return { track, score };
      });

    scored.sort((a, b) => b.score - a.score);

    // Apply diversity filter: Max 2 tracks per artist in radio queue
    const result = [];
    const artistCounts = {};

    for (const item of scored) {
      const art = item.track.artist;
      artistCounts[art] = (artistCounts[art] || 0) + 1;
      if (artistCounts[art] <= 2) {
        result.push(item.track);
      }
      if (result.length >= 35) break;
    }

    return result;
  },

  // 3. Generate Mood Station
  async getMoodStation(userId, moodId, candidatePool = []) {
    const moodMeta = MOOD_METADATA[moodId] || MOOD_METADATA.chill;
    const profile = userId ? await db.getTasteProfile(userId) : null;
    const dislikedArtists = new Set(profile?.disliked_artists || []);

    const filtered = candidatePool
      .filter(t => !dislikedArtists.has(t.artist))
      .map(track => {
        let score = 0;
        if (profile?.preferred_artists?.[track.artist]) score += 20;
        if (profile?.liked_artists?.includes(track.artist)) score += 25;
        score += Math.random() * 10;
        return { track, score };
      })
      .sort((a, b) => b.score - a.score)
      .map(i => i.track);

    return {
      mood: moodMeta.name,
      moodId,
      tracks: filtered.slice(0, 30),
    };
  },

  // 4. Generate Personalized Home Sections with Distinct Daily Mixes
  async getPersonalizedHome(userId, globalTrending = []) {
    const profile = userId ? await db.getTasteProfile(userId) : null;
    const liked = userId ? await db.getLikedTracks(userId) : [];
    const history = userId ? await db.getUserHistory(userId) : [];

    const quickPicks = (liked.length > 0 ? liked : history.length > 0 ? history : globalTrending).slice(0, 16);

    const sortedArtists = Object.entries(profile?.preferred_artists || {}).sort((a, b) => b[1] - a[1]);
    const topArtist1 = sortedArtists[0]?.[0] || 'Popular Artists';
    const topArtist2 = sortedArtists[1]?.[0] || 'Global Hitmakers';

    const dailyMix1 = {
      id: 'mix_daily_1',
      title: 'Daily Mix 1',
      description: topArtist1 ? `Featuring ${topArtist1} and similar favorites` : 'Personalized blend of your top tracks',
      tracks: quickPicks.slice(0, 8),
    };

    const dailyMix2 = {
      id: 'mix_daily_2',
      title: 'Daily Mix 2',
      description: topArtist2 ? `Featuring ${topArtist2} and energetic tracks` : 'Upbeat and trending discoveries',
      tracks: globalTrending.slice(0, 8),
    };

    const dailyMix3 = {
      id: 'mix_daily_3',
      title: 'Chill Discovery Mix',
      description: 'Relaxing tunes, acoustic tracks, and lofi study beats',
      tracks: globalTrending.slice(4, 10),
    };

    return {
      quickPicks,
      trending: globalTrending,
      dailyMixes: [dailyMix1, dailyMix2, dailyMix3],
      topArtistRec: topArtist1 ? { artist: topArtist1 } : null,
      moods: Object.entries(MOOD_METADATA).map(([id, data]) => ({
        id,
        name: data.name,
        color: id === 'workout' ? 'from-red-600 to-orange-900' : id === 'focus' ? 'from-emerald-600 to-teal-900' : id === 'party' ? 'from-fuchsia-600 to-pink-900' : 'from-blue-600 to-indigo-900',
        count: '40+ Songs',
      })),
    };
  },
};
