import { db } from '../db/schema.js';
import { chartService } from '../charts/chartService.js';
import { seedRadioService } from './seedRadioService.js';
import { moodEngine } from './moodEngine.js';
import { contentClassifier } from '../catalog/contentClassifier.js';
import { musicProvider } from '../providers/musicProvider.js';
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

// Rank the user's REAL top artists from long-term affinity + likes + play history.
function computeTopArtists(profile, cleanLiked = [], cleanHistory = []) {
  const scoreByArtist = new Map();
  const bump = (name, amt) => {
    if (!name) return;
    scoreByArtist.set(name, (scoreByArtist.get(name) || 0) + amt);
  };
  for (const [name, s] of Object.entries(profile?.preferred_artists || {})) if (s > 0) bump(name, s);
  for (const name of profile?.liked_artists || []) bump(name, 50);
  for (const t of cleanLiked) bump(t.artist, 30);
  for (const t of cleanHistory) bump(t.artist, 10);
  return [...scoreByArtist.entries()]
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name);
}

// Rank the user's top genres from preference scores + explicit liked genres.
function computeTopGenres(profile) {
  const g = new Map();
  for (const [name, s] of Object.entries(profile?.preferred_genres || {})) if (s > 0) g.set(name, (g.get(name) || 0) + s);
  for (const name of profile?.liked_genres || []) g.set(name, (g.get(name) || 0) + 30);
  return [...g.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);
}

// Filter a track pool down to items matching the user's taste signals.
function filterByTaste(pool, { artists = [], genres = [], searches = [] }) {
  const aLc = artists.map((a) => (a || '').toLowerCase()).filter(Boolean);
  const gLc = new Set(genres.map((g) => (g || '').toLowerCase()).filter(Boolean));
  const sLc = searches.map((s) => (s || '').toLowerCase()).filter(Boolean);
  return pool.filter((t) => {
    const art = (t.artist || '').toLowerCase();
    const gen = (t.genre || '').toLowerCase();
    const ti = (t.title || '').toLowerCase();
    if (aLc.some((a) => art.includes(a) || a.includes(art))) return true;
    if (gLc.has(gen)) return true;
    if (sLc.some((s) => s && (art.includes(s) || ti.includes(s) || gen.includes(s)))) return true;
    return false;
  });
}

