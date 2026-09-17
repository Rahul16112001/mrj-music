-- Replace SoundCloud with Jamendo and Audius in the provider mapping contract.

ALTER TABLE provider_track_mappings
    DROP CONSTRAINT IF EXISTS provider_mapping_provider_name_check;

ALTER TABLE provider_track_mappings
    ADD CONSTRAINT provider_mapping_provider_name_check
    CHECK (provider_name IN ('youtube_music', 'jiosaavn', 'jamendo', 'audius', 'youtube_video', 'scraper'));
