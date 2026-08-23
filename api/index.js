import express from 'express';
import cors from 'cors';
import axios from 'axios';
import { authService } from '../server/auth/authService.js';
import { requireAuth, optionalAuth } from '../server/auth/authMiddleware.js';
import { db } from '../server/db/schema.js';
import { dbClient } from '../server/db/client.js';
import { chartService } from '../server/charts/chartService.js';
import { cloudRecommendationService } from '../server/recommendations/cloudRecommendationService.js';
import { musicProvider } from '../server/providers/musicProvider.js';

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Database Health Check Endpoint
app.get(['/api/health/db', '/health/db'], async (req, res) => {
  try {
    const health = await dbClient.healthCheck();
    res.json({
      status: health.status === 'connected' ? 'ok' : 'error',
      database: health,
      timestamp: Date.now(),
    });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// 1. Auth Routes
app.post(['/api/auth/register', '/auth/register'], async (req, res) => {
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

app.post(['/api/auth/login', '/auth/login'], async (req, res) => {
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

app.post(['/api/auth/refresh', '/auth/refresh'], async (req, res) => {
  try {
    const { refreshToken } = req.body;
    const result = await authService.refreshAccessToken(refreshToken);
    res.json({ status: 'success', ...result });
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});

app.post(['/api/auth/logout', '/auth/logout'], optionalAuth, async (req, res) => {
  try {
    const { refreshToken } = req.body;
    const result = await authService.logout(refreshToken);
    res.json({ status: 'success', ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get(['/api/auth/me', '/auth/me'], requireAuth, (req, res) => {
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

app.post(['/api/auth/change-password', '/auth/change-password'], requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const result = await authService.changePassword(req.user.id, currentPassword, newPassword);
    res.json({ status: 'success', ...result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete(['/api/auth/account', '/auth/account'], requireAuth, async (req, res) => {
  try {
    const { password } = req.body;
    const result = await authService.deleteAccount(req.user.id, password);
    res.json({ status: 'success', ...result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post(['/api/auth/forgot-password', '/auth/forgot-password'], async (req, res) => {
  try {
    const { email } = req.body;
    const result = await authService.forgotPassword(email);
    res.json({ status: 'success', ...result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post(['/api/auth/reset-password', '/auth/reset-password'], async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    const result = await authService.resetPassword(token, newPassword);
    res.json({ status: 'success', ...result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 2. Official Charts Routes
app.get(['/api/charts/trending', '/charts/trending'], async (req, res) => {
  try {
    const region = req.query.region || 'GLOBAL';
    const data = await chartService.getTrending(region);
    res.json({ status: 'success', ...data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get(['/api/charts/top-songs', '/charts/top-songs'], async (req, res) => {
  try {
    const region = req.query.region || 'GLOBAL';
    const data = await chartService.getTopSongs(region);
    res.json({ status: 'success', ...data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get(['/api/charts/top-artists', '/charts/top-artists'], async (req, res) => {
  try {
    const region = req.query.region || 'GLOBAL';
    const data = await chartService.getTopArtists(region);
    res.json({ status: 'success', ...data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Recommendation Routes
app.get(['/api/recommendations/home', '/recommendations/home'], optionalAuth, async (req, res) => {
  try {
    const userId = req.user ? req.user.id : null;
    const region = req.query.region || 'IN';
    const homeData = await cloudRecommendationService.getPersonalizedHome(userId, region);
    res.json({ status: 'success', ...homeData });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get(['/api/recommendations/radio/:videoId', '/recommendations/radio/:videoId'], optionalAuth, async (req, res) => {
  try {
    const { videoId } = req.params;
    const userId = req.user ? req.user.id : null;

    const radio = await cloudRecommendationService.getSeedRadio(userId, { id: videoId });
    res.json({ status: 'success', radio });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get(['/api/recommendations/mood/:mood', '/recommendations/mood/:mood'], optionalAuth, async (req, res) => {
  try {
    const moodId = req.params.mood;
    const userId = req.user ? req.user.id : null;

    const station = await cloudRecommendationService.getMoodStation(userId, moodId);
    res.json({ status: 'success', ...station });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. User Data Routes
app.get(['/api/user/likes', '/user/likes'], requireAuth, async (req, res) => {
  try {
    const likes = await db.getLikedTracks(req.user.id);
    res.json({ status: 'success', likes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post(['/api/user/likes', '/user/likes'], requireAuth, async (req, res) => {
  try {
    const { track } = req.body;
    if (!track || !track.id) return res.status(400).json({ error: 'Track is required' });
    const likes = await db.addLikedTrack(req.user.id, track);
    res.json({ status: 'success', likes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete(['/api/user/likes/:trackId', '/user/likes/:trackId'], requireAuth, async (req, res) => {
  try {
    const { trackId } = req.params;
    const likes = await db.removeLikedTrack(req.user.id, trackId);
    res.json({ status: 'success', likes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get(['/api/user/playlists', '/user/playlists'], requireAuth, async (req, res) => {
  try {
    const playlists = await db.getPlaylists(req.user.id);
    res.json({ status: 'success', playlists });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post(['/api/user/playlists', '/user/playlists'], requireAuth, async (req, res) => {
  try {
    const playlist = req.body;
    if (!playlist || !playlist.title) return res.status(400).json({ error: 'Playlist title is required' });
    const saved = await db.savePlaylist(req.user.id, playlist);
    res.json({ status: 'success', playlist: saved });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete(['/api/user/playlists/:id', '/user/playlists/:id'], requireAuth, async (req, res) => {
  try {
    const deleted = await db.deletePlaylist(req.user.id, req.params.id);
    res.json({ status: 'success', success: deleted });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get(['/api/user/history', '/user/history'], requireAuth, async (req, res) => {
  try {
    const history = await db.getUserHistory(req.user.id);
    res.json({ status: 'success', history });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete(['/api/user/history', '/user/history'], requireAuth, async (req, res) => {
  try {
    await db.clearUserHistory(req.user.id);
    res.json({ status: 'success', message: 'History cleared' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post(['/api/user/events', '/user/events'], optionalAuth, async (req, res) => {
  try {
    const { events } = req.body;
    const userId = req.user ? req.user.id : 'anon_' + (req.ip || 'client');
    if (Array.isArray(events)) {
      await cloudRecommendationService.processEvents(userId, events);
    }
    res.json({ status: 'success', processed: events?.length || 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post(['/api/user/migrate', '/user/migrate'], requireAuth, async (req, res) => {
  try {
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
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Music Routes
app.get(['/api/music/charts', '/music/charts'], async (req, res) => {
  try {
    const charts = await chartService.getTrending('GLOBAL');
    res.json({ status: 'success', trending: charts.tracks, quickPicks: charts.tracks.slice(0, 10) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get(['/api/music/search', '/music/search'], async (req, res) => {
  try {
    const query = req.query.q;
    const type = req.query.type || 'all';
    if (!query) return res.status(400).json({ error: 'Query parameter q is required' });

    const results = await musicProvider.search(query, type, 30);
    res.json({ status: 'success', query, ...results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get(['/api/music/artist/:name', '/music/artist/:name'], async (req, res) => {
  try {
    const artistName = decodeURIComponent(req.params.name);
    const artistData = await musicProvider.getArtist(artistName);
    if (!artistData) return res.status(404).json({ error: 'Artist not found' });
    res.json({ status: 'success', artist: artistData });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get(['/api/music/album/:id', '/music/album/:id'], async (req, res) => {
  try {
    const albumData = await musicProvider.getAlbum(req.params.id);
    res.json({ status: 'success', album: albumData });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get(['/api/music/stream/:id', '/music/stream/:id'], async (req, res) => {
  try {
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
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get(['/api/music/download/:id', '/music/download/:id'], async (req, res) => {
  try {
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
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get(['/api/music/lyrics', '/music/lyrics'], async (req, res) => {
  try {
    const { track, artist, duration } = req.query;
    if (!track || !artist) return res.status(400).json({ error: 'track and artist required' });

    const lyrics = await musicProvider.getLyrics(track, artist, duration);
    res.json({ status: 'success', ...lyrics });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get(['/api/ads/bundle', '/ads/bundle'], (req, res) => {
  res.json({ status: 'success', version: '1.0', audioAds: [], displayBanners: [] });
});

export default function handler(req, res) {
  return app(req, res);
}