function dedupeById(tracks) {
  const seen = new Set();
  const out = [];
  for (const t of tracks) {
    if (t && t.id && !seen.has(t.id)) {
      seen.add(t.id);
      out.push(t);
    }
  }
  return out;
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
    // 1. Fetch Official Charts
    const regionalTrending = await chartService.getTrending(userRegion);
    const globalTrending = await chartService.getTrending('GLOBAL');
    const topSongs = await chartService.getTopSongs(userRegion);
    const topArtists = await chartService.getTopArtists(userRegion);

    // 2. Fetch User Profile Data & History from Database
    const profile = userId ? await db.getTasteProfile(userId) : null;
    const liked = userId ? await db.getLikedTracks(userId) : [];
    const history = userId ? await db.getUserHistory(userId) : [];
    const searchHistory = userId ? await db.getSearchHistory(userId) : [];

    // Music-first normalization & filtering
    const cleanLiked = liked.map(t => contentClassifier.normalizeTrack(t)).filter(t => !t.isCompilation && !t.isReaction);
    const cleanHistory = history.map(t => contentClassifier.normalizeTrack(t)).filter(t => !t.isCompilation && !t.isReaction);
    const cleanRegional = regionalTrending.tracks.map(t => contentClassifier.normalizeTrack(t)).filter(t => !t.isCompilation);
    const cleanGlobal = globalTrending.tracks.map(t => contentClassifier.normalizeTrack(t)).filter(t => !t.isCompilation);

    // 2b. Determine the user's REAL top artists / genres (drives the personalized sections).
    const realTopArtists = computeTopArtists(profile, cleanLiked, cleanHistory);
    const topGenres = computeTopGenres(profile);
    const hasTaste = realTopArtists.length > 0 || topGenres.length > 0 || searchHistory.length > 0;

    // 2c. Build a taste-affinity pool: real top artists + top genres + recent searches.
    // Best-effort live catalogs from musicProvider are blended with the local catalog so
    // this works both online and offline (falls back to regional trending when empty).
    let networkTasteTracks = [];
    if (hasTaste) {
      try {
        const fetched = await musicProvider.getTasteCandidatePool({
          artists: realTopArtists.slice(0, 4),
          genres: topGenres.slice(0, 2),
          searches: searchHistory.slice(0, 3),
        });
        networkTasteTracks = (fetched || [])
          .map(t => contentClassifier.normalizeTrack(t))
          .filter(t => !t.isCompilation && !t.isReaction);
      } catch {}
    }

    const affinityBasePool = dedupeById([...networkTasteTracks, ...cleanRegional, ...cleanGlobal]);
    const affinityTracks = hasTaste
      ? dedupeById(filterByTaste(affinityBasePool, { artists: realTopArtists, genres: topGenres, searches: searchHistory }))
      : [];

    const tracksByArtist = (name) =>
      affinityBasePool.filter(t => (t.artist || '').toLowerCase().includes((name || '').toLowerCase()));
    const tracksByGenre = (g) =>
      affinityBasePool.filter(t => (t.genre || '').toLowerCase() === (g || '').toLowerCase());

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

    // 5. Quick Picks — blend listen-again with taste-affinity discoveries (real top artists /
    //    genres / recent searches). Falls back to regional trending only when taste is empty.
    let quickPicks = [];
    if (hasTaste && affinityTracks.length >= 4) {
      const topPicks = listenAgain.slice(0, 6);
      const affinityDiscoveries = shuffle(affinityTracks.filter(t => !uniqueListenAgainMap.has(t.id))).slice(0, 10);
      const filler = shuffle(cleanRegional.filter(t => !uniqueListenAgainMap.has(t.id))).slice(0, 4);
      quickPicks = dedupeById(shuffle([...topPicks, ...affinityDiscoveries, ...filler]));
    } else if (listenAgain.length >= 6) {
      const topPicks = listenAgain.slice(0, 8);
      const discoveries = shuffle(cleanRegional.filter(t => !uniqueListenAgainMap.has(t.id))).slice(0, 8);
      quickPicks = shuffle([...topPicks, ...discoveries]);
    } else {
      quickPicks = shuffle(cleanRegional).slice(0, 16);
    }

    // 6. Build 6 Daily Mixes sourced from the user's REAL top artists & genres.
    //    When the profile is empty we fall back to honestly-labeled trending mixes.
    const topArtist1 = realTopArtists[0] || null;
    const topArtist2 = realTopArtists[1] || null;
    const topArtist3 = realTopArtists[2] || null;
    const topGenre1 = topGenres[0] || null;
    const topGenre2 = topGenres[1] || null;
    const lastSearch = searchHistory[0] || null;

    const pickMix = (primary, fallback, n = 10) => {
      const p = dedupeById(primary).slice(0, n);
      if (p.length >= 4) return p;
      return dedupeById([...p, ...fallback]).slice(0, n);
    };

    let dailyMixes;
    if (hasTaste) {
      const mixSpecs = [];
      const pushedIds = new Set();
      const addMix = (m) => {
        if (m && m.id && !pushedIds.has(m.id) && mixSpecs.length < 6) {
          pushedIds.add(m.id);
          mixSpecs.push(m);
        }
      };
      // Personalized mixes first (sourced from the user's REAL top artists / genres / searches).
      if (topArtist1) addMix({ id: 'mix_artist_1', title: `More of ${topArtist1}`, description: `Handpicked tracks because you love ${topArtist1}`, tracks: pickMix([...tracksByArtist(topArtist1), ...(topGenre1 ? tracksByGenre(topGenre1) : [])], affinityTracks) });
      if (topGenre1) addMix({ id: 'mix_genre_1', title: `Your ${topGenre1} Mix`, description: `The ${topGenre1} sound you keep coming back to`, tracks: pickMix(tracksByGenre(topGenre1), affinityTracks) });
      if (topArtist2) addMix({ id: 'mix_artist_2', title: `More of ${topArtist2}`, description: `Deep cuts and hits from ${topArtist2}`, tracks: pickMix([...tracksByArtist(topArtist2), ...(topGenre2 ? tracksByGenre(topGenre2) : [])], affinityTracks) });
      if (lastSearch) addMix({ id: 'mix_search', title: `Inspired by "${lastSearch}"`, description: `Based on your recent search for ${lastSearch}`, tracks: pickMix(filterByTaste(affinityBasePool, { artists: [], genres: [], searches: [lastSearch] }), affinityTracks) });
      if (topArtist3) addMix({ id: 'mix_artist_3', title: `More of ${topArtist3}`, description: `Because ${topArtist3} is on repeat for you`, tracks: pickMix(tracksByArtist(topArtist3), affinityTracks) });
      if (topGenre2) addMix({ id: 'mix_genre_2', title: `${topGenre2} Essentials`, description: `More ${topGenre2} picked for your taste`, tracks: pickMix(tracksByGenre(topGenre2), affinityTracks) });
      addMix({ id: 'mix_fresh', title: 'Fresh Finds For You', description: 'New tracks aligned with your taste', tracks: pickMix(shuffle(affinityTracks.filter(t => !uniqueListenAgainMap.has(t.id))), cleanRegional) });
      addMix({ id: 'mix_on_repeat', title: 'On Repeat Mix', description: 'Your most played and looped tracks', tracks: (onRepeatSongs.length > 0 ? onRepeatSongs : quickPicks).slice(0, 10) });
      // Pad to a full 6-mix carousel with honest discovery mixes when taste signals are sparse.
      for (const m of [
        { id: 'mix_pad_region', title: `Trending in ${userRegion.toUpperCase()}`, description: 'Popular in your region right now', tracks: shuffle(cleanRegional).slice(0, 10) },
        { id: 'mix_pad_global', title: 'Global Pop Hits', description: 'Top worldwide chart leaders', tracks: shuffle(cleanGlobal).slice(0, 10) },
        { id: 'mix_pad_fresh', title: 'Fresh Finds', description: 'Discover something new today', tracks: shuffle(cleanRegional).slice(4, 14) },
        { id: 'mix_pad_charts', title: 'Chart Toppers', description: 'Certified hits across genres', tracks: shuffle(cleanGlobal).slice(2, 12) },
      ]) {
        if (mixSpecs.length >= 6) break;
        addMix(m);
      }
      dailyMixes = mixSpecs.slice(0, 6);
    } else {
      // Cold-start: honest, generic trending mixes (no fake "top artist" labels).
      dailyMixes = [
        { id: 'mix_daily_1', title: `Trending in ${userRegion.toUpperCase()}`, description: 'The biggest tracks in your region right now', tracks: shuffle(cleanRegional).slice(0, 10) },
        { id: 'mix_daily_2', title: 'Global Pop Hits', description: 'Top worldwide chart leaders', tracks: shuffle(cleanGlobal).slice(0, 10) },
        { id: 'mix_daily_3', title: 'Fresh Finds', description: 'Discover something new today', tracks: shuffle(cleanRegional).slice(6, 16) },
        { id: 'mix_daily_4', title: 'Chart Toppers', description: 'Certified hits across genres', tracks: shuffle(cleanGlobal).slice(4, 14) },
        { id: 'mix_daily_5', title: 'New Releases', description: 'Hot off the press', tracks: shuffle(cleanRegional).slice(2, 12) },
        { id: 'mix_daily_6', title: 'Popular Right Now', description: 'What everyone is listening to', tracks: shuffle([...cleanRegional, ...cleanGlobal]).slice(0, 10) },
      ];
    }

    // 7. Time-of-Day Adaptive Mix — biased toward the user's top-genre tracks when known.
    const currentHour = new Date().getHours();
    const tasteBiasedPool = hasTaste && affinityTracks.length >= 4 ? affinityTracks : cleanRegional;
    const timeOfDayContext = {
      greeting: currentHour < 12 ? 'Good Morning' : currentHour < 17 ? 'Good Afternoon' : currentHour < 21 ? 'Good Evening' : 'Late Night Vibes',
      sectionTitle: currentHour < 12 ? 'Morning Energy Boost' : currentHour < 17 ? 'Afternoon Focus & Groove' : currentHour < 21 ? 'Evening Wind Down' : 'Late Night Ambient & Chill',
      tracks: shuffle(tasteBiasedPool).slice(0, 8),
    };

    // 8. "Because You Listened To..." Sections (real top artist)
    const becauseYouLikeSections = [];
    if (topArtist1) {
      const matchTracks = tracksByArtist(topArtist1);
      becauseYouLikeSections.push({
        type: 'artist',
        title: `Because you listen to ${topArtist1}`,
        artist: topArtist1,
        tracks: (matchTracks.length > 0 ? matchTracks : quickPicks.slice(0, 6)).slice(0, 8),
      });
    }

    // recommendedForYou: taste affinity first, then quick picks
    const recommendedForYou = dedupeById([
      ...(hasTaste ? affinityTracks.filter(t => !uniqueListenAgainMap.has(t.id)) : []),
      ...quickPicks,
    ]).slice(0, 12);

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
        recommendedForYou,
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
