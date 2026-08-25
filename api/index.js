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
import { mlIntelligenceEngine } from '../server/recommendations/mlIntelligenceEngine.js';
import { viralTrendService } from '../server/recommendations/viralTrendService.js';
import { predictiveSearchEngine } from '../server/recommendations/predictiveSearchEngine.js';
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

// Web & Android Version Check — returns latest version 3.17.0 with direct APK link
app.get(['/version.json', '/api/version.json'], (req, res) => {
  res.json({
    version: '3.17.0',
    build: '322',
    updatedAt: '2026-08-26T00:00:00Z',
    latestVersion: '3.17.0',
    isUpdateAvailable: true,
    apkDownloadUrl: 'https://github.com/Rahul16112001/mrj-music/releases/download/v3.17.0/mrj-music-v3.17.0.apk',
    apkFileName: 'mrj-music-v3.17.0.apk',
    downloadUrl: 'https://github.com/Rahul16112001/mrj-music/releases/download/v3.17.0/mrj-music-v3.17.0.apk',
    fileSize: '111 MB',
    fileSizeBytes: 116703707,
    sha256: '391ef328e35fbba19b544faea65247b366d3c98e3fb5d7fbd22ddcf81ea22de4',
    title: 'MRJ Music v3.17.0 Smart Downloads, AI Up Next Queue & Fuzzy Search',
    changelog: [
      '⚡ YouTube Music-Style Smart Downloads & Offline Vault Engine with WiFi-only auto-sync',
      '🧠 Dynamic Deep AI/ML Up Next Queue Generator with Zero Duplicate Track filtering',
      '🔍 Real-Time Fuzzy Search & Typo Auto-Correction Engine with Google/Spotify-style intent predictions',
      '🎛️ Native 5-Band Equalizer, Sub-Bass Boost & 3D Spatializer with presets',
      '🎨 Dynamic Palette Morphing Player & 4-Way Swipe Player Gestures'
    ]
  });
});

// App Release Info Endpoint
app.get(['/api/app/release', '/app/release'], (req, res) => {
  res.json({
    status: 'success',
    web: {
      version: '3.17.0',
      build: '322',
      updatedAt: '2026-08-26T00:00:00Z',
    },
    android: {
      versionName: '3.17.0',
      versionCode: 322,
      apkDownloadUrl: 'https://github.com/Rahul16112001/mrj-music/releases/download/v3.17.0/mrj-music-v3.17.0.apk',
      apkFileName: 'mrj-music-v3.17.0.apk',
      fileSize: '111 MB',
      fileSizeBytes: 116703707,
      minAndroidVersion: 'Android 8.0+',
      targetAndroidVersion: 'Android 14',
      sha256: '391ef328e35fbba19b544faea65247b366d3c98e3fb5d7fbd22ddcf81ea22de4',
      engine: 'Native Kotlin + Jetpack Compose + AndroidX Media3 ExoPlayer',
      isAvailable: true,
      releaseNotes: [
        '⚡ YouTube Music-Style Smart Downloads & Offline Vault Engine with WiFi-only auto-sync',
        '🧠 Dynamic Deep AI/ML Up Next Queue Generator with Zero Duplicate Track filtering',
        '🔍 Real-Time Fuzzy Search & Typo Auto-Correction Engine with Google/Spotify-style intent predictions',
        '🎛️ Native 5-Band Equalizer, Sub-Bass Boost & 3D Spatializer with presets',
        '🎨 Dynamic Palette Morphing Player & 4-Way Swipe Player Gestures'
      ],
      releaseDate: '2026-08-26',
      isMandatory: false,
    },
  });
});

