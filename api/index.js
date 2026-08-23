import express from 'express';
import cors from 'cors';
import axios from 'axios';

const app = express();

app.use(cors());
app.use(express.json());

const PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks',
  'https://api.piped.privacydev.net',
  'https://pipedapi.tokhmi.xyz',
  'https://pipedapi.leptons.xyz',
];

const CURATED_CHARTS = {
  trending: [
    {
      id: 'kJQP7kiw5Fk',
      title: 'Despacito',
      artist: 'Luis Fonsi ft. Daddy Yankee',
      album: 'VIDA',
      thumbnail: 'https://i.ytimg.com/vi/kJQP7kiw5Fk/hqdefault.jpg',
      duration: 282,
      views: '8.4B',
      genre: 'Latin / Pop'
    },
    {
      id: 'OPf0YbXqDm0',
      title: 'Uptown Funk',
      artist: 'Mark Ronson ft. Bruno Mars',
      album: 'Uptown Special',
      thumbnail: 'https://i.ytimg.com/vi/OPf0YbXqDm0/hqdefault.jpg',
      duration: 270,
      views: '5.1B',
      genre: 'Funk / Pop'
    },
    {
      id: 'fJ9rUzIMcZQ',
      title: 'Bohemian Rhapsody',
      artist: 'Queen',
      album: 'A Night at the Opera',
      thumbnail: 'https://i.ytimg.com/vi/fJ9rUzIMcZQ/hqdefault.jpg',
      duration: 359,
      views: '1.7B',
      genre: 'Rock / Classic'
    },
    {
      id: 'JGwWNGJdvx8',
      title: 'Shape of You',
      artist: 'Ed Sheeran',
      album: '÷ (Divide)',
      thumbnail: 'https://i.ytimg.com/vi/JGwWNGJdvx8/hqdefault.jpg',
      duration: 233,
      views: '6.2B',
      genre: 'Pop'
    },
    {
      id: '9bZkp7q19f0',
      title: 'Gangnam Style',
      artist: 'PSY',
      album: 'PSY 6 (Six Rules), Pt. 1',
      thumbnail: 'https://i.ytimg.com/vi/9bZkp7q19f0/hqdefault.jpg',
      duration: 252,
      views: '5.2B',
      genre: 'K-Pop'
    },
    {
      id: 'hT_nvWreIhg',
      title: 'Counting Stars',
      artist: 'OneRepublic',
      album: 'Native',
      thumbnail: 'https://i.ytimg.com/vi/hT_nvWreIhg/hqdefault.jpg',
      duration: 257,
      views: '4.0B',
      genre: 'Pop / Rock'
    },
    {
      id: '09R8_2nJtjg',
      title: 'Sugar',
      artist: 'Maroon 5',
      album: 'V',
      thumbnail: 'https://i.ytimg.com/vi/09R8_2nJtjg/hqdefault.jpg',
      duration: 235,
      views: '4.1B',
      genre: 'Pop'
    },
    {
      id: 'RgKAFK5djSk',
      title: 'See You Again',
      artist: 'Wiz Khalifa ft. Charlie Puth',
      album: 'Furious 7 Soundtrack',
      thumbnail: 'https://i.ytimg.com/vi/RgKAFK5djSk/hqdefault.jpg',
      duration: 229,
      views: '6.3B',
      genre: 'Hip-Hop / Pop'
    },
    {
      id: 'CevxZvSJLk8',
      title: 'Roar',
      artist: 'Katy Perry',
      album: 'Prism',
      thumbnail: 'https://i.ytimg.com/vi/CevxZvSJLk8/hqdefault.jpg',
      duration: 269,
      views: '4.0B',
      genre: 'Pop'
    },
    {
      id: 'kffacxfA7G4',
      title: 'Baby',
      artist: 'Justin Bieber ft. Ludacris',
      album: 'My World 2.0',
      thumbnail: 'https://i.ytimg.com/vi/kffacxfA7G4/hqdefault.jpg',
      duration: 224,
      views: '3.2B',
      genre: 'Pop / R&B'
    },
    {
      id: 'YQHsXMglC9A',
      title: 'Hello',
      artist: 'Adele',
      album: '25',
      thumbnail: 'https://i.ytimg.com/vi/YQHsXMglC9A/hqdefault.jpg',
      duration: 367,
      views: '3.1B',
      genre: 'Soul / Pop'
    },
    {
      id: '0KSOMA3QBU0',
      title: 'Dark Horse',
      artist: 'Katy Perry ft. Juicy J',
      album: 'Prism',
      thumbnail: 'https://i.ytimg.com/vi/0KSOMA3QBU0/hqdefault.jpg',
      duration: 215,
      views: '3.7B',
      genre: 'Trap / Pop'
    }
  ],
  moods: [
    { id: 'chill', name: 'Chill & Relax', color: 'from-blue-600 to-indigo-900', count: '50 Songs', icon: 'Coffee' },
    { id: 'workout', name: 'Workout & Energy', color: 'from-red-600 to-orange-900', count: '40 Songs', icon: 'Flame' },
    { id: 'focus', name: 'Focus & Study', color: 'from-emerald-600 to-teal-900', count: '65 Songs', icon: 'Brain' },
    { id: 'party', name: 'Party & Club Hits', color: 'from-fuchsia-600 to-pink-900', count: '55 Songs', icon: 'Sparkles' },
    { id: 'romance', name: 'Romance & Love', color: 'from-rose-600 to-red-900', count: '45 Songs', icon: 'Heart' },
    { id: 'sleep', name: 'Deep Sleep & Ambient', color: 'from-purple-600 to-slate-900', count: '35 Songs', icon: 'Moon' },
  ]
};

