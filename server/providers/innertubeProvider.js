import axios from 'axios';
import {
  buildStreamResult,
  firstString,
  normalizeArtworkUrl,
  normalizeDuration,
  normalizeTrackMetadata,
  providerCacheKey,
} from './providerUtils.js';

const INNERTUBE_HOST = 'https://music.youtube.com';
const DEFAULT_CLIENT_VERSION = process.env.INNERTUBE_CLIENT_VERSION || '1.20240918.01.00';
const REQUEST_TIMEOUT_MS = Number(process.env.INNERTUBE_TIMEOUT_MS || 1200);

const clientContext = {
  client: {
    clientName: 'WEB_REMIX',
    clientVersion: DEFAULT_CLIENT_VERSION,
    hl: 'en',
    gl: process.env.INNERTUBE_REGION || 'IN',
  },
};

const streamCache = new Map();
const playerScriptCache = new Map();
const health = {
  provider: 'youtube_music',
  successCount: 0,
  failureCount: 0,
  lastSuccessAt: null,
  lastFailureAt: null,
  lastError: null,
};

function apiKey() {
  return firstString(process.env.INNERTUBE_API_KEY, process.env.YOUTUBE_MUSIC_API_KEY);
}

function endpoint(path) {
  const key = apiKey();
  return `${INNERTUBE_HOST}/youtubei/v1/${path}${key ? `?key=${encodeURIComponent(key)}` : ''}`;
}

function requestHeaders() {
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'User-Agent': 'MRJMusic/4.0',
    Origin: INNERTUBE_HOST,
    Referer: `${INNERTUBE_HOST}/`,
  };
}

function rememberSuccess() {
  health.successCount += 1;
  health.lastSuccessAt = Date.now();
  health.lastError = null;
}

function rememberFailure(error) {
  health.failureCount += 1;
  health.lastFailureAt = Date.now();
  health.lastError = error?.message || String(error);
}

function walk(value, visitor) {
  if (!value || typeof value !== 'object') return;
  visitor(value);
  if (Array.isArray(value)) {
    value.forEach((item) => walk(item, visitor));
  } else {
    Object.values(value).forEach((item) => walk(item, visitor));
  }
}

function textRuns(value) {
  if (!value) return '';
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value)) return value.map(textRuns).filter(Boolean).join(' ').trim();
  return textRuns(value.simpleText) || textRuns(value.runs) || textRuns(value.text);
}

function thumbnailUrl(thumbnails) {
  if (!Array.isArray(thumbnails) || thumbnails.length === 0) return null;
  return normalizeArtworkUrl(thumbnails[thumbnails.length - 1]?.url);
}

