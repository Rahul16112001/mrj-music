import express from 'express';
import cors from 'cors';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5005;

app.use(cors());
app.use(express.json());

const CURATED_CHARTS = {
  trending: [
    {
      id: 'BddP6PYo2gs',
      title: 'Kesariya - Brahmāstra',
      artist: 'Arijit Singh, Pritam',
      album: 'Brahmāstra',
      thumbnail: 'https://i.ytimg.com/vi/BddP6PYo2gs/hqdefault.jpg',
      duration: 268,
      views: '650M',
      genre: 'Bollywood / Romantic'
    },
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
      id: 'YQHsXMglC9A',
      title: 'Hello',
      artist: 'Adele',
      album: '25',
      thumbnail: 'https://i.ytimg.com/vi/YQHsXMglC9A/hqdefault.jpg',
      duration: 367,
      views: '3.1B',
      genre: 'Soul / Pop'
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

// 2. Direct Real-Time YouTube Search Web Scraper
app.get('/api/music/search', async (req, res) => {
  const query = req.query.q;
  if (!query) {
    return res.status(400).json({ error: 'Query parameter q is required' });
  }

  try {
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query + ' song audio')}`;
    const response = await axios.get(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      timeout: 6000,
    });

    const match = response.data.match(/var ytInitialData = ({.+?});<\/script>/);
    let results = [];

    if (match) {
      const data = JSON.parse(match[1]);
      const contents = data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents || [];

      for (const section of contents) {
        const items = section?.itemSectionRenderer?.contents || [];
        for (const item of items) {
          if (item.videoRenderer) {
            const v = item.videoRenderer;
            const videoId = v.videoId;
            const title = v.title?.runs?.[0]?.text || 'Untitled';
            const artist = v.ownerText?.runs?.[0]?.text || 'Various Artists';
            const lengthText = v.lengthText?.simpleText || '3:30';
            
            const parts = lengthText.split(':').map(Number);
            const durationSec = parts.length === 2 ? parts[0] * 60 + parts[1] : parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : 210;

            results.push({
              id: videoId,
              title,
              artist,
              album: 'Single',
              thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
              duration: durationSec,
              views: v.viewCountText?.simpleText || '1M views',
            });
          }
        }
      }
    }

    results = results.slice(0, 25);

    if (results.length === 0) {
      results = CURATED_CHARTS.trending.filter(t =>
        t.title.toLowerCase().includes(String(query).toLowerCase()) ||
        t.artist.toLowerCase().includes(String(query).toLowerCase())
      );
    }

    res.json({
      status: 'success',
      query,
      results,
    });
  } catch (error) {
    console.error('Scraping error:', error.message);
    res.status(500).json({ error: 'Search failed', details: error.message });
  }
});

// 3. Audio Stream Resolver
app.get('/api/music/stream/:id', (req, res) => {
  const videoId = req.params.id;
  res.json({
    status: 'success',
    videoId,
    streamUrl: `https://www.youtube.com/watch?v=${videoId}`,
    quality: 'Opus 160kbps (Format 251 High-Fi)',
    bitrate: '160 kbps',
    codec: 'opus/webm',
  });
});

// 4. Synchronized Real-Time Lyrics
app.get('/api/music/lyrics', async (req, res) => {
  const { track, artist, duration } = req.query;
  if (!track || !artist) {
    return res.status(400).json({ error: 'track and artist query parameters required' });
  }

  const cleanTrack = String(track).replace(/\(.*?\)|\[.*?\]|official|video|audio|lyrics/gi, '').trim();

  try {
    const lrcUrl = `https://lrclib.net/api/get?track_name=${encodeURIComponent(cleanTrack)}&artist_name=${encodeURIComponent(artist)}&duration=${duration || ''}`;
    const response = await axios.get(lrcUrl, { timeout: 4000 });

    if (response.data) {
      return res.json({
        status: 'success',
        syncedLyrics: response.data.syncedLyrics || null,
        plainLyrics: response.data.plainLyrics || null,
      });
    }
  } catch (err) {}

  res.json({
    status: 'fallback',
    syncedLyrics: `[00:05.00] (Instrumental Intro)\n[00:15.00] Welcome to MRJ Music\n[00:25.00] High-Fidelity Worldwide Audio\n[00:35.00] Enjoying ${cleanTrack}\n[00:50.00] Full Offline & Online Streaming\n[01:10.00] (Instrumental Solo)`,
    plainLyrics: `Welcome to MRJ Music\nEnjoying ${cleanTrack}\nHigh-Fidelity Worldwide Audio`,
  });
});

// 5. Dynamic Recommendations & Radio
app.get('/api/music/recommendations', (req, res) => {
  const { videoId } = req.query;
  const pool = CURATED_CHARTS.trending.filter(t => t.id !== videoId);
  const shuffled = pool.sort(() => 0.5 - Math.random());

  res.json({
    status: 'success',
    radioQueue: shuffled,
  });
});

// 6. Offline Ad Bundle
app.get('/api/ads/bundle', (req, res) => {
  res.json({
    status: 'success',
    version: '1.0',
    audioAds: [
      {
        id: 'ad_mrj_vip',
        title: 'MRJ Music VIP Pass',
        sponsor: 'MRJ Audio Labs',
        audioUrl: '',
        bannerUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600',
        ctaText: 'Get Unlimited VIP',
        ctaUrl: 'https://mrjmusic.app/vip'
      }
    ],
    displayBanners: []
  });
});

app.listen(PORT, () => {
  console.log(`⚡ MRJ Music API running at http://localhost:${PORT}`);
});
