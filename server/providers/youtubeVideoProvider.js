import axios from 'axios';
import { buildStreamResult, firstString, providerCacheKey } from './providerUtils.js';

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
const streamCache = new Map();
const health = { provider: 'youtube_video', successCount: 0, failureCount: 0, lastFailureReason: null };

function remember(success, error) {
  if (success) {
    health.successCount += 1;
    health.lastFailureReason = null;
  } else {
    health.failureCount += 1;
    health.lastFailureReason = error?.message || String(error);
  }
}

async function raceInstances(instances, pathBuilder, parser) {
  const attempts = instances.map(async (base) => {
    const response = await axios.get(`${base}${pathBuilder()}`, {
      headers: { Accept: 'application/json', 'User-Agent': 'MRJMusic/4.0' },
      timeout: 3500,
    });
    return parser(response.data);
  });
  return Promise.any(attempts);
}

export const youtubeVideoProvider = {
  name: 'youtube_video',
  priority: 5,

  getHealth() { return { ...health }; },

  async search() {
    // Search remains owned by YouTube Music and the existing catalog search.
    return [];
  },

  async resolveStream(trackOrId) {
    const videoId = typeof trackOrId === 'string'
      ? trackOrId
      : firstString(trackOrId?.providerTrackId, trackOrId?.videoId, trackOrId?.id);
    if (!videoId || videoId.includes('|')) return null;
    const key = providerCacheKey(this.name, videoId);
    const cached = key ? streamCache.get(key) : null;
    if (cached && cached.expiresAt > Date.now() + 10_000) return cached;

    try {
      const stream = await raceInstances(PIPED_INSTANCES, () => `/streams/${encodeURIComponent(videoId)}`, (data) => {
        const best = (data?.audioStreams || [])
          .filter((item) => item?.url)
          .sort((a, b) => Number(b.bitrate || 0) - Number(a.bitrate || 0))[0];
        if (!best) throw new Error('Piped returned no direct audio stream');
        return buildStreamResult({
          provider: this.name,
          providerTrackId: videoId,
          url: best.url,
          mimeType: best.mimeType,
          codec: best.codec,
          bitrate: best.quality || best.bitrate,
          expiresAt: Date.now() + 5 * 60 * 1000,
        });
      });
      if (stream?.ok) {
        if (key) streamCache.set(key, stream);
        remember(true);
        return stream;
      }
      throw new Error(stream?.reason || 'Invalid Piped direct audio stream');
    } catch (pipedError) {
      try {
        const stream = await raceInstances(INVIDIOUS_INSTANCES, () => `/api/v1/videos/${encodeURIComponent(videoId)}`, (data) => {
          const best = (data?.adaptiveFormats || [])
            .filter((item) => item?.url && String(item.type || '').toLowerCase().startsWith('audio/'))
            .sort((a, b) => Number(b.bitrate || 0) - Number(a.bitrate || 0))[0];
          if (!best) throw new Error('Invidious returned no direct audio stream');
          return buildStreamResult({
            provider: this.name,
            providerTrackId: videoId,
            url: best.url,
            mimeType: best.type,
            codec: best.audioQuality,
            bitrate: best.bitrate,
            expiresAt: Date.now() + 5 * 60 * 1000,
          });
        });
        if (!stream?.ok) throw new Error(stream?.reason || 'Invalid Invidious direct audio stream');
        if (key) streamCache.set(key, stream);
        remember(true);
        return stream;
      } catch (invidiousError) {
        remember(false, new Error(`${pipedError.message}; ${invidiousError.message}`));
        return null;
      }
    }
  },

  async isAvailable() { return true; },
  async invalidate(videoId) {
    const key = providerCacheKey(this.name, videoId);
    if (key) streamCache.delete(key);
  },
};

export default youtubeVideoProvider;
