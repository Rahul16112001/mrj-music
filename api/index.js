import express from 'express';
import cors from 'cors';
import axios from 'axios';
import { authService } from '../server/auth/authService.js';
import { requireAuth, optionalAuth } from '../server/auth/authMiddleware.js';
import { db } from '../server/db/schema.js';
import { dbClient } from '../server/db/client.js';
import { runMigrations } from '../server/db/migrate.js';
import { chartService } from '../server/charts/chartService.js';
import { cloudRecommendationService } from '../server/recommendations/cloudRecommendationService.js';
import { nextTrackService } from '../server/recommendations/nextTrackService.js';
import { searchSuggestionService } from '../server/catalog/searchSuggestionService.js';
import { trackIdentityManager } from '../server/catalog/trackIdentityManager.js';
import { musicProvider } from '../server/providers/musicProvider.js';

authService.validateEnv();
runMigrations().catch(err => console.error('Migration notice:', err.message));

const ALLOWED_ORIGINS = [
  'https://mrj-music.vercel.app',
  'https://www.mrj-music.vercel.app',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:5005',
];

const app = express();

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin) || origin.startsWith('http://localhost:')) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

// Lightweight in-memory rate limiter for auth routes
const authRateMap = new Map();
const authRateLimiter = (maxReqs = 20, windowMs = 15 * 60 * 1000) => (req, res, next) => {
  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'client';
  const now = Date.now();
  const history = (authRateMap.get(ip) || []).filter(t => now - t < windowMs);
  if (history.length >= maxReqs) {
    return res.status(429).json({ error: 'Too many authentication attempts. Please try again later.' });
  }
  history.push(now);
  authRateMap.set(ip, history);
  next();
};

// Web & Android Version Check — returns latest version 3.3.0 with direct APK link
app.get(['/version.json', '/api/version.json'], (req, res) => {
  res.json({
    version: '3.3.0',
    build: '303',
    updatedAt: '2026-08-25T00:00:00Z',
    latestVersion: '3.3.0',
    isUpdateAvailable: true,
    apkDownloadUrl: 'https://github.com/Rahul16112001/mrj-music/releases/download/v3.3.0/mrj-music-v3.3.0.apk',
    apkFileName: 'mrj-music-v3.3.0.apk',
    downloadUrl: 'https://github.com/Rahul16112001/mrj-music/releases/download/v3.3.0/mrj-music-v3.3.0.apk',
    title: 'MRJ Music v3.3.0 Update',
    changelog: [
      '🚀 Connected with all cloud backend services & scrapers',
      '⚡ Instant search suggestions with debounced query resolution',
      '🎵 Complete song streaming & unplayable track auto-recovery',
      '🔄 Continuous smart autoplay recommendations engine',
      '☁️ Cloud library & favorites synchronization'
    ]
  });
});

// App Release Info Endpoint
app.get(['/api/app/release', '/app/release'], (req, res) => {
  res.json({
    status: 'success',
    web: {
      version: '3.3.0',
      build: '303',
      updatedAt: '2026-08-25T00:00:00Z',
    },
    android: {
      versionName: '3.3.0',
      versionCode: 303,
      apkDownloadUrl: 'https://github.com/Rahul16112001/mrj-music/releases/download/v3.3.0/mrj-music-v3.3.0.apk',
      apkFileName: 'mrj-music-v3.3.0.apk',
      fileSize: '111 MB',
      fileSizeBytes: 116386039,
      minAndroidVersion: 'Android 8.0+',
      targetAndroidVersion: 'Android 14',
      sha256: 'c6aac4e8c8e2fd9a559899cabd4d259d00020c1040b53ff8e2d2598cbd3d45d2',
      engine: 'Native Kotlin + Jetpack Compose + AndroidX Media3 ExoPlayer',
      isAvailable: true,
      releaseNotes: [
        '🚀 Connected with all cloud backend services & scrapers',
        '⚡ Instant search suggestions with debounced query resolution',
        '🎵 Complete song streaming & unplayable track auto-recovery',
        '🔄 Continuous smart autoplay recommendations engine',
        '☁️ Cloud library & favorites synchronization'
      ],
      releaseDate: '2026-08-25',
      isMandatory: false,
    },
  });
});