function parseSearchItems(payload, limit) {
  const results = [];
  const seen = new Set();

  walk(payload, (node) => {
    const renderer = node.musicResponsiveListItemRenderer;
    if (!renderer || results.length >= limit) return;

    const videoId = firstString(
      renderer.playlistItemData?.videoId,
      renderer.overlay?.musicItemThumbnailOverlayRenderer?.content?.musicPlayButtonRenderer?.playNavigationEndpoint?.watchEndpoint?.videoId,
      renderer.navigationEndpoint?.watchEndpoint?.videoId
    );
    if (!videoId || seen.has(videoId)) return;

    const columns = renderer.flexColumns || [];
    const texts = columns.map((column) => textRuns(column.musicResponsiveListItemFlexColumnRenderer?.text));
    const title = texts[0] || 'Unknown Track';
    const secondary = texts.slice(1).filter(Boolean);
    const secondaryParts = secondary[0]?.split(/\s*[·•]\s*/).map((part) => part.trim()).filter(Boolean) || [];
    const artist = secondaryParts[0] || 'Unknown Artist';
    const album = secondaryParts[1] || secondary.find((value) => value && value !== artist) || null;
    const durationText = texts.find((value) => /\d+:\d+/.test(value));
    const duration = durationText ? parseDuration(durationText) : null;
    const thumbnails = renderer.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails;

    seen.add(videoId);
    results.push({
      id: videoId,
      canonicalTrackId: videoId,
      title,
      artist,
      album,
      duration,
      thumbnail: thumbnailUrl(thumbnails) || `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
      provider: 'youtube_music',
      providerTrackId: videoId,
      sourceType: 'youtube_music',
      contentType: 'music',
      isOfficialMusic: true,
      isAudioOnly: true,
      playbackFormat: 'audio',
    });
  });

  return results.map((item) => ({
    ...item,
    ...normalizeTrackMetadata(item, {
      provider: 'youtube_music',
      providerTrackId: item.providerTrackId,
      duration: item.duration,
      artworkUrl: item.thumbnail,
    }),
    thumbnail: item.thumbnail,
  }));
}

function parseDuration(value) {
  const parts = String(value || '').trim().split(':').map(Number);
  if (parts.some((part) => !Number.isFinite(part))) return null;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return null;
}

function parseCipher(value) {
  const params = new URLSearchParams(value || '');
  return {
    url: params.get('url'),
    signature: params.get('s'),
    signatureParameter: params.get('sp') || 'sig',
    n: params.get('n'),
  };
}

function extractPlayerScriptUrl(playerResponse) {
  const candidate = playerResponse?.assets?.js || playerResponse?.playabilityStatus?.playerConfig?.assets?.js;
  if (!candidate) return null;
  return candidate.startsWith('http') ? candidate : `https://www.youtube.com${candidate}`;
}

function parseOperations(script, functionName) {
  const functionPattern = new RegExp(`(?:function\\s+${functionName}|${functionName}\\s*=\\s*function)\\s*\\([^)]*\\)\\s*\\{([\\s\\S]*?)\\}`);
  const match = script.match(functionPattern);
  if (!match) return null;

  const operations = [];
  const body = match[1];
  const helperName = body.match(/([\w$]+)\.[\w$]+\(a,\d+\)/)?.[1];
  const helperBody = helperName
    ? script.match(new RegExp(`${helperName}\\s*=\\s*\\{([\\s\\S]*?)\\};`))?.[1]
    : null;

  for (const statement of body.split(';')) {
    const index = Number(statement.match(/(?:\.slice\(0,|\[0\]|\.)?a(?:\.length)?[,)](\d+)/)?.[1]);
    if (/\.reverse\(/.test(statement)) operations.push({ type: 'reverse' });
    else if (/\.slice\(0,/.test(statement)) operations.push({ type: 'slice', index: Number.isFinite(index) ? index : 0 });
    else if (/\.splice\(0,/.test(statement)) operations.push({ type: 'splice', index: Number.isFinite(index) ? index : 0 });
    else if (helperBody && /\[.*\]\s*\(/.test(statement)) {
      const helperMethod = statement.match(new RegExp(`${helperName}\\.([\\w$]+)`))?.[1];
      if (helperMethod) operations.push({ type: helperMethod, index: Number.isFinite(index) ? index : 0 });
    }
  }
  return operations.length ? operations : null;
}

async function transformSignature(signature, playerScriptUrl) {
  if (!signature || !playerScriptUrl) return signature;
  let script = playerScriptCache.get(playerScriptUrl);
  if (!script) {
    const response = await axios.get(playerScriptUrl, { timeout: REQUEST_TIMEOUT_MS, responseType: 'text' });
    script = response.data;
    playerScriptCache.set(playerScriptUrl, script);
  }

  const functionName = script.match(/\.sig\|\|([\w$]+)\(/)?.[1]
    || script.match(/signature=([\w$]+)\(/)?.[1];
  if (!functionName) return null;
  const operations = parseOperations(script, functionName);
  if (!operations) return null;

  const chars = signature.split('');
  for (const operation of operations) {
    if (operation.type === 'reverse') chars.reverse();
    else if (operation.type === 'slice') chars.splice(0, operation.index);
    else if (operation.type === 'splice') chars.splice(0, operation.index);
    else if (operation.type === 'swap') {
      const index = operation.index % chars.length;
      [chars[0], chars[index]] = [chars[index], chars[0]];
    }
  }
  return chars.join('');
}

function transformN(value) {
  // InnerTube commonly supplies a usable URL. If only an n-throttled URL is
  // supplied, fail closed until the player-script transform is available.
  return value || null;
}

async function formatUrl(format, playerResponse) {
  const cipher = format.signatureCipher || format.cipher;
  let url = format.url;
  let signatureParameter = 'sig';
  let n = null;

  if (!url && cipher) {
    const parsed = parseCipher(cipher);
    url = parsed.url;
    signatureParameter = parsed.signatureParameter;
    n = parsed.n;
    const signature = await transformSignature(parsed.signature, extractPlayerScriptUrl(playerResponse));
    if (signature && url) {
      const parsedUrl = new URL(url);
      parsedUrl.searchParams.set(signatureParameter, signature);
      url = parsedUrl.toString();
    }
  }

  if (!url) return null;
  const parsedUrl = new URL(url);
  if (n) parsedUrl.searchParams.set('n', transformN(n));
  return parsedUrl.toString();
}

function chooseFormat(formats) {
  return formats
    .filter((format) => format && (format.mimeType || '').toLowerCase().startsWith('audio/'))
    .filter((format) => format.url || format.signatureCipher || format.cipher)
    .sort((a, b) => Number(b.bitrate || 0) - Number(a.bitrate || 0))[0] || null;
}

export const innertubeProvider = {
  name: 'youtube_music',
  priority: 1,

  getHealth() {
    return { ...health };
  },

  async search(query, limit = 20) {
    const value = firstString(query);
    if (!value) return [];
    try {
      const response = await axios.post(endpoint('search'), {
        context: clientContext,
        query: value,
        params: 'EgWKAQIIAWoKEAkQBRAEEAoQBQ%3D%3D',
      }, { headers: requestHeaders(), timeout: REQUEST_TIMEOUT_MS });
      const results = parseSearchItems(response.data, limit);
      rememberSuccess();
      return results;
    } catch (error) {
      rememberFailure(error);
      return [];
    }
  },

  async resolveStream(trackOrId) {
    const videoId = typeof trackOrId === 'string'
      ? trackOrId
      : firstString(trackOrId?.providerTrackId, trackOrId?.id, trackOrId?.canonicalTrackId);
    if (!videoId) return null;

    const cacheKey = providerCacheKey(this.name, videoId);
    const cached = cacheKey ? streamCache.get(cacheKey) : null;
    if (cached && cached.expiresAt > Date.now() + 10_000) return cached;

    try {
      const response = await axios.post(endpoint('player'), {
        context: clientContext,
        videoId,
        contentCheckOk: true,
        racyCheckOk: true,
      }, { headers: requestHeaders(), timeout: REQUEST_TIMEOUT_MS });
      const playerResponse = response.data;
      if (playerResponse?.playabilityStatus?.status !== 'OK') {
        throw new Error(playerResponse?.playabilityStatus?.reason || 'InnerTube playback unavailable');
      }

      const format = chooseFormat([
        ...(playerResponse.streamingData?.adaptiveFormats || []),
        ...(playerResponse.streamingData?.formats || []),
      ]);
      if (!format) throw new Error('InnerTube returned no audio format');

      const url = await formatUrl(format, playerResponse);
      if (!url) throw new Error('InnerTube format could not be transformed into a direct URL');

      const result = buildStreamResult({
        provider: this.name,
        providerTrackId: videoId,
        url,
        mimeType: format.mimeType,
        codec: format.codecs,
        bitrate: format.bitrate,
        duration: normalizeDuration(playerResponse.videoDetails?.lengthSeconds),
        expiresAt: Date.now() + 5 * 60 * 1000,
      });
      if (!result.ok) throw new Error(result.reason || 'Invalid InnerTube stream URL');
      if (cacheKey) streamCache.set(cacheKey, result);
      rememberSuccess();
      return result;
    } catch (error) {
      rememberFailure(error);
      if (cacheKey) streamCache.delete(cacheKey);
      return null;
    }
  },

  async getTrackMetadata(videoId) {
    const result = await this.search(videoId, 1);
    return result[0] || null;
  },

  async getArtwork(videoId) {
    const metadata = await this.getTrackMetadata(videoId);
    return metadata?.thumbnail || null;
  },

  async isAvailable() {
    return Boolean(apiKey());
  },

  async invalidate(videoId) {
    const key = providerCacheKey(this.name, videoId);
    if (key) streamCache.delete(key);
  },
};

export default innertubeProvider;
