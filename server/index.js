import express from 'express';
import cors from 'cors';
import axios from 'axios';
import dotenv from 'dotenv';
import { authService } from './auth/authService.js';
import { requireAuth, optionalAuth } from './auth/authMiddleware.js';
import { db } from './db/schema.js';
import { dbClient } from './db/client.js';
import { cloudRecommendationService } from './recommendations/cloudRecommendationService.js';
import { musicProvider } from './providers/musicProvider.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5005;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Database Health Check Endpoint
app.get('/api/health/db', async (req, res) => {
  const health = await dbClient.healthCheck();
  res.json({
    status: health.status === 'connected' ? 'ok' : 'error',
    database: health,
    timestamp: Date.now(),
  });
});

// ==========================================
// 1. AUTHENTICATION ROUTES
// ==========================================

app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const userAgent = req.headers['user-agent'] || '';
    const ip = req.ip || req.socket.remoteAddress || '';
    const result = await authService.register(name, email, password, userAgent, ip);
    res.status(201).json({ status: 'success', ...result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const userAgent = req.headers['user-agent'] || '';
    const ip = req.ip || req.socket.remoteAddress || '';
    const result = await authService.login(email, password, userAgent, ip);
    res.json({ status: 'success', ...result });
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});

app.post('/api/auth/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    const result = await authService.refreshAccessToken(refreshToken);
    res.json({ status: 'success', ...result });
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});