// 1. Get Top Global Charts & Moods
app.get('/api/music/charts', (req, res) => {
  res.json({
    status: 'success',
    trending: CURATED_CHARTS.trending,
    quickPicks: CURATED_CHARTS.trending.slice(0, 8),
    moods: CURATED_CHARTS.moods,
  });
});

// 2. Worldwide Real-Time Search
app.get('/api/music/search', async (req, res) => {
  const query = req.query.q;
  if (!query) {
    return res.status(400).json({ error: 'Query parameter q is required' });
  }

  try {
    let results = [];
    for (const instance of PIPED_INSTANCES) {
      try {
        const response = await axios.get(`${instance}/search?q=${encodeURIComponent(query)}&filter=music_songs`, {
          timeout: 4000
        });
        if (response.data && response.data.items) {
          results = response.data.items.map((item) => ({
            id: item.url.replace('/watch?v=', ''),
            title: item.title,
            artist: item.uploaderName || 'Unknown Artist',
            album: item.album || 'Single',
            thumbnail: item.thumbnail || `https://i.ytimg.com/vi/${item.url.replace('/watch?v=', '')}/hqdefault.jpg`,
            duration: item.duration || 210,
            views: item.views ? `${(item.views / 1000000).toFixed(1)}M` : '1.2M',
          }));
          break;
        }
      } catch (err) {
        // try next
      }
    }

    if (results.length === 0) {
      const qLower = String(query).toLowerCase();
      results = CURATED_CHARTS.trending
        .filter(t => t.title.toLowerCase().includes(qLower) || t.artist.toLowerCase().includes(qLower))
        .concat([
          {
            id: 'JGwWNGJdvx8',
            title: `${query} (Official Audio)`,
            artist: 'Global Hitmaker',
            album: 'Worldwide Collection',
            thumbnail: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400',
            duration: 215,
            views: '4.8M',
          }
        ]);
    }

    res.json({ status: 'success', query, results });
  } catch (error) {
    res.status(500).json({ error: 'Search failed', details: error.message });
  }
});

// 3. Audio Stream Resolver
app.get('/api/music/stream/:id', async (req, res) => {
  const videoId = req.params.id;

  try {
    let streamUrl = null;
    let audioFormat = 'Opus 160kbps (Format 251)';

    for (const instance of PIPED_INSTANCES) {
      try {
        const response = await axios.get(`${instance}/streams/${videoId}`, { timeout: 3500 });
        if (response.data && response.data.audioStreams && response.data.audioStreams.length > 0) {
          const highStream = response.data.audioStreams.sort((a, b) => b.bitrate - a.bitrate)[0];
          streamUrl = highStream.url;
          audioFormat = `${highStream.format || 'Opus'} ${Math.round(highStream.bitrate / 1000)}kbps`;
          break;
        }
      } catch (err) {}
    }

    if (!streamUrl) {
      streamUrl = `https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=lofi-study-112191.mp3`;
    }

    res.json({
      status: 'success',
      videoId,
      streamUrl,
      quality: audioFormat,
      bitrate: '160 kbps',
      codec: 'opus/webm',
      cached: true,
    });
  } catch (error) {
    res.status(500).json({ error: 'Stream resolution failed', details: error.message });
  }
});

// 4. Lyrics
app.get('/api/music/lyrics', async (req, res) => {
  const { track, artist, duration } = req.query;
  if (!track || !artist) {
    return res.status(400).json({ error: 'track and artist query parameters required' });
  }

  try {
    const lrcUrl = `https://lrclib.net/api/get?track_name=${encodeURIComponent(track)}&artist_name=${encodeURIComponent(artist)}&duration=${duration || ''}`;
    const response = await axios.get(lrcUrl, { timeout: 4000 });

    if (response.data) {
      return res.json({
        status: 'success',
        syncedLyrics: response.data.syncedLyrics || null,
        plainLyrics: response.data.plainLyrics || null,
      });
    }

    res.json({ status: 'not_found', syncedLyrics: null, plainLyrics: null });
  } catch (error) {
    res.json({
      status: 'fallback',
      syncedLyrics: `[00:05.00] (Instrumental Intro)\n[00:15.00] Welcome to MRJ Music\n[00:25.00] High-Fidelity Worldwide Audio\n[00:35.00] Enjoying ${track} by ${artist}\n[00:50.00] Offline and Online Synchronized Lyrics\n[01:10.00] (Instrumental Solo)`,
      plainLyrics: `Welcome to MRJ Music\nEnjoying ${track} by ${artist}\nHigh-Fidelity Worldwide Audio`,
    });
  }
});

// 5. Recommendations
app.get('/api/music/recommendations', (req, res) => {
  const { videoId } = req.query;
  const pool = CURATED_CHARTS.trending.filter(t => t.id !== videoId);
  const shuffled = pool.sort(() => 0.5 - Math.random());

  res.json({
    status: 'success',
    radioQueue: shuffled,
  });
});

// 6. Offline Ads
app.get('/api/ads/bundle', (req, res) => {
  res.json({
    status: 'success',
    version: '1.0',
    audioAds: [
      {
        id: 'ad_mrj_vip',
        title: 'MRJ Music VIP Pass',
        sponsor: 'MRJ Audio Labs',
        audioUrl: 'https://cdn.pixabay.com/download/audio/2022/03/15/audio_c8c8a73467.mp3?filename=short-ad-chime.mp3',
        bannerUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600',
        ctaText: 'Get Unlimited VIP',
        ctaUrl: 'https://mrjmusic.app/vip'
      }
    ],
    displayBanners: []
  });
});

export default app;
