import axios from 'axios';
import { musicProvider } from '../providers/musicProvider.js';
import { db } from '../db/schema.js';

// 100% Verified Multi-Genre Stream Catalog
const VERIFIED_CATALOG = [
  // 1. Bollywood & Hindi Melodies
  { id: '6RdS6wLu7RY', title: 'Kesariya', artist: 'Arijit Singh & Pritam', album: 'Brahmastra', genre: 'Bollywood', duration: 268 },
  { id: 'VAdGW7QDJiU', title: 'Chaleya', artist: 'Arijit Singh & Anirudh', album: 'Jawan', genre: 'Bollywood', duration: 200 },
  { id: 'u2NAuswnTKs', title: 'Apna Bana Le', artist: 'Arijit Singh & Sachin-Jigar', album: 'Bhediya', genre: 'Bollywood', duration: 261 },
  { id: 'RLzC55ai0eo', title: 'Heeriye', artist: 'Jasleen Royal & Arijit Singh', album: 'Heeriye', genre: 'Bollywood', duration: 194 },
  { id: 'QKMTreKTpug', title: 'Pehle Bhi Main', artist: 'Vishal Mishra', album: 'Animal', genre: 'Bollywood', duration: 250 },
  { id: '_Wv2iV8b0hA', title: 'Satranga', artist: 'Arijit Singh', album: 'Animal', genre: 'Bollywood', duration: 271 },
  { id: 'tOo5Rn8dRaA', title: 'Lutt Putt Gaya', artist: 'Arijit Singh & Pritam', album: 'Dunki', genre: 'Bollywood', duration: 224 },
  { id: '1tsCjcq0G-U', title: 'O Maahi', artist: 'Arijit Singh', album: 'Dunki', genre: 'Bollywood', duration: 233 },
  { id: 'QXJyMpxd210', title: 'Ve Kamleya', artist: 'Arijit Singh & Shreya Ghoshal', album: 'Rocky Aur Rani Kii Prem Kahaani', genre: 'Bollywood', duration: 247 },
  { id: '73vZDNKa_Wg', title: 'Maan Meri Jaan', artist: 'King', album: 'Champagne Talk', genre: 'Bollywood', duration: 194 },
  { id: '3Mej13I-Tdc', title: 'Guli Mata', artist: 'Saad Lamjarred & Shreya Ghoshal', album: 'Guli Mata', genre: 'Bollywood', duration: 215 },
  { id: 'DsjRNPrvq6U', title: 'Hukum', artist: 'Anirudh Ravichander', album: 'Jailer', genre: 'Bollywood', duration: 204 },
  { id: 'IqwIOlhfCak', title: 'Badass', artist: 'Anirudh Ravichander', album: 'Leo', genre: 'Bollywood', duration: 229 },

  // 2. Punjabi Superhits
  { id: 'mH_LFkWxpI0', title: 'Lover', artist: 'Diljit Dosanjh', album: 'MoonChild Era', genre: 'Punjabi', duration: 190 },
  { id: 'cl0a3i2wFcc', title: 'Born to Shine', artist: 'Diljit Dosanjh', album: 'G.O.A.T.', genre: 'Punjabi', duration: 214 },
  { id: 'cWMxCE2HTag', title: 'Softly', artist: 'Karan Aujla', album: 'Making Memories', genre: 'Punjabi', duration: 156 },
  { id: 'LK7-_dgAVQE', title: 'Tauba Tauba', artist: 'Karan Aujla', album: 'Bad Newz', genre: 'Punjabi', duration: 208 },
  { id: 'VNs_cCtdbPc', title: 'Mi Amor', artist: 'Sharn', album: 'Mi Amor', genre: 'Punjabi', duration: 198 },
  { id: '4tywp83zkmk', title: 'Cheques', artist: 'Shubh', album: 'Still Rollin', genre: 'Punjabi', duration: 183 },
  { id: 'XTp5jaRU3Ws', title: 'Wavy', artist: 'Karan Aujla', album: 'Street Dreams', genre: 'Punjabi', duration: 169 },
  { id: '-YlmnPh-6rE', title: 'For A Reason', artist: 'Karan Aujla', album: 'Single', genre: 'Punjabi', duration: 180 },
  { id: 'YOQLbW9NeBM', title: 'Banda Bamb', artist: 'Jordan Sandhu', album: 'Banda Bamb', genre: 'Punjabi', duration: 195 },

  // 3. Hollywood & Global Pop
  { id: '4NRXx6U8ABQ', title: 'Blinding Lights', artist: 'The Weeknd', album: 'After Hours', genre: 'Hollywood', duration: 200 },
  { id: 'dqt8Z1k0oWQ', title: 'Starboy', artist: 'The Weeknd ft. Daft Punk', album: 'Starboy', genre: 'Hollywood', duration: 230 },
  { id: 'ic8j13piAhQ', title: 'Cruel Summer', artist: 'Taylor Swift', album: 'Lover', genre: 'Hollywood', duration: 178 },
  { id: 'TUVcZfQe-Kw', title: 'Levitating', artist: 'Dua Lipa', album: 'Future Nostalgia', genre: 'Hollywood', duration: 203 },
  { id: 'H5v3kku4y6Q', title: 'As It Was', artist: 'Harry Styles', album: "Harry's House", genre: 'Hollywood', duration: 167 },
  { id: 'JGwWNGJdvx8', title: 'Shape of You', artist: 'Ed Sheeran', album: '÷ (Divide)', genre: 'Hollywood', duration: 233 },
  { id: 'Pkh8UtuejGw', title: 'Señorita', artist: 'Shawn Mendes & Camila Cabello', album: 'Shawn Mendes', genre: 'Hollywood', duration: 191 },
  { id: 'k2qgadSvNyU', title: 'New Rules', artist: 'Dua Lipa', album: 'Dua Lipa', genre: 'Hollywood', duration: 209 },
  { id: 'syFZfO_wfMQ', title: 'Night Changes', artist: 'One Direction', album: 'FOUR', genre: 'Hollywood', duration: 226 },

  // 4. Tollywood & South Indian Hits
  { id: 'hCt-H4-5wco', title: 'Chiru Chiru', artist: 'Yuvan Shankar Raja', album: 'Awaara', genre: 'Tollywood', duration: 280 },
  { id: 'xDkNIWgGb3g', title: 'Bommali', artist: 'Mani Sharma & Hemachandra', album: 'Billa', genre: 'Tollywood', duration: 260 },
  { id: '2a34XyiZO14', title: 'The Life Of Ram', artist: 'Govind Vasantha & Pradeep Kumar', album: 'Jaanu', genre: 'Tollywood', duration: 330 },
  { id: 'VQ2-HPwxAZY', title: 'Idedo Bagundi', artist: 'Devi Sri Prasad & Vijay Prakash', album: 'Mirchi', genre: 'Tollywood', duration: 270 },

  // 5. Haryanvi Superhits
  { id: 'ua6GpI8ugxY', title: 'Gaadi Paache Gaadi', artist: 'Amanraj Gill & Pranjal Dahiya', album: 'Single', genre: 'Haryanvi', duration: 195 },
  { id: 'tYKrORILFOg', title: 'Naam Chale', artist: 'Vikram Sarkar & Masoom Sharma', album: 'Single', genre: 'Haryanvi', duration: 180 },
  { id: 'MDrsQMTbOuw', title: 'Ji Laage Se Babya Mai', artist: 'Aman Jaji & Raj Mawar', album: 'Single', genre: 'Haryanvi', duration: 210 },
  { id: 'XcJVcyZ2vwE', title: 'Hopeless', artist: 'Amanraj Gill & Prem Lata', album: 'Single', genre: 'Haryanvi', duration: 190 },
  { id: 'AsdEIaw9Wks', title: 'Mithe Tere Bol Pari', artist: 'Masoom Sharma & Aman Jaji', album: 'Single', genre: 'Haryanvi', duration: 215 },

  // 6. Bhojpuri Dhamaka
  { id: 'Nd3PmNWqpPQ', title: 'Tut Jai Palang Raja Ji', artist: 'Khesari Lal Yadav & Aamrapali Dubey', album: 'Doli Saja Ke Rakhna', genre: 'Bhojpuri', duration: 210 },
  { id: 'cQM55aOrZCg', title: 'Rajaji Ke Dilwa', artist: 'Pawan Singh & Shivani Singh', album: 'Single', genre: 'Bhojpuri', duration: 195 },
  { id: 'c4JD7rEtIj8', title: 'Chhalakata Hamro Jawaniya', artist: 'Pawan Singh & Priyanka Singh', album: 'Bhojpuriya Raja', genre: 'Bhojpuri', duration: 220 },
  { id: 'j1PFv7qIPXo', title: 'Sadiya', artist: 'Pawan Singh & Shivani Singh', album: 'Single', genre: 'Bhojpuri', duration: 205 },
  { id: 'qZId59qml_4', title: 'Lal Ghaghra', artist: 'Pawan Singh & Shilpi Raj', album: 'Single', genre: 'Bhojpuri', duration: 215 },

  // 7. Indie & Acoustic Lounge
  { id: 'Qwm6BSGrOq0', title: 'Iraaday', artist: 'Abdul Hannan & Rovalio', album: 'Single', genre: 'Indie', duration: 145 },
  { id: 'G8nlhcmDXNE', title: 'Woh', artist: 'Khatth ft. Sthiti', album: 'Single', genre: 'Indie', duration: 210 },
  { id: 'VU23OPQ1Pmc', title: 'Katchi Sera', artist: 'Sai Abhyankkar', album: 'Think Indie', genre: 'Indie', duration: 190 },
  { id: '_kUrW9SEaJc', title: 'Sage', artist: 'Ritviz', album: 'DEV', genre: 'Indie', duration: 165 },
  { id: 'ecPMVO7JuTo', title: 'Dooba Dooba', artist: 'Silk Route & Mohit Chauhan', album: 'Boondein', genre: 'Indie', duration: 290 },
  { id: 'gPpQNzQP6gE', title: 'Nadaaniyan', artist: 'Akshath', album: 'Single', genre: 'Indie', duration: 165 },
];

