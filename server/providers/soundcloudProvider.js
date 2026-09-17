import axios from 'axios';
import {
  buildStreamResult,
  firstString,
  normalizeArtworkUrl,
  normalizeDuration,
  normalizeTrackMetadata,
  providerCacheKey,
} from './providerUtils.js';

const API_BASE = 'https://api-v2.soundcloud.com';
const REQUEST_TIMEOUT_MS = Number(process.env.SOUNDCLOUD_TIMEOUT_MS || 8000);
const MAX_RETRIES = 3;
const streamCache = new Map();
const health = {
  provider: 'soundcloud',
  successCount: 0,
  failureCount: 0,
  lastSuccessAt: null,
  lastFailureAt: null,
  lastFailureReason: null,
};

function clientId() {
  return firstString(process.env.SOUNDCLOUD_CLIENT_ID);
}

function rememberSuccess() {
  health.successCount += 1;
  health.lastSuccessAt = Date.now();
  health.lastFailureReason = null;
}

function rememberFailure(error) {
  health.failureCount += 1;
  health.lastFailureAt = Date.now();
  health.lastFailureReason = error?.message || String(error);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function request(path, params = {}) {
  const id = clientId();
  if (!id) throw new Error('SOUNDCLOUD_CLIENT_ID is not configured');
  for (let attempt = 0; ; attempt += 1) {
    try {
      const response = await axios.get(`${API_BASE}${path}`, {
        params: { ...params, client_id: id },
        headers: {
          Accept: 'application/json',
          'User-Agent': 'MRJMusic/4.0',
        },
        timeout: REQUEST_TIMEOUT_MS,
      });
      return response.data;
    } catch (error) {
      const status = error?.response?.status;
      if (![403, 429].includes(status) || attempt >= MAX_RETRIES) throw error;
      await sleep(250 * (2 ** attempt));
    }
  }
}

function artwork(track) {
  const value = firstString(track.artwork_url, track.user?.avatar_url);
  return normalizeArtworkUrl(value?.replace('-large', '-t500x500'));
}

function normalizeTrack(track) {
  const id = String(track.id);
  const normalized = normalizeTrackMetadata({
    title: track.title,
    artist: track.user?.username || track.publisher_metadata?.artist,
    album: track.publisher_metadata?.album_name,
    duration: Number(track.duration || 0) / 1000,
    artworkUrl: artwork(track),
    provider: 'soundcloud',
    providerTrackId: id,
  });
  return {
    id,
    canonicalTrackId: null,
    title: normalized.title,
    artist: normalized.artist,
    album: normalized.album,
    duration: normalizeDuration(normalized.duration),
    thumbnail: normalized.artworkUrl,
    provider: 'soundcloud',
    providerTrackId: id,
    sourceType: 'soundcloud',
    contentType: 'music',
    isOfficialMusic: true,
    isAudioOnly: true,
    playbackFormat: 'audio',
  };
}

function isAudioTranscoding(item) {
  const protocol = item?.format?.protocol || item?.protocol;
  const mime = item?.format?.mime_type || item?.mime_type || '';
  return protocol === 'progressive' && /^audio\//i.test(mime);
}

export const soundcloudProvider = {
  name: 'soundcloud',
  priority: 3,

  getHealth() {
    return { ...health };
  },

  async search(query, limit = 20) {
    if (!firstString(query) || !clientId()) return [];
    try {
      const payload = await request('/search/tracks', { q: query.trim(), limit, offset: 0 });
      const results = (payload?.collection || []).filter((track) => track?.id).slice(0, limit).map(normalizeTrack);
      if (results.length) rememberSuccess();
      return results;
    } catch (error) {
      rememberFailure(error);
      return [];
    }
  },

  async resolveStream(trackOrId) {
    const providerTrackId = typeof trackOrId === 'string'
      ? trackOrId
      : firstString(trackOrId?.providerTrackId, trackOrId?.id);
    if (!providerTrackId || !clientId()) return null;
    const cacheKey = providerCacheKey(this.name, providerTrackId);
    const cached = cacheKey ? streamCache.get(cacheKey) : null;
    if (cached && cached.expiresAt > Date.now() + 10_000) return cached;

    try {
      const payload = await request(`/tracks/${encodeURIComponent(providerTrackId)}/streams`);
      const candidates = (Array.isArray(payload) ? payload : payload?.collection || [])
        .filter(isAudioTranscoding)
        .filter((item) => item.url || item.stream_url)
        .sort((a, b) => Number(b.format?.bitrate || b.bitrate || 0) - Number(a.format?.bitrate || a.bitrate || 0));
      const best = candidates[0];
      if (!best) throw new Error('SoundCloud returned no progressive audio stream');
      const url = firstString(best.url, best.stream_url);
      if (!url) throw new Error('SoundCloud returned an empty stream URL');
      const result = buildStreamResult({
        provider: this.name,
        providerTrackId,
        url,
        mimeType: best.format?.mime_type || best.mime_type,
        codec: best.format?.mime_type,
        bitrate: best.format?.bitrate || best.bitrate,
        expiresAt: Date.now() + 5 * 60 * 1000,
        duration: trackOrId?.duration,
      });
      if (!result.ok) throw new Error(result.reason || 'Invalid SoundCloud stream URL');
      if (cacheKey) streamCache.set(cacheKey, result);
      rememberSuccess();
      return result;
    } catch (error) {
      if (cacheKey) streamCache.delete(cacheKey);
      rememberFailure(error);
      return null;
    }
  },

  async getTrackMetadata(providerTrackId) {
    if (!providerTrackId || !clientId()) return null;
    try {
      return normalizeTrack(await request(`/tracks/${encodeURIComponent(providerTrackId)}`));
    } catch (error) {
      rememberFailure(error);
      return null;
    }
  },

  async getArtwork(providerTrackId) {
    const track = await this.getTrackMetadata(providerTrackId);
    return track?.thumbnail || null;
  },

  async isAvailable() {
    return Boolean(clientId());
  },

  async invalidate(providerTrackId) {
    const key = providerCacheKey(this.name, providerTrackId);
    if (key) streamCache.delete(key);
  },
};

export default soundcloudProvider;
