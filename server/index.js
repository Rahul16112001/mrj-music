import express from 'express';
import cors from 'cors';
import axios from 'axios';
import dotenv from 'dotenv';
import { authService } from './auth/authService.js';
import { requireAuth, optionalAuth } from './auth/authMiddleware.js';
import { db } from './db/schema.js';
import { cloudRecommendationService } from './recommendations/cloudRecommendationService.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5005;

app.use(cors());
app.use(express.json());

const PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks',
  'https://api.piped.privacydev.net',
  'https://pipedapi.leptons.xyz',
  'https://pipedapi.tokhmi.xyz',
];

const INVIDIOUS_INSTANCES = [
  'https://yt.artemislena.eu',
  'https://invidious.jing.rocks',
  'https://invidious.nerdvpn.de',
  'https://inv.nadeko.net',
];

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
  ]
};

// ==========================================
// 1. AUTHENTICATION ROUTES
// ==========================================

// Register (Email + Password only)
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const result = await authService.register(name, email, password);
    res.status(201).json({ status: 'success', ...result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Login (Email + Password only)
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await authService.login(email, password);
    res.json({ status: 'success', ...result });
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});

// Logout
app.post('/api/auth/logout', (req, res) => {
  res.json({ status: 'success', message: 'Logged out successfully' });
});

// Get Current Logged-in User
app.get('/api/auth/me', requireAuth, (req, res) => {
  const user = db.findUserById(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  res.json({
    status: 'success',
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.created_at,
    }
  });
});

