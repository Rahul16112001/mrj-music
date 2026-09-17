-- ==========================================================
-- MRJ Music Provider Mapping Migration 002
-- PostgreSQL dialect
--
-- A canonical track may have multiple provider mappings. The
-- canonical ID is therefore indexed, but intentionally not unique
-- in this table: one canonical track needs fallback providers.
-- ==========================================================

CREATE TABLE IF NOT EXISTS provider_track_mappings (
    mapping_id VARCHAR(64) PRIMARY KEY,
    canonical_track_id VARCHAR(255) NOT NULL,
    provider_name VARCHAR(32) NOT NULL,
    provider_track_id VARCHAR(255) NOT NULL,
    source_type VARCHAR(32) NOT NULL DEFAULT 'catalog',
    normalized_title VARCHAR(255) NOT NULL,
    normalized_artist VARCHAR(255) NOT NULL,
    album VARCHAR(255),
    duration INT,
    artwork_url TEXT,
    verification_status VARCHAR(32) NOT NULL DEFAULT 'unverified',
    last_verified_at BIGINT,
    last_success_at BIGINT,
    last_failure_at BIGINT,
    failure_reason TEXT,
    provider_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at BIGINT NOT NULL DEFAULT (extract(epoch FROM clock_timestamp()) * 1000)::bigint,
    updated_at BIGINT NOT NULL DEFAULT (extract(epoch FROM clock_timestamp()) * 1000)::bigint,

    CONSTRAINT provider_mapping_canonical_id_nonempty
        CHECK (length(btrim(canonical_track_id)) > 0),
    CONSTRAINT provider_mapping_provider_name_check
        CHECK (provider_name IN ('youtube_music', 'jiosaavn', 'soundcloud', 'youtube_video', 'scraper')),
    CONSTRAINT provider_mapping_provider_id_nonempty
        CHECK (length(btrim(provider_track_id)) > 0),
    CONSTRAINT provider_mapping_title_nonempty
        CHECK (length(btrim(normalized_title)) > 0),
    CONSTRAINT provider_mapping_artist_nonempty
        CHECK (length(btrim(normalized_artist)) > 0),
    CONSTRAINT provider_mapping_duration_nonnegative
        CHECK (duration IS NULL OR duration >= 0),
    CONSTRAINT provider_mapping_verification_status_check
        CHECK (verification_status IN ('unverified', 'verified', 'unavailable', 'failed')),
    CONSTRAINT provider_mapping_provider_identity_unique
        UNIQUE (provider_name, provider_track_id)
);

CREATE INDEX IF NOT EXISTS idx_provider_mappings_canonical_track_id
    ON provider_track_mappings(canonical_track_id);

CREATE INDEX IF NOT EXISTS idx_provider_mappings_provider_name
    ON provider_track_mappings(provider_name);

-- Keep this explicit lookup index even though the unique constraint also
-- creates an equivalent PostgreSQL index; the named index documents the
-- query contract and remains harmless if PostgreSQL reuses the constraint.
CREATE INDEX IF NOT EXISTS idx_provider_mappings_provider_track
    ON provider_track_mappings(provider_name, provider_track_id);
