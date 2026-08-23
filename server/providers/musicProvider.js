import axios from 'axios';

const INVIDIOUS_INSTANCES = [
  'https://yt.artemislena.eu',
  'https://invidious.jing.rocks',
  'https://invidious.nerdvpn.de',
  'https://inv.nadeko.net',
];

const PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks',
  'https://api.piped.privacydev.net',
  'https://pipedapi.leptons.xyz',
];

export const musicProvider = {
  // 1. Search Music Catalog (Live Scraper)
  async search(query, type = 'all', limit = 30) {
    if (!query || !query.trim()) return { results: [], artists: [] };

    try {
      const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(
        query.trim() + (type === 'songs' ? ' official audio song' : '')
      )}`;

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
              const title = v.title?.runs?.[0]?.text || 'Untitled';
              const artist = v.ownerText?.runs?.[0]?.text || 'Artist';
              const lengthText = v.lengthText?.simpleText || '3:30';

              const parts = lengthText.split(':').map(Number);
              const durationSec =
                parts.length === 2
                  ? parts[0] * 60 + parts[1]
                  : parts.length === 3
                  ? parts[0] * 3600 + parts[1] * 60 + parts[2]
                  : 210;

              results.push({
                id: videoId,
                title,
                artist,
                album: 'Single',
                thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
                duration: durationSec,
                views: v.viewCountText?.simpleText || null,
                provider: 'youtube',
              });
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
    const searchRes = await this.search('top songs global music hits 2026', 'songs', 40);
    if (searchRes.results.length > 0) {
      return {
        trending: searchRes.results,
        quickPicks: searchRes.results.slice(0, 16),
      };
    }

    // Fallback baseline tracks if network query fails
    const defaultTracks = [
      {
        id: 'BddP6PYo2gs',
        title: 'Kesariya',
        artist: 'Arijit Singh, Pritam',
        album: 'Brahmāstra',
        thumbnail: 'https://i.ytimg.com/vi/BddP6PYo2gs/hqdefault.jpg',
        duration: 268,
        genre: 'Bollywood',
      },
      {
        id: 'kJQP7kiw5Fk',
        title: 'Despacito',
        artist: 'Luis Fonsi ft. Daddy Yankee',
        album: 'VIDA',
        thumbnail: 'https://i.ytimg.com/vi/kJQP7kiw5Fk/hqdefault.jpg',
        duration: 282,
        genre: 'Latin / Pop',
      },
      {
        id: 'JGwWNGJdvx8',
        title: 'Shape of You',
        artist: 'Ed Sheeran',
        album: '÷ (Divide)',
        thumbnail: 'https://i.ytimg.com/vi/JGwWNGJdvx8/hqdefault.jpg',
        duration: 233,
        genre: 'Pop',
      },
      {
        id: 'OPf0YbXqDm0',
        title: 'Uptown Funk',
        artist: 'Mark Ronson ft. Bruno Mars',
        album: 'Uptown Special',
        thumbnail: 'https://i.ytimg.com/vi/OPf0YbXqDm0/hqdefault.jpg',
        duration: 270,
        genre: 'Funk / Pop',
      },
    ];

    return {
      trending: defaultTracks,
      quickPicks: defaultTracks,
    };
  },

  // 3. Fetch Artist Profile & Tracks
  async getArtist(artistName) {
    const searchRes = await this.search(`${artistName} official audio top songs`, 'songs', 20);
    const topSongs = searchRes.results;

    if (topSongs.length === 0) return null;

    return {
      id: encodeURIComponent(artistName.toLowerCase().replace(/\s+/g, '-')),
      name: artistName,
      thumbnail: topSongs[0]?.thumbnail || null,
      subscribers: null,
      monthlyListeners: null,
      bio: null,
      topSongs: topSongs.slice(0, 10),
      albums: [],
      singles: topSongs.slice(5, 15),
      relatedArtists: [],
    };
  },

  // 4. Fetch Album
  async getAlbum(albumId) {
    return {
      id: albumId,
      title: 'Album',
      artist: 'Artist',
      thumbnail: null,
      year: null,
      trackCount: 0,
      totalDuration: 0,
      tracks: [],
    };
  },

  // 5. Dynamic Large Candidate Pool for Seed Radio (100+ candidates)
  async getCandidatePool(seedTrack) {
    const pool = [];
    const seenIds = new Set();

    const addTracks = (tracks) => {
      for (const t of tracks) {
        if (!seenIds.has(t.id)) {
          seenIds.add(t.id);
          pool.push(t);
        }
      }
    };

    try {
      const queries = [
        `${seedTrack.artist} songs playlist`,
        `${seedTrack.title} similar songs`,
        `${seedTrack.artist} top hits`,
        `${seedTrack.genre || 'popular'} music playlist`,
      ];

      const searchPromises = queries.map((q) => this.search(q, 'songs', 30));
      const results = await Promise.allSettled(searchPromises);

      for (const res of results) {
        if (res.status === 'fulfilled' && res.value?.results) {
          addTracks(res.value.results);
        }
      }
    } catch {}

    return pool;
  },

  // 6. Real Stream Resolution (SSRF-Protected)
  async resolveAudioStream(videoId) {
    if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
      return null;
    }

    for (const inst of INVIDIOUS_INSTANCES) {
      try {
        const resp = await axios.get(`${inst}/api/v1/videos/${videoId}`, { timeout: 3500 });
        const formats = resp.data?.adaptiveFormats?.filter((f) => f.type?.includes('audio')) || [];
        if (formats.length > 0) {
          const best = formats[0];
          return {
            url: best.url,
            mimeType: best.type || 'audio/webm',
            bitrate: best.bitrate ? `${Math.round(best.bitrate / 1000)} kbps` : null,
            codec: best.container || 'opus',
          };
        }
      } catch {}
    }

    for (const inst of PIPED_INSTANCES) {
      try {
        const resp = await axios.get(`${inst}/streams/${videoId}`, { timeout: 3500 });
        const audios = resp.data?.audioStreams || [];
        if (audios.length > 0) {
          const best = audios[0];
          return {
            url: best.url,
            mimeType: best.mimeType || 'audio/webm',
            bitrate: best.bitrate ? `${Math.round(best.bitrate / 1000)} kbps` : null,
            codec: best.codec || 'opus',
          };
        }
      } catch {}
    }

    return null;
  },

  // 7. Synced Lyrics
  async getLyrics(title, artist, duration) {
    if (!title || !artist) return { syncedLyrics: null, plainLyrics: null };
    const cleanTrack = String(title).replace(/\(.*?\)|\[.*?\]|official|video|audio|lyrics/gi, '').trim();

    try {
      const lrcUrl = `https://lrclib.net/api/get?track_name=${encodeURIComponent(cleanTrack)}&artist_name=${encodeURIComponent(
        artist
      )}&duration=${duration || ''}`;
      const response = await axios.get(lrcUrl, { timeout: 3500 });

      if (response.data) {
        return {
          syncedLyrics: response.data.syncedLyrics || null,
          plainLyrics: response.data.plainLyrics || null,
        };
      }
    } catch {}

    return { syncedLyrics: null, plainLyrics: null };
  },
};