// App Update Check Endpoint — returns platform-specific data
app.get(['/api/app/check-update', '/app/check-update'], (req, res) => {
  const platform = (req.headers['x-mrj-platform'] || req.query.platform || '').toString().toLowerCase();
  const clientVersion = (req.query.version || '1.0.0').toString().trim();
  const latestVersion = '3.3.0';
  const latestVersionCode = 303;
  const isUpdateAvailable = clientVersion !== latestVersion;

  res.json({
    status: 'success',
    platform: platform || 'android',
    isUpdateAvailable,
    currentVersion: clientVersion,
    latestVersion,
    versionCode: latestVersionCode,
    releaseDate: '2026-08-25',
    title: 'MRJ Music v3.3.0 Full Cloud Connected Release',
    changelog: [
      '🚀 Connected with all cloud backend services & scrapers',
      '⚡ Instant search suggestions with debounced query resolution',
      '🎵 Complete song streaming & unplayable track auto-recovery',
      '🔄 Continuous smart autoplay recommendations engine',
      '☁️ Cloud library & favorites synchronization'
    ],
    apkDownloadUrl: 'https://github.com/Rahul16112001/mrj-music/releases/download/v3.3.0/mrj-music-v3.3.0.apk',
    apkFileName: 'mrj-music-v3.3.0.apk',
    fileSize: '111 MB',
    fileSizeBytes: 116386039,
    sha256: 'c6aac4e8c8e2fd9a559899cabd4d259d00020c1040b53ff8e2d2598cbd3d45d2',
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
    return res.status(404).json({
      status: 'unavailable',
      message: 'Direct audio stream unavailable for this track.',
      videoId: id,
    });
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

// 1. Auth Routes with Rate Limiting
app.post(['/api/auth/signup-otp', '/auth/signup-otp'], authRateLimiter(10, 15 * 60 * 1000), async (req, res) => {
  try {
    const { email, name } = req.body;
    const result = await authService.sendSignupOtp(email, name);
    res.json({ status: 'success', ...result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post(['/api/auth/verify-otp', '/auth/verify-otp'], authRateLimiter(10, 15 * 60 * 1000), async (req, res) => {
  try {
    const { email, otp, password, name, ageGroup, gender } = req.body;
    const userAgent = req.headers['user-agent'] || '';
    const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '';
    const result = await authService.verifySignupOtp(email, otp, password, name, ageGroup, gender, userAgent, ip);
    res.status(201).json({ status: 'success', ...result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Dev-only: retrieve OTP from DB (auto-disabled when RESEND_API_KEY is set)
app.get(['/api/auth/dev-otp', '/auth/dev-otp'], async (req, res) => {
  if (process.env.RESEND_API_KEY) {
    return res.status(403).json({ error: 'Not available when email service is configured.' });
  }
  try {
    const email = (req.query.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ error: 'email query param required' });
    const r = await dbClient.query('SELECT otp, expires_at FROM signup_otps WHERE email=$1 LIMIT 1;', [email]);
    if (!r.rows[0]) return res.status(404).json({ error: 'No OTP found — try signing up first.' });
    res.json({ otp: r.rows[0].otp, expiresAt: r.rows[0].expires_at });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post(['/api/auth/register', '/auth/register'], authRateLimiter(10, 15 * 60 * 1000), async (req, res) => {
  try {
    const { name, email, password, ageGroup, gender } = req.body;
    const userAgent = req.headers['user-agent'] || '';
    const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '';
    const result = await authService.register(name, email, password, ageGroup, gender, userAgent, ip);
    res.status(201).json({ status: 'success', ...result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post(['/api/auth/login', '/auth/login'], authRateLimiter(20, 15 * 60 * 1000), async (req, res) => {
  try {
    const { email, password } = req.body;
    const userAgent = req.headers['user-agent'] || '';
    const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '';
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
app.get(['/api/recommendations/home', '/recommendations/home', '/api/music/personalized-home', '/music/personalized-home'], optionalAuth, async (req, res) => {
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

export default app;
