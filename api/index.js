import express from 'express';
import cors from 'cors';
import axios from 'axios';
import { authService } from '../server/auth/authService.js';
import { requireAuth, optionalAuth } from '../server/auth/authMiddleware.js';
import { db } from '../server/db/schema.js';
import { dbClient } from '../server/db/client.js';
import { chartService } from '../server/charts/chartService.js';
import { cloudRecommendationService } from '../server/recommendations/cloudRecommendationService.js';
import { nextTrackService } from '../server/recommendations/nextTrackService.js';
import { searchSuggestionService } from '../server/catalog/searchSuggestionService.js';
import { trackIdentityManager } from '../server/catalog/trackIdentityManager.js';
import { musicProvider } from '../server/providers/musicProvider.js';

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// App Release Info Endpoint
app.get(['/api/app/release', '/app/release'], (req, res) => {
  res.json({
    status: 'success',
    version: '2.1.0',
    buildNumber: 210,
    apkDownloadUrl: 'https://mrj-music.vercel.app/downloads/mrj-music.apk',
    apkFileName: 'mrj-music-v2.1.0.apk',
    fileSize: '7.8 MB',
    fileSizeBytes: 8178892,
    minAndroidVersion: 'Android 8.0+',
    targetAndroidVersion: 'Android 14',
    engine: 'AndroidX Media3 / ExoPlayer + Foreground MediaSession Service',
    isAvailable: true,
  });
});

// App Update Check Endpoint
app.get(['/api/app/check-update', '/app/check-update'], (req, res) => {
  const clientVersion = req.query.version || '1.0.0';
  const latestVersion = '2.1.0';
  const isUpdateAvailable = clientVersion !== latestVersion;

  res.json({
    status: 'success',
    isUpdateAvailable,
    currentVersion: clientVersion,
    latestVersion,
    buildNumber: 210,
    releaseDate: '2026-08-24',
    title: 'MRJ Music v2.1.0 Production Update',
    changelog: [
      '⚡ True Android Background Audio via AndroidX Media3 & Foreground Service',
      '🎵 Seamless Song / Video Switcher with interactive playback',
      '🎨 Redesigned Premium Dark Interface & Refined Typography Hierarchy',
      '🚀 Up Next dynamic queue improvements and synchronized lyrics',
      '🔒 In-App Silent Update System with FileProvider integration',
      '🛠️ Stream resilience and performance improvements'
    ],
    apkDownloadUrl: 'https://mrj-music.vercel.app/downloads/mrj-music.apk',
    apkFileName: 'mrj-music-v2.1.0.apk',
    fileSize: '7.8 MB',
    fileSizeBytes: 8178892,
    isMandatory: false,
    minAndroidVersion: 'Android 8.0+'
  });
});