// App Update Check Endpoint — returns platform-specific data
app.get(['/api/app/check-update', '/app/check-update'], (req, res) => {
  const platform = (req.headers['x-mrj-platform'] || req.query.platform || '').toString().toLowerCase();
  const clientVersion = (req.query.version || '1.0.0').toString().trim();
  const latestVersion = '3.17.0';
  const latestVersionCode = 322;
  const isUpdateAvailable = clientVersion !== latestVersion;

  res.json({
    status: 'success',
    platform: platform || 'android',
    isUpdateAvailable,
    currentVersion: clientVersion,
    latestVersion,
    versionCode: latestVersionCode,
    releaseDate: '2026-08-26',
    title: 'MRJ Music v3.17.0 Smart Downloads, AI Up Next Queue & Fuzzy Search',
    changelog: [
      '⚡ YouTube Music-Style Smart Downloads & Offline Vault Engine with WiFi-only auto-sync',
      '🧠 Dynamic Deep AI/ML Up Next Queue Generator with Zero Duplicate Track filtering',
      '🔍 Real-Time Fuzzy Search & Typo Auto-Correction Engine with Google/Spotify-style intent predictions',
      '🎛️ Native 5-Band Equalizer, Sub-Bass Boost & 3D Spatializer with presets',
      '🎨 Dynamic Palette Morphing Player & 4-Way Swipe Player Gestures'
    ],
    apkDownloadUrl: 'https://github.com/Rahul16112001/mrj-music/releases/download/v3.17.0/mrj-music-v3.17.0.apk',
    apkFileName: 'mrj-music-v3.17.0.apk',
    fileSize: '111 MB',
    fileSizeBytes: 116703707,
    sha256: '391ef328e35fbba19b544faea65247b366d3c98e3fb5d7fbd22ddcf81ea22de4',
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

app.get(['/api/charts/category/:categoryId', '/charts/category/:categoryId'], optionalAuth, async (req, res) => {
  try {
    const { categoryId } = req.params;
    const userId = req.user ? req.user.id : null;
    const tracks = await chartService.getTracksByCategory(categoryId, userId);
    res.json({ status: 'success', categoryId, tracks });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Recommendation Routes
app.get(['/api/home/dashboard', '/api/recommendations/home', '/recommendations/home', '/api/music/personalized-home', '/music/personalized-home'], optionalAuth, async (req, res) => {
  try {
    const userId = req.user ? req.user.id : req.query.userId || null;
    const country = req.query.country || req.headers['x-country-code'] || 'IN';
    const localHour = req.query.localHour !== undefined ? Number(req.query.localHour) : new Date().getHours();

    let greeting = 'Welcome to MRJ Music';
    let circadianTitle = 'Late Night Vibes';
    let circadianSubtitle = 'Calm Lo-Fi & Midnight Chill';
    if (localHour >= 5 && localHour < 12) {
      greeting = 'Good morning';
      circadianTitle = 'Morning Focus & Acoustic';
      circadianSubtitle = 'Fresh tunes to kickstart your day';
    } else if (localHour >= 12 && localHour < 17) {
      greeting = 'Good afternoon';
      circadianTitle = 'Afternoon Energy & Hits';
      circadianSubtitle = 'Upbeat rhythm for your workday & drive';
    } else if (localHour >= 17 && localHour < 22) {
      greeting = 'Good evening';
      circadianTitle = 'Evening Groove & Hits';
      circadianSubtitle = 'Party, pop & high-energy beats';
    }

    const [dailyMixesRes, viralReels, charts, userProfile, userLiked, userHistory] = await Promise.all([
      mlIntelligenceEngine.generateDailyMixes(userId, country),
      viralTrendService.getViralReelsTracks(country, 15),
      chartService.getTrending(country),
      userId ? db.getUserById(userId) : Promise.resolve(null),
      userId ? db.getLikedTracks(userId) : Promise.resolve([]),
      userId ? db.getUserHistory(userId) : Promise.resolve([]),
    ]);

    const combinedRaw = [
      ...userLiked,
      ...userHistory,
      ...(charts.tracks || []),
    ];
    const uniqueQuickPicks = [];
    const seenQuick = new Set();
    for (const t of combinedRaw) {
      if (!t || !t.id || seenQuick.has(t.id)) continue;
      seenQuick.add(t.id);
      uniqueQuickPicks.push(t);
      if (uniqueQuickPicks.length >= 8) break;
    }

    const artists = [
      { id: '1', name: 'Arijit Singh', category: 'Bollywood', followerCount: '45M+ Fans', image: 'https://c.saavncdn.com/artists/Arijit_Singh_002_20230323062147_500x500.jpg' },
      { id: '2', name: 'Karan Aujla', category: 'Punjabi', followerCount: '18M+ Fans', image: 'https://c.saavncdn.com/artists/Karan_Aujla_003_20230622081014_500x500.jpg' },
      { id: '3', name: 'Diljit Dosanjh', category: 'Punjabi', followerCount: '24M+ Fans', image: 'https://c.saavncdn.com/artists/Diljit_Dosanjh_004_20221007180447_500x500.jpg' },
      { id: '4', name: 'Shreya Ghoshal', category: 'Bollywood', followerCount: '30M+ Fans', image: 'https://c.saavncdn.com/artists/Shreya_Ghoshal_003_20221118090547_500x500.jpg' },
      { id: '5', name: 'Sidhu Moose Wala', category: 'Punjabi Legend', followerCount: '28M+ Fans', image: 'https://c.saavncdn.com/artists/Sidhu_Moose_Wala_003_20230613093228_500x500.jpg' },
      { id: '6', name: 'The Weeknd', category: 'Global Pop', followerCount: '110M+ Fans', image: 'https://i.scdn.co/image/ab6761610000e5eb214f3cf1cbe7139c1e26ffbb' },
      { id: '7', name: 'Taylor Swift', category: 'Global Pop', followerCount: '115M+ Fans', image: 'https://i.scdn.co/image/ab6761610000e5eb5a00969a4698c3132a15fbb0' },
      { id: '8', name: 'Anirudh Ravichander', category: 'South Mass', followerCount: '16M+ Fans', image: 'https://c.saavncdn.com/artists/Anirudh_Ravichander_003_20230914101416_500x500.jpg' },
    ];

    res.json({
      status: 'success',
      greeting,
      userName: userProfile?.name || 'Listener',
      userAvatar: userProfile?.avatar || null,
      userEmail: userProfile?.email || null,
      circadianSection: {
        title: circadianTitle,
        subtitle: circadianSubtitle,
        tracks: (charts.tracks || []).slice(0, 10),
      },
      quickPicks: uniqueQuickPicks,
      dailyMixes: dailyMixesRes.dailyMixes || [],
      viralReels: viralReels || [],
      trendingArtists: artists,
    });
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

// ==================== DEEP ML DYNAMIC QUEUE & PERSONALIZATION ====================

// 1. Real-Time Dynamic Autoplay Queue (20-30 Acoustically Harmonized Transition Tracks)
app.post(['/api/recommendations/dynamic-queue', '/recommendations/dynamic-queue'], optionalAuth, async (req, res) => {
  try {
    const userId = req.user ? req.user.id : null;
    const {
      currentTrack,
      playedTrackIds,
      currentQueueIds,
      countryCode,
      localHour,
      sessionId,
      isEarlySkip,
    } = req.body;

    const queueData = await mlIntelligenceEngine.generateDynamicQueue(userId, {
      currentTrack,
      playedTrackIds,
      currentQueueIds,
      countryCode: countryCode || req.headers['x-country-code'] || 'IN',
      localHour: localHour !== undefined ? Number(localHour) : null,
      sessionId,
      isEarlySkip: !!isEarlySkip,
    });

    res.json(queueData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. AI Daily Mixes (4 Clustered Personalized Mixes)
app.get(['/api/recommendations/daily-mixes', '/recommendations/daily-mixes'], optionalAuth, async (req, res) => {
  try {
    const userId = req.user ? req.user.id : null;
    const countryCode = req.query.country || req.headers['x-country-code'] || 'IN';
    const mixes = await mlIntelligenceEngine.generateDailyMixes(userId, countryCode);
    res.json(mixes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Viral Reels & Social Trending Sounds
app.get(['/api/recommendations/viral-reels', '/recommendations/viral-reels'], async (req, res) => {
  try {
    const countryCode = req.query.country || req.headers['x-country-code'] || 'IN';
    const limit = Number(req.query.limit) || 20;
    const tracks = await viralTrendService.getViralReelsTracks(countryCode, limit);
    res.json({ status: 'success', country: countryCode, count: tracks.length, tracks });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 4. PREDICTIVE SEARCH & NEXT-KEY INTENT ENGINE
// ==========================================

app.get('/api/search/predictive', optionalAuth, async (req, res) => {
  try {
    const query = req.query.q || '';
    const country = req.query.country || req.headers['x-country-code'] || 'IN';
    const userId = req.user ? req.user.id : req.query.userId || null;
    const results = await predictiveSearchEngine.predictIntent(query, country, userId);
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/search/trending-keywords', async (req, res) => {
  try {
    const country = req.query.country || req.headers['x-country-code'] || 'IN';
    const keywords = predictiveSearchEngine.getTrendingKeywords(country);
    res.json({ status: 'success', country, keywords });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/search/categorized', optionalAuth, async (req, res) => {
  try {
    const query = req.query.q || '';
    const category = req.query.category || 'all';
    const country = req.query.country || req.headers['x-country-code'] || 'IN';
    const userId = req.user ? req.user.id : req.query.userId || null;
    const results = await predictiveSearchEngine.searchCategorized(query, category, country, userId);
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 5. SEARCH SUGGESTIONS & SEARCH HISTORY
// ==========================================

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

app.get(['/api/user/playlists/:id', '/user/playlists/:id'], requireAuth, async (req, res) => {
  try {
    const playlist = await db.getPlaylist(req.user.id, req.params.id);
    if (!playlist) return res.status(404).json({ error: 'Playlist not found' });
    res.json({ status: 'success', playlist });
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

app.put(['/api/user/playlists/:id', '/user/playlists/:id'], requireAuth, async (req, res) => {
  try {
    const { title, description } = req.body;
    if (!title) return res.status(400).json({ error: 'Playlist title is required' });
    const updated = await db.updatePlaylistMeta(req.user.id, req.params.id, { title, description });
    res.json({ status: 'success', playlist: updated });
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

app.post(['/api/user/playlists/:id/tracks', '/user/playlists/:id/tracks'], requireAuth, async (req, res) => {
  try {
    const track = req.body.track || req.body;
    if (!track || !track.id || !track.title) {
      return res.status(400).json({ error: 'Valid track object (with id & title) is required' });
    }
    const updated = await db.addTrackToPlaylist(req.user.id, req.params.id, track);
    res.json({ status: 'success', playlist: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete(['/api/user/playlists/:id/tracks/:trackId', '/user/playlists/:id/tracks/:trackId'], requireAuth, async (req, res) => {
  try {
    const updated = await db.removeTrackFromPlaylist(req.user.id, req.params.id, req.params.trackId);
    res.json({ status: 'success', playlist: updated });
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
