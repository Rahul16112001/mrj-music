import crypto from 'crypto';
import { dbClient } from './client.js';

export const db = {
  // ==================== 1. USERS & CONSTRAINTS ====================
  async findUserByEmail(email) {
    if (!email) return null;
    const normalized = email.trim().toLowerCase();
    const res = await dbClient.query(
      'SELECT * FROM users WHERE LOWER(email) = LOWER($1) AND is_active = true LIMIT 1;',
      [normalized]
    );
    return res.rows[0] || null;
  },

  async findUserById(id) {
    if (!id) return null;
    const res = await dbClient.query(
      'SELECT * FROM users WHERE id = $1 AND is_active = true LIMIT 1;',
      [id]
    );
    return res.rows[0] || null;
  },

  async getUserById(id) {
    return this.findUserById(id);
  },

  async createUser(userData) {
    const normalizedEmail = userData.email.trim().toLowerCase();
    const now = Date.now();
    const userId = userData.id || 'usr_' + crypto.randomUUID();

    // 1. Insert User
    const userRes = await dbClient.query(
      `INSERT INTO users (id, name, email, password_hash, created_at, updated_at, last_login_at, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *;`,
      [userId, userData.name.trim(), normalizedEmail, userData.password_hash, now, now, now, true]
    );

    const user = userRes.rows[0];

    // 2. Initialize Taste Profile (Relational)
    await dbClient.query(
      `INSERT INTO taste_profiles (
        user_id, preferred_artists, preferred_genres, preferred_moods, liked_artists, disliked_artists,
        liked_genres, disliked_genres, skip_rate, completion_rate, total_plays, total_skips, total_completions, recent_seeds, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15);`,
      [
        userId,
        JSON.stringify({}),
        JSON.stringify({}),
        JSON.stringify({}),
        JSON.stringify([]),
        JSON.stringify([]),
        JSON.stringify([]),
        JSON.stringify([]),
        0.0,
        1.0,
        0,
        0,
        0,
        JSON.stringify([]),
        now,
      ]
    );

    // 3. Initialize User Settings
    await dbClient.query(
      `INSERT INTO user_settings (user_id, audio_quality, autoplay_radio, theme, smart_downloads, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6);`,
      [
        userId,
        'high',
        true,
        'oled-dark',
        JSON.stringify({ enabled: true, maxTracks: 20, storageLimitMB: 500, wifiOnly: true }),
        now,
      ]
    );

    return user;
  },

  async updateUser(id, updates) {
    const user = await this.findUserById(id);
    if (!user) return null;

    if (updates.name) {
      await dbClient.query('UPDATE users SET name = $1 WHERE id = $2;', [updates.name.trim(), id]);
    }
    if (updates.password_hash) {
      await dbClient.query('UPDATE users SET password_hash = $1 WHERE id = $2;', [updates.password_hash, id]);
    }
    if (updates.last_login_at) {
      await dbClient.query('UPDATE users SET last_login_at = $1 WHERE id = $2;', [updates.last_login_at, id]);
    }

    return await this.findUserById(id);
  },

  async deleteUser(id) {
    const res = await dbClient.query('DELETE FROM users WHERE id = $1;', [id]);
    return res.rowCount > 0;
  },

  // ==================== 2. SESSIONS & REFRESH TOKENS ====================
  async createSession(userId, refreshTokenHash, userAgent = '', ip = '') {
    const sessionId = 'ses_' + crypto.randomUUID();
    const now = Date.now();
    const expiresAt = now + 30 * 24 * 60 * 60 * 1000; // 30 days

    const res = await dbClient.query(
      `INSERT INTO sessions (id, user_id, refresh_token_hash, user_agent, ip, created_at, expires_at, revoked_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *;`,
      [sessionId, userId, refreshTokenHash, userAgent, ip, now, expiresAt, null]
    );
    return res.rows[0];
  },

  async findSessionByTokenHash(refreshTokenHash) {
    const res = await dbClient.query(
      'SELECT * FROM sessions WHERE refresh_token_hash = $1 LIMIT 1;',
      [refreshTokenHash]
    );
    return res.rows[0] || null;
  },

  async revokeSession(sessionId) {
    const res = await dbClient.query(
      'UPDATE sessions SET revoked_at = $1 WHERE id = $2;',
      [Date.now(), sessionId]
    );
    return res.rowCount > 0;
  },

  async revokeSessionByTokenHash(refreshTokenHash) {
    const res = await dbClient.query(
      'UPDATE sessions SET revoked_at = $1 WHERE refresh_token_hash = $2;',
      [Date.now(), refreshTokenHash]
    );
    return res.rowCount > 0;
  },

  async revokeAllUserSessions(userId) {
    await dbClient.query(
      'UPDATE sessions SET revoked_at = $1 WHERE user_id = $2;',
      [Date.now(), userId]
    );
  },

  // ==================== 3. SECURE PASSWORD RESET ====================
  async createPasswordResetToken(userId) {
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const now = Date.now();
    const expiresAt = now + 3600000; // 1 hour

    await dbClient.query(
      `INSERT INTO password_reset_tokens (id, user_id, token_hash, created_at, expires_at, used_at)
       VALUES ($1, $2, $3, $4, $5, $6);`,
      ['prt_' + crypto.randomUUID(), userId, tokenHash, now, expiresAt, null]
    );

    return { token, tokenHash };
  },

  async validateAndUseResetToken(token) {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const res = await dbClient.query(
      'SELECT * FROM password_reset_tokens WHERE token_hash = $1 LIMIT 1;',
      [tokenHash]
    );

    const record = res.rows[0];
    if (!record || record.used_at || Number(record.expires_at) < Date.now()) {
      return null;
    }

    await dbClient.query(
      'UPDATE password_reset_tokens SET used_at = $1 WHERE token_hash = $2;',
      [Date.now(), tokenHash]
    );

    return record.user_id;
  },

  // ==================== 4. TASTE PROFILES ====================
  async getTasteProfile(userId) {
    const res = await dbClient.query(
      'SELECT * FROM taste_profiles WHERE user_id = $1 LIMIT 1;',
      [userId]
    );

    if (res.rows[0]) {
      const row = res.rows[0];
      return {
        user_id: row.user_id,
        preferred_artists: typeof row.preferred_artists === 'string' ? JSON.parse(row.preferred_artists) : row.preferred_artists || {},
        preferred_genres: typeof row.preferred_genres === 'string' ? JSON.parse(row.preferred_genres) : row.preferred_genres || {},
        preferred_moods: typeof row.preferred_moods === 'string' ? JSON.parse(row.preferred_moods) : row.preferred_moods || {},
        liked_artists: typeof row.liked_artists === 'string' ? JSON.parse(row.liked_artists) : row.liked_artists || [],
        disliked_artists: typeof row.disliked_artists === 'string' ? JSON.parse(row.disliked_artists) : row.disliked_artists || [],
        liked_genres: typeof row.liked_genres === 'string' ? JSON.parse(row.liked_genres) : row.liked_genres || [],
        disliked_genres: typeof row.disliked_genres === 'string' ? JSON.parse(row.disliked_genres) : row.disliked_genres || [],
        skip_rate: row.skip_rate || 0,
        completion_rate: row.completion_rate || 1,
        total_plays: row.total_plays || 0,
        total_skips: row.total_skips || 0,
        total_completions: row.total_completions || 0,
        recent_seeds: typeof row.recent_seeds === 'string' ? JSON.parse(row.recent_seeds) : row.recent_seeds || [],
        updated_at: Number(row.updated_at) || Date.now(),
      };
    }

    return {
      user_id: userId,
      preferred_artists: {},
      preferred_genres: {},
      preferred_moods: {},
      liked_artists: [],
      disliked_artists: [],
      liked_genres: [],
      disliked_genres: [],
      skip_rate: 0,
      completion_rate: 1,
      total_plays: 0,
      total_skips: 0,
      total_completions: 0,
      recent_seeds: [],
      updated_at: Date.now(),
    };
  },

  async saveTasteProfile(userId, profile) {
    const now = Date.now();
    await dbClient.query(
      `INSERT INTO taste_profiles (
        user_id, preferred_artists, preferred_genres, preferred_moods, liked_artists, disliked_artists,
        liked_genres, disliked_genres, skip_rate, completion_rate, total_plays, total_skips, total_completions, recent_seeds, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15);`,
      [
        userId,
        JSON.stringify(profile.preferred_artists || {}),
        JSON.stringify(profile.preferred_genres || {}),
        JSON.stringify(profile.preferred_moods || {}),
        JSON.stringify(profile.liked_artists || []),
        JSON.stringify(profile.disliked_artists || []),
        JSON.stringify(profile.liked_genres || []),
        JSON.stringify(profile.disliked_genres || []),
        profile.skip_rate || 0,
        profile.completion_rate || 1,
        profile.total_plays || 0,
        profile.total_skips || 0,
        profile.total_completions || 0,
        JSON.stringify(profile.recent_seeds || []),
        now,
      ]
    );
    return profile;
  },

  // ==================== 5. LISTENING EVENTS ====================
  async addEvents(userId, events) {
    if (!Array.isArray(events) || events.length === 0) return [];

    const inserted = [];
    for (const e of events) {
      const id = e.id || 'evt_' + crypto.randomUUID();
      const ts = e.timestamp || Date.now();
      await dbClient.query(
        `INSERT INTO listening_events (
          id, user_id, track_id, title, artist, album, thumbnail, event_type, timestamp, duration, listened_seconds, completion_percent, skipped, source
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14);`,
        [
          id,
          userId,
          e.trackId,
          e.title || '',
          e.artist || '',
          e.album || '',
          e.thumbnail || '',
          e.eventType,
          ts,
          e.duration || 0,
          e.listenedSeconds || 0,
          e.completionPercent || 0,
          !!e.skipped,
          e.source || 'player',
        ]
      );
      inserted.push({ id, ...e });
    }
    return inserted;
  },

  async getUserHistory(userId) {
    const res = await dbClient.query(
      'SELECT * FROM listening_events WHERE user_id = $1;',
      [userId]
    );
    return res.rows.map(r => ({
      id: r.id,
      track_id: r.track_id,
      title: r.title,
      artist: r.artist,
      album: r.album,
      thumbnail: r.thumbnail,
      duration: r.duration,
      timestamp: Number(r.timestamp),
    }));
  },

  async clearUserHistory(userId) {
    await dbClient.query('DELETE FROM listening_events WHERE user_id = $1;', [userId]);
    return true;
  },

  // ==================== 6. LIKED TRACKS ====================
  async getLikedTracks(userId) {
    const res = await dbClient.query(
      'SELECT * FROM liked_tracks WHERE user_id = $1;',
      [userId]
    );
    return res.rows.map(r => ({
      id: r.track_id,
      title: r.title,
      artist: r.artist,
      album: r.album,
      thumbnail: r.thumbnail,
      duration: r.duration,
      likedAt: Number(r.liked_at),
    }));
  },

  async addLikedTrack(userId, track) {
    const now = Date.now();
    await dbClient.query(
      `INSERT INTO liked_tracks (user_id, track_id, title, artist, album, thumbnail, duration, liked_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8);`,
      [userId, track.id, track.title, track.artist, track.album || '', track.thumbnail || '', track.duration || 210, now]
    );
    return await this.getLikedTracks(userId);
  },

  async removeLikedTrack(userId, trackId) {
    await dbClient.query(
      'DELETE FROM liked_tracks WHERE user_id = $1 AND track_id = $2;',
      [userId, trackId]
    );
    return await this.getLikedTracks(userId);
  },

  // ==================== 7. PLAYLISTS & PLAYLIST TRACKS ====================
  async getPlaylists(userId) {
    const res = await dbClient.query(
      'SELECT * FROM playlists WHERE user_id = $1;',
      [userId]
    );
    return res.rows.map(r => ({
      id: r.id,
      userId: r.user_id,
      title: r.title,
      description: r.description,
      thumbnail: r.thumbnail,
      trackCount: r.track_count || r.tracks?.length || 0,
      tracks: r.tracks || [],
      createdAt: Number(r.created_at),
      updatedAt: Number(r.updated_at),
      isCustom: r.is_custom,
    }));
  },

  async getPlaylist(userId, playlistId) {
    const res = await dbClient.query(
      'SELECT * FROM playlists WHERE id = $1 AND user_id = $2 LIMIT 1;',
      [playlistId, userId]
    );
    const row = res.rows[0];
    if (!row) return null;
    return {
      id: row.id,
      userId: row.user_id,
      title: row.title,
      description: row.description,
      thumbnail: row.thumbnail,
      trackCount: row.track_count || row.tracks?.length || 0,
      tracks: row.tracks || [],
      createdAt: Number(row.created_at),
      updatedAt: Number(row.updated_at),
      isCustom: row.is_custom,
    };
  },

  async savePlaylist(userId, playlist) {
    const now = Date.now();
    const playlistId = playlist.id || 'pl_' + crypto.randomUUID();

    // 1. Insert/Update Playlist
    await dbClient.query(
      `INSERT INTO playlists (id, user_id, title, description, thumbnail, created_at, updated_at, is_custom)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8);`,
      [
        playlistId,
        userId,
        playlist.title,
        playlist.description || '',
        playlist.thumbnail || '',
        playlist.createdAt || now,
        now,
        playlist.isCustom ?? true,
      ]
    );

    // 2. Insert Tracks
    if (Array.isArray(playlist.tracks)) {
      await dbClient.query('DELETE FROM playlist_tracks WHERE playlist_id = $1;', [playlistId]);
      for (let i = 0; i < playlist.tracks.length; i++) {
        const t = playlist.tracks[i];
        await dbClient.query(
          `INSERT INTO playlist_tracks (id, playlist_id, track_id, title, artist, album, thumbnail, duration, position, added_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10);`,
          ['pt_' + crypto.randomUUID(), playlistId, t.id, t.title, t.artist, t.album || '', t.thumbnail || '', t.duration || 210, i, now]
        );
      }
    }

    return await this.getPlaylist(userId, playlistId);
  },

  async deletePlaylist(userId, playlistId) {
    const res = await dbClient.query(
      'DELETE FROM playlists WHERE id = $1 AND user_id = $2;',
      [playlistId, userId]
    );
    return res.rowCount > 0;
  },

  // ==================== 8. USER SETTINGS ====================
  async getUserSettings(userId) {
    const res = await dbClient.query(
      'SELECT * FROM user_settings WHERE user_id = $1 LIMIT 1;',
      [userId]
    );
    const row = res.rows[0];
    if (row) {
      return {
        audioQuality: row.audio_quality,
        autoplayRadio: row.autoplay_radio,
        theme: row.theme,
        smartDownloads: typeof row.smart_downloads === 'string' ? JSON.parse(row.smart_downloads) : row.smart_downloads,
      };
    }
    return {
      audioQuality: 'high',
      autoplayRadio: true,
      theme: 'oled-dark',
      smartDownloads: { enabled: true, maxTracks: 20, storageLimitMB: 500, wifiOnly: true },
    };
  },

  async updateUserSettings(userId, settings) {
    const now = Date.now();
    await dbClient.query(
      `INSERT INTO user_settings (user_id, audio_quality, autoplay_radio, theme, smart_downloads, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6);`,
      [
        userId,
        settings.audioQuality || 'high',
        settings.autoplayRadio ?? true,
        settings.theme || 'oled-dark',
        JSON.stringify(settings.smartDownloads || {}),
        now,
      ]
    );
    return await this.getUserSettings(userId);
  },
};
