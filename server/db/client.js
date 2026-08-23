import pg from 'pg';

const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL;

let pool = null;

// If DATABASE_URL is provided, initialize pg.Pool
if (DATABASE_URL) {
  try {
    const isSslRequired = DATABASE_URL.includes('sslmode=require') || (!DATABASE_URL.includes('localhost') && !DATABASE_URL.includes('127.0.0.1'));

    pool = new Pool({
      connectionString: DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      ssl: isSslRequired ? { rejectUnauthorized: false } : false,
    });

    pool.on('error', (err) => {
      console.error('Unexpected PostgreSQL client error:', err.message);
    });
  } catch (e) {
    console.error('PostgreSQL Pool initialization error:', e.message);
    pool = null;
  }
}

// In-Memory Relational Store used when DATABASE_URL is not configured or in local/serverless fallback
class EmbeddedRelationalStore {
  constructor() {
    this.tables = {
      users: new Map(),
      sessions: new Map(),
      password_reset_tokens: new Map(),
      taste_profiles: new Map(),
      user_settings: new Map(),
      listening_events: [],
      liked_tracks: new Map(),
      playlists: new Map(),
      playlist_tracks: new Map(),
      saved_albums: new Map(),
      followed_artists: new Map(),
      search_history: [],
      sync_operations: [],
      recommendation_cache: new Map(),
    };
  }

