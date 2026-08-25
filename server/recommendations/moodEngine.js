import { db } from '../db/schema.js';
import { contentClassifier } from '../catalog/contentClassifier.js';
import { musicProvider } from '../providers/musicProvider.js';

export const MOOD_DEFINITIONS = {
  workout: {
    name: 'Workout & High Energy',
    queries: ['imagine dragons high energy songs', 'anirudh motivational songs', 'gym workout phonk music', 'eminem motivation hits'],
    color: 'from-red-600 to-orange-900',
    count: '50+ Songs',
    fallbackTracks: [
      { id: 'IhP3J0j9JmY', title: 'Believer', artist: 'Imagine Dragons', genre: 'Workout', duration: 203, thumbnail: 'https://i.ytimg.com/vi/IhP3J0j9JmY/hqdefault.jpg' },
      { id: 'fHI8X4OXluQ', title: 'Blinding Lights', artist: 'The Weeknd', genre: 'Workout', duration: 204, thumbnail: 'https://i.ytimg.com/vi/fHI8X4OXluQ/hqdefault.jpg' },
      { id: 'Rif-RTvmmss', title: 'Starboy', artist: 'The Weeknd ft. Daft Punk', genre: 'Workout', duration: 231, thumbnail: 'https://i.ytimg.com/vi/Rif-RTvmmss/hqdefault.jpg' },
      { id: 'IqwIOlhfCak', title: 'Badass', artist: 'Anirudh Ravichander', genre: 'Workout', duration: 236, thumbnail: 'https://i.ytimg.com/vi/IqwIOlhfCak/hqdefault.jpg' },
      { id: 'DsjRNPrvq6U', title: 'Hukum - Thalaivar Alappara', artist: 'Anirudh Ravichander', genre: 'Workout', duration: 208, thumbnail: 'https://i.ytimg.com/vi/DsjRNPrvq6U/hqdefault.jpg' },
    ],
  },
  chill: {
    name: 'Chill & Relax',
    queries: ['arijit singh chill songs', 'prateek kuhad songs', 'jasleen royal acoustic', 'the weeknd acoustic hits'],
    color: 'from-blue-600 to-indigo-900',
    count: '45+ Songs',
    fallbackTracks: [
      { id: 'RLzC55ai0eo', title: 'Heeriye', artist: 'Jasleen Royal & Arijit Singh', genre: 'Chill', duration: 199, thumbnail: 'https://i.ytimg.com/vi/RLzC55ai0eo/hqdefault.jpg' },
      { id: '73vZDNKa_Wg', title: 'Maan Meri Jaan', artist: 'King', genre: 'Chill', duration: 196, thumbnail: 'https://i.ytimg.com/vi/73vZDNKa_Wg/hqdefault.jpg' },
      { id: 'V1Z586zoeeE', title: 'As It Was', artist: 'Harry Styles', genre: 'Chill', duration: 166, thumbnail: 'https://i.ytimg.com/vi/V1Z586zoeeE/hqdefault.jpg' },
      { id: 'u6lihZAcy4s', title: 'Save Your Tears', artist: 'The Weeknd', genre: 'Chill', duration: 217, thumbnail: 'https://i.ytimg.com/vi/u6lihZAcy4s/hqdefault.jpg' },
    ],
  },
  romance: {
    name: 'Romance & Love',
    queries: ['arijit singh romantic songs', 'shreya ghoshal love songs', 'darshan raval romantic', 'ed sheeran romantic songs'],
    color: 'from-rose-600 to-pink-900',
    count: '60+ Songs',
    fallbackTracks: [
      { id: '6RdS6wLu7RY', title: 'Kesariya', artist: 'Arijit Singh & Pritam', genre: 'Romance', duration: 271, thumbnail: 'https://i.ytimg.com/vi/6RdS6wLu7RY/hqdefault.jpg' },
      { id: 'u2NAuswnTKs', title: 'Apna Bana Le', artist: 'Arijit Singh & Sachin-Jigar', genre: 'Romance', duration: 273, thumbnail: 'https://i.ytimg.com/vi/u2NAuswnTKs/hqdefault.jpg' },
      { id: 'VAdGW7QDJiU', title: 'Chaleya', artist: 'Arijit Singh & Anirudh Ravichander', genre: 'Romance', duration: 188, thumbnail: 'https://i.ytimg.com/vi/VAdGW7QDJiU/hqdefault.jpg' },
      { id: 'iKzRIweSBLA', title: 'Perfect', artist: 'Ed Sheeran', genre: 'Romance', duration: 264, thumbnail: 'https://i.ytimg.com/vi/iKzRIweSBLA/hqdefault.jpg' },
    ],
  },
  focus: {
    name: 'Focus & Study',
    queries: ['lofi hip hop study beats', 'ambient focus study piano', 'peaceful instrumental guitar songs'],
    color: 'from-emerald-600 to-teal-900',
    count: '40+ Songs',
    fallbackTracks: [
      { id: 'fJ9rUzIMcZQ', title: 'Bohemian Rhapsody', artist: 'Queen', genre: 'Focus', duration: 359, thumbnail: 'https://i.ytimg.com/vi/fJ9rUzIMcZQ/hqdefault.jpg' },
      { id: 'T1tl66trXTQ', title: 'Hello', artist: 'Adele', genre: 'Focus', duration: 296, thumbnail: 'https://i.ytimg.com/vi/T1tl66trXTQ/hqdefault.jpg' },
    ],
  },
  energy: {
    name: 'Pure Energy',
    queries: ['anirudh ravichander high energy songs', 'karan aujla fast beats', 'skrillex david guetta edm'],
    color: 'from-amber-600 to-yellow-800',
    count: '50+ Songs'
  },
  party: {
    name: 'Party & Club Hits',
    queries: ['badshah party songs', 'honey singh party hits', 'karan aujla party tracks', 'diljit dosanjh bhangra songs'],
    color: 'from-fuchsia-600 to-pink-900',
    count: '65+ Songs'
  },
  sleep: {
    name: 'Deep Sleep & Ambient',
    queries: ['peaceful sleep ambient music', 'calm piano sleep sounds', 'late night lofi beats'],
    color: 'from-slate-700 to-indigo-950',
    count: '35+ Songs'
  },
  commute: {
    name: 'Daily Commute',
    queries: ['road trip travel songs hindi', 'indie travel vibes hindi', 'feel good driving songs'],
    color: 'from-cyan-600 to-blue-900',
    count: '50+ Songs'
  },
  sad: {
    name: 'Melancholy & Healing',
    queries: ['arijit singh sad songs', 'b praak emotional sad songs', 'sad acoustic hindi songs'],
    color: 'from-gray-700 to-slate-900',
    count: '40+ Songs'
  },
  happy: {
    name: 'Feel Good & Uplifting',
    queries: ['upbeat feel good hindi songs', 'happy bollywood dance songs', 'pharrell williams happy vibes'],
    color: 'from-yellow-500 to-orange-700',
    count: '55+ Songs'
  },
  motivation: {
    name: 'Motivation & Drive',
    queries: ['powerful motivational songs hindi', 'neffex motivational songs', 'rock motivation tracks'],
    color: 'from-violet-600 to-purple-900',
    count: '45+ Songs'
  },
  nostalgia: {
    name: 'Throwback & Classics',
    queries: ['90s bollywood superhit songs', 'udit narayan kumar sanu romantic songs', '2000s bollywood hit songs'],
    color: 'from-teal-600 to-emerald-900',
    count: '60+ Songs'
  },
  instrumental: {
    name: 'Pure Instrumental',
    queries: ['beautiful instrumental guitar piano music', 'indian classical flute instrumental', 'cinematic violin instrumental'],
    color: 'from-zinc-700 to-neutral-900',
    count: '40+ Songs'
  },
  relax: {
    name: 'Relax & Unwind',
    queries: ['relaxing soft acoustic songs', 'anuv jain soothing songs', 'cozy acoustic guitar songs'],
    color: 'from-sky-600 to-blue-950',
    count: '45+ Songs'
  },
  study: {
    name: 'Deep Study',
    queries: ['deep study lofi beats music', 'binaural study beats focus', 'lofi study relaxing sounds'],
    color: 'from-green-700 to-emerald-950',
    count: '40+ Songs'
  },
};