// Change Password
app.post('/api/auth/change-password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const result = await authService.changePassword(req.user.id, currentPassword, newPassword);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete Account
app.delete('/api/auth/account', requireAuth, async (req, res) => {
  try {
    const { password } = req.body;
    const result = await authService.deleteAccount(req.user.id, password);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Forgot Password
app.post('/api/auth/forgot-password', (req, res) => {
  const { email } = req.body;
  const result = authService.forgotPassword(email);
  res.json(result);
});

// Reset Password
app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    const result = await authService.resetPassword(token, newPassword);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ==========================================
// 2. USER PROFILE, LIKES & PLAYLISTS ROUTES
// ==========================================

// Get / Update User Settings
app.get('/api/user/settings', requireAuth, (req, res) => {
  const settings = db.getUserSettings(req.user.id);
  res.json({ status: 'success', settings });
});

app.patch('/api/user/settings', requireAuth, (req, res) => {
  const updated = db.updateUserSettings(req.user.id, req.body);
  res.json({ status: 'success', settings: updated });
});

// Get User Liked Tracks
app.get('/api/user/likes', requireAuth, (req, res) => {
  const likes = db.getLikedTracks(req.user.id);
  res.json({ status: 'success', likes });
});

// Like Track
app.post('/api/user/likes', requireAuth, (req, res) => {
  const { track } = req.body;
  if (!track || !track.id) return res.status(400).json({ error: 'Track object required' });

  const likes = db.addLikedTrack(req.user.id, track);
  cloudRecommendationService.processEvents(req.user.id, [{
    eventType: 'LIKE',
    trackId: track.id,
    title: track.title,
    artist: track.artist,
  }]);

  res.json({ status: 'success', likes });
});

// Unlike Track
app.delete('/api/user/likes/:trackId', requireAuth, (req, res) => {
  const trackId = req.params.trackId;
  const likes = db.removeLikedTrack(req.user.id, trackId);
  cloudRecommendationService.processEvents(req.user.id, [{
    eventType: 'UNLIKE',
    trackId,
  }]);

  res.json({ status: 'success', likes });
});

// Get User Playlists
app.get('/api/user/playlists', requireAuth, (req, res) => {
  const playlists = db.getPlaylists(req.user.id);
  res.json({ status: 'success', playlists });
});

// Create / Save Playlist
app.post('/api/user/playlists', requireAuth, (req, res) => {
  const playlist = req.body;
  if (!playlist || !playlist.title) return res.status(400).json({ error: 'Playlist title required' });

  const saved = db.savePlaylist(req.user.id, playlist);
  res.json({ status: 'success', playlist: saved });
});

// Delete Playlist
app.delete('/api/user/playlists/:id', requireAuth, (req, res) => {
  const playlistId = req.params.id;
  const success = db.deletePlaylist(req.user.id, playlistId);
  res.json({ status: 'success', success });
});

// Get User History
app.get('/api/user/history', requireAuth, (req, res) => {
  const history = db.getUserHistory(req.user.id);
  res.json({ status: 'success', history });
});

// Clear User History
app.delete('/api/user/history', requireAuth, (req, res) => {
  db.clearUserHistory(req.user.id);
  res.json({ status: 'success', message: 'History cleared' });
});

// Ingest Behavioral Events Batch
app.post('/api/user/events', optionalAuth, (req, res) => {
  const { events } = req.body;
  const userId = req.user ? req.user.id : null;

  if (userId && Array.isArray(events)) {
    cloudRecommendationService.processEvents(userId, events);
  }

  res.json({ status: 'success', count: events?.length || 0 });
});

// Migrate Local Data into Cloud Account
app.post('/api/user/migrate', requireAuth, (req, res) => {
  const { likedTracks, playlists, history } = req.body;

  if (Array.isArray(likedTracks)) {
    for (const t of likedTracks) db.addLikedTrack(req.user.id, t);
  }
  if (Array.isArray(playlists)) {
    for (const p of playlists) db.savePlaylist(req.user.id, p);
  }
  if (Array.isArray(history)) {
    db.addEvents(req.user.id, history);
  }

  res.json({ status: 'success', message: 'Local data migrated to cloud account successfully' });
});

// ==========================================
// 3. RECOMMENDATION ROUTES
// ==========================================

// Personalized Home
app.get('/api/recommendations/home', optionalAuth, (req, res) => {
  const userId = req.user ? req.user.id : null;
  const homeData = cloudRecommendationService.getPersonalizedHome(userId, CURATED_CHARTS.trending);
  res.json({ status: 'success', ...homeData });
});

// Seed Radio
app.get('/api/recommendations/radio/:trackId', optionalAuth, (req, res) => {
  const trackId = req.params.trackId;
  const userId = req.user ? req.user.id : null;
  const seedTrack = CURATED_CHARTS.trending.find(t => t.id === trackId) || { id: trackId, artist: '', title: '' };

  const radio = cloudRecommendationService.getSeedRadio(userId, seedTrack, CURATED_CHARTS.trending);
  res.json({ status: 'success', radio });
});

// Mood Station
app.get('/api/recommendations/mood/:mood', optionalAuth, (req, res) => {
  const moodId = req.params.mood;
  const userId = req.user ? req.user.id : null;

  const station = cloudRecommendationService.getMoodStation(userId, moodId, CURATED_CHARTS.trending);
  res.json({ status: 'success', ...station });
});

// ==========================================
// 4. MUSIC CATALOG & STREAM ROUTES
// ==========================================

// Charts
app.get('/api/music/charts', (req, res) => {
  res.json({
    status: 'success',
    trending: CURATED_CHARTS.trending,
    quickPicks: CURATED_CHARTS.trending.slice(0, 8),
  });
});

// Real-Time Search Scraper
app.get('/api/music/search', async (req, res) => {
  const query = req.query.q;
  const type = req.query.type || 'all';

  if (!query) {
    return res.status(400).json({ error: 'Query parameter q is required' });
  }

  try {
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query + (type === 'songs' ? ' song audio' : ''))}`;
    const response = await axios.get(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      timeout: 6000,
    });

    const match = response.data.match(/var ytInitialData = ({.+?});<\/script>/);
    let songs = [];
    let artists = [];

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

            songs.push({
              id: videoId,
              title,
              artist,
              album: 'Single',
              thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
              duration: durationSec,
              views: v.viewCountText?.simpleText || '1M views',
            });
          }

          if (item.channelRenderer) {
            const c = item.channelRenderer;
            artists.push({
              id: c.channelId,
              name: c.title?.simpleText || 'Artist',
              thumbnail: c.thumbnail?.thumbnails?.[0]?.url || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300',
              subscribers: c.subscriberCountText?.simpleText || 'Popular Artist',
            });
          }
        }
      }
    }

    songs = songs.slice(0, 30);

    if (songs.length === 0) {
      songs = CURATED_CHARTS.trending.filter(t =>
        t.title.toLowerCase().includes(String(query).toLowerCase()) ||
        t.artist.toLowerCase().includes(String(query).toLowerCase())
      );
    }

    res.json({
      status: 'success',
      query,
      results: songs,
      artists: artists.slice(0, 5),
    });
  } catch (error) {
    res.status(500).json({ error: 'Search failed', details: error.message });
  }
});

// Artist Scraper
app.get('/api/music/artist/:name', async (req, res) => {
  const artistName = decodeURIComponent(req.params.name);

  try {
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(artistName + ' top songs official')}`;
    const response = await axios.get(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      timeout: 6000,
    });

    const match = response.data.match(/var ytInitialData = ({.+?});<\/script>/);
    let topSongs = [];

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
            const artist = v.ownerText?.runs?.[0]?.text || artistName;
            const lengthText = v.lengthText?.simpleText || '3:30';
            
            const parts = lengthText.split(':').map(Number);
            const durationSec = parts.length === 2 ? parts[0] * 60 + parts[1] : 210;

            topSongs.push({
              id: videoId,
              title,
              artist,
              album: 'Hit Single',
              thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
              duration: durationSec,
              views: v.viewCountText?.simpleText || '10M views',
            });
          }
        }
      }
    }

    const artistData = {
      id: encodeURIComponent(artistName.toLowerCase().replace(/\s+/g, '-')),
      name: artistName,
      thumbnail: topSongs[0]?.thumbnail || `https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400`,
      monthlyListeners: '45.2M Monthly Listeners',
      bio: `${artistName} is one of the most celebrated and streamed artists globally.`,
      topSongs: topSongs.slice(0, 10),
      albums: [
        {
          id: 'alb_1',
          title: 'Greatest Hits & Essentials',
          artist: artistName,
          thumbnail: topSongs[0]?.thumbnail || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400',
          year: '2024',
          trackCount: topSongs.slice(0, 5).length,
          tracks: topSongs.slice(0, 5)
        }
      ],
      singles: topSongs.slice(5, 12),
      relatedArtists: [
        { id: 'rel_1', name: 'Global Hitmakers', thumbnail: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=300', listeners: '50M' },
      ]
    };

    res.json({ status: 'success', artist: artistData });
  } catch (err) {
    res.status(500).json({ error: 'Artist fetch failed', details: err.message });
  }
});

