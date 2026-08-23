import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Persistent Database storage for Node server / serverless
const DB_FILE_PATH = path.resolve(process.cwd(), 'server', 'db', 'mrj_cloud_database.json');

// Ensure parent dir exists
try {
  const dir = path.dirname(DB_FILE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
} catch {}

let dbMemory = {
  users: {},
  sessions: {},
  password_reset_tokens: {},
  user_settings: {},
  taste_profiles: {},
  listening_events: [],
  liked_tracks: {},
  playlists: {},
  search_history: {},
};

// Load initial database from disk
try {
  if (fs.existsSync(DB_FILE_PATH)) {
    const raw = fs.readFileSync(DB_FILE_PATH, 'utf-8');
    dbMemory = { ...dbMemory, ...JSON.parse(raw) };
  }
} catch (e) {
  console.warn('DB load warning, starting fresh in-memory:', e);
}

const persistDB = () => {
  try {
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(dbMemory, null, 2), 'utf-8');
  } catch {}
};

export const db = {
  // 1. Users
  findUserByEmail(email) {
    if (!email) return null;
    const normalized = email.trim().toLowerCase();
    return Object.values(dbMemory.users).find(u => u.email.toLowerCase() === normalized) || null;
  },

  findUserById(id) {
    return dbMemory.users[id] || null;
  },

  createUser(userData) {
    const now = Date.now();
    const user = {
      id: userData.id,
      name: userData.name.trim(),
      email: userData.email.trim().toLowerCase(),
      password_hash: userData.password_hash,
      created_at: now,
      updated_at: now,
      last_login_at: now,
      is_active: true,
    };
    dbMemory.users[user.id] = user;

    // Initialize taste profile
    dbMemory.taste_profiles[user.id] = {
      userId: user.id,
      preferredArtists: {},
      preferredGenres: {},
      preferredMoods: {},
      skipRate: 0,
      completionRate: 1,
      totalPlays: 0,
      totalSkips: 0,
      totalCompletions: 0,
      likedArtists: [],
      dislikedArtists: [],
      likedGenres: [],
      dislikedGenres: [],
      recentSeeds: [],
      updatedAt: now,
    };

    // Initialize user settings
    dbMemory.user_settings[user.id] = {
      audioQuality: 'high',
      autoplayRadio: true,
      theme: 'oled-dark',
      smartDownloads: {
        enabled: true,
        maxTracks: 20,
        storageLimitMB: 500,
        wifiOnly: true,
      },
    };

    dbMemory.liked_tracks[user.id] = [];
    dbMemory.playlists[user.id] = [];
    dbMemory.search_history[user.id] = [];

    persistDB();
    return user;
  },

  updateUser(id, updates) {
    const user = dbMemory.users[id];
    if (!user) return null;
    if (updates.name) user.name = updates.name.trim();
    if (updates.password_hash) user.password_hash = updates.password_hash;
    if (updates.last_login_at) user.last_login_at = updates.last_login_at;
    user.updated_at = Date.now();
    persistDB();
    return user;
  },

  deleteUser(id) {
    delete dbMemory.users[id];
    delete dbMemory.user_settings[id];
    delete dbMemory.taste_profiles[id];
    delete dbMemory.liked_tracks[id];
    delete dbMemory.playlists[id];
    delete dbMemory.search_history[id];
    dbMemory.listening_events = dbMemory.listening_events.filter(e => e.userId !== id);
    persistDB();
    return true;
  },

  // 2. Password Reset
  createPasswordResetToken(userId) {
    const token = crypto.randomBytes(32).toString('hex');
    dbMemory.password_reset_tokens[token] = {
      token,
      userId,
      expires_at: Date.now() + 3600000, // 1 hour
      used: false,
    };
    persistDB();
    return token;
  },

  validateResetToken(token) {
    const record = dbMemory.password_reset_tokens[token];
    if (!record || record.used || record.expires_at < Date.now()) {
      return null;
    }
    return record.userId;
  },

  markResetTokenUsed(token) {
    if (dbMemory.password_reset_tokens[token]) {
      dbMemory.password_reset_tokens[token].used = true;
      persistDB();
    }
  },

  // 3. User Settings
  getUserSettings(userId) {
    return dbMemory.user_settings[userId] || {
      audioQuality: 'high',
      autoplayRadio: true,
      theme: 'oled-dark',
    };
  },

  updateUserSettings(userId, settings) {
    dbMemory.user_settings[userId] = {
      ...this.getUserSettings(userId),
      ...settings,
    };
    persistDB();
    return dbMemory.user_settings[userId];
  },

  // 4. Taste Profiles
  getTasteProfile(userId) {
    if (!dbMemory.taste_profiles[userId]) {
      dbMemory.taste_profiles[userId] = {
        userId,
        preferredArtists: {},
        preferredGenres: {},
        preferredMoods: {},
        skipRate: 0,
        completionRate: 1,
        totalPlays: 0,
        totalSkips: 0,
        totalCompletions: 0,
        likedArtists: [],
        dislikedArtists: [],
        likedGenres: [],
        dislikedGenres: [],
        recentSeeds: [],
        updatedAt: Date.now(),
      };
    }
    return dbMemory.taste_profiles[userId];
  },

  saveTasteProfile(userId, profile) {
    dbMemory.taste_profiles[userId] = { ...profile, updatedAt: Date.now() };
    persistDB();
    return dbMemory.taste_profiles[userId];
  },

  // 5. Listening Events
  addEvents(userId, events) {
    if (!Array.isArray(events)) return [];
    const formatted = events.map(e => ({
      id: e.id || 'evt_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      userId,
      trackId: e.trackId,
      title: e.title || '',
      artist: e.artist || '',
      album: e.album || '',
      thumbnail: e.thumbnail || '',
      eventType: e.eventType,
      timestamp: e.timestamp || Date.now(),
      duration: e.duration || 0,
      listenedSeconds: e.listenedSeconds || 0,
      completionPercent: e.completionPercent || 0,
      skipped: !!e.skipped,
      source: e.source || 'player',
    }));

    dbMemory.listening_events.push(...formatted);

    // Limit in-memory history to last 5000 events
    if (dbMemory.listening_events.length > 5000) {
      dbMemory.listening_events = dbMemory.listening_events.slice(-5000);
    }

    persistDB();
    return formatted;
  },

  getUserHistory(userId) {
    const events = dbMemory.listening_events
      .filter(e => e.userId === userId && (e.eventType === 'PLAY_STARTED' || e.eventType === 'PLAY_COMPLETED'))
      .sort((a, b) => b.timestamp - a.timestamp);

    return events.slice(0, 100);
  },

  clearUserHistory(userId) {
    dbMemory.listening_events = dbMemory.listening_events.filter(e => e.userId !== userId);
    persistDB();
    return true;
  },

  removeHistoryEvent(userId, eventId) {
    dbMemory.listening_events = dbMemory.listening_events.filter(e => !(e.userId === userId && e.id === eventId));
    persistDB();
    return true;
  },

  // 6. Liked Tracks
  getLikedTracks(userId) {
    return dbMemory.liked_tracks[userId] || [];
  },

  addLikedTrack(userId, track) {
    if (!dbMemory.liked_tracks[userId]) dbMemory.liked_tracks[userId] = [];
    const exists = dbMemory.liked_tracks[userId].some(t => t.id === track.id);
    if (!exists) {
      dbMemory.liked_tracks[userId].unshift({
        id: track.id,
        title: track.title,
        artist: track.artist,
        album: track.album,
        thumbnail: track.thumbnail,
        duration: track.duration || 210,
        likedAt: Date.now(),
      });
      persistDB();
    }
    return dbMemory.liked_tracks[userId];
  },

  removeLikedTrack(userId, trackId) {
    if (!dbMemory.liked_tracks[userId]) return [];
    dbMemory.liked_tracks[userId] = dbMemory.liked_tracks[userId].filter(t => t.id !== trackId);
    persistDB();
    return dbMemory.liked_tracks[userId];
  },

  // 7. Playlists
  getPlaylists(userId) {
    return dbMemory.playlists[userId] || [];
  },

  getPlaylist(userId, playlistId) {
    const userPlaylists = dbMemory.playlists[userId] || [];
    return userPlaylists.find(p => p.id === playlistId) || null;
  },

  savePlaylist(userId, playlist) {
    if (!dbMemory.playlists[userId]) dbMemory.playlists[userId] = [];
    const index = dbMemory.playlists[userId].findIndex(p => p.id === playlist.id);
    if (index >= 0) {
      dbMemory.playlists[userId][index] = {
        ...playlist,
        userId,
        updatedAt: Date.now(),
      };
    } else {
      dbMemory.playlists[userId].unshift({
        id: playlist.id || 'pl_' + Date.now(),
        userId,
        title: playlist.title,
        description: playlist.description || '',
        thumbnail: playlist.thumbnail || '',
        trackCount: playlist.tracks?.length || 0,
        tracks: playlist.tracks || [],
        createdAt: playlist.createdAt || Date.now(),
        updatedAt: Date.now(),
      });
    }
    persistDB();
    return playlist;
  },

  deletePlaylist(userId, playlistId) {
    if (!dbMemory.playlists[userId]) return false;
    dbMemory.playlists[userId] = dbMemory.playlists[userId].filter(p => p.id !== playlistId);
    persistDB();
    return true;
  },
};
