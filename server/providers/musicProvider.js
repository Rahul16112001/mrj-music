import axios from 'axios';
import { contentClassifier, CONTENT_TYPES } from '../catalog/contentClassifier.js';
import { searchIntentEngine, INTENT_TYPES } from '../catalog/searchIntentEngine.js';
import { canonicalMusicResolver } from '../catalog/canonicalMusicResolver.js';
import { searchRelevanceEngine } from '../catalog/searchRelevanceEngine.js';
import { trackIdentityManager } from '../catalog/trackIdentityManager.js';
import { searchYouTubeHighEnd, searchYouTubeMusic } from '../catalog/youtubeScraper.js';

// Multiple resilient multi-region stream endpoints
const PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks',
  'https://api.piped.privacydev.net',
  'https://pipedapi.leptons.xyz',
  'https://piped-api.lunar.icu',
  'https://piped.video',
];

const INVIDIOUS_INSTANCES = [
  'https://yt.artemislena.eu',
  'https://invidious.jing.rocks',
  'https://invidious.nerdvpn.de',
  'https://inv.nadeko.net',
  'https://invidious.snopyta.org',
];

// Instance health tracking & caching
const instanceHealth = new Map();
const streamCache = new Map();
const lyricsCache = new Map();

function recordInstanceMetric(url, success, latencyMs) {
  const current = instanceHealth.get(url) || { successCount: 0, failCount: 0, avgLatency: 0, lastCheck: Date.now() };
  if (success) {
    current.successCount += 1;
    current.avgLatency = Math.round((current.avgLatency * 0.7) + (latencyMs * 0.3));
  } else {
    current.failCount += 1;
  }
  current.lastCheck = Date.now();
  instanceHealth.set(url, current);
}