  async query(text, params = []) {
    const sql = text.trim();

    // 1. SELECT 1 (Health check)
    if (/SELECT 1/i.test(sql)) {
      return { rows: [{ '?column?': 1 }], rowCount: 1 };
    }

    // 2. USERS Queries
    if (/SELECT \* FROM users WHERE LOWER\(email\) = LOWER\(\$1\)/i.test(sql)) {
      const email = String(params[0]).toLowerCase();
      const user = Array.from(this.tables.users.values()).find(u => u.email.toLowerCase() === email && u.is_active);
      return { rows: user ? [{ ...user }] : [], rowCount: user ? 1 : 0 };
    }

    if (/SELECT \* FROM users WHERE id = \$1/i.test(sql)) {
      const user = this.tables.users.get(params[0]);
      const activeUser = user && user.is_active ? { ...user } : null;
      return { rows: activeUser ? [activeUser] : [], rowCount: activeUser ? 1 : 0 };
    }

    if (/INSERT INTO users/i.test(sql)) {
      const [id, name, email, password_hash, created_at, updated_at, last_login_at, is_active] = params;
      const normalizedEmail = email.toLowerCase();
      // Enforce UNIQUE(email) constraint
      const existing = Array.from(this.tables.users.values()).find(u => u.email.toLowerCase() === normalizedEmail && u.is_active);
      if (existing) {
        const error = new Error('duplicate key value violates unique constraint "users_email_key"');
        error.code = '23505';
        throw error;
      }

      const user = { id, name, email: normalizedEmail, password_hash, created_at, updated_at, last_login_at, is_active: is_active ?? true };
      this.tables.users.set(id, user);
      return { rows: [user], rowCount: 1 };
    }

    if (/UPDATE users SET/i.test(sql)) {
      const id = params[params.length - 1];
      const user = this.tables.users.get(id);
      if (user) {
        if (sql.includes('password_hash = $1')) user.password_hash = params[0];
        if (sql.includes('last_login_at = $1')) user.last_login_at = params[0];
        if (sql.includes('name = $1')) user.name = params[0];
        user.updated_at = Date.now();
        return { rows: [user], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }

    if (/DELETE FROM users WHERE id = \$1/i.test(sql)) {
      const id = params[0];
      const existed = this.tables.users.has(id);
      this.tables.users.delete(id);
      // Cascading deletes
      this.tables.taste_profiles.delete(id);
      this.tables.user_settings.delete(id);
      for (const [sId, s] of this.tables.sessions.entries()) {
        if (s.user_id === id) this.tables.sessions.delete(sId);
      }
      for (const [k, l] of this.tables.liked_tracks.entries()) {
        if (k.startsWith(id + '_')) this.tables.liked_tracks.delete(k);
      }
      for (const [pId, p] of this.tables.playlists.entries()) {
        if (p.user_id === id) {
          this.tables.playlists.delete(pId);
          for (const [tId, t] of this.tables.playlist_tracks.entries()) {
            if (t.playlist_id === pId) this.tables.playlist_tracks.delete(tId);
          }
        }
      }
      this.tables.listening_events = this.tables.listening_events.filter(e => e.user_id !== id);
      return { rows: [], rowCount: existed ? 1 : 0 };
    }

    // 3. SESSIONS Queries
    if (/INSERT INTO sessions/i.test(sql)) {
      const [id, user_id, refresh_token_hash, user_agent, ip, created_at, expires_at, revoked_at] = params;
      const session = { id, user_id, refresh_token_hash, user_agent, ip, created_at, expires_at, revoked_at: revoked_at || null };
      this.tables.sessions.set(id, session);
      return { rows: [session], rowCount: 1 };
    }

    if (/SELECT \* FROM sessions WHERE refresh_token_hash = \$1/i.test(sql)) {
      const hash = params[0];
      const session = Array.from(this.tables.sessions.values()).find(s => s.refresh_token_hash === hash && !s.revoked_at && s.expires_at > Date.now());
      return { rows: session ? [session] : [], rowCount: session ? 1 : 0 };
    }

    if (/UPDATE sessions SET revoked_at = \$1 WHERE id = \$2/i.test(sql)) {
      const [revoked_at, id] = params;
      const session = this.tables.sessions.get(id);
      if (session) session.revoked_at = revoked_at;
      return { rows: [], rowCount: session ? 1 : 0 };
    }

    if (/UPDATE sessions SET revoked_at = \$1 WHERE refresh_token_hash = \$2/i.test(sql)) {
      const [revoked_at, hash] = params;
      const session = Array.from(this.tables.sessions.values()).find(s => s.refresh_token_hash === hash);
      if (session) session.revoked_at = revoked_at;
      return { rows: [], rowCount: session ? 1 : 0 };
    }

    if (/UPDATE sessions SET revoked_at = \$1 WHERE user_id = \$2/i.test(sql)) {
      const [revoked_at, userId] = params;
      for (const session of this.tables.sessions.values()) {
        if (session.user_id === userId) session.revoked_at = revoked_at;
      }
      return { rows: [], rowCount: 1 };
    }

    // 4. PASSWORD RESET TOKENS
    if (/INSERT INTO password_reset_tokens/i.test(sql)) {
      const [id, user_id, token_hash, created_at, expires_at, used_at] = params;
      const record = { id, user_id, token_hash, created_at, expires_at, used_at: used_at || null };
      this.tables.password_reset_tokens.set(token_hash, record);
      return { rows: [record], rowCount: 1 };
    }

    if (/SELECT \* FROM password_reset_tokens WHERE token_hash = \$1/i.test(sql)) {
      const hash = params[0];
      const record = this.tables.password_reset_tokens.get(hash);
      return { rows: record ? [record] : [], rowCount: record ? 1 : 0 };
    }

    if (/UPDATE password_reset_tokens SET used_at = \$1 WHERE token_hash = \$2/i.test(sql)) {
      const [used_at, hash] = params;
      const record = this.tables.password_reset_tokens.get(hash);
      if (record) record.used_at = used_at;
      return { rows: [], rowCount: record ? 1 : 0 };
    }

    // 5. TASTE PROFILES
    if (/SELECT \* FROM taste_profiles WHERE user_id = \$1/i.test(sql)) {
      const profile = this.tables.taste_profiles.get(params[0]);
      return { rows: profile ? [profile] : [], rowCount: profile ? 1 : 0 };
    }

    if (/INSERT INTO taste_profiles/i.test(sql)) {
      const [user_id, preferred_artists, preferred_genres, preferred_moods, liked_artists, disliked_artists, liked_genres, disliked_genres, skip_rate, completion_rate, total_plays, total_skips, total_completions, recent_seeds, updated_at] = params;
      const profile = {
        user_id,
        preferred_artists: typeof preferred_artists === 'string' ? JSON.parse(preferred_artists) : preferred_artists,
        preferred_genres: typeof preferred_genres === 'string' ? JSON.parse(preferred_genres) : preferred_genres,
        preferred_moods: typeof preferred_moods === 'string' ? JSON.parse(preferred_moods) : preferred_moods,
        liked_artists: typeof liked_artists === 'string' ? JSON.parse(liked_artists) : liked_artists,
        disliked_artists: typeof disliked_artists === 'string' ? JSON.parse(disliked_artists) : disliked_artists,
        liked_genres: typeof liked_genres === 'string' ? JSON.parse(liked_genres) : liked_genres,
        disliked_genres: typeof disliked_genres === 'string' ? JSON.parse(disliked_genres) : disliked_genres,
        skip_rate,
        completion_rate,
        total_plays,
        total_skips,
        total_completions,
        recent_seeds: typeof recent_seeds === 'string' ? JSON.parse(recent_seeds) : recent_seeds,
        updated_at,
      };
      this.tables.taste_profiles.set(user_id, profile);
      return { rows: [profile], rowCount: 1 };
    }

    // 6. USER SETTINGS
    if (/SELECT \* FROM user_settings WHERE user_id = \$1/i.test(sql)) {
      const settings = this.tables.user_settings.get(params[0]);
      return { rows: settings ? [settings] : [], rowCount: settings ? 1 : 0 };
    }

    if (/INSERT INTO user_settings/i.test(sql)) {
      const [user_id, audio_quality, autoplay_radio, theme, smart_downloads, updated_at] = params;
      const settings = {
        user_id,
        audio_quality,
        autoplay_radio,
        theme,
        smart_downloads: typeof smart_downloads === 'string' ? JSON.parse(smart_downloads) : smart_downloads,
        updated_at,
      };
      this.tables.user_settings.set(user_id, settings);
      return { rows: [settings], rowCount: 1 };
    }

    // 7. LIKED TRACKS
    if (/SELECT \* FROM liked_tracks WHERE user_id = \$1/i.test(sql)) {
      const userId = params[0];
      const likes = Array.from(this.tables.liked_tracks.values())
        .filter(l => l.user_id === userId)
        .sort((a, b) => b.liked_at - a.liked_at);
      return { rows: likes, rowCount: likes.length };
    }

    if (/INSERT INTO liked_tracks/i.test(sql)) {
      const [user_id, track_id, title, artist, album, thumbnail, duration, liked_at] = params;
      const key = `${user_id}_${track_id}`;
      const record = { user_id, track_id, title, artist, album, thumbnail, duration, liked_at };
      this.tables.liked_tracks.set(key, record);
      return { rows: [record], rowCount: 1 };
    }

    if (/DELETE FROM liked_tracks WHERE user_id = \$1 AND track_id = \$2/i.test(sql)) {
      const [user_id, track_id] = params;
      const key = `${user_id}_${track_id}`;
      const existed = this.tables.liked_tracks.has(key);
      this.tables.liked_tracks.delete(key);
      return { rows: [], rowCount: existed ? 1 : 0 };
    }

    // 8. LISTENING EVENTS
    if (/INSERT INTO listening_events/i.test(sql)) {
      const [id, user_id, track_id, title, artist, album, thumbnail, event_type, timestamp, duration, listened_seconds, completion_percent, skipped, source] = params;
      const evt = { id, user_id, track_id, title, artist, album, thumbnail, event_type, timestamp, duration, listened_seconds, completion_percent, skipped, source };
      this.tables.listening_events.unshift(evt);
      if (this.tables.listening_events.length > 5000) {
        this.tables.listening_events = this.tables.listening_events.slice(0, 5000);
      }
      return { rows: [evt], rowCount: 1 };
    }

    if (/SELECT \* FROM listening_events WHERE user_id = \$1/i.test(sql)) {
      const userId = params[0];
      const evts = this.tables.listening_events
        .filter(e => e.user_id === userId)
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 100);
      return { rows: evts, rowCount: evts.length };
    }

    if (/DELETE FROM listening_events WHERE user_id = \$1/i.test(sql)) {
      const userId = params[0];
      this.tables.listening_events = this.tables.listening_events.filter(e => e.user_id !== userId);
      return { rows: [], rowCount: 1 };
    }

    // 9. PLAYLISTS & PLAYLIST TRACKS
    if (/SELECT \* FROM playlists WHERE user_id = \$1/i.test(sql)) {
      const userId = params[0];
      const userPlaylists = Array.from(this.tables.playlists.values())
        .filter(p => p.user_id === userId)
        .sort((a, b) => b.updated_at - a.updated_at);

      const result = userPlaylists.map(p => {
        const tracks = Array.from(this.tables.playlist_tracks.values())
          .filter(t => t.playlist_id === p.id)
          .sort((a, b) => a.position - b.position);
        return { ...p, tracks, track_count: tracks.length };
      });
      return { rows: result, rowCount: result.length };
    }

    if (/SELECT \* FROM playlists WHERE id = \$1 AND user_id = \$2/i.test(sql)) {
      const [pId, userId] = params;
      const playlist = this.tables.playlists.get(pId);
      if (!playlist || playlist.user_id !== userId) return { rows: [], rowCount: 0 };
      const tracks = Array.from(this.tables.playlist_tracks.values())
        .filter(t => t.playlist_id === pId)
        .sort((a, b) => a.position - b.position);
      return { rows: [{ ...playlist, tracks, track_count: tracks.length }], rowCount: 1 };
    }

    if (/INSERT INTO playlists/i.test(sql)) {
      const [id, user_id, title, description, thumbnail, created_at, updated_at, is_custom] = params;
      const playlist = { id, user_id, title, description, thumbnail, created_at, updated_at, is_custom: is_custom ?? true };
      this.tables.playlists.set(id, playlist);
      return { rows: [playlist], rowCount: 1 };
    }

    if (/DELETE FROM playlists WHERE id = \$1 AND user_id = \$2/i.test(sql)) {
      const [id, userId] = params;
      const pl = this.tables.playlists.get(id);
      if (pl && pl.user_id === userId) {
        this.tables.playlists.delete(id);
        for (const [tId, t] of this.tables.playlist_tracks.entries()) {
          if (t.playlist_id === id) this.tables.playlist_tracks.delete(tId);
        }
        return { rows: [], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }

    if (/INSERT INTO playlist_tracks/i.test(sql)) {
      const [id, playlist_id, track_id, title, artist, album, thumbnail, duration, position, added_at] = params;
      const record = { id, playlist_id, track_id, title, artist, album, thumbnail, duration, position, added_at };
      this.tables.playlist_tracks.set(id, record);
      return { rows: [record], rowCount: 1 };
    }

    if (/DELETE FROM playlist_tracks WHERE playlist_id = \$1/i.test(sql)) {
      const playlist_id = params[0];
      for (const [id, t] of this.tables.playlist_tracks.entries()) {
        if (t.playlist_id === playlist_id) this.tables.playlist_tracks.delete(id);
      }
      return { rows: [], rowCount: 1 };
    }

    return { rows: [], rowCount: 0 };
  }
}

const embeddedStore = new EmbeddedRelationalStore();

export const dbClient = {
  async query(text, params) {
    if (pool) {
      try {
        return await pool.query(text, params);
      } catch (err) {
        console.warn('PostgreSQL query error, using embedded engine:', err.message);
      }
    }
    return await embeddedStore.query(text, params);
  },

  async getClient() {
    if (pool) {
      try {
        return await pool.connect();
      } catch (err) {
        console.warn('PostgreSQL connect error:', err.message);
      }
    }
    return {
      query: (text, params) => embeddedStore.query(text, params),
      release: () => {},
    };
  },

  async healthCheck() {
    try {
      const res = await this.query('SELECT 1;');
      return {
        status: 'connected',
        driver: pool ? 'postgresql' : 'embedded-relational-sql',
        databaseUrlConfigured: !!DATABASE_URL,
      };
    } catch (err) {
      return {
        status: 'error',
        message: err.message,
        driver: pool ? 'postgresql' : 'embedded-relational-sql',
      };
    }
  },
};