app.post('/api/auth/logout', optionalAuth, async (req, res) => {
  try {
    const { refreshToken } = req.body;
    const result = await authService.logout(refreshToken);
    res.json({ status: 'success', ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({
    status: 'success',
    user: {
      id: req.user.id,
      name: req.user.name,
      email: req.user.email,
      createdAt: Number(req.user.created_at),
    },
  });
});

app.post('/api/auth/change-password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const result = await authService.changePassword(req.user.id, currentPassword, newPassword);
    res.json({ status: 'success', ...result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/auth/account', requireAuth, async (req, res) => {
  try {
    const { password } = req.body;
    const result = await authService.deleteAccount(req.user.id, password);
    res.json({ status: 'success', ...result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const result = await authService.forgotPassword(email);
    res.json({ status: 'success', ...result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    const result = await authService.resetPassword(token, newPassword);
    res.json({ status: 'success', ...result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ==========================================
// 2. CLOUD USER DATA & SYNC ROUTES
// ==========================================

app.get('/api/user/likes', requireAuth, async (req, res) => {
  const likes = await db.getLikedTracks(req.user.id);
  res.json({ status: 'success', likes });
});

app.post('/api/user/likes', requireAuth, async (req, res) => {
  const { track } = req.body;
  if (!track || !track.id) return res.status(400).json({ error: 'Track is required' });
  const likes = await db.addLikedTrack(req.user.id, track);
  res.json({ status: 'success', likes });
});

app.delete('/api/user/likes/:trackId', requireAuth, async (req, res) => {
  const { trackId } = req.params;
  const likes = await db.removeLikedTrack(req.user.id, trackId);
  res.json({ status: 'success', likes });
});

app.get('/api/user/playlists', requireAuth, async (req, res) => {
  const playlists = await db.getPlaylists(req.user.id);
  res.json({ status: 'success', playlists });
});

app.post('/api/user/playlists', requireAuth, async (req, res) => {
  const playlist = req.body;
  if (!playlist || !playlist.title) return res.status(400).json({ error: 'Playlist title is required' });
  const saved = await db.savePlaylist(req.user.id, playlist);
  res.json({ status: 'success', playlist: saved });
});

app.delete('/api/user/playlists/:id', requireAuth, async (req, res) => {
  const deleted = await db.deletePlaylist(req.user.id, req.params.id);
  res.json({ status: 'success', success: deleted });
});

app.get('/api/user/history', requireAuth, async (req, res) => {
  const history = await db.getUserHistory(req.user.id);
  res.json({ status: 'success', history });
});

app.delete('/api/user/history', requireAuth, async (req, res) => {
  await db.clearUserHistory(req.user.id);
  res.json({ status: 'success', message: 'History cleared' });
});

app.post('/api/user/events', optionalAuth, async (req, res) => {
  const { events } = req.body;
  const userId = req.user ? req.user.id : 'anon_' + (req.ip || 'client');
  if (Array.isArray(events)) {
    await cloudRecommendationService.processEvents(userId, events);
  }
  res.json({ status: 'success', processed: events?.length || 0 });
});

app.post('/api/user/migrate', requireAuth, async (req, res) => {
  const { likedTracks, playlists, history } = req.body;
  const userId = req.user.id;

  if (Array.isArray(likedTracks)) {
    for (const t of likedTracks) await db.addLikedTrack(userId, t);
  }
  if (Array.isArray(playlists)) {
    for (const p of playlists) await db.savePlaylist(userId, p);
  }
  if (Array.isArray(history)) {
    const formatted = history.map((h) => ({
      eventType: 'PLAY_COMPLETED',
      trackId: h.id,
      title: h.title,
      artist: h.artist,
      duration: h.duration,
    }));
    await cloudRecommendationService.processEvents(userId, formatted);
  }

  res.json({ status: 'success', message: 'Local data migrated to cloud account successfully.' });
});

// ==========================================
// 3. RECOMMENDATIONS & SEED RADIO
// ==========================================

app.get('/api/recommendations/home', optionalAuth, async (req, res) => {
  const userId = req.user ? req.user.id : null;
  const charts = await musicProvider.getCharts();
  const homeData = await cloudRecommendationService.getPersonalizedHome(userId, charts.trending);
  res.json({ status: 'success', ...homeData });
});

app.get('/api/recommendations/radio/:videoId', optionalAuth, async (req, res) => {
  const { videoId } = req.params;
  const userId = req.user ? req.user.id : null;

  const candidatePool = await musicProvider.getCandidatePool({ id: videoId, artist: '', title: '' });
  const radio = await cloudRecommendationService.getSeedRadio(userId, { id: videoId }, candidatePool);
  res.json({ status: 'success', radio });
});

app.get('/api/recommendations/mood/:mood', optionalAuth, async (req, res) => {
  const moodId = req.params.mood;
  const userId = req.user ? req.user.id : null;

  const candidatePool = await musicProvider.getCandidatePool({ id: moodId, genre: moodId });
  const station = await cloudRecommendationService.getMoodStation(userId, moodId, candidatePool);
  res.json({ status: 'success', ...station });
});

// ==========================================
// 4. MUSIC CATALOG & STREAM ROUTES
// ==========================================

app.get('/api/music/charts', async (req, res) => {
  const charts = await musicProvider.getCharts();
  res.json({ status: 'success', ...charts });
});

app.get('/api/music/search', async (req, res) => {
  const query = req.query.q;
  const type = req.query.type || 'all';
  if (!query) return res.status(400).json({ error: 'Query parameter q is required' });

  const results = await musicProvider.search(query, type, 30);
  res.json({ status: 'success', query, ...results });
});

app.get('/api/music/artist/:name', async (req, res) => {
  const artistName = decodeURIComponent(req.params.name);
  const artistData = await musicProvider.getArtist(artistName);
  if (!artistData) return res.status(404).json({ error: 'Artist not found' });
  res.json({ status: 'success', artist: artistData });
});

app.get('/api/music/album/:id', async (req, res) => {
  const albumData = await musicProvider.getAlbum(req.params.id);
  res.json({ status: 'success', album: albumData });
});

app.get('/api/music/stream/:id', async (req, res) => {
  const videoId = req.params.id;
  const stream = await musicProvider.resolveAudioStream(videoId);

  if (stream) {
    return res.json({
      status: 'success',
      videoId,
      streamUrl: stream.url,
      mimeType: stream.mimeType,
      codec: stream.codec,
      bitrate: stream.bitrate || 'Quality information unavailable',
    });
  }

  res.json({
    status: 'online_only',
    videoId,
    streamUrl: `https://www.youtube.com/watch?v=${videoId}`,
    mimeType: 'audio/webm',
    codec: 'opus',
    bitrate: 'Standard',
  });
});

app.get('/api/music/download/:id', async (req, res) => {
  const videoId = req.params.id;
  const stream = await musicProvider.resolveAudioStream(videoId);

  if (stream && stream.url) {
    try {
      const streamResp = await axios({
        method: 'get',
        url: stream.url,
        responseType: 'stream',
        timeout: 10000,
      });

      res.setHeader('Content-Type', stream.mimeType || 'audio/webm');
      res.setHeader('Content-Disposition', `attachment; filename="${videoId}.webm"`);
      return streamResp.data.pipe(res);
    } catch (e) {
      console.warn('Audio pipe stream error:', e.message);
    }
  }

  res.status(404).json({
    status: 'unavailable',
    message: 'Direct audio stream unavailable for offline download.',
    videoId,
  });
});

app.get('/api/music/lyrics', async (req, res) => {
  const { track, artist, duration } = req.query;
  if (!track || !artist) return res.status(400).json({ error: 'track and artist required' });

  const lyrics = await musicProvider.getLyrics(track, artist, duration);
  res.json({ status: 'success', ...lyrics });
});

app.get('/api/ads/bundle', (req, res) => {
  res.json({ status: 'success', version: '1.0', audioAds: [], displayBanners: [] });
});

app.listen(PORT, () => {
  console.log(`⚡ MRJ Music API running at http://localhost:${PORT}`);
});

export default app;
