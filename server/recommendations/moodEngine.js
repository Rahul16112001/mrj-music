import { db } from '../db/schema.js';
import { contentClassifier } from '../catalog/contentClassifier.js';
import { musicProvider } from '../providers/musicProvider.js';

export const MOOD_DEFINITIONS = {
  workout: {
    name: 'Workout & High Energy',
    query: 'gym workout high energy edm hip hop',
    color: 'from-red-600 to-orange-900',
    count: '50+ Songs',
    fallbackTracks: [
      { id: '7wtfhZwyrcc', title: 'Believer', artist: 'Imagine Dragons', genre: 'Workout', duration: 204 },
      { id: '4NRXx6U8ABQ', title: 'Blinding Lights', artist: 'The Weeknd', genre: 'Workout', duration: 200 },
      { id: 'TUVcZfQe-Kw', title: 'Starboy', artist: 'The Weeknd ft. Daft Punk', genre: 'Workout', duration: 230 },
      { id: 'Xz7e_eW9B0U', title: 'Badass', artist: 'Anirudh Ravichander', genre: 'Workout', duration: 231 },
      { id: 'T94PHkuydcw', title: 'Hukum - Thalaivar Alappara', artist: 'Anirudh Ravichander', genre: 'Workout', duration: 238 },
    ],
  },
  chill: {
    name: 'Chill & Relax',
    query: 'chill lofi acoustic relaxing songs',
    color: 'from-blue-600 to-indigo-900',
    count: '45+ Songs',
    fallbackTracks: [
      { id: 'hHuG7FIKgtc', title: 'Heeriye', artist: 'Jasleen Royal & Arijit Singh', genre: 'Chill', duration: 194 },
      { id: 'JFcgOboQZ08', title: 'Maan Meri Jaan', artist: 'King', genre: 'Chill', duration: 194 },
      { id: 'gNi_6U5Pm_o', title: 'As It Was', artist: 'Harry Styles', genre: 'Chill', duration: 167 },
      { id: 'L7_jYl8A060', title: 'Save Your Tears', artist: 'The Weeknd', genre: 'Chill', duration: 215 },
    ],
  },
  romance: {
    name: 'Romance & Love',
    query: 'romantic love songs ballad acoustic',
    color: 'from-rose-600 to-pink-900',
    count: '60+ Songs',
    fallbackTracks: [
      { id: '4tyep_qZ-2w', title: 'Kesariya', artist: 'Arijit Singh & Pritam', genre: 'Romance', duration: 268 },
      { id: 'K4DyBUG242c', title: 'Apna Bana Le', artist: 'Arijit Singh & Sachin-Jigar', genre: 'Romance', duration: 261 },
      { id: '6vYn7dJb5u0', title: 'Chaleya', artist: 'Arijit Singh & Anirudh Ravichander', genre: 'Romance', duration: 200 },
      { id: '2Vv-BfVoq4g', title: 'Perfect', artist: 'Ed Sheeran', genre: 'Romance', duration: 263 },
    ],
  },
  focus: {
    name: 'Focus & Study',
    query: 'focus study lofi instrumental piano',
    color: 'from-emerald-600 to-teal-900',
    count: '40+ Songs',
    fallbackTracks: [
      { id: 'fJ9rUzIMcZQ', title: 'Bohemian Rhapsody', artist: 'Queen', genre: 'Focus', duration: 359 },
      { id: 'YQHsXMglC9A', title: 'Hello', artist: 'Adele', genre: 'Focus', duration: 295 },
    ],
  },
  energy: { name: 'Pure Energy', query: 'energy dance edm electronic club hits', color: 'from-amber-600 to-yellow-800', count: '50+ Songs' },
  party: { name: 'Party & Club Hits', query: 'party dance club hits reggaeton pop', color: 'from-fuchsia-600 to-pink-900', count: '65+ Songs' },
  sleep: { name: 'Deep Sleep & Ambient', query: 'sleep ambient peaceful calm piano', color: 'from-slate-700 to-indigo-950', count: '35+ Songs' },
  commute: { name: 'Daily Commute', query: 'daily commute road trip indie pop hits', color: 'from-cyan-600 to-blue-900', count: '50+ Songs' },
  sad: { name: 'Melancholy & Healing', query: 'sad emotional acoustic slow songs', color: 'from-gray-700 to-slate-900', count: '40+ Songs' },
  happy: { name: 'Feel Good & Uplifting', query: 'happy feel good upbeat pop funk hits', color: 'from-yellow-500 to-orange-700', count: '55+ Songs' },
  motivation: { name: 'Motivation & Drive', query: 'motivation epic rock hip hop drive', color: 'from-violet-600 to-purple-900', count: '45+ Songs' },
  nostalgia: { name: 'Throwback & Classics', query: 'throwback classics 90s 2000s retro hits', color: 'from-teal-600 to-emerald-900', count: '60+ Songs' },
  instrumental: { name: 'Pure Instrumental', query: 'instrumental guitar violin piano soundtrack', color: 'from-zinc-700 to-neutral-900', count: '40+ Songs' },
  relax: { name: 'Relax & Unwind', query: 'relaxing acoustic soul soft pop unwind', color: 'from-sky-600 to-blue-950', count: '45+ Songs' },
  study: { name: 'Deep Study', query: 'deep study lofi beats binaural focus', color: 'from-green-700 to-emerald-950', count: '40+ Songs' },
};

export const moodEngine = {
  async getMoodStation(userId, moodId, customPool = null) {
    const key = (moodId || 'chill').toLowerCase();
    const moodMeta = MOOD_DEFINITIONS[key] || MOOD_DEFINITIONS.chill;

    // 1. Gather Candidate Pool for Mood
    let candidates = customPool;
    if (!candidates || candidates.length < 5) {
      try {
        const searchRes = await musicProvider.search(moodMeta.query, 'songs', 30);
        candidates = searchRes?.results || [];
      } catch {}
    }

    if (!candidates || candidates.length === 0) {
      candidates = moodMeta.fallbackTracks || MOOD_DEFINITIONS.chill.fallbackTracks;
    }

    // 2. Fetch User Taste Profile
    const profile = userId ? await db.getTasteProfile(userId) : null;
    const dislikedArtists = new Set(profile?.disliked_artists || []);

    // 3. Filter & Score with User Taste Affinity
    let filtered = candidates
      .filter(t => !dislikedArtists.has(t.artist) && !contentClassifier.isCompilation(t.title, t.artist, t.duration))
      .map(track => {
        let score = 0;
        if (profile?.preferred_artists?.[track.artist]) {
          score += Math.min(20, profile.preferred_artists[track.artist] * 3);
        }
        if (profile?.liked_artists?.includes(track.artist)) {
          score += 25;
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
      tracks: filtered.slice(0, 30),
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
