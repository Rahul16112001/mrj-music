import axios from 'axios';
import { contentClassifier, CONTENT_TYPES } from './contentClassifier.js';
import { searchIntentEngine, INTENT_TYPES } from './searchIntentEngine.js';
import { trackIdentityManager } from './trackIdentityManager.js';

export const canonicalMusicResolver = {
  /**
   * Search for canonical music entities from the music catalog
   */
  async searchCanonicalEntities(query, intent = {}) {
    const cleanQuery = (intent.cleanQuery || query || '').trim();
    if (!cleanQuery) return { songs: [], albums: [], artists: [] };

    try {
      const songUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(cleanQuery)}&entity=song&limit=15`;
      const albumUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(cleanQuery)}&entity=album&limit=6`;
      const artistUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(cleanQuery)}&entity=musicArtist&limit=6`;

      const [songRes, albumRes, artistRes] = await Promise.allSettled([
        axios.get(songUrl, { timeout: 4500 }),
        axios.get(albumUrl, { timeout: 4500 }),
        axios.get(artistUrl, { timeout: 4500 }),
      ]);

      const songs = [];
      const seenEntities = new Set();

      if (songRes.status === 'fulfilled' && songRes.value.data?.results) {
        for (const item of songRes.value.data.results) {
          const rawTitle = item.trackName || '';
          const rawArtist = item.artistName || '';
          const cleanTitle = contentClassifier.cleanTitle(rawTitle);
          const cleanArtist = contentClassifier.cleanArtist(rawArtist);
          const canonicalTrackId = trackIdentityManager.generateCanonicalTrackId(cleanTitle, cleanArtist);

          if (seenEntities.has(canonicalTrackId)) continue;
          seenEntities.add(canonicalTrackId);

          const durationSec = Math.round((item.trackTimeMillis || 210000) / 1000);
          const releaseYear = item.releaseDate ? item.releaseDate.substring(0, 4) : '2024';
          const artwork = (item.artworkUrl100 || '')
            .replace('100x100bb.jpg', '600x600bb.jpg')
            .replace('100x100bb.png', '600x600bb.png');

          const classification = contentClassifier.classifySearchResult({
            title: rawTitle,
            artist: rawArtist,
            duration: durationSec,
          });

          if (!intent.wantsSlowed && !intent.wantsRemix && !intent.wantsCover) {
            if (classification.isSlowed || classification.isRemix || classification.isCover) continue;
          }

          songs.push({
            id: canonicalTrackId,
            canonicalTrackId,
            canonicalMusicEntityId: canonicalTrackId,
            title: cleanTitle,
            rawTitle,
            artist: cleanArtist,
            artistId: item.artistId ? `art_${item.artistId}` : null,
            album: item.collectionName || 'Single',
            albumId: item.collectionId ? `alb_${item.collectionId}` : null,
            releaseYear,
            duration: durationSec,
            thumbnail: artwork || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400',
            genre: item.primaryGenreName || 'Pop',
            contentType: CONTENT_TYPES.MUSIC,
            isOfficialMusic: true,
            isAudioOnly: true,
            isMusicVideo: false,
            isLive: false,
            isCover: false,
            isRemix: false,
            isSlowed: false,
            isLyricsVideo: false,
            isShort: false,
            isReaction: false,
            isCompilation: false,
            musicEntityKey: canonicalTrackId,
            sourceType: 'canonical_catalog',
            playbackFormat: 'audio',
            provider: 'canonical',
            previewUrl: item.previewUrl || null,
          });
        }
      }

      // Real Albums
      const albums = [];
      if (albumRes.status === 'fulfilled' && albumRes.value.data?.results) {
        for (const alb of albumRes.value.data.results) {
          const art = (alb.artworkUrl100 || '')
            .replace('100x100bb.jpg', '600x600bb.jpg')
            .replace('100x100bb.png', '600x600bb.png');

          albums.push({
            id: `alb_${alb.collectionId}`,
            title: alb.collectionName,
            artist: alb.artistName,
            artistId: alb.artistId ? `art_${alb.artistId}` : null,
            thumbnail: art,
            year: alb.releaseDate ? alb.releaseDate.substring(0, 4) : '2024',
            trackCount: alb.trackCount || 8,
            genre: alb.primaryGenreName || 'Pop',
          });
        }
      }

      // Real Artists
      const artists = [];
      if (artistRes.status === 'fulfilled' && artistRes.value.data?.results) {
        for (const art of artistRes.value.data.results) {
          artists.push({
            id: `art_${art.artistId}`,
            name: art.artistName,
            genre: art.primaryGenreName || 'Artist',
            thumbnail: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400',
          });
        }
      }

      return { songs, albums, artists };
    } catch (err) {
      console.warn('Canonical metadata resolver warning:', err.message);
      return { songs: [], albums: [], artists: [] };
    }
  },

  /**
   * Discovers and binds playable YouTube Audio and Video sources with strict identity validation
   */
  async bindPlaybackSources(canonicalSong, youtubeCandidates = []) {
    if (!canonicalSong) return null;

    const validatedAudioSource = trackIdentityManager.resolvePlaybackSource(
      canonicalSong,
      youtubeCandidates,
      'audio'
    );
    const validatedVideoSource = trackIdentityManager.resolvePlaybackSource(
      canonicalSong,
      youtubeCandidates,
      'video'
    );

    const providerTrackId = validatedAudioSource?.providerTrackId || validatedVideoSource?.providerTrackId || null;

    // Use authentic candidate thumbnail only if validated
    const matchedCandidate = youtubeCandidates.find(
      (c) => (c.id || c.videoId) === providerTrackId
    );
    const thumbnail = matchedCandidate?.thumbnail || canonicalSong.thumbnail;

    return {
      ...canonicalSong,
      canonicalTrackId: canonicalSong.canonicalTrackId || canonicalSong.id,
      providerTrackId,
      provider: providerTrackId ? 'youtube' : 'canonical',
      thumbnail,
      audioSource: validatedAudioSource,
      videoSource: validatedVideoSource,
    };
  },
};