// Album Scraper
app.get('/api/music/album/:id', (req, res) => {
  const albumId = req.params.id;
  res.json({
    status: 'success',
    album: {
      id: albumId,
      title: 'Complete Studio Collection',
      artist: 'Various Artists',
      thumbnail: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600',
      year: '2024',
      trackCount: CURATED_CHARTS.trending.length,
      totalDuration: 1800,
      tracks: CURATED_CHARTS.trending,
    }
  });
});

// Stream info
app.get('/api/music/stream/:id', (req, res) => {
  const videoId = req.params.id;
  res.json({
    status: 'success',
    videoId,
    streamUrl: `https://www.youtube.com/watch?v=${videoId}`,
    quality: 'Opus 160kbps (High-Fi)',
  });
});

// Real Audio Download Pipe
app.get('/api/music/download/:id', async (req, res) => {
  const videoId = req.params.id;

  let resolvedAudioUrl = null;

  for (const inst of INVIDIOUS_INSTANCES) {
    try {
      const resp = await axios.get(`${inst}/api/v1/videos/${videoId}`, { timeout: 3000 });
      const formats = resp.data?.adaptiveFormats?.filter(f => f.type?.includes('audio')) || [];
      if (formats.length > 0) {
        resolvedAudioUrl = formats[0].url;
        break;
      }
    } catch {}
  }

  if (!resolvedAudioUrl) {
    for (const inst of PIPED_INSTANCES) {
      try {
        const resp = await axios.get(`${inst}/streams/${videoId}`, { timeout: 3000 });
        const audios = resp.data?.audioStreams || [];
        if (audios.length > 0) {
          resolvedAudioUrl = audios[0].url;
          break;
        }
      } catch {}
    }
  }

  if (resolvedAudioUrl) {
    try {
      const streamResp = await axios({
        method: 'get',
        url: resolvedAudioUrl,
        responseType: 'stream',
        timeout: 10000,
      });

      res.setHeader('Content-Type', streamResp.headers['content-type'] || 'audio/webm');
      res.setHeader('Content-Disposition', `attachment; filename="${videoId}.webm"`);
      return streamResp.data.pipe(res);
    } catch (e) {
      console.warn('Audio pipe error:', e.message);
    }
  }

  res.json({
    status: 'online_only',
    message: 'Track available for online playback via High-Fi stream engine',
    videoId,
  });
});

// Synchronized Lyrics
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
    syncedLyrics: null,
    plainLyrics: null,
  });
});

// Ad Bundle
app.get('/api/ads/bundle', (req, res) => {
  res.json({
    status: 'success',
    version: '1.0',
    audioAds: [],
    displayBanners: []
  });
});

app.listen(PORT, () => {
  console.log(`⚡ MRJ Music API running at http://localhost:${PORT}`);
});

export default app;