// Raw Stream Redirect for Native Players
app.get(['/api/music/stream-raw/:id', '/music/stream-raw/:id'], async (req, res) => {
  try {
    const id = req.params.id;
    const stream = await musicProvider.resolveAudioStream(id);
    if (stream && stream.url && stream.url.startsWith('http') && !stream.url.includes('youtube.com/watch')) {
      return res.redirect(302, stream.url);
    }
    return res.redirect(302, `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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
app.post(['/api/auth/signup-otp', '/auth/signup-otp'], async (req, res) => {
  try {
    const { email, name } = req.body;
    const result = await authService.sendSignupOtp(email, name);
    res.json({ status: 'success', ...result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post(['/api/auth/verify-otp', '/auth/verify-otp'], async (req, res) => {
  try {
    const { email, otp, password, name, ageGroup, gender } = req.body;
    const userAgent = req.headers['user-agent'] || '';
    const ip = req.ip || req.socket.remoteAddress || '';
    const result = await authService.verifySignupOtp(email, otp, password, name, ageGroup, gender, userAgent, ip);
    res.status(201).json({ status: 'success', ...result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post(['/api/auth/register', '/auth/register'], async (req, res) => {
  try {
    const { name, email, password, ageGroup, gender } = req.body;
    const userAgent = req.headers['user-agent'] || '';
    const ip = req.ip || req.socket.remoteAddress || '';
    const result = await authService.register(name, email, password, ageGroup, gender, userAgent, ip);
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

app.get(['/api/charts/categories', '/charts/categories'], async (req, res) => {
  try {
    const categories = chartService.getAllCategories();
    res.json({ status: 'success', categories });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get(['/api/charts/category/:categoryId', '/charts/category/:categoryId'], async (req, res) => {
  try {
    const { categoryId } = req.params;
    const tracks = chartService.getTracksByCategory(categoryId);
    res.json({ status: 'success', categoryId, tracks });
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

app.get(['/api/recommendations/related/:trackId', '/recommendations/related/:trackId'], optionalAuth, async (req, res) => {
  try {
    const { trackId } = req.params;
    const userId = req.user ? req.user.id : null;
    const { artist, genre, title } = req.query;

    const related = await nextTrackService.getNextRecommendations(userId, {
      currentTrack: { id: trackId, artist: artist || '', genre: genre || '', title: title || '' },
    });
    res.json({ status: 'success', tracks: related.tracks });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post(['/api/recommendations/next', '/recommendations/next'], optionalAuth, async (req, res) => {
  try {
    const userId = req.user ? req.user.id : null;
    const { currentTrack, playedTrackIds, currentQueueIds, mood, sessionSearches, tuneConfig, sessionId } = req.body;

    const recommendations = await nextTrackService.getNextRecommendations(userId, {
      currentTrack,
      playedTrackIds,
      currentQueueIds,
      mood,
      sessionSearches,
      tuneConfig,
      sessionId,
    });

    res.json({ status: 'success', ...recommendations });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post(['/api/recommendations/tune', '/recommendations/tune'], optionalAuth, async (req, res) => {
  try {
    const userId = req.user ? req.user.id : null;
    const { sessionId, tuneConfig, currentTrack, currentQueueIds } = req.body;

    const recommendations = await nextTrackService.getNextRecommendations(userId, {
      currentTrack,
      currentQueueIds,
      tuneConfig,
      sessionId,
    });

    res.json({ status: 'success', tuneConfig, ...recommendations });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post(['/api/recommendations/feedback', '/recommendations/feedback'], optionalAuth, async (req, res) => {
  try {
    const userId = req.user ? req.user.id : null;
    const { eventType, track, artist, sessionId } = req.body;

    if (userId && eventType) {
      await cloudRecommendationService.processEvents(userId, [{
        eventType,
        trackId: track?.id,
        artist: artist || track?.artist,
        genre: track?.genre,
        sessionId,
      }]);
    }

    res.json({ status: 'success', eventType, message: 'Recommendation profile updated' });
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

// 4. Search Suggestions & Search History
app.get(['/api/music/suggestions', '/music/suggestions'], optionalAuth, async (req, res) => {
  try {
    const query = req.query.q || '';
    const userId = req.user ? req.user.id : null;
    const region = req.query.region || req.headers['x-mrj-region'] || 'GLOBAL';
    const language = req.query.lang || req.headers['x-mrj-lang'] || 'all';

    const data = await searchSuggestionService.getSuggestions(query, userId, {
      region,
      language,
    });
    res.json({ status: 'success', ...data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get(['/api/user/search-history', '/user/search-history'], requireAuth, async (req, res) => {
  try {
    const history = await db.getSearchHistory(req.user.id);
    res.json({ status: 'success', history });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post(['/api/user/search-history', '/user/search-history'], requireAuth, async (req, res) => {
  try {
    const { query } = req.body;
    if (!query) return res.status(400).json({ error: 'Query is required' });
    const history = await db.addSearchHistory(req.user.id, query);
    res.json({ status: 'success', history });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete(['/api/user/search-history/:query', '/user/search-history/:query'], requireAuth, async (req, res) => {
  try {
    const history = await db.removeSearchHistory(req.user.id, req.params.query);
    res.json({ status: 'success', history });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete(['/api/user/search-history', '/user/search-history'], requireAuth, async (req, res) => {
  try {
    await db.clearSearchHistory(req.user.id);
    res.json({ status: 'success', history: [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. User Data Routes
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

// 6. Music Routes
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
    if (!albumData) return res.status(404).json({ error: 'Album not found' });
    res.json({ status: 'success', album: albumData });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get(['/api/music/resolve-source', '/music/resolve-source'], async (req, res) => {
  try {
    const { id, title, artist, duration, format = 'audio' } = req.query;
    if (!id && !title) {
      return res.status(400).json({ error: 'id or title parameter is required' });
    }

    const canonicalTrack = {
      id: id || trackIdentityManager.generateCanonicalTrackId(title, artist),
      canonicalTrackId: id || trackIdentityManager.generateCanonicalTrackId(title, artist),
      title: title || (id ? id.split('|')[0].replace(/-/g, ' ') : 'Song'),
      artist: artist || (id && id.includes('|') ? id.split('|')[1].replace(/-/g, ' ') : ''),
      duration: duration ? Number(duration) : 210,
    };

    const source = await trackIdentityManager.fetchAndResolveSource(canonicalTrack, format);

    if (source) {
      return res.json({
        status: 'success',
        canonicalTrackId: canonicalTrack.canonicalTrackId,
        source,
      });
    }

    return res.status(404).json({
      status: 'error',
      code: 'SOURCE_IDENTITY_MISMATCH',
      canonicalTrackId: canonicalTrack.canonicalTrackId,
      message: 'No verified playback source found matching this canonical track',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get(['/api/music/stream/:id', '/music/stream/:id'], async (req, res) => {
  try {
    const id = req.params.id;
    let videoId = id;

    // If id is a canonical track ID, resolve its verified playback source
    if (id.includes('|')) {
      const parts = id.split('|');
      const title = parts[0].replace(/-/g, ' ');
      const artist = parts[1] ? parts[1].replace(/-/g, ' ') : '';
      const searchRes = await musicProvider.search(`${title} ${artist}`, 'songs', 5);
      const topSong = searchRes.songs[0];
      if (topSong && topSong.providerTrackId) {
        videoId = topSong.providerTrackId;
      }
    }

    const stream = await musicProvider.resolveAudioStream(videoId);

    if (stream) {
      return res.json({
        status: 'success',
        canonicalTrackId: id,
        videoId,
        streamUrl: stream.url,
        mimeType: stream.mimeType,
        codec: stream.codec,
        bitrate: stream.bitrate || 'Quality information unavailable',
        sampleRate: stream.sampleRate,
        expiresAt: stream.expiresAt,
        provider: stream.provider,
      });
    }

    res.json({
      status: 'online_only',
      canonicalTrackId: id,
      videoId,
      streamUrl: `https://www.youtube.com/watch?v=${videoId}`,
      mimeType: 'audio/webm',
      codec: 'opus',
      bitrate: 'Quality information unavailable',
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
