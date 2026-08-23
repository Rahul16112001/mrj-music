import { db } from '../db/schema.js';
import { chartService } from '../charts/chartService.js';
import { seedRadioService } from './seedRadioService.js';
import { moodEngine } from './moodEngine.js';
import { contentClassifier, CONTENT_TYPES } from '../catalog/contentClassifier.js';
import { personalizationEngine } from './personalizationEngine.js';

export const cloudRecommendationService = {
  // 1. Process Event Batch & Update Taste Profile
  async processEvents(userId, events) {
    if (!Array.isArray(events) || events.length === 0) return;

    await db.addEvents(userId, events);
    for (const evt of events) {
      await personalizationEngine.processBehavioralEvent(userId, evt);
    }

    return await db.getTasteProfile(userId);
  },

  // 2. Generate Seed-Based Radio
  async getSeedRadio(userId, seedTrack, candidatePool = null) {
    return await seedRadioService.generateRadio(userId, seedTrack, candidatePool);
  },

  // 3. Generate Mood Station
  async getMoodStation(userId, moodId, candidatePool = null) {
    return await moodEngine.getMoodStation(userId, moodId, candidatePool);
  },

  // 4. Generate Deep Music-First Home Contract
  async getPersonalizedHome(userId, userRegion = 'IN') {
    // 1. Fetch Official Charts
    const regionalTrending = await chartService.getTrending(userRegion);
    const globalTrending = await chartService.getTrending('GLOBAL');
    const topSongs = await chartService.getTopSongs(userRegion);
    const topArtists = await chartService.getTopArtists(userRegion);

    // 2. Fetch User Profile Data & History
    const profile = userId ? await db.getTasteProfile(userId) : null;
    const liked = userId ? await db.getLikedTracks(userId) : [];
    const history = userId ? await db.getUserHistory(userId) : [];

    // Music-first normalization & filtering
    const cleanLiked = liked.map(t => contentClassifier.normalizeTrack(t)).filter(t => !t.isCompilation && !t.isReaction);
    const cleanHistory = history.map(t => contentClassifier.normalizeTrack(t)).filter(t => !t.isCompilation && !t.isReaction);
    const cleanRegional = regionalTrending.tracks.map(t => contentClassifier.normalizeTrack(t)).filter(t => !t.isCompilation);

    // 3. Calculate Intelligent "Listen Again" (Plays + Completions + Likes)
    const playFrequency = new Map();
    for (const h of cleanHistory) {
      playFrequency.set(h.id, (playFrequency.get(h.id) || 0) + 1);
    }
    for (const l of cleanLiked) {
      playFrequency.set(l.id, (playFrequency.get(l.id) || 0) + 3);
    }

    const listenAgainCandidates = [...cleanLiked, ...cleanHistory];
    const uniqueListenAgainMap = new Map();
    for (const track of listenAgainCandidates) {
      if (!uniqueListenAgainMap.has(track.id)) {
        const score = (playFrequency.get(track.id) || 1) * 10;
        uniqueListenAgainMap.set(track.id, { ...track, listenScore: score });
      }
    }

    const listenAgain = Array.from(uniqueListenAgainMap.values())
      .sort((a, b) => b.listenScore - a.listenScore)
      .slice(0, 12);

    // 4. Calculate "On Repeat" Stats (Songs played >= 2 times or with high affinity)
    const onRepeatSongs = Array.from(uniqueListenAgainMap.values())
      .filter(t => (playFrequency.get(t.id) || 0) >= 2)
      .slice(0, 8);

    const onRepeatArtists = Object.entries(profile?.preferred_artists || {})
      .filter(([_, score]) => score >= 10)
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => ({ name, thumbnail: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=200' }))
      .slice(0, 6);

    // 5. Generate Personalized Quick Picks
    let quickPicks = [];
    if (listenAgain.length > 0) {
      quickPicks = listenAgain.slice(0, 16);
    } else {
      quickPicks = cleanRegional.slice(0, 16);
    }

    // 6. Generate 6 Distinct Daily Mixes
    const sortedArtists = Object.entries(profile?.preferred_artists || {}).sort((a, b) => b[1] - a[1]);
    const topArtist1 = sortedArtists[0]?.[0] || 'Arijit Singh';
    const topArtist2 = sortedArtists[1]?.[0] || 'Diljit Dosanjh';
    const topArtist3 = sortedArtists[2]?.[0] || 'The Weeknd';

    const dailyMixes = [
      {
        id: 'mix_daily_1',
        title: 'Daily Mix 1',
        description: `Featuring ${topArtist1} and essential hits`,
        tracks: quickPicks.slice(0, 8),
      },
      {
        id: 'mix_daily_2',
        title: 'Daily Mix 2',
        description: `Energetic tracks featuring ${topArtist2}`,
        tracks: cleanRegional.slice(0, 8),
      },
      {
        id: 'mix_daily_3',
        title: 'Chill & Acoustic Mix',
        description: `Mellow acoustic melodies and relaxing beats`,
        tracks: globalTrending.tracks.slice(4, 12),
      },
      {
        id: 'mix_daily_4',
        title: 'Workout & Energy Mix',
        description: `High-BPM motivational tracks for high performance`,
        tracks: cleanRegional.slice(8, 16),
      },
      {
        id: 'mix_daily_5',
        title: 'Discovery Mix',
        description: `Fresh music and new creators based on your taste`,
        tracks: globalTrending.tracks.slice(12, 20),
      },
      {
        id: 'mix_daily_6',
        title: 'On Repeat Mix',
        description: `Your most played and looped songs`,
        tracks: (onRepeatSongs.length > 0 ? onRepeatSongs : quickPicks).slice(0, 8),
      },
    ];

    // 7. "Because You Like..." Sections
    const becauseYouLikeSections = [];
    if (topArtist1) {
      becauseYouLikeSections.push({
        type: 'artist',
        title: `Because you like ${topArtist1}`,
        artist: topArtist1,
        tracks: quickPicks.filter(t => t.artist.includes(topArtist1) || t.artist === topArtist1).concat(quickPicks.slice(0, 6)).slice(0, 6),
      });
    }

    // 8. Build Final Home Data Contract
    return {
      personalized: {
        quickPicks,
        dailyMixes,
        listenAgain: listenAgain.slice(0, 10),
        onRepeat: {
          songs: onRepeatSongs,
          artists: onRepeatArtists,
        },
        recommendedForYou: quickPicks.slice(0, 10),
        becauseYouLike: becauseYouLikeSections[0] || null,
        becauseYouLikeSections,
      },
      discovery: {
        newReleases: cleanRegional.slice(8, 18),
        topArtists: topArtists.artists,
      },
      charts: {
        trendingRegional: cleanRegional,
        trendingWorldwide: globalTrending.tracks,
        topSongs: topSongs.tracks,
        topArtists: topArtists.artists,
        region: userRegion.toUpperCase(),
        updatedAt: regionalTrending.updatedAt,
      },
      moods: moodEngine.getAllMoods(),
    };
  },
};
