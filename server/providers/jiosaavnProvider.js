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

const JIOSAAVN_API = process.env.JIOSAAVN_API_BASE_URL || 'https://www.jiosaavn.com/api.php';
const REQUEST_TIMEOUT_MS = Number(process.env.JIOSAAVN_TIMEOUT_MS || 8000);
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 250;
const QUALITY_TIERS = [320, 160, 128];
const streamCache = new Map();

const health = {
  provider: 'jiosaavn',
  successCount: 0,
  failureCount: 0,
  lastSuccessAt: null,
  lastFailureAt: null,
  lastFailureReason: null,
};

const browserHeaders = {
  Accept: 'application/json',
  Referer: 'https://www.jiosaavn.com/',
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
};

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function decodeHtml(value) {
  if (typeof value !== 'string') return value;
  const named = {
    amp: '&',
    apos: "'",
    gt: '>',
    lt: '<',
    nbsp: ' ',
    quot: '"',
  };
  return value
    .replace(/&(#x?[\da-f]+|[a-z]+);/gi, (entity, token) => {
      const lowerToken = token.toLowerCase();
      if (lowerToken.startsWith('#x')) return String.fromCodePoint(Number.parseInt(lowerToken.slice(2), 16));
      if (lowerToken.startsWith('#')) return String.fromCodePoint(Number.parseInt(lowerToken.slice(1), 10));
      return named[lowerToken] || entity;
    })
    .replace(/\s+/g, ' ')
    .trim();
}

function parsePayload(payload) {
  if (typeof payload !== 'string') return payload || {};
  const trimmed = payload.trim().replace(/^\s*\w+\((.*)\)\s*;?$/s, '$1');
  try {
    return JSON.parse(trimmed);
  } catch {
    throw new Error('JioSaavn returned malformed JSON');
  }
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

function statusCode(error) {
  return error?.response?.status || error?.status || null;
}

async function requestJson(params) {
  let attempt = 0;
  while (true) {
    try {
      const response = await axios.get(JIOSAAVN_API, {
        params: {
          ...params,
          __client: 'web6dot0',
          api_version: '4',
          _format: 'json',
          _marker: '0',
        },
        headers: browserHeaders,
        timeout: REQUEST_TIMEOUT_MS,
        validateStatus: (status) => status >= 200 && status < 300,
      });
      return parsePayload(response.data);
    } catch (error) {
      const status = statusCode(error);
      if (![403, 429].includes(status) || attempt >= MAX_RETRIES) throw error;
      await sleep(RETRY_BASE_DELAY_MS * (2 ** attempt));
      attempt += 1;
    }
  }
}

function asArray(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.data?.results)) return payload.data.results;
  if (Array.isArray(payload?.songs)) return payload.songs;
  if (Array.isArray(payload?.data?.songs)) return payload.data.songs;
  return [];
}

function songFromPayload(payload, providerTrackId) {
  const candidates = asArray(payload);
  if (candidates.length) {
    return candidates.find((song) => String(song.id || song.songid) === String(providerTrackId)) || candidates[0];
  }
  if (payload?.[providerTrackId]) return payload[providerTrackId];
  if (payload?.data?.[providerTrackId]) return payload.data[providerTrackId];
  return payload?.data || payload || null;
}

function artistName(song) {
  const artistMap = song?.more_info?.artistMap || song?.artistMap;
  const primaryArtists = artistMap?.primary_artists || artistMap?.primaryArtists;
  if (Array.isArray(primaryArtists)) {
    const names = primaryArtists.map((artist) => decodeHtml(artist?.name)).filter(Boolean);
    if (names.length) return names.join(', ');
  }
  return decodeHtml(firstString(song?.primary_artists, song?.singers, song?.artist, song?.music)) || 'Unknown Artist';
}

function artworkCandidates(song) {
  const values = [
    ...(Array.isArray(song?.image) ? song.image : [song?.image]),
    song?.more_info?.image,
    song?.artwork,
    song?.thumbnail,
  ].filter(Boolean);
  return values.map((value) => String(value).replace(/\d+x\d+/g, '500x500'));
}

function artworkUrl(song) {
  const candidates = artworkCandidates(song)
    .map(normalizeArtworkUrl)
    .filter(Boolean);
  return candidates.find((url) => /500x500|600x600|800x800|1000x1000/i.test(url)) || candidates[0] || null;
}

function normalizeSong(song, defaults = {}) {
  const providerTrackId = firstString(song?.id, song?.songid, defaults.providerTrackId);
  const normalized = normalizeTrackMetadata({
    title: decodeHtml(firstString(song?.song, song?.title, song?.name, defaults.title)),
    artist: artistName(song),
    album: decodeHtml(firstString(song?.album, song?.album_name, defaults.album)),
    duration: song?.duration ?? song?.more_info?.duration ?? defaults.duration,
    artworkUrl: artworkUrl(song) || defaults.artworkUrl,
    provider: 'jiosaavn',
    providerTrackId,
  }, { provider: 'jiosaavn', providerTrackId });

  return {
    id: providerTrackId,
    canonicalTrackId: defaults.canonicalTrackId || null,
    title: normalized.title,
    artist: normalized.artist,
    album: normalized.album,
    duration: normalizeDuration(normalized.duration),
    thumbnail: normalized.artworkUrl,
    provider: 'jiosaavn',
    providerTrackId,
    sourceType: 'jiosaavn',
    contentType: 'music',
    isOfficialMusic: true,
    isAudioOnly: true,
    playbackFormat: 'audio',
    providerMetadata: {
      language: song?.language || null,
      year: song?.year || null,
      is320kbps: song?.['320kbps'] === true || song?.['320kbps'] === 'true' || song?.more_info?.['320kbps'] === true,
      permaUrl: song?.perma_url || song?.url || null,
    },
  };
}

