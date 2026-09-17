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

const API_BASE = 'https://api.jamendo.com/v3.0';
const REQUEST_TIMEOUT_MS = Number(process.env.JAMENDO_TIMEOUT_MS || 8000);
const streamCache = new Map();
const health = { provider: 'jamendo', successCount: 0, failureCount: 0, lastSuccessAt: null, lastFailureAt: null, lastFailureReason: null };

function clientId() { return firstString(process.env.JAMENDO_CLIENT_ID); }

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

function isJamendoAudioUrl(url) {
  try {
    const parsed = new URL(url);
    return /(?:^|\.)jamendo\.com$/i.test(parsed.hostname)
      && !/preview|jamen\.do|jamendo\.com\/track/i.test(url);
  } catch {
    return false;
  }
}

function artwork(track) {
  const value = firstString(track.album_image, track.image);
  if (!value) return null;
  return normalizeArtworkUrl(value.replace(/width=\d+/i, 'width=600'));
}

function normalizeTrack(track) {
  const providerTrackId = String(track.id);
  const normalized = normalizeTrackMetadata({
    title: track.name,
    artist: track.artist_name,
    album: track.album_name,
    duration: track.duration,
    artworkUrl: artwork(track),
    provider: 'jamendo',
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
    provider: 'jamendo',
    providerTrackId,
    sourceType: 'jamendo',
    contentType: 'music',
    isOfficialMusic: true,
    isAudioOnly: true,
    playbackFormat: 'audio',
    providerMetadata: {
      licenseUrl: track.license_ccurl || null,
      audioDownloadAllowed: track.audiodownload_allowed ?? null,
      releasedAt: track.releasedate || null,
    },
  };
}

async function requestTracks(params) {
  const id = clientId();
  if (!id) throw new Error('JAMENDO_CLIENT_ID is not configured');
  const response = await axios.get(`${API_BASE}/tracks/`, {
    params: { client_id: id, format: 'json', ...params },
    headers: { Accept: 'application/json', 'User-Agent': 'MRJMusic/4.0' },
    timeout: REQUEST_TIMEOUT_MS,
  });
  if (response.data?.headers?.status === 'failed') {
    throw new Error(response.data.headers.error_message || 'Jamendo API request failed');
  }
  return response.data?.results || [];
}

export const jamendoProvider = {
  name: 'jamendo',
  priority: 3,

  getHealth() { return { ...health }; },

  async search(query, limit = 20) {
    if (!firstString(query) || !clientId()) return [];
    try {
      const tracks = await requestTracks({
        search: query.trim(),
        limit: Math.min(Math.max(Number(limit) || 20, 1), 200),
        imagesize: 600,
        audioformat: 'mp32',
        type: 'single albumtrack',
      });
      const results = tracks.filter((track) => track?.id && track?.audio).map(normalizeTrack).slice(0, limit);
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
    if (!providerTrackId || !clientId()) return null;
    const key = providerCacheKey(this.name, providerTrackId);
    const cached = key ? streamCache.get(key) : null;
    if (cached && cached.expiresAt > Date.now() + 10_000) return cached;

    try {
      const tracks = await requestTracks({ id: providerTrackId, imagesize: 600, audioformat: 'mp32' });
      const track = tracks[0];
      const url = firstString(track?.audio);
      if (!url || !isJamendoAudioUrl(url)) throw new Error('Jamendo returned no direct audio stream');
      const validation = validateDirectAudioUrl(url, { mimeType: 'audio/mpeg' });
      if (!validation.valid) throw new Error(`Invalid Jamendo stream URL: ${validation.reason}`);
      const result = buildStreamResult({
        provider: this.name,
        providerTrackId,
        url: validation.url,
        mimeType: 'audio/mpeg',
        codec: 'mp3',
        bitrate: 'mp32 VBR',
        duration: track?.duration,
        expiresAt: Date.now() + 5 * 60 * 1000,
      });
      if (!result.ok) throw new Error(result.reason || 'Invalid Jamendo stream');
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
    if (!providerTrackId || !clientId()) return null;
    try {
      const tracks = await requestTracks({ id: providerTrackId, imagesize: 600 });
      return tracks[0] ? normalizeTrack(tracks[0]) : null;
    } catch (error) {
      remember(false, error);
      return null;
    }
  },

  async getArtwork(providerTrackId) {
    const track = await this.getTrackMetadata(providerTrackId);
    return track?.thumbnail || null;
  },

  async isAvailable() { return Boolean(clientId()); },
  async invalidate(providerTrackId) {
    const key = providerCacheKey(this.name, providerTrackId);
    if (key) streamCache.delete(key);
  },
};

export default jamendoProvider;
