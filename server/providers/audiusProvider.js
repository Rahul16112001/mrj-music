import axios from 'axios';
import {
  buildStreamResult,
  firstString,
  normalizeArtworkUrl,
  normalizeDuration,
  normalizeTrackMetadata,
  providerCacheKey,
  validateDirectAudioUrl,
} from './providerUtils.js';

const API_BASE = process.env.AUDIUS_API_BASE_URL || 'https://api.audius.co/v1';
const REQUEST_TIMEOUT_MS = Number(process.env.AUDIUS_TIMEOUT_MS || 8000);
const streamCache = new Map();
const health = { provider: 'audius', successCount: 0, failureCount: 0, lastSuccessAt: null, lastFailureAt: null, lastFailureReason: null };

function headers() {
  const result = { Accept: 'application/json', 'User-Agent': 'MRJMusic/4.0' };
  if (process.env.AUDIUS_API_KEY) result['X-API-Key'] = process.env.AUDIUS_API_KEY;
  if (process.env.AUDIUS_BEARER_TOKEN) result.Authorization = `Bearer ${process.env.AUDIUS_BEARER_TOKEN}`;
  return result;
}

function remember(success, error) {
  if (success) {
    health.successCount += 1;
    health.lastSuccessAt = Date.now();
    health.lastFailureReason = null;
  } else {
    health.failureCount += 1;
    health.lastFailureAt = Date.now();
    health.lastFailureReason = error?.message || String(error);
  }
}

function artwork(track) {
  const value = firstString(track.artwork?.['1000x1000'], track.artwork?.['480x480'], track.artwork?.['150x150']);
  return normalizeArtworkUrl(value);
}

function normalizeTrack(track) {
  const providerTrackId = String(track.id);
  const normalized = normalizeTrackMetadata({
    title: track.title,
    artist: track.user?.name || track.user?.handle,
    album: track.album_name,
    duration: track.duration,
    artworkUrl: artwork(track),
    provider: 'audius',
    providerTrackId,
  });
  return {
    id: providerTrackId,
    canonicalTrackId: null,
    title: normalized.title,
    artist: normalized.artist,
    album: normalized.album,
    duration: normalizeDuration(normalized.duration),
    thumbnail: normalized.artworkUrl,
    provider: 'audius',
    providerTrackId,
    sourceType: 'audius',
    contentType: 'music',
    isOfficialMusic: true,
    isAudioOnly: true,
    playbackFormat: 'audio',
  };
}

async function request(path, params = {}) {
  const response = await axios.get(`${API_BASE}${path}`, {
    params,
    headers: headers(),
    timeout: REQUEST_TIMEOUT_MS,
  });
  return response.data?.data ?? response.data;
}

async function resolveRedirectedAudioUrl(providerTrackId) {
  const response = await axios.get(`${API_BASE}/tracks/${encodeURIComponent(providerTrackId)}/stream`, {
    params: { app_name: 'MRJMusic' },
    headers: headers(),
    timeout: REQUEST_TIMEOUT_MS,
    maxRedirects: 5,
    responseType: 'stream',
    validateStatus: (status) => status >= 200 && status < 300,
  });
  response.data?.destroy?.();
  const finalUrl = firstString(
    response.request?.res?.responseUrl,
    response.request?.responseURL,
  );
  const mimeType = response.headers?.['content-type']?.split(';', 1)[0];
  if (!finalUrl) throw new Error('Audius did not return a direct stream URL');
  return { url: finalUrl, mimeType };
}

export const audiusProvider = {
  name: 'audius',
  priority: 4,

  getHealth() { return { ...health }; },

  async search(query, limit = 20) {
    if (!firstString(query)) return [];
    try {
      const tracks = await request('/tracks/search', { query: query.trim(), limit, offset: 0, sort_method: 'relevant' });
      const results = (Array.isArray(tracks) ? tracks : []).filter((track) => track?.id).map(normalizeTrack).slice(0, limit);
      if (results.length) remember(true);
      return results;
    } catch (error) {
      remember(false, error);
      return [];
    }
  },

  async resolveStream(trackOrId) {
    const providerTrackId = typeof trackOrId === 'string'
      ? trackOrId
      : firstString(trackOrId?.providerTrackId, trackOrId?.id);
    if (!providerTrackId) return null;
    const key = providerCacheKey(this.name, providerTrackId);
    const cached = key ? streamCache.get(key) : null;
    if (cached && cached.expiresAt > Date.now() + 10_000) return cached;

    try {
      const redirected = await resolveRedirectedAudioUrl(providerTrackId);
      const validation = validateDirectAudioUrl(redirected.url, { mimeType: redirected.mimeType });
      if (!validation.valid || !/^audio\//i.test(redirected.mimeType || '')) {
        throw new Error(`Invalid Audius audio stream: ${validation.reason || 'non_audio_content_type'}`);
      }
      const result = buildStreamResult({
        provider: this.name,
        providerTrackId,
        url: validation.url,
        mimeType: redirected.mimeType,
        codec: redirected.mimeType,
        expiresAt: Date.now() + 5 * 60 * 1000,
        duration: trackOrId?.duration,
      });
      if (!result.ok) throw new Error(result.reason || 'Invalid Audius stream');
      if (key) streamCache.set(key, result);
      remember(true);
      return result;
    } catch (error) {
      if (key) streamCache.delete(key);
      remember(false, error);
      return null;
    }
  },

  async getTrackMetadata(providerTrackId) {
    if (!providerTrackId) return null;
    try {
      const track = await request(`/tracks/${encodeURIComponent(providerTrackId)}`);
      return track?.id ? normalizeTrack(track) : null;
    } catch (error) {
      remember(false, error);
      return null;
    }
  },

  async getArtwork(providerTrackId) {
    const track = await this.getTrackMetadata(providerTrackId);
    return track?.thumbnail || null;
  },

  async isAvailable() { return true; },
  async invalidate(providerTrackId) {
    const key = providerCacheKey(this.name, providerTrackId);
    if (key) streamCache.delete(key);
  },
};

export default audiusProvider;
