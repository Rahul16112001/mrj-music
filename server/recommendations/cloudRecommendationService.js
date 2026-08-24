import { db } from '../db/schema.js';
import { chartService } from '../charts/chartService.js';
import { seedRadioService } from './seedRadioService.js';
import { moodEngine } from './moodEngine.js';
import { contentClassifier } from '../catalog/contentClassifier.js';
import { personalizationEngine } from './personalizationEngine.js';

// Random array shuffler helper
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

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
    // 1. Fetch Official Charts in parallel
    const [regionalTrending, globalTrending, topSongs, topArtists] = await Promise.all([
      chartService.getTrending(userRegion),
      chartService.getTrending('GLOBAL'),
      chartService.getTopSongs(userRegion),
      chartService.getTopArtists(userRegion),
    ]);

    // 2. Fetch User Profile Data & History from Database in parallel
    const [profile, liked, history] = userId
      ? await Promise.all([
          db.getTasteProfile(userId),
          db.getLikedTracks(userId),
          db.getUserHistory(userId),
        ])
      : [null, [], []];

    // Music-first normalization & filtering
    const cleanLiked = liked.map(t => contentClassifier.normalizeTrack(t)).filter(t => !t.isCompilation && !t.isReaction);
    const cleanHistory = history.map(t => contentClassifier.normalizeTrack(t)).filter(t => !t.isCompilation && !t.isReaction);
    const cleanRegional = regionalTrending.tracks.map(t => contentClassifier.normalizeTrack(t)).filter(t => !t.isCompilation);
    const cleanGlobal = globalTrending.tracks.map(t => contentClassifier.normalizeTrack(t)).filter(t => !t.isCompilation);

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
      .slice(0, 16);

    // 4. Calculate "On Repeat" Stats (Songs played >= 2 times or with high affinity)
    const onRepeatSongs = Array.from(uniqueListenAgainMap.values())
      .filter(t => (playFrequency.get(t.id) || 0) >= 2)
      .slice(0, 12);

    const onRepeatArtists = Object.entries(profile?.preferred_artists || {})
      .filter(([_, score]) => score >= 10)
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => ({ name, thumbnail: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=200' }))
      .slice(0, 8);

    // 5. Generate Dynamic Quick Picks (blended and fresh every time)
    let quickPicks = [];
    if (listenAgain.length >= 6) {
      const topPicks = listenAgain.slice(0, 8);
      const discoveries = shuffle(cleanRegional.filter(t => !uniqueListenAgainMap.has(t.id))).slice(0, 8);
      quickPicks = shuffle([...topPicks, ...discoveries]);
    } else {
      quickPicks = shuffle(cleanRegional).slice(0, 16);
    }

    // 6. Generate 6 Distinct Dynamic Daily Mixes by Genre / Artist Affinity
    const sortedArtists = Object.entries(profile?.preferred_artists || {}).sort((a, b) => b[1] - a[1]);
    const topArtist1 = sortedArtists[0]?.[0] || 'Arijit Singh';
    const topArtist2 = sortedArtists[1]?.[0] || 'Diljit Dosanjh';
    const topArtist3 = sortedArtists[2]?.[0] || 'The Weeknd';

    const punjabiTracks = cleanRegional.filter(t => (t.genre || '').toLowerCase().includes('punjabi') || t.artist.includes('Diljit') || t.artist.includes('Karan'));
    const romanticTracks = cleanRegional.filter(t => (t.genre || '').toLowerCase().includes('romantic') || t.artist.includes('Arijit') || t.artist.includes('Jasleen'));
    const indieTracks = cleanRegional.filter(t => (t.genre || '').toLowerCase().includes('indie') || (t.genre || '').toLowerCase().includes('acoustic') || t.artist.includes('Anuv') || t.artist.includes('Local Train'));
    const partyTracks = cleanRegional.filter(t => (t.genre || '').toLowerCase().includes('energy') || (t.genre || '').toLowerCase().includes('party') || t.artist.includes('Badshah') || t.artist.includes('Anirudh'));

    const dailyMixes = [
      {
        id: 'mix_daily_1',
        title: 'Daily Mix 1',
        description: `Romantic & soulful melodies featuring ${topArtist1}`,
        tracks: (romanticTracks.length >= 4 ? romanticTracks : cleanRegional).slice(0, 10),
      },
      {
        id: 'mix_daily_2',
        title: 'Daily Mix 2',
        description: `Punjabi & Urban party hits featuring ${topArtist2}`,
        tracks: (punjabiTracks.length >= 4 ? punjabiTracks : cleanRegional.slice(5)).slice(0, 10),
      },
      {
        id: 'mix_daily_3',
        title: 'Chill & Acoustic Mix',
        description: `Mellow acoustic indie vibes & relaxing acoustic guitar`,
        tracks: (indieTracks.length >= 4 ? indieTracks : cleanGlobal.slice(4, 12)).slice(0, 10),
      },
      {
        id: 'mix_daily_4',
        title: 'Workout & Energy Mix',
        description: `High-BPM motivational anthems for maximum drive`,
        tracks: (partyTracks.length >= 4 ? partyTracks : cleanRegional.slice(8, 16)).slice(0, 10),
      },
      {
        id: 'mix_daily_5',
        title: 'Global Pop Hits',
        description: `Top worldwide hits featuring ${topArtist3} and chart leaders`,
        tracks: shuffle(cleanGlobal).slice(0, 10),
      },
      {
        id: 'mix_daily_6',
        title: 'On Repeat Mix',
        description: `Your most played and looped tracks`,
        tracks: (onRepeatSongs.length > 0 ? onRepeatSongs : quickPicks).slice(0, 10),
      },
    ];

    // 7. Time-of-Day Adaptive Mix
    const currentHour = new Date().getHours();
    let timeOfDayContext = {
      greeting: currentHour < 12 ? 'Good Morning' : currentHour < 17 ? 'Good Afternoon' : currentHour < 21 ? 'Good Evening' : 'Late Night Vibes',
      sectionTitle: currentHour < 12 ? 'Morning Energy Boost' : currentHour < 17 ? 'Afternoon Focus & Groove' : currentHour < 21 ? 'Evening Wind Down' : 'Late Night Ambient & Chill',
      tracks: currentHour < 12
        ? shuffle(partyTracks.length > 0 ? partyTracks : cleanRegional).slice(0, 8)
        : currentHour < 17
        ? shuffle(cleanRegional).slice(0, 8)
        : currentHour < 21
        ? shuffle(romanticTracks.length > 0 ? romanticTracks : cleanRegional).slice(0, 8)
        : shuffle(indieTracks.length > 0 ? indieTracks : cleanGlobal).slice(0, 8),
    };

    // 8. "Because You Listened To..." Sections
    const becauseYouLikeSections = [];
    if (topArtist1) {
      const matchTracks = cleanRegional.filter(t => t.artist.toLowerCase().includes(topArtist1.toLowerCase()));
      becauseYouLikeSections.push({
        type: 'artist',
        title: `Because you listen to ${topArtist1}`,
        artist: topArtist1,
        tracks: (matchTracks.length > 0 ? matchTracks : quickPicks.slice(0, 6)).slice(0, 8),
      });
    }

    // 9. Build Final Home Data Contract
    return {
      personalized: {
        greeting: timeOfDayContext.greeting,
        timeOfDay: timeOfDayContext,
        quickPicks,
        dailyMixes,
        listenAgain: listenAgain.slice(0, 12),
        onRepeat: {
          songs: onRepeatSongs,
          artists: onRepeatArtists,
        },
        recommendedForYou: quickPicks.slice(0, 12),
        becauseYouLike: becauseYouLikeSections[0] || null,
        becauseYouLikeSections,
      },
      discovery: {
        newReleases: shuffle(cleanRegional).slice(0, 12),
        topArtists: topArtists.artists,
      },
      charts: {
        trendingRegional: cleanRegional,
        trendingWorldwide: cleanGlobal,
        topSongs: topSongs.tracks,
        topArtists: topArtists.artists,
        region: userRegion.toUpperCase(),
        updatedAt: regionalTrending.updatedAt,
      },
      moods: moodEngine.getAllMoods(),
    };
  },
};
