import { db } from '../db/schema.js';
import { chartService } from '../charts/chartService.js';
import { seedRadioService } from './seedRadioService.js';
import { moodEngine } from './moodEngine.js';
import { contentClassifier } from '../catalog/contentClassifier.js';

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
          profile.preferred_artists[artist] = (profile.preferred_artists[artist] || 0) + 3;
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
        if (profile.preferred_artists?.[artist]) {
          delete profile.preferred_artists[artist];
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

  // 2. Generate Seed-Based Radio (Delegated to SeedRadioService)
  async getSeedRadio(userId, seedTrack, candidatePool = null) {
    return await seedRadioService.generateRadio(userId, seedTrack, candidatePool);
  },

  // 3. Generate Mood Station (Delegated to MoodEngine)
  async getMoodStation(userId, moodId, candidatePool = null) {
    return await moodEngine.getMoodStation(userId, moodId, candidatePool);
  },

  // 4. Generate Structured Home Contract with Clear Architectural Separation
  async getPersonalizedHome(userId, userRegion = 'IN') {
    // 1. Fetch Official Charts (Strictly Non-Personalized)
    const regionalTrending = await chartService.getTrending(userRegion);
    const globalTrending = await chartService.getTrending('GLOBAL');
    const topSongs = await chartService.getTopSongs(userRegion);
    const topArtists = await chartService.getTopArtists(userRegion);

    // 2. Fetch User Profile Data
    const profile = userId ? await db.getTasteProfile(userId) : null;
    const liked = userId ? await db.getLikedTracks(userId) : [];
    const history = userId ? await db.getUserHistory(userId) : [];

    // Filter out compilations
    const cleanLiked = liked.filter(t => !contentClassifier.isCompilation(t.title, t.artist, t.duration));
    const cleanHistory = history.filter(t => !contentClassifier.isCompilation(t.title, t.artist, t.duration));

    // 3. Generate Personalized Quick Picks
    let quickPicks = [];
    if (cleanLiked.length > 0) {
      quickPicks = cleanLiked.slice(0, 16);
    } else if (cleanHistory.length > 0) {
      quickPicks = cleanHistory.slice(0, 16);
    } else {
      quickPicks = regionalTrending.tracks.slice(0, 16);
    }

    // 4. Generate Distinct Daily Mixes from Clusters
    const sortedArtists = Object.entries(profile?.preferred_artists || {}).sort((a, b) => b[1] - a[1]);
    const topArtist1 = sortedArtists[0]?.[0] || 'Popular Artists';
    const topArtist2 = sortedArtists[1]?.[0] || 'Trending Hitmakers';

    const dailyMix1 = {
      id: 'mix_daily_1',
      title: 'Daily Mix 1',
      description: topArtist1 !== 'Popular Artists' ? `Featuring ${topArtist1} and similar favorites` : 'Personalized blend of your top tracks',
      tracks: quickPicks.slice(0, 8),
    };

    const dailyMix2 = {
      id: 'mix_daily_2',
      title: 'Daily Mix 2',
      description: topArtist2 !== 'Trending Hitmakers' ? `Featuring ${topArtist2} and energetic tracks` : 'Upbeat and trending discoveries',
      tracks: regionalTrending.tracks.slice(0, 8),
    };

    const dailyMix3 = {
      id: 'mix_daily_3',
      title: 'Chill Discovery Mix',
      description: 'Relaxing tunes, acoustic tracks, and lofi study beats',
      tracks: globalTrending.tracks.slice(4, 12),
    };

    // 5. Build Final Home Data Contract
    return {
      personalized: {
        quickPicks,
        dailyMixes: [dailyMix1, dailyMix2, dailyMix3],
        listenAgain: cleanHistory.slice(0, 10),
        recommendedForYou: quickPicks.slice(0, 10),
        becauseYouLike: topArtist1 !== 'Popular Artists' ? { artist: topArtist1, tracks: quickPicks.slice(0, 6) } : null,
      },
      discovery: {
        newReleases: regionalTrending.tracks.slice(8, 18),
        topArtists: topArtists.artists,
      },
      charts: {
        trendingRegional: regionalTrending.tracks,
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
