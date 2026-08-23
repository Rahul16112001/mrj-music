import axios from 'axios';
import { contentClassifier } from '../catalog/contentClassifier.js';

// Multiple resilient multi-region stream endpoints
const PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks',
  'https://api.piped.privacydev.net',
  'https://pipedapi.leptons.xyz',
  'https://piped-api.lunar.icu',
];

const INVIDIOUS_INSTANCES = [
  'https://yt.artemislena.eu',
  'https://invidious.jing.rocks',
  'https://invidious.nerdvpn.de',
  'https://inv.nadeko.net',
];

// Instance health and latency tracking
const instanceHealth = new Map();

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
  // 1. Search Music Catalog (Live Scraper)
  async search(query, type = 'all', limit = 30) {
    if (!query || !query.trim()) return { results: [], artists: [] };

    try {
      const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(
        query.trim() + (type === 'songs' ? ' official audio song' : '')
      )}`;

      const startTime = Date.now();
      const response = await axios.get(searchUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        timeout: 6000,
      });

      const match = response.data.match(/var ytInitialData = ({.+?});<\/script>/);
      const results = [];
      const artists = [];

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
              const rawTitle = v.title?.runs?.[0]?.text || 'Untitled';
              const artist = v.ownerText?.runs?.[0]?.text || 'Popular Artist';
              const lengthText = v.lengthText?.simpleText || '3:30';

              const parts = lengthText.split(':').map(Number);
              const durationSec =
                parts.length === 2
                  ? parts[0] * 60 + parts[1]
                  : parts.length === 3
                  ? parts[0] * 3600 + parts[1] * 60 + parts[2]
                  : 210;

              // Filter out compilations
              if (!contentClassifier.isCompilation(rawTitle, artist, durationSec)) {
                results.push({
                  id: videoId,
                  title: contentClassifier.cleanTitle(rawTitle),
                  artist,
                  album: 'Single',
                  thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
                  duration: durationSec,
                  views: v.viewCountText?.simpleText || null,
                  provider: 'youtube',
                });
              }
            }

            if (item.channelRenderer) {
              const c = item.channelRenderer;
              artists.push({
                id: c.channelId,
                name: c.title?.simpleText || 'Artist',
                thumbnail:
                  c.thumbnail?.thumbnails?.[0]?.url ||
                  'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300',
                subscribers: c.subscriberCountText?.simpleText || null,
              });
            }
          }
        }
      }

      return {
        results: results.slice(0, limit),
        artists: artists.slice(0, 6),
      };
    } catch (err) {
      console.warn('Search provider notice:', err.message);
      return { results: [], artists: [] };
    }
  },

  // 2. Fetch Charts / Trending
  async getCharts() {
    const defaultTracks = [
      { id: 'fJ9rUzIMcZQ', title: 'Bohemian Rhapsody', artist: 'Queen', duration: 359 },
      { id: 'fHI8X4OXluQ', title: 'Blinding Lights', artist: 'The Weeknd', duration: 204 },
      { id: 'ic8j13piAhQ', title: 'Cruel Summer', artist: 'Taylor Swift', duration: 180 },
      { id: '_dK2tDK9grQ', title: 'Shape of You', artist: 'Ed Sheeran', duration: 235 },
      { id: 'WHuBW3qKm9g', title: 'Levitating', artist: 'Dua Lipa', duration: 221 },
      { id: 'V1Z586zoeeE', title: 'As It Was', artist: 'Harry Styles', duration: 166 },
      { id: 'G7KNmW9a75Y', title: 'Flowers', artist: 'Miley Cyrus', duration: 202 },
      { id: 'u6lihZAcy4s', title: 'Save Your Tears', artist: 'The Weeknd', duration: 217 },
      { id: '7Ya2U8XN_Zw', title: 'Uptown Funk', artist: 'Mark Ronson ft. Bruno Mars', duration: 271 },
      { id: 'IhP3J0j9JmY', title: 'Believer', artist: 'Imagine Dragons', duration: 203 },
      { id: 'iKzRIweSBLA', title: 'Perfect', artist: 'Ed Sheeran', duration: 264 },
    ];

    return {
      trending: defaultTracks,
      quickPicks: defaultTracks.slice(0, 10),
    };
  },

  // 3. Get Artist Details
  async getArtist(artistName) {
    if (!artistName) return null;
    const cleanName = artistName.replace(/\(.*?\)/g, '').trim();
    const searchRes = await this.search(`${cleanName} official songs`, 'songs', 20);

    return {
      id: 'art_' + Buffer.from(cleanName).toString('hex').slice(0, 16),
      name: cleanName,
      monthlyListeners: 'Verified Artist',
      avatar:
        searchRes.artists?.[0]?.thumbnail ||
        'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&q=80',
      headerImage: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1200&q=80',
      topTracks: searchRes.results.slice(0, 12),
      albums: [
        {
          id: 'alb_essentials_' + cleanName.toLowerCase().replace(/\s+/g, '_'),
          title: `${cleanName} - Essentials`,
          year: '2024',
          thumbnail:
            searchRes.results?.[0]?.thumbnail ||
            'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300',
          trackCount: searchRes.results.length,
        },
      ],
      singles: searchRes.results.slice(0, 8).map((t) => ({
        id: `sgl_${t.id}`,
        title: t.title,
        year: '2024',
        thumbnail: t.thumbnail,
      })),
      similarArtists: [
        {
          id: 'sim_1',
          name: `${cleanName} Radio`,
          thumbnail: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=200',
        },
      ],
    };
  },

  // 4. Get Album Details
  async getAlbum(albumId) {
    const rawName = albumId.replace(/^alb_essentials_/, '').replace(/_/g, ' ');
    const searchRes = await this.search(`${rawName} songs`, 'songs', 15);

    return {
      id: albumId,
      title: `${rawName.toUpperCase()} Essentials`,
      artist: rawName,
      year: '2024',
      thumbnail:
        searchRes.results?.[0]?.thumbnail ||
        'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400',
      tracks: searchRes.results,
    };
  },

  // 5. Gather Large Candidate Pool for Recommendations (100+ candidates)
  async getCandidatePool(seedTrack) {
    const queries = [];
    const seedArtist = seedTrack.artist ? seedTrack.artist.replace(/\(.*?\)/g, '').trim() : '';
    const seedTitle = seedTrack.title ? seedTrack.title.replace(/\(.*?\)/g, '').trim() : '';
    const seedGenre = seedTrack.genre || '';

    if (seedArtist) {
      queries.push(`${seedArtist} top tracks`);
      queries.push(`${seedArtist} similar artists`);
    }
    if (seedGenre) {
      queries.push(`${seedGenre} hit songs`);
    }
    if (seedTitle) {
      queries.push(`${seedTitle} song radio`);
    }
    queries.push('global trending hits');

    const trackMap = new Map();

    const searchPromises = queries.map(async (q) => {
      try {
        const res = await this.search(q, 'songs', 30);
        for (const t of res.results) {
          if (!trackMap.has(t.id)) {
            trackMap.set(t.id, t);
          }
        }
      } catch (err) {
        // Continue on query failure
      }
    });

    await Promise.all(searchPromises);

    if (trackMap.size < 20) {
      const charts = await this.getCharts();
      for (const t of charts.trending) {
        if (!trackMap.has(t.id)) trackMap.set(t.id, t);
      }
    }

    return Array.from(trackMap.values());
  },

  // 6. AudioSourceResolver with SSRF Protection & Stream Validation
  async resolveAudioStream(videoId) {
    if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
      return null;
    }

    // 1. Try Piped instances
    for (const instance of PIPED_INSTANCES) {
      const t0 = Date.now();
      try {
        const resp = await axios.get(`${instance}/streams/${videoId}`, { timeout: 3500 });
        if (resp.data && resp.data.audioStreams && resp.data.audioStreams.length > 0) {
          const stream = resp.data.audioStreams[0];
          if (stream.url && (stream.url.startsWith('https://') || stream.url.startsWith('http://'))) {
            recordInstanceMetric(instance, true, Date.now() - t0);
            return {
              url: stream.url,
              mimeType: stream.mimeType || 'audio/webm',
              codec: stream.codec || 'opus',
              bitrate: stream.bitrate || 160000,
              sampleRate: stream.sampleRate || 48000,
              duration: resp.data.duration || null,
              seekable: true,
              expiresAt: Date.now() + 6 * 3600 * 1000,
              provider: 'piped_audio_stream',
            };
          }
        }
        recordInstanceMetric(instance, false, Date.now() - t0);
      } catch (e) {
        recordInstanceMetric(instance, false, Date.now() - t0);
      }
    }

    // 2. Try Invidious instances
    for (const instance of INVIDIOUS_INSTANCES) {
      const t0 = Date.now();
      try {
        const resp = await axios.get(`${instance}/api/v1/videos/${videoId}`, { timeout: 3500 });
        if (resp.data && resp.data.adaptiveFormats) {
          const audioFormats = resp.data.adaptiveFormats.filter((f) => f.type && f.type.startsWith('audio/'));
          if (audioFormats.length > 0) {
            const stream = audioFormats[0];
            recordInstanceMetric(instance, true, Date.now() - t0);
            return {
              url: stream.url,
              mimeType: stream.type || 'audio/webm',
              codec: stream.encoding || 'opus',
              bitrate: stream.bitrate || 128000,
              sampleRate: stream.audioSampleRate || 44100,
              duration: resp.data.lengthSeconds || null,
              seekable: true,
              expiresAt: Date.now() + 6 * 3600 * 1000,
              provider: 'invidious_audio_stream',
            };
          }
        }
        recordInstanceMetric(instance, false, Date.now() - t0);
      } catch (e) {
        recordInstanceMetric(instance, false, Date.now() - t0);
      }
    }

    return null;
  },

  // 7. Get Synced Lyrics via LRCLIB
  async getLyrics(title, artist, duration) {
    try {
      const cleanTitle = title ? title.replace(/\(.*?\)/g, '').replace(/\[.*?\]/g, '').trim() : '';
      const cleanArtist = artist ? artist.replace(/\(.*?\)/g, '').replace(/\[.*?\]/g, '').trim() : '';

      const resp = await axios.get('https://lrclib.net/api/get', {
        params: {
          track_name: cleanTitle,
          artist_name: cleanArtist,
          duration: duration || undefined,
        },
        timeout: 4000,
      });

      if (resp.data) {
        return {
          syncedLyrics: resp.data.syncedLyrics || null,
          plainLyrics: resp.data.plainLyrics || null,
        };
      }
    } catch (e) {
      // Fallback
    }

    return {
      syncedLyrics: null,
      plainLyrics: null,
    };
  },
};
