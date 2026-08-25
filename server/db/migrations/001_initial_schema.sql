-- ==========================================================
-- MRJ Music Production Database Schema Migration 001
-- PostgreSQL Dialect with Foreign Keys, Indexes & Constraints
-- ==========================================================

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,
    last_login_at BIGINT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(LOWER(email));

-- 2. Sessions & Rotatable Refresh Tokens
CREATE TABLE IF NOT EXISTS sessions (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_token_hash VARCHAR(255) NOT NULL,
    user_agent TEXT,
    ip VARCHAR(45),
    created_at BIGINT NOT NULL,
    expires_at BIGINT NOT NULL,
    revoked_at BIGINT
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(refresh_token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

-- 3. Password Reset Tokens
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    created_at BIGINT NOT NULL,
    expires_at BIGINT NOT NULL,
    used_at BIGINT
);

CREATE INDEX IF NOT EXISTS idx_reset_token_hash ON password_reset_tokens(token_hash);

-- 4. Taste Profiles Table
CREATE TABLE IF NOT EXISTS taste_profiles (
    user_id VARCHAR(64) PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    preferred_artists JSONB NOT NULL DEFAULT '{}'::jsonb,
    preferred_genres JSONB NOT NULL DEFAULT '{}'::jsonb,
    preferred_moods JSONB NOT NULL DEFAULT '{}'::jsonb,
    liked_artists JSONB NOT NULL DEFAULT '[]'::jsonb,
    disliked_artists JSONB NOT NULL DEFAULT '[]'::jsonb,
    liked_genres JSONB NOT NULL DEFAULT '[]'::jsonb,
    disliked_genres JSONB NOT NULL DEFAULT '[]'::jsonb,
    skip_rate REAL NOT NULL DEFAULT 0.0,
    completion_rate REAL NOT NULL DEFAULT 1.0,
    total_plays INT NOT NULL DEFAULT 0,
    total_skips INT NOT NULL DEFAULT 0,
    total_completions INT NOT NULL DEFAULT 0,
    recent_seeds JSONB NOT NULL DEFAULT '[]'::jsonb,
    updated_at BIGINT NOT NULL
);

-- 5. User Settings Table
CREATE TABLE IF NOT EXISTS user_settings (
    user_id VARCHAR(64) PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    audio_quality VARCHAR(32) NOT NULL DEFAULT 'high',
    autoplay_radio BOOLEAN NOT NULL DEFAULT TRUE,
    theme VARCHAR(32) NOT NULL DEFAULT 'oled-dark',
    smart_downloads JSONB NOT NULL DEFAULT '{"enabled":true,"maxTracks":20,"storageLimitMB":500,"wifiOnly":true}'::jsonb,
    updated_at BIGINT NOT NULL
);

-- 6. Listening Events Table (High-volume event log)
CREATE TABLE IF NOT EXISTS listening_events (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    track_id VARCHAR(64) NOT NULL,
    title VARCHAR(255) NOT NULL,
    artist VARCHAR(255) NOT NULL,
    album VARCHAR(255),
    thumbnail TEXT,
    event_type VARCHAR(64) NOT NULL,
    timestamp BIGINT NOT NULL,
    duration INT NOT NULL DEFAULT 0,
    listened_seconds INT NOT NULL DEFAULT 0,
    completion_percent INT NOT NULL DEFAULT 0,
    skipped BOOLEAN NOT NULL DEFAULT FALSE,
    source VARCHAR(64) NOT NULL DEFAULT 'player'
);

CREATE INDEX IF NOT EXISTS idx_listening_events_user_ts ON listening_events(user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_listening_events_user_track ON listening_events(user_id, track_id);
CREATE INDEX IF NOT EXISTS idx_listening_events_type ON listening_events(event_type);

-- 7. Liked Tracks Table
CREATE TABLE IF NOT EXISTS liked_tracks (
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    track_id VARCHAR(64) NOT NULL,
    title VARCHAR(255) NOT NULL,
    artist VARCHAR(255) NOT NULL,
    album VARCHAR(255),
    thumbnail TEXT,
    duration INT NOT NULL DEFAULT 210,
    liked_at BIGINT NOT NULL,
    PRIMARY KEY (user_id, track_id)
);

CREATE INDEX IF NOT EXISTS idx_liked_tracks_user ON liked_tracks(user_id);
CREATE INDEX IF NOT EXISTS idx_liked_tracks_time ON liked_tracks(liked_at DESC);

-- 8. Playlists Table
CREATE TABLE IF NOT EXISTS playlists (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    thumbnail TEXT,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,
    is_custom BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_playlists_user ON playlists(user_id);

-- 9. Playlist Tracks Table (Relational Track list)
CREATE TABLE IF NOT EXISTS playlist_tracks (
    id VARCHAR(64) PRIMARY KEY,
    playlist_id VARCHAR(64) NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
    track_id VARCHAR(64) NOT NULL,
    title VARCHAR(255) NOT NULL,
    artist VARCHAR(255) NOT NULL,
    album VARCHAR(255),
    thumbnail TEXT,
    duration INT NOT NULL DEFAULT 210,
    position INT NOT NULL DEFAULT 0,
    added_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_playlist_tracks_pl_pos ON playlist_tracks(playlist_id, position);

-- 10. Saved Albums
CREATE TABLE IF NOT EXISTS saved_albums (
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    album_id VARCHAR(64) NOT NULL,
    title VARCHAR(255) NOT NULL,
    artist VARCHAR(255) NOT NULL,
    thumbnail TEXT,
    saved_at BIGINT NOT NULL,
    PRIMARY KEY (user_id, album_id)
);

-- 11. Followed Artists
CREATE TABLE IF NOT EXISTS followed_artists (
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    artist_id VARCHAR(64) NOT NULL,
    artist_name VARCHAR(255) NOT NULL,
    thumbnail TEXT,
    followed_at BIGINT NOT NULL,
    PRIMARY KEY (user_id, artist_id)
);

-- 12. Search History
CREATE TABLE IF NOT EXISTS search_history (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    query VARCHAR(255) NOT NULL,
    searched_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_search_history_user_ts ON search_history(user_id, searched_at DESC);

-- 13. Sync Operations Table
CREATE TABLE IF NOT EXISTS sync_operations (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_id VARCHAR(64),
    operation_type VARCHAR(64) NOT NULL,
    entity_type VARCHAR(64) NOT NULL,
    entity_id VARCHAR(64) NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at BIGINT NOT NULL,
    applied_at BIGINT,
    version INT NOT NULL DEFAULT 1
);

-- 14. Recommendation Cache Table
CREATE TABLE IF NOT EXISTS recommendation_cache (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    context VARCHAR(64) NOT NULL,
    seed_track_id VARCHAR(64),
    mood VARCHAR(64),
    result_payload JSONB NOT NULL,
    created_at BIGINT NOT NULL,
    expires_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rec_cache_user_exp ON recommendation_cache(user_id, expires_at);

-- Signup OTP Verification Codes (DB-backed so they survive serverless cold starts)
CREATE TABLE IF NOT EXISTS signup_otps (
    email VARCHAR(255) PRIMARY KEY,
    otp VARCHAR(6) NOT NULL,
    name VARCHAR(255),
    expires_at BIGINT NOT NULL,
    created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_signup_otps_expires ON signup_otps(expires_at);
