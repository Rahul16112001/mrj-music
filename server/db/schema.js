import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Production database path (persistent storage)
const DB_FILE_PATH = path.resolve(process.cwd(), 'server', 'db', 'mrj_production_database.json');

try {
  const dir = path.dirname(DB_FILE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
} catch {}

let dbMemory = {
  users: {},
  sessions: {},
  refresh_tokens: {},
  password_reset_tokens: {},
  taste_profiles: {},
  listening_events: [],
  liked_tracks: {},
  playlists: {},
  playlist_tracks: {},
  saved_albums: {},
  followed_artists: {},
  search_history: {},
  user_settings: {},
  sync_operations: [],
};

// Load initial database from disk
try {
  if (fs.existsSync(DB_FILE_PATH)) {
    const raw = fs.readFileSync(DB_FILE_PATH, 'utf-8');
    dbMemory = { ...dbMemory, ...JSON.parse(raw) };
  }
} catch (e) {
  console.warn('DB load warning, starting fresh:', e);
}

const persistDB = () => {
  try {
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(dbMemory, null, 2), 'utf-8');
  } catch (e) {
    console.warn('DB persist notice:', e);
  }
};

export const db = {
  // ==================== 1. USERS & CONSTRAINTS ====================
  findUserByEmail(email) {
    if (!email) return null;
    const normalized = email.trim().toLowerCase();
    return Object.values(dbMemory.users).find(u => u.email.toLowerCase() === normalized && u.is_active) || null;
  },

  findUserById(id) {
    const user = dbMemory.users[id];
    return user && user.is_active ? user : null;
  },

  createUser(userData) {
    const normalizedEmail = userData.email.trim().toLowerCase();
    const existing = Object.values(dbMemory.users).find(u => u.email.toLowerCase() === normalizedEmail && u.is_active);
    if (existing) {
      throw new Error('A user with this email address already exists.');
    }

    const now = Date.now();
    const user = {
      id: userData.id || 'usr_' + crypto.randomUUID(),
      name: userData.name.trim(),
      email: normalizedEmail,
      password_hash: userData.password_hash,
      created_at: now,
      updated_at: now,
      last_login_at: now,
      is_active: true,
    };
    dbMemory.users[user.id] = user;

    // Initialize related relational records
    dbMemory.taste_profiles[user.id] = {
      user_id: user.id,
      preferred_artists: {},
      preferred_genres: {},
      preferred_moods: {},
      skip_rate: 0,
      completion_rate: 1,
      total_plays: 0,
      total_skips: 0,
      total_completions: 0,
      liked_artists: [],
      disliked_artists: [],
      liked_genres: [],
      disliked_genres: [],
      recent_seeds: [],
      updated_at: now,
    };

    dbMemory.user_settings[user.id] = {
      user_id: user.id,
      audio_quality: 'high',
      autoplay_radio: true,
      theme: 'oled-dark',
      smart_downloads: {
        enabled: true,
        maxTracks: 20,
        storageLimitMB: 500,
        wifiOnly: true,
      },
      updated_at: now,
    };

    dbMemory.liked_tracks[user.id] = [];
    dbMemory.playlists[user.id] = [];
    dbMemory.search_history[user.id] = [];

    persistDB();
    return user;
  },

  updateUser(id, updates) {
    const user = dbMemory.users[id];
    if (!user || !user.is_active) return null;
    if (updates.name) user.name = updates.name.trim();
    if (updates.password_hash) user.password_hash = updates.password_hash;
    if (updates.last_login_at) user.last_login_at = updates.last_login_at;
    user.updated_at = Date.now();
    persistDB();
    return user;
  },

  deleteUser(id) {
    if (dbMemory.users[id]) {
      dbMemory.users[id].is_active = false;
      delete dbMemory.users[id];
      delete dbMemory.user_settings[id];
      delete dbMemory.taste_profiles[id];
      delete dbMemory.liked_tracks[id];
      delete dbMemory.playlists[id];
      delete dbMemory.search_history[id];
      dbMemory.listening_events = dbMemory.listening_events.filter(e => e.user_id !== id);
      db.revokeAllUserSessions(id);
      persistDB();
      return true;
    }
    return false;
  },

  // ==================== 2. SESSIONS & REFRESH TOKENS ====================
  createSession(userId, refreshTokenHash, userAgent = '', ip = '') {
    const sessionId = 'ses_' + crypto.randomUUID();
    const now = Date.now();
    const session = {
      id: sessionId,
      user_id: userId,
      refresh_token_hash: refreshTokenHash,
      user_agent: userAgent,
      ip: ip,
      created_at: now,
      expires_at: now + 30 * 24 * 60 * 60 * 1000, // 30 days
      revoked_at: null,
    };
    dbMemory.sessions[sessionId] = session;
    persistDB();
    return session;
  },

  findSessionByTokenHash(refreshTokenHash) {
    return Object.values(dbMemory.sessions).find(
      s => s.refresh_token_hash === refreshTokenHash && !s.revoked_at && s.expires_at > Date.now()
    ) || null;
  },

  revokeSession(sessionId) {
    if (dbMemory.sessions[sessionId]) {
      dbMemory.sessions[sessionId].revoked_at = Date.now();
      persistDB();
      return true;
    }
    return false;
  },

  revokeSessionByTokenHash(refreshTokenHash) {
    const session = Object.values(dbMemory.sessions).find(s => s.refresh_token_hash === refreshTokenHash);
    if (session) {
      session.revoked_at = Date.now();
      persistDB();
      return true;
    }
    return false;
  },

  revokeAllUserSessions(userId) {
    for (const session of Object.values(dbMemory.sessions)) {
      if (session.user_id === userId) {
        session.revoked_at = Date.now();
      }
    }
    persistDB();
  },

  // ==================== 3. SECURE PASSWORD RESET ====================
  createPasswordResetToken(userId) {
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const now = Date.now();

    dbMemory.password_reset_tokens[tokenHash] = {
      id: 'prt_' + crypto.randomUUID(),
      token_hash: tokenHash,
      user_id: userId,
      created_at: now,
      expires_at: now + 3600000, // 1 hour expiry
      used_at: null,
    };
    persistDB();
    return { token, tokenHash };
  },

  validateAndUseResetToken(token) {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const record = dbMemory.password_reset_tokens[tokenHash];
    if (!record || record.used_at || record.expires_at < Date.now()) {
      return null;
    }
    record.used_at = Date.now();
    persistDB();
    return record.user_id;
  },

  // ==================== 4. TASTE PROFILES ====================
  getTasteProfile(userId) {
    if (!dbMemory.taste_profiles[userId]) {
      dbMemory.taste_profiles[userId] = {
        user_id: userId,
        preferred_artists: {},
        preferred_genres: {},
        preferred_moods: {},
        skip_rate: 0,
        completion_rate: 1,
        total_plays: 0,
        total_skips: 0,
        total_completions: 0,
        liked_artists: [],
        disliked_artists: [],
        liked_genres: [],
        disliked_genres: [],
        recent_seeds: [],
        updated_at: Date.now(),
      };
    }
    return dbMemory.taste_profiles[userId];
  },

  saveTasteProfile(userId, profile) {
    dbMemory.taste_profiles[userId] = { ...profile, updated_at: Date.now() };
    persistDB();
    return dbMemory.taste_profiles[userId];
  },

  // ==================== 5. LISTENING EVENTS & HISTORY ====================
  addEvents(userId, events) {
    if (!Array.isArray(events)) return [];
    const formatted = events.map(e => ({
      id: e.id || 'evt_' + crypto.randomUUID(),
      user_id: userId,
      track_id: e.trackId,
      title: e.title || '',
      artist: e.artist || '',
      album: e.album || '',
      thumbnail: e.thumbnail || '',
      event_type: e.eventType,
      timestamp: e.timestamp || Date.now(),
      duration: e.duration || 0,
      listened_seconds: e.listenedSeconds || 0,
      completion_percent: e.completionPercent || 0,
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
    return dbMemory.listening_events
      .filter(e => e.user_id === userId && (e.event_type === 'PLAY_STARTED' || e.event_type === 'PLAY_COMPLETED'))
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 100);
  },

  clearUserHistory(userId) {
    dbMemory.listening_events = dbMemory.listening_events.filter(e => e.user_id !== userId);
    persistDB();
    return true;
  },

  // ==================== 6. LIKED TRACKS ====================
  getLikedTracks(userId) {
    return dbMemory.liked_tracks[userId] || [];
  },

  addLikedTrack(userId, track) {
    if (!dbMemory.liked_tracks[userId]) dbMemory.liked_tracks[userId] = [];
    const exists = dbMemory.liked_tracks[userId].some(t => t.id === track.id);
    if (!exists) {
      dbMemory.liked_tracks[userId].unshift({
        id: track.id,
        user_id: userId,
        title: track.title,
        artist: track.artist,
        album: track.album || '',
        thumbnail: track.thumbnail,
        duration: track.duration || 210,
        liked_at: Date.now(),
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

  // ==================== 7. PLAYLISTS ====================
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
    const now = Date.now();

    if (index >= 0) {
      dbMemory.playlists[userId][index] = {
        ...playlist,
        user_id: userId,
        updated_at: now,
      };
    } else {
      dbMemory.playlists[userId].unshift({
        id: playlist.id || 'pl_' + crypto.randomUUID(),
        user_id: userId,
        title: playlist.title,
        description: playlist.description || '',
        thumbnail: playlist.thumbnail || '',
        track_count: playlist.tracks?.length || 0,
        tracks: playlist.tracks || [],
        created_at: playlist.createdAt || now,
        updated_at: now,
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

  // ==================== 8. USER SETTINGS ====================
  getUserSettings(userId) {
    return dbMemory.user_settings[userId] || {
      user_id: userId,
      audio_quality: 'high',
      autoplay_radio: true,
      theme: 'oled-dark',
    };
  },

  updateUserSettings(userId, settings) {
    dbMemory.user_settings[userId] = {
      ...this.getUserSettings(userId),
      ...settings,
      updated_at: Date.now(),
    };
    persistDB();
    return dbMemory.user_settings[userId];
  },
};