const GENRE_QUERIES = {
  bollywood: [
    'latest bollywood romantic songs 2026',
    'trending arijit singh shreya ghoshal hindi songs',
    'top bollywood chartbusters songs'
  ],
  punjabi: [
    'latest punjabi songs 2026',
    'karan aujla diljit dosanjh shubh hits',
    'top punjabi chartbusters'
  ],
  hollywood: [
    'billboard hot 100 top pop hits',
    'the weeknd taylor swift dua lipa pop songs',
    'global viral english songs'
  ],
  tollywood: [
    'latest telugu songs 2026',
    'anirudh ravichander south hits',
    'top trending tamil superhits'
  ],
  haryanvi: [
    'latest haryanvi songs 2026',
    'masoom sharma haryanvi superhits',
    'top haryanvi dj songs'
  ],
  bhojpuri: [
    'latest bhojpuri hits 2026',
    'pawan singh khesari lal superhits',
    'trending bhojpuri gana'
  ],
  indie: [
    'latest hindi indie acoustic songs',
    'anuv jain prateek kuhad soulful songs',
    'chill indian indie pop'
  ],
};

const categoryCache = new Map();

function normalize(t) {
  return {
    id: t.id,
    title: t.title,
    rawTitle: t.title,
    artist: t.artist,
    album: t.album || null,
    thumbnail: t.thumbnail || `https://i.ytimg.com/vi/${t.id}/hqdefault.jpg`,
    duration: t.duration || 210,
    genre: t.genre || 'Pop',
    isExplicit: false,
    channelTitle: t.artist,
    viewCount: '150M',
    likeCount: '3.2M',
  };
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const CATEGORY_DEFINITIONS = [
  { id: 'bollywood', name: 'Bollywood & Hindi', color: 'from-amber-600 to-rose-700', icon: '🎬', description: 'Romantic & soul-stirring Bollywood melodies' },
  { id: 'punjabi', name: 'Punjabi Hits', color: 'from-orange-600 to-red-700', icon: '🌾', description: 'Bhangra, Desi Hip-Hop & Punjabi chart toppers' },
  { id: 'hollywood', name: 'Hollywood & Pop', color: 'from-blue-600 to-indigo-800', icon: '🌍', description: 'Global Billboard Hot 100 hits & international anthems' },
  { id: 'tollywood', name: 'Tollywood & South', color: 'from-emerald-600 to-teal-800', icon: '⚡', description: 'High-energy Telugu, Tamil & South Indian blockbusters' },
  { id: 'haryanvi', name: 'Haryanvi Superhits', color: 'from-yellow-600 to-amber-700', icon: '🚜', description: 'Desi swag, DJ beats & viral Haryanvi anthems' },
  { id: 'bhojpuri', name: 'Bhojpuri Dhamaka', color: 'from-rose-600 to-pink-700', icon: '🌶️', description: 'Electrifying Bhojpuri party tracks & popular folk hits' },
  { id: 'indie', name: 'Indie & Acoustic', color: 'from-purple-600 to-violet-800', icon: '🎸', description: 'Chill indie, soulful acoustic vibes & singer-songwriter gems' },
];

export const chartService = {
  // Get Trending tracks (shuffled fresh for dynamic feel)
  async getTrending(region = 'IN') {
    const tracks = VERIFIED_CATALOG.map(normalize);
    return {
      tracks: shuffle(tracks),
      region: region.toUpperCase(),
      updatedAt: Date.now(),
    };
  },

  // Get Top Songs
  async getTopSongs(region = 'IN') {
    const tracks = VERIFIED_CATALOG.map(normalize);
    return {
      tracks: tracks.slice(0, 30),
      region: region.toUpperCase(),
      updatedAt: Date.now(),
    };
  },

  // Get Top Artists
  async getTopArtists(region = 'IN') {
    return {
      artists: [
        { id: 'arijit_singh', name: 'Arijit Singh', image: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300' },
        { id: 'diljit_dosanjh', name: 'Diljit Dosanjh', image: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300' },
        { id: 'karan_aujla', name: 'Karan Aujla', image: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300' },
        { id: 'the_weeknd', name: 'The Weeknd', image: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300' },
        { id: 'taylor_swift', name: 'Taylor Swift', image: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=300' },
        { id: 'anirudh_ravichander', name: 'Anirudh Ravichander', image: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=300' },
        { id: 'pawan_singh', name: 'Pawan Singh', image: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300' },
        { id: 'masoom_sharma', name: 'Masoom Sharma', image: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300' },
        { id: 'anuv_jain', name: 'Anuv Jain', image: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300' },
      ],
      region: region.toUpperCase(),
      updatedAt: Date.now(),
    };
  },

  // Get Dynamic Non-Repetitive Genre / Category Tracks
  async getTracksByCategory(categoryId, userId = null) {
    const cat = (categoryId || 'bollywood').toLowerCase();
    const cacheKey = `cat_${cat}`;
    const cached = categoryCache.get(cacheKey);

    let rawTracks = [];

    if (cached && Date.now() - cached.timestamp < 10 * 60 * 1000 && cached.tracks.length >= 10) {
      rawTracks = cached.tracks;
    } else {
      const queries = GENRE_QUERIES[cat] || [`${cat} superhit top songs`];
      const searchPromises = queries.map(q =>
        musicProvider.searchDiscovery(q, 30).catch(() => [])
      );

      const results = await Promise.allSettled(searchPromises);
      const combined = [];
      const seenIds = new Set();

      for (const res of results) {
        if (res.status === 'fulfilled' && Array.isArray(res.value)) {
          for (const item of res.value) {
            if (item && item.id && !seenIds.has(item.id)) {
              seenIds.add(item.id);
              combined.push(item);
            }
          }
        }
      }

      if (combined.length >= 8) {
        rawTracks = combined;
        categoryCache.set(cacheKey, { timestamp: Date.now(), tracks: combined });
      } else {
        // Fallback to verified catalog matching genre
        const filtered = VERIFIED_CATALOG.filter(t => t.genre.toLowerCase().includes(cat) || cat.includes(t.genre.toLowerCase()));
        rawTracks = (filtered.length > 0 ? filtered : VERIFIED_CATALOG).map(normalize);
      }
    }

    // Personalize by user's preferred artists if authenticated
    if (userId && rawTracks.length > 0) {
      try {
        const profile = await db.getTasteProfile(userId);
        if (profile) {
          const preferredMap = profile.preferred_artists || {};
          const likedArtists = new Set(profile.liked_artists || []);
          const dislikedArtists = new Set(profile.disliked_artists || []);

          rawTracks = rawTracks
            .filter(t => !dislikedArtists.has(t.artist))
            .map(track => {
              let score = 0;
              if (preferredMap[track.artist]) {
                score += preferredMap[track.artist] * 5;
              }
              if (likedArtists.has(track.artist)) {
                score += 30;
              }
              return { track, score };
            })
            .sort((a, b) => b.score - a.score)
            .map(item => item.track);
        }
      } catch (err) {
        console.warn('Taste ranking failed:', err.message);
      }
    }

    return rawTracks.map(normalize);
  },

  getAllCategories() {
    return CATEGORY_DEFINITIONS;
  },

  getVerifiedCatalog() {
    return VERIFIED_CATALOG.map(normalize);
  },
};
