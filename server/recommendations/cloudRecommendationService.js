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
  processEvents(userId, events) {
    if (!Array.isArray(events) || events.length === 0) return;

    db.addEvents(userId, events);
    const profile = db.getTasteProfile(userId);

    for (const evt of events) {
      const artist = (evt.artist || '').trim();
      const genre = (evt.genre || '').trim();

      if (evt.eventType === 'PLAY_STARTED') {
        profile.totalPlays++;
        if (evt.trackId && !profile.recentSeeds.includes(evt.trackId)) {
          profile.recentSeeds = [evt.trackId, ...profile.recentSeeds].slice(0, 30);
        }
      }

      if (evt.eventType === 'PLAY_COMPLETED' || (evt.completionPercent && evt.completionPercent >= 75)) {
        profile.totalCompletions++;
        if (artist) {
          profile.preferredArtists[artist] = (profile.preferredArtists[artist] || 0) + 2;
        }
        if (genre) {
          profile.preferredGenres[genre] = (profile.preferredGenres[genre] || 0) + 2;
        }
      }

      if (evt.eventType === 'SKIP') {
        profile.totalSkips++;
        if (artist && profile.preferredArtists[artist]) {
          profile.preferredArtists[artist] = Math.max(0, profile.preferredArtists[artist] - 1);
        }
      }

      if (evt.eventType === 'LIKE') {
        if (artist && !profile.likedArtists.includes(artist)) {
          profile.likedArtists.push(artist);
          profile.preferredArtists[artist] = (profile.preferredArtists[artist] || 0) + 5;
        }
      }

      if (evt.eventType === 'UNLIKE') {
        profile.likedArtists = profile.likedArtists.filter(a => a !== artist);
      }

      if (evt.eventType === 'DISLIKE' || evt.eventType === 'NOT_INTERESTED') {
        if (artist && !profile.dislikedArtists.includes(artist)) {
          profile.dislikedArtists.push(artist);
        }
      }
    }

    if (profile.totalPlays > 0) {
      profile.skipRate = +(profile.totalSkips / profile.totalPlays).toFixed(2);
      profile.completionRate = +(profile.totalCompletions / profile.totalPlays).toFixed(2);
    }

    db.saveTasteProfile(userId, profile);
    return profile;
  },

  // 2. Generate Seed-Based Radio from Large Candidate Pool
  getSeedRadio(userId, seedTrack, candidatePool = []) {
    const profile = userId ? db.getTasteProfile(userId) : null;
    const history = userId ? db.getUserHistory(userId) : [];
    const recentTrackIds = new Set(history.slice(0, 20).map(h => h.trackId));
    const dislikedArtists = new Set(profile?.dislikedArtists || []);

    const seedArtist = (seedTrack?.artist || '').toLowerCase();
    const seedTitle = (seedTrack?.title || '').toLowerCase();
    const seedGenre = (seedTrack?.genre || '').toLowerCase();

    const scored = candidatePool
      .filter(t => t.id !== seedTrack?.id && !dislikedArtists.has(t.artist))
      .map(track => {
        let score = 0;
        const trackArtist = (track.artist || '').toLowerCase();
        const trackTitle = (track.title || '').toLowerCase();
        const trackGenre = (track.genre || '').toLowerCase();

        // 1. Metadata & Artist similarity
        if (trackArtist === seedArtist) score += 45;
        if (trackGenre && seedGenre && trackGenre === seedGenre) score += 35;

        // 2. User taste affinity
        if (profile?.preferredArtists?.[track.artist]) {
          score += Math.min(30, profile.preferredArtists[track.artist] * 3);
        }
        if (profile?.likedArtists?.includes(track.artist)) {
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
  getMoodStation(userId, moodId, candidatePool = []) {
    const moodMeta = MOOD_METADATA[moodId] || MOOD_METADATA.chill;
    const profile = userId ? db.getTasteProfile(userId) : null;
    const dislikedArtists = new Set(profile?.dislikedArtists || []);

    const filtered = candidatePool
      .filter(t => !dislikedArtists.has(t.artist))
      .map(track => {
        let score = 0;
        if (profile?.preferredArtists?.[track.artist]) score += 20;
        if (profile?.likedArtists?.includes(track.artist)) score += 25;
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
  getPersonalizedHome(userId, globalTrending = []) {
    const profile = userId ? db.getTasteProfile(userId) : null;
    const liked = userId ? db.getLikedTracks(userId) : [];
    const history = userId ? db.getUserHistory(userId) : [];

    // Quick Picks: Top frequent favorites & history
    const quickPicks = (liked.length > 0 ? liked : history.length > 0 ? history : globalTrending).slice(0, 16);

    // Top artist & genre affinities
    const sortedArtists = Object.entries(profile?.preferredArtists || {}).sort((a, b) => b[1] - a[1]);
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