const moodCache = new Map();

export const moodEngine = {
  async getMoodStation(userId, moodId, customPool = null) {
    const key = (moodId || 'chill').toLowerCase();
    const moodMeta = MOOD_DEFINITIONS[key] || MOOD_DEFINITIONS.chill;

    // 1. Gather Candidate Pool for Mood (from cache, live provider, or fallback)
    let candidates = customPool;
    const cacheKey = `mood_${key}`;
    const cached = moodCache.get(cacheKey);

    if (!candidates || candidates.length < 10) {
      if (cached && Date.now() - cached.timestamp < 10 * 60 * 1000 && cached.tracks.length >= 10) {
        candidates = cached.tracks;
      } else {
        try {
          const queries = moodMeta.queries || [moodMeta.query, `${moodMeta.name} songs`];
          const searchPromises = queries.map(q =>
            musicProvider.searchDiscovery(q, 30).catch(() => [])
          );
          const results = await Promise.allSettled(searchPromises);
          const pool = [];
          const seen = new Set();

          for (const res of results) {
            if (res.status === 'fulfilled' && Array.isArray(res.value)) {
              for (const t of res.value) {
                if (t && t.id && !seen.has(t.id)) {
                  seen.add(t.id);
                  pool.push(t);
                }
              }
            }
          }

          if (pool.length >= 8) {
            candidates = pool;
            moodCache.set(cacheKey, { timestamp: Date.now(), tracks: pool });
          }
        } catch (e) {
          console.warn(`Mood ${key} search error:`, e.message);
        }
      }
    }

    if (!candidates || candidates.length === 0) {
      candidates = moodMeta.fallbackTracks || MOOD_DEFINITIONS.chill.fallbackTracks;
    }

    // 2. Fetch User Taste Profile & Re-Rank
    const profile = userId ? await db.getTasteProfile(userId) : null;
    const dislikedArtists = new Set(profile?.disliked_artists || []);

    // 3. Filter & Score with User Taste Affinity
    let filtered = candidates
      .filter(t => !dislikedArtists.has(t.artist) && !contentClassifier.isCompilation(t.title, t.artist, t.duration))
      .map(track => {
        let score = 0;
        if (profile?.preferred_artists?.[track.artist]) {
          score += Math.min(30, profile.preferred_artists[track.artist] * 5);
        }
        if (profile?.liked_artists?.includes(track.artist)) {
          score += 35;
        }
        return { track, score };
      })
      .sort((a, b) => b.score - a.score)
      .map(i => i.track);

    if (filtered.length === 0 && moodMeta.fallbackTracks) {
      filtered = moodMeta.fallbackTracks;
    }

    return {
      moodId: key,
      mood: moodMeta.name,
      tracks: filtered.slice(0, 45),
    };
  },

  getAllMoods() {
    return Object.entries(MOOD_DEFINITIONS).map(([id, data]) => ({
      id,
      name: data.name,
      color: data.color,
      count: data.count,
    }));
  },
};
