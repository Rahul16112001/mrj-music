const WEBPAGE_CONTENT_TYPES = new Set([
  'text/html',
  'application/xhtml+xml',
  'application/json',
  'text/plain',
]);

const WEBPAGE_PATH_PATTERNS = [
  /\/watch(?:[/?#]|$)/i,
  /\/embed(?:[/?#]|$)/i,
  /\/shorts(?:[/?#]|$)/i,
  /\/results(?:[/?#]|$)/i,
  /\/playlist(?:[/?#]|$)/i,
  /youtube\.com\/?$/i,
  /youtu\.be\/?$/i,
];

export const PROVIDER_EXPIRY_LIMITS_MS = Object.freeze({
  innertube: 5 * 60 * 1000,
  youtube_music: 5 * 60 * 1000,
  jiosaavn: 5 * 60 * 1000,
  soundcloud: 5 * 60 * 1000,
  youtube_video: 5 * 60 * 1000,
  scraper: 2 * 60 * 1000,
});

export function firstString(...values) {
  return values.find((value) => typeof value === 'string' && value.trim())?.trim() || null;
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeProvider(provider) {
  return String(provider || '').trim().toLowerCase().replace(/[-\s]+/g, '_') || null;
}

export function normalizeMimeType(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  return value.split(';', 1)[0].trim().toLowerCase();
}

export function normalizeDuration(value) {
  const duration = numberOrNull(value);
  if (duration === null || duration < 0) return null;
  return Math.round(duration);
}

export function normalizeExpiry(provider, expiresAt, now = Date.now()) {
  const normalizedProvider = normalizeProvider(provider);
  const limit = PROVIDER_EXPIRY_LIMITS_MS[normalizedProvider] || 5 * 60 * 1000;
  const requested = numberOrNull(expiresAt);
  const candidate = requested === null
    ? now + limit
    : requested < 10_000_000_000
      ? requested * 1000
      : requested;

  return Math.min(candidate, now + limit);
}

export function isYouTubeWebpageUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return false;
  let parsed;
  try {
    parsed = new URL(value.trim());
  } catch {
    return false;
  }

  const hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
  const isYouTubeHost = hostname === 'youtube.com' || hostname.endsWith('.youtube.com') || hostname === 'youtu.be';
  return isYouTubeHost && WEBPAGE_PATH_PATTERNS.some((pattern) => pattern.test(parsed.pathname) || pattern.test(value));
}

export function isLikelyAudioUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return false;
  let parsed;
  try {
    parsed = new URL(value.trim());
  } catch {
    return false;
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) return false;
  if (isYouTubeWebpageUrl(value)) return false;

  const pathname = parsed.pathname.toLowerCase();
  const extensionLooksAudio = /\.(aac|flac|m4a|mp3|mp4|m3u8|ogg|opus|wav|webm)(?:$|[?#])/i.test(pathname);
  const queryLooksMedia = /(?:mime|type|mime_type|itag|audio|format|ext)=/i.test(parsed.search);

  // CDN URLs commonly omit an extension, so hostname alone is not rejected.
  // The provider response and optional content type must validate those URLs.
  return extensionLooksAudio || queryLooksMedia || parsed.hostname.length > 0;
}

export function validateDirectAudioUrl(url, options = {}) {
  const normalizedUrl = firstString(url);
  if (!normalizedUrl) return { valid: false, reason: 'missing_url' };
  if (isYouTubeWebpageUrl(normalizedUrl)) return { valid: false, reason: 'webpage_url' };
  if (!isLikelyAudioUrl(normalizedUrl)) return { valid: false, reason: 'invalid_url' };

  const mimeType = normalizeMimeType(options.mimeType);
  if (mimeType && WEBPAGE_CONTENT_TYPES.has(mimeType)) {
    return { valid: false, reason: 'webpage_content_type' };
  }

  return { valid: true, url: normalizedUrl, mimeType };
}

export function normalizeArtworkUrl(value) {
  const url = firstString(value);
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    // YouTube Music frequently returns a 120px thumbnail even when larger
    // artwork is available at the same CDN URL. Prefer the high-resolution
    // variant for native clients and lock-screen metadata.
    if (parsed.hostname === 'yt3.googleusercontent.com') {
      parsed.pathname = parsed.pathname.replace(/=w\d+-h\d+[^&]*/i, '=w800-h800-l90-rj');
      parsed.search = parsed.search
        .replace(/([?&])w\d+-h\d+/i, '$1w800-h800')
        .replace(/([?&])s\d+/i, '$1s800');
    } else if (parsed.hostname === 'i.ytimg.com' || parsed.hostname.endsWith('.ytimg.com')) {
      parsed.pathname = parsed.pathname.replace(/\/(?:default|mqdefault|hqdefault)\.jpg$/i, '/maxresdefault.jpg');
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

export function normalizeTrackMetadata(raw = {}, defaults = {}) {
  const title = firstString(raw.title, raw.trackTitle, raw.name, defaults.title) || 'Unknown Track';
  const artist = firstString(raw.artist, raw.artistName, raw.uploader, defaults.artist) || 'Unknown Artist';
  const album = firstString(raw.album, raw.albumName, raw.releaseName, defaults.album);
  const duration = normalizeDuration(raw.duration ?? raw.durationSec ?? raw.duration_seconds ?? defaults.duration);
  const provider = normalizeProvider(raw.provider || defaults.provider);
  const providerTrackId = firstString(
    raw.providerTrackId,
    raw.provider_track_id,
    raw.trackId,
    raw.id,
    raw.videoId,
    defaults.providerTrackId
  );

  return {
    title,
    artist,
    album,
    duration,
    artworkUrl: normalizeArtworkUrl(raw.artworkUrl || raw.artwork || raw.thumbnail || raw.cover || defaults.artworkUrl),
    provider,
    providerTrackId,
  };
}

export function buildStreamResult(input = {}) {
  const provider = normalizeProvider(input.provider);
  const validation = validateDirectAudioUrl(input.url || input.streamUrl, {
    mimeType: input.mimeType,
  });

  if (!validation.valid) {
    return {
      ok: false,
      status: validation.reason === 'webpage_url' ? 'invalid_webpage_url' : 'unavailable',
      reason: validation.reason,
      provider,
      providerTrackId: firstString(input.providerTrackId, input.videoId),
    };
  }

  const now = Date.now();
  return {
    ok: true,
    status: 'resolved',
    url: validation.url,
    provider,
    providerTrackId: firstString(input.providerTrackId, input.videoId),
    mimeType: validation.mimeType || normalizeMimeType(input.type) || null,
    codec: firstString(input.codec, input.audioCodec),
    bitrate: firstString(input.bitrate, input.quality),
    sampleRate: firstString(input.sampleRate, input.audioSampleRate),
    duration: normalizeDuration(input.duration),
    expiresAt: normalizeExpiry(provider, input.expiresAt, now),
    resolvedAt: now,
  };
}

export function providerCacheKey(provider, providerTrackId) {
  const normalizedProvider = normalizeProvider(provider);
  const normalizedId = firstString(providerTrackId);
  return normalizedProvider && normalizedId ? `${normalizedProvider}:${normalizedId}` : null;
}