function isPreviewUrl(url) {
  return /(?:preview|jiotunepreview|_\d+_p\.|_96_p\.|jiosaavn\.com\/song)/i.test(String(url || ''));
}

function directUrlFromAuth(payload) {
  return firstString(
    payload?.auth_url,
    payload?.authUrl,
    payload?.url,
    payload?.data?.auth_url,
    payload?.data?.url,
  );
}

function encryptedMediaUrl(song) {
  return firstString(
    song?.encrypted_media_url,
    song?.encryptedMediaUrl,
    song?.media_url,
    song?.mediaUrl,
    song?.more_info?.encrypted_media_url,
    song?.more_info?.encryptedMediaUrl,
  );
}

function resolveProviderTrackId(trackOrId) {
  return typeof trackOrId === 'string'
    ? trackOrId
    : firstString(trackOrId?.providerTrackId, trackOrId?.provider_track_id, trackOrId?.id);
}

async function resolveQuality(song, providerTrackId, quality) {
  const encryptedUrl = encryptedMediaUrl(song);
  if (!encryptedUrl) return null;

  const authResponse = await requestJson({
    __call: 'song.generateAuthToken',
    url: encryptedUrl,
    bit_rate: String(quality),
  });
  const url = directUrlFromAuth(authResponse);
  if (!url || isPreviewUrl(url)) return null;

  const validation = validateDirectAudioUrl(url, { mimeType: 'audio/mpeg' });
  if (!validation.valid || !/saavncdn\.com$/i.test(new URL(url).hostname)) return null;

  const result = buildStreamResult({
    provider: 'jiosaavn',
    providerTrackId,
    url: validation.url,
    mimeType: 'audio/mpeg',
    bitrate: `${quality}kbps`,
    duration: song?.duration || song?.more_info?.duration,
    expiresAt: Date.now() + 5 * 60 * 1000,
  });
  return result.ok ? result : null;
}

export const jiosaavnProvider = {
  name: 'jiosaavn',
  priority: 2,

  getHealth() {
    return { ...health };
  },

  async search(query, limit = 20) {
    const value = firstString(query);
    if (!value) return [];
    try {
      const payload = await requestJson({ __call: 'search.getResults', q: value, p: '1', n: String(limit) });
      const results = asArray(payload).slice(0, limit).map((song) => normalizeSong(song));
      if (results.length) rememberSuccess();
      return results;
    } catch (error) {
      rememberFailure(error);
      return [];
    }
  },

  async resolveStream(trackOrId) {
    const providerTrackId = resolveProviderTrackId(trackOrId);
    if (!providerTrackId) return null;

    const cacheKey = providerCacheKey(this.name, providerTrackId);
    const cached = cacheKey ? streamCache.get(cacheKey) : null;
    if (cached && cached.expiresAt > Date.now() + 10_000) return cached;

    try {
      const detailsPayload = await requestJson({ __call: 'song.getDetails', pids: providerTrackId });
      const song = songFromPayload(detailsPayload, providerTrackId);
      if (!song) throw new Error('JioSaavn returned no song details');

      for (const quality of QUALITY_TIERS) {
        try {
          const result = await resolveQuality(song, providerTrackId, quality);
          if (result) {
            if (cacheKey) streamCache.set(cacheKey, result);
            rememberSuccess();
            return result;
          }
        } catch (error) {
          if (![403, 429].includes(statusCode(error))) throw error;
        }
      }
      throw new Error('JioSaavn has no direct audio stream at supported qualities');
    } catch (error) {
      if (cacheKey) streamCache.delete(cacheKey);
      rememberFailure(error);
      return null;
    }
  },

  async getTrackMetadata(providerTrackId) {
    if (!firstString(providerTrackId)) return null;
    try {
      const payload = await requestJson({ __call: 'song.getDetails', pids: providerTrackId });
      return normalizeSong(songFromPayload(payload, providerTrackId), { providerTrackId });
    } catch (error) {
      rememberFailure(error);
      return null;
    }
  },

  async getArtwork(providerTrackId) {
    const metadata = await this.getTrackMetadata(providerTrackId);
    return metadata?.thumbnail || null;
  },

  async isAvailable() {
    return true;
  },

  async invalidate(providerTrackId) {
    const key = providerCacheKey(this.name, providerTrackId);
    if (key) streamCache.delete(key);
  },
};

export default jiosaavnProvider;
