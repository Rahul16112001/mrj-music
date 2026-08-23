import axios from 'axios';
import { contentClassifier, CONTENT_TYPES } from './contentClassifier.js';
import { searchIntentEngine, INTENT_TYPES } from './searchIntentEngine.js';

function cleanSlug(text = '') {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

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
          const entityKey = `${cleanSlug(cleanTitle)}|${cleanSlug(cleanArtist)}`;

          if (seenEntities.has(entityKey)) continue;
          seenEntities.add(entityKey);

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
            id: entityKey,
            canonicalMusicEntityId: entityKey,
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
            musicEntityKey: entityKey,
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
   * Discovers and binds playable YouTube Audio and Video sources for a canonical music entity
   */
  async bindPlaybackSources(canonicalSong, youtubeCandidates = []) {
    if (!canonicalSong) return null;

    const targetTitle = (canonicalSong.title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const targetArtist = (canonicalSong.artist || '').toLowerCase().replace(/[^a-z0-9]/g, '');

    let bestAudioCandidate = null;
    let bestAudioScore = -Infinity;

    let bestVideoCandidate = null;
    let bestVideoScore = -Infinity;

    for (const cand of youtubeCandidates) {
      const candRawTitle = (cand.rawTitle || cand.title || '').toLowerCase();
      const candTitleClean = candRawTitle.replace(/[^a-z0-9]/g, '');
      const candArtist = (cand.artist || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const text = `${candRawTitle} ${candArtist}`;

      const classification = contentClassifier.classifySearchResult(cand);

      // Skip reactions, shorts, slowed, compilations, covers
      if (classification.isReaction || classification.isShort || classification.isCompilation || classification.isSlowed || classification.isCover) {
        continue;
      }

      // 1. Audio Candidate Scoring
      let aScore = 0;

      if (candTitleClean.includes(targetTitle) || targetTitle.includes(candTitleClean)) {
        aScore += 100;
      }
      if (text.includes(targetArtist) || targetArtist.includes(candArtist)) {
        aScore += 50;
      }

      // Verified Official Audio / Full Audio / Topic track
      if (text.includes('full audio') || text.includes('official audio') || text.includes('- topic')) {
        aScore += 80;
      }
      if (classification.isOfficialMusic) {
        aScore += 40;
      }

      if (classification.isMusicVideo) {
        aScore += 20; // Valid fallback
      }

      const durDiff = Math.abs(cand.duration - canonicalSong.duration);
      if (durDiff <= 25) {
        aScore += 60;
      } else if (durDiff <= 60) {
        aScore += 20;
      }

      if (aScore > bestAudioScore) {
        bestAudioScore = aScore;
        bestAudioCandidate = cand;
      }

      // 2. Video Candidate Scoring
      if (classification.isMusicVideo || classification.contentType === CONTENT_TYPES.VIDEO || classification.isLyricsVideo) {
        let vScore = 0;
        if (candTitleClean.includes(targetTitle)) vScore += 100;
        if (text.includes(targetArtist)) vScore += 50;
        if (classification.isMusicVideo) vScore += 60;
        if (classification.isOfficialMusic) vScore += 40;

        if (vScore > bestVideoScore) {
          bestVideoScore = vScore;
          bestVideoCandidate = cand;
        }
      }
    }

    const selectedAudio = bestAudioCandidate || youtubeCandidates[0];
    const selectedVideo = bestVideoCandidate || bestAudioCandidate;

    const audioId = selectedAudio ? selectedAudio.id : canonicalSong.id;
    const videoId = selectedVideo ? selectedVideo.id : audioId;

    return {
      ...canonicalSong,
      providerTrackId: audioId,
      provider: 'youtube',
      thumbnail: selectedAudio?.thumbnail || canonicalSong.thumbnail,
      audioSource: {
        sourceId: `src_aud_${audioId}`,
        musicEntityId: canonicalSong.id,
        type: 'audio',
        provider: 'youtube',
        providerTrackId: audioId,
        duration: selectedAudio ? selectedAudio.duration : canonicalSong.duration,
      },
      videoSource: {
        sourceId: `src_vid_${videoId}`,
        musicEntityId: canonicalSong.id,
        type: 'video',
        provider: 'youtube',
        providerTrackId: videoId,
        duration: selectedVideo ? selectedVideo.duration : canonicalSong.duration,
      },
    };
  },
};