export const musicProvider = {
  // 1. Search Music Catalog with Dedicated Search Relevance Engine
  async search(query, type = 'all', limit = 30) {
    if (!query || !query.trim()) {
      return { songs: [], videos: [], artists: [], albums: [], podcasts: [], results: [] };
    }

    const intent = searchIntentEngine.parse(query);
    const normQuery = searchRelevanceEngine.normalize(query);

    try {
      const qTrim = query.trim();
      const [canonicalRes, ytMusicRes, audioYtRes, generalYtRes] = await Promise.allSettled([
        canonicalMusicResolver.searchCanonicalEntities(query, intent),
        searchYouTubeMusic(qTrim, 20),
        searchYouTubeHighEnd(`${qTrim} official audio`, 15),
        searchYouTubeHighEnd(qTrim, 15),
      ]);

      const rawCandidates = [];
      const seenCandIds = new Set();
      const addCand = (res) => {
        if (res.status === 'fulfilled' && Array.isArray(res.value)) {
          for (const c of res.value) {
            if (c && c.id && !seenCandIds.has(c.id)) {
              seenCandIds.add(c.id);
              rawCandidates.push(c);
            }
          }
        }
      };
      addCand(ytMusicRes);
      addCand(audioYtRes);
      addCand(generalYtRes);
      const ytArtists = [];

      // Classify YouTube candidates
      const allClassifiedYt = [];
      for (const raw of rawCandidates) {
        const track = contentClassifier.normalizeTrack(raw);
        if (track.isCompilation || track.isReaction || track.isShort) continue;
        allClassifiedYt.push(track);
      }

      const canonicalData = canonicalRes.status === 'fulfilled' ? canonicalRes.value : { songs: [], albums: [], artists: [] };
      const canonicalSongs = canonicalData.songs || [];
      const realAlbums = canonicalData.albums || [];
      const realArtists = canonicalData.artists.length > 0 ? canonicalData.artists : ytArtists;

      const candidateSongs = [];
      const candidateVideos = [];
      const podcasts = [];

      // Add verified YouTube Music tracks directly
      if (ytMusicRes.status === 'fulfilled' && Array.isArray(ytMusicRes.value)) {
        for (const ytSong of ytMusicRes.value) {
          candidateSongs.push({
            ...ytSong,
            playbackFormat: 'audio',
            sourceType: 'youtube_music',
            isOfficialMusic: true,
            confidenceScore: 100,
          });
        }
      }

      const isExplicitVariant = intent.wantsSlowed || intent.wantsRemix || intent.wantsCover || intent.wantsLive || intent.wantsLyrics;

      if (!isExplicitVariant && canonicalSongs.length > 0) {
        // A. CANONICAL MUSIC ENTITY FIRST (Parallel Source Resolution)
        const boundCandidates = await Promise.all(
          canonicalSongs.slice(0, 8).map((canonical) =>
            canonicalMusicResolver.bindPlaybackSources(canonical, allClassifiedYt)
          )
        );
        candidateSongs.push(...boundCandidates.filter(Boolean));

        // Separate Videos
        for (const track of allClassifiedYt) {
          if (track.isPodcast) {
            podcasts.push(track);
          } else if (track.contentType === CONTENT_TYPES.VIDEO || track.isMusicVideo || track.isLyricsVideo || track.isLive) {
            candidateVideos.push({ ...track, playbackFormat: 'video' });
          }
        }
      } else {
        // B. EXPLICIT VARIANT OR FALLBACK
        for (const track of allClassifiedYt) {
          if (track.isPodcast) {
            podcasts.push(track);
            continue;
          }

          if (isExplicitVariant) {
            candidateSongs.push({ ...track, playbackFormat: 'audio' });
          } else {
            const isTrueMusic = (track.contentType === CONTENT_TYPES.MUSIC || track.isOfficialMusic) &&
              !track.isSlowed && !track.isRemix && !track.isCover && !track.isLive && !track.isLyricsVideo;

            if (isTrueMusic) {
              candidateSongs.push({ ...track, playbackFormat: 'audio' });
            } else {
              candidateVideos.push({ ...track, playbackFormat: 'video' });
            }
          }
        }
      }

      // 2. APPLY SEARCH RELEVANCE ENGINE (Hard filter & ranking)
      const finalSongs = searchRelevanceEngine.filterAndRank(candidateSongs, query, intent, limit);
      const finalVideos = searchRelevanceEngine.filterAndRank(candidateVideos, query, intent, limit);

      // Filter matching Albums
      const matchingAlbums = realAlbums.filter((a) => {
        const normAlb = searchRelevanceEngine.normalize(a.title + ' ' + a.artist);
        return normAlb.includes(normQuery) || normQuery.includes(normAlb);
      });

      // Filter matching Artists
      const matchingArtists = realArtists.filter((a) => {
        const normArt = searchRelevanceEngine.normalize(a.name);
        return normArt.includes(normQuery) || normQuery.includes(normArt);
      });

      return {
        query: query.trim(),
        intent: intent.primaryIntent,
        songs: finalSongs,
        videos: finalVideos,
        artists: matchingArtists.slice(0, 6),
        albums: matchingAlbums.slice(0, 6),
        podcasts: podcasts.slice(0, 4),
        results: finalSongs.length > 0 ? finalSongs : finalVideos,
      };
    } catch (err) {
      console.warn('Search provider notice:', err.message);
      return { songs: [], videos: [], artists: [], albums: [], podcasts: [], results: [] };
    }
  },

  // Direct High-Yield Discovery Search without strict keyword filtering
  async searchDiscovery(query, limit = 30) {
    if (!query || !query.trim()) return [];
    try {
      const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query.trim())}`;
      const ytResponse = await axios.get(searchUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        timeout: 7000,
      });

      const tracks = [];
      if (ytResponse.data) {
        const match = ytResponse.data.match(/var ytInitialData = ({.+?});<\/script>/);
        if (match) {
          const data = JSON.parse(match[1]);
          const contents =
            data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents || [];
          for (const section of contents) {
            const items = section?.itemSectionRenderer?.contents || [];
            for (const item of items) {
              if (item.videoRenderer) {
                const v = item.videoRenderer;
                const videoId = v.videoId;
                const rawTitle = v.title?.runs?.[0]?.text || v.title?.accessibility?.accessibilityData?.label || 'Untitled';
                const artist = v.ownerText?.runs?.[0]?.text || 'Popular Artist';
                const lengthText = v.lengthText?.simpleText || '3:30';

                const parts = lengthText.split(':').map(Number);
                const durationSec =
                  parts.length === 2
                    ? parts[0] * 60 + parts[1]
                    : parts.length === 3
                    ? parts[0] * 3600 + parts[1] * 60 + parts[2]
                    : 210;

                // Exclude long compilations (> 10 mins) and shorts (< 45s)
                if (durationSec > 600 || durationSec < 45) continue;

                // Clean title
                const cleanTitle = rawTitle
                  .replace(/\s*\([^)]*(official|video|audio|lyrics|hd|4k|full song|visualizer)[^)]*\)/gi, '')
                  .replace(/\s*\[[^\]]*(official|video|audio|lyrics|hd|4k|full song|visualizer)[^\]]*\]/gi, '')
                  .trim();

                tracks.push({
                  id: videoId,
                  videoId,
                  providerTrackId: videoId,
                  canonicalTrackId: videoId,
                  title: cleanTitle || rawTitle,
                  rawTitle,
                  artist,
                  duration: durationSec,
                  thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
                  views: v.viewCountText?.simpleText || null,
                  playbackFormat: 'audio',
                });
              }
            }
          }
        }
      }

      // Prioritize studio audio & Topic releases before music videos
      tracks.sort((a, b) => {
        const aIsAudio =
          a.rawTitle.toLowerCase().includes('audio') ||
          a.rawTitle.toLowerCase().includes('official track') ||
          a.artist.toLowerCase().endsWith('- topic');
        const bIsAudio =
          b.rawTitle.toLowerCase().includes('audio') ||
          b.rawTitle.toLowerCase().includes('official track') ||
          b.artist.toLowerCase().endsWith('- topic');
        if (aIsAudio && !bIsAudio) return -1;
        if (!aIsAudio && bIsAudio) return 1;
        return 0;
      });

      return tracks.slice(0, limit);
    } catch (e) {
      console.warn('searchDiscovery failed for ' + query + ':', e.message);
      return [];
    }
  },

  // 2. Build High-Precision Candidate Pool for Recommendations
  async getCandidatePool(seedTrack) {
    if (!seedTrack) return [];

    const queries = [];
    if (seedTrack.artist && seedTrack.artist !== 'Popular Artist') {
      queries.push(`${seedTrack.artist} songs`);
    }
    if (seedTrack.genre) {
      queries.push(`${seedTrack.genre} top hits`);
    }
    queries.push(`${seedTrack.title} similar songs`);

    const pool = new Map();
    for (const q of queries.slice(0, 3)) {
      try {
        const res = await this.search(q, 'songs', 20);
        for (const t of res.songs || []) {
          if (!pool.has(t.id)) pool.set(t.id, t);
        }
      } catch {}
    }

    return Array.from(pool.values());
  },

  // 3. Artist Profile & Discography Resolver
  async getArtist(artistName) {
    if (!artistName || !artistName.trim()) return null;
    const cleanName = artistName.trim();

    try {
      // Query iTunes for artist top songs & albums
      const [artistLookupRes, songsSearchRes, ytSearchRes] = await Promise.allSettled([
        axios.get(`https://itunes.apple.com/search?term=${encodeURIComponent(cleanName)}&entity=musicArtist&limit=3`, { timeout: 4500 }),
        axios.get(`https://itunes.apple.com/search?term=${encodeURIComponent(cleanName)}&entity=song&limit=15`, { timeout: 4500 }),
        axios.get(`https://itunes.apple.com/search?term=${encodeURIComponent(cleanName)}&entity=album&limit=8`, { timeout: 4500 }),
      ]);

      let artistThumbnail = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400';
      let genre = 'Artist';
      let artistId = `art_${encodeURIComponent(cleanName)}`;

      if (artistLookupRes.status === 'fulfilled' && artistLookupRes.value.data?.results?.[0]) {
        const art = artistLookupRes.value.data.results[0];
        genre = art.primaryGenreName || genre;
        artistId = `art_${art.artistId || cleanName}`;
      }

      // Parse Top Songs
      const topSongs = [];
      if (songsSearchRes.status === 'fulfilled' && songsSearchRes.value.data?.results) {
        for (const item of songsSearchRes.value.data.results) {
          const rawTitle = item.trackName || '';
          const rawArtist = item.artistName || cleanName;
          const cleanTitle = contentClassifier.cleanTitle(rawTitle);
          const cleanArtist = contentClassifier.cleanArtist(rawArtist);
          const canonicalTrackId = trackIdentityManager.generateCanonicalTrackId(cleanTitle, cleanArtist);
          const artwork = (item.artworkUrl100 || '')
            .replace('100x100bb.jpg', '600x600bb.jpg')
            .replace('100x100bb.png', '600x600bb.png');

          if (artistThumbnail.includes('unsplash') && artwork) {
            artistThumbnail = artwork;
          }

          topSongs.push({
            id: canonicalTrackId,
            canonicalTrackId,
            title: cleanTitle,
            artist: cleanArtist,
            album: item.collectionName || 'Single',
            duration: Math.round((item.trackTimeMillis || 210000) / 1000),
            thumbnail: artwork || artistThumbnail,
            genre: item.primaryGenreName || genre,
            releaseYear: item.releaseDate ? item.releaseDate.substring(0, 4) : '2024',
            isOfficialMusic: true,
            playbackFormat: 'audio',
            provider: 'canonical',
          });
        }
      }

      // Parse Albums
      const albums = [];
      if (ytSearchRes.status === 'fulfilled' && ytSearchRes.value.data?.results) {
        for (const alb of ytSearchRes.value.data.results) {
          const art = (alb.artworkUrl100 || '')
            .replace('100x100bb.jpg', '600x600bb.jpg')
            .replace('100x100bb.png', '600x600bb.png');

          albums.push({
            id: `alb_${alb.collectionId}`,
            title: alb.collectionName,
            artist: alb.artistName || cleanName,
            thumbnail: art,
            year: alb.releaseDate ? alb.releaseDate.substring(0, 4) : '2024',
            trackCount: alb.trackCount || 8,
            genre: alb.primaryGenreName || genre,
          });
        }
      }

      // Fallback songs if none found
      if (topSongs.length === 0) {
        const ytResults = await this.search(`${cleanName} top songs`, 'songs', 10);
        topSongs.push(...(ytResults.songs || []));
      }

      return {
        id: artistId,
        name: cleanName,
        thumbnail: artistThumbnail,
        genre,
        monthlyListeners: `${(Math.floor(Math.random() * 20) + 10)}.${Math.floor(Math.random() * 9)}M Monthly Listeners`,
        bio: `${cleanName} is a globally recognized artist with multiple top charting albums and trending releases.`,
        topSongs: topSongs.slice(0, 10),
        albums: albums.slice(0, 8),
        relatedArtists: [
          { id: 'rel_1', name: 'Arijit Singh', thumbnail: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300' },
          { id: 'rel_2', name: 'Shreya Ghoshal', thumbnail: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300' },
          { id: 'rel_3', name: 'Diljit Dosanjh', thumbnail: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300' },
          { id: 'rel_4', name: 'The Weeknd', thumbnail: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=300' },
          { id: 'rel_5', name: 'Taylor Swift', thumbnail: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300' },
        ].filter(r => r.name.toLowerCase() !== cleanName.toLowerCase()),
      };
    } catch (err) {
      console.warn('Artist provider error:', err.message);
      return null;
    }
  },

  // 4. Album & Tracklist Resolver
  async getAlbum(albumId) {
    if (!albumId) return null;

    try {
      let collectionId = albumId;
      if (albumId.startsWith('alb_')) {
        collectionId = albumId.replace('alb_', '');
      }

      const res = await axios.get(`https://itunes.apple.com/lookup?id=${encodeURIComponent(collectionId)}&entity=song`, { timeout: 4500 });
      const results = res.data?.results || [];

      if (results.length === 0) return null;

      const albumMeta = results[0];
      const artwork = (albumMeta.artworkUrl100 || '')
        .replace('100x100bb.jpg', '600x600bb.jpg')
        .replace('100x100bb.png', '600x600bb.png');

      const tracks = [];
      for (const item of results.slice(1)) {
        const rawTitle = item.trackName || '';
        const rawArtist = item.artistName || albumMeta.artistName || '';
        const cleanTitle = contentClassifier.cleanTitle(rawTitle);
        const cleanArtist = contentClassifier.cleanArtist(rawArtist);
        const canonicalTrackId = trackIdentityManager.generateCanonicalTrackId(cleanTitle, cleanArtist);

        tracks.push({
          id: canonicalTrackId,
          canonicalTrackId,
          title: cleanTitle,
          artist: cleanArtist,
          album: albumMeta.collectionName || 'Album',
          duration: Math.round((item.trackTimeMillis || 210000) / 1000),
          thumbnail: artwork,
          genre: item.primaryGenreName || albumMeta.primaryGenreName || 'Pop',
          releaseYear: albumMeta.releaseDate ? albumMeta.releaseDate.substring(0, 4) : '2024',
          isOfficialMusic: true,
          playbackFormat: 'audio',
          provider: 'canonical',
        });
      }

      return {
        id: albumId,
        title: albumMeta.collectionName || 'Album',
        artist: albumMeta.artistName || 'Artist',
        thumbnail: artwork,
        year: albumMeta.releaseDate ? albumMeta.releaseDate.substring(0, 4) : '2024',
        trackCount: tracks.length || albumMeta.trackCount || 1,
        genre: albumMeta.primaryGenreName || 'Pop',
        tracks,
      };
    } catch (err) {
      console.warn('Album provider error:', err.message);
      return null;
    }
  },

  // 5. Synced & Plain Lyrics Resolver (LRCLIB Integration)
  async getLyrics(trackTitle, artistName, durationSec) {
    if (!trackTitle) return { syncedLyrics: null, plainLyrics: null };
    const cacheKey = `${trackTitle.toLowerCase().trim()}_${(artistName || '').toLowerCase().trim()}`;
    if (lyricsCache.has(cacheKey)) {
      return lyricsCache.get(cacheKey);
    }

    try {
      const cleanTitle = contentClassifier.cleanTitle(trackTitle);
      const cleanArtist = contentClassifier.cleanArtist(artistName || '');

      // Direct LRCLIB get request
      let url = `https://lrclib.net/api/get?track_name=${encodeURIComponent(cleanTitle)}&artist_name=${encodeURIComponent(cleanArtist)}`;
      if (durationSec && Number(durationSec) > 0) {
        url += `&duration=${Math.round(Number(durationSec))}`;
      }

      const res = await axios.get(url, {
        headers: { 'User-Agent': 'MRJMusic/2.0 (https://github.com/Rahul16112001/mrj-music)' },
        timeout: 3500,
      });

      if (res.data && (res.data.syncedLyrics || res.data.plainLyrics)) {
        const payload = {
          syncedLyrics: res.data.syncedLyrics || null,
          plainLyrics: res.data.plainLyrics || null,
          track: res.data.trackName || cleanTitle,
          artist: res.data.artistName || cleanArtist,
          isSynced: !!res.data.syncedLyrics,
        };
        lyricsCache.set(cacheKey, payload);
        return payload;
      }
    } catch {
      // Search fallback
      try {
        const searchRes = await axios.get(
          `https://lrclib.net/api/search?q=${encodeURIComponent(trackTitle + ' ' + (artistName || ''))}`,
          {
            headers: { 'User-Agent': 'MRJMusic/2.0 (https://github.com/Rahul16112001/mrj-music)' },
            timeout: 3000,
          }
        );
        if (Array.isArray(searchRes.data) && searchRes.data.length > 0) {
          const first = searchRes.data[0];
          const payload = {
            syncedLyrics: first.syncedLyrics || null,
            plainLyrics: first.plainLyrics || null,
            track: first.trackName || trackTitle,
            artist: first.artistName || artistName,
            isSynced: !!first.syncedLyrics,
          };
          lyricsCache.set(cacheKey, payload);
          return payload;
        }
      } catch {}
    }

    const empty = { syncedLyrics: null, plainLyrics: null };
    lyricsCache.set(cacheKey, empty);
    return empty;
  },

  // 6. Multi-Region Resilient Stream Resolver
  async resolveAudioStream(videoId) {
    if (!videoId) return null;
    let actualId = videoId;

    // Resolve canonical string if needed
    if (videoId.includes('|')) {
      const parts = videoId.split('|');
      const title = parts[0].replace(/-/g, ' ');
      const artist = parts[1] ? parts[1].replace(/-/g, ' ') : '';
      const searchRes = await this.search(`${title} ${artist}`, 'songs', 5);
      const top = searchRes.songs[0];
      if (top && top.providerTrackId && !top.providerTrackId.includes('|')) {
        actualId = top.providerTrackId;
      }
    }

    if (streamCache.has(actualId)) {
      const cached = streamCache.get(actualId);
      if (cached.expiresAt > Date.now()) {
        return cached;
      }
    }

    // Concurrent race on Piped & Invidious instances
    const instancePromises = PIPED_INSTANCES.slice(0, 3).map(async (base) => {
      const startTime = Date.now();
      const res = await axios.get(`${base}/streams/${actualId}`, { timeout: 3000 });
      recordInstanceMetric(base, true, Date.now() - startTime);
      const audioStreams = (res.data.audioStreams || []).sort(
        (a, b) => (b.bitrate || 0) - (a.bitrate || 0)
      );
      if (audioStreams.length > 0) {
        const best = audioStreams[0];
        return {
          url: best.url,
          mimeType: best.mimeType || 'audio/webm',
          codec: best.codec || 'opus',
          bitrate: best.quality || `${Math.round((best.bitrate || 160000) / 1000)} kbps`,
          sampleRate: '48000 Hz',
          expiresAt: Date.now() + 6 * 3600 * 1000,
          provider: 'piped-stream',
          videoId: actualId,
        };
      }
      throw new Error('No audio streams');
    });

    try {
      const stream = await Promise.any(instancePromises);
      streamCache.set(actualId, stream);
      return stream;
    } catch {
      // Invidious fallback race
      const invidiousPromises = INVIDIOUS_INSTANCES.slice(0, 2).map(async (base) => {
        const startTime = Date.now();
        const res = await axios.get(`${base}/api/v1/videos/${actualId}`, { timeout: 3000 });
        recordInstanceMetric(base, true, Date.now() - startTime);
        const formatStreams = (res.data.adaptiveFormats || []).filter((f) =>
          (f.type || '').startsWith('audio')
        );
        formatStreams.sort((a, b) => (Number(b.bitrate) || 0) - (Number(a.bitrate) || 0));
        if (formatStreams.length > 0) {
          const best = formatStreams[0];
          return {
            url: best.url,
            mimeType: best.type || 'audio/mp4',
            codec: best.audioQuality || 'm4a',
            bitrate: `${Math.round((Number(best.bitrate) || 128000) / 1000)} kbps`,
            sampleRate: '44100 Hz',
            expiresAt: Date.now() + 6 * 3600 * 1000,
            provider: 'invidious-stream',
            videoId: actualId,
          };
        }
        throw new Error('No format streams');
      });

      try {
        const stream = await Promise.any(invidiousPromises);
        streamCache.set(actualId, stream);
        return stream;
      } catch {
        return null;
      }
    }
  },
};
