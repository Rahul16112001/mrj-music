import { multiSourceProvider } from '../providers/multiSourceProvider.js';
import { validateDirectAudioUrl, firstString, normalizeMimeType } from '../providers/providerUtils.js';

const SUCCESS_TTL_MS = 60 * 60 * 1000;
const FAILURE_TTL_MS = 30 * 60 * 1000;
const MAX_CONCURRENCY = 5;
const VERIFY_DEADLINE_MS = 8000;
const verificationCache = new Map();

function now() {
  return Date.now();
}

function failureReason(error) {
  return firstString(error?.code, error?.message) || 'provider_unavailable';
}

async function verifyArtwork(track) {
  if (!track?.artworkUrl) return { ok: false, reason: 'missing_artwork' };
  if (typeof fetch !== 'function') return { ok: true };
  const candidates = [track.artworkUrl];
  if (/\/maxresdefault\.jpg$/i.test(track.artworkUrl)) {
    candidates.push(track.artworkUrl.replace(/\/maxresdefault\.jpg$/i, '/hqdefault.jpg'));
  }
  for (const artworkUrl of candidates) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);
    try {
      const response = await fetch(artworkUrl, { method: 'HEAD', redirect: 'follow', signal: controller.signal });
      if (!response.ok) continue;
      const contentType = normalizeMimeType(response.headers.get('content-type'));
      if (contentType && !contentType.startsWith('image/')) continue;
      return { ok: true, artworkUrl };
    } catch {
      // Try the provider's lower-resolution fallback before excluding the track.
    } finally {
      clearTimeout(timeout);
    }
  }
  return { ok: false, reason: 'artwork_unavailable' };
}

async function resolveVerification(track) {
  const stream = await multiSourceProvider.resolveStream(track);
  if (!stream?.ok || !stream.url) return { ok: false, reason: 'provider_unavailable' };

  const validation = validateDirectAudioUrl(stream.url, { mimeType: stream.mimeType });
  if (!validation.valid) return { ok: false, reason: validation.reason };
  if (normalizeMimeType(stream.mimeType)?.startsWith('text/')) return { ok: false, reason: 'non_audio_mime_type' };

  const artwork = await verifyArtwork(track);
  if (!artwork.ok) return artwork;

  return {
    ok: true,
    provider: firstString(stream.provider, track.provider),
    providerTrackId: firstString(stream.providerTrackId, track.providerTrackId),
    mimeType: stream.mimeType || null,
    expiresAt: stream.expiresAt || null,
    artworkUrl: artwork.artworkUrl || track.artworkUrl,
  };
}

export async function verifyHomeTrack(track) {
  const key = track?.canonicalTrackId;
  if (!key) return { track: null, state: { status: 'unavailable', failureReason: 'missing_canonical_id' } };

  const cached = verificationCache.get(key);
  if (cached && cached.expiresAt > now()) {
    return cached.result;
  }

  try {
    const verification = await Promise.race([
      resolveVerification(track),
      new Promise((resolve) => setTimeout(() => resolve({ ok: false, reason: 'verification_timeout' }), VERIFY_DEADLINE_MS)),
    ]);
    const timestamp = now();
    const state = verification.ok
      ? {
        status: 'verified',
        expiresAt: timestamp + SUCCESS_TTL_MS,
        provider: verification.provider,
        providerTrackId: verification.providerTrackId,
        verifiedAt: timestamp,
        failureReason: null,
      }
      : {
        status: 'unavailable',
        expiresAt: timestamp + FAILURE_TTL_MS,
        provider: track.provider,
        providerTrackId: track.providerTrackId,
        verifiedAt: null,
        failureReason: verification.reason || 'provider_unavailable',
      };
    const result = verification.ok
      ? { track: { ...track, artworkUrl: verification.artworkUrl || track.artworkUrl, sourceAvailable: true, verificationStatus: 'verified' }, state }
      : { track: null, state };
    verificationCache.set(key, { expiresAt: state.expiresAt, result });
    return result;
  } catch (error) {
    const timestamp = now();
    const state = {
      status: 'unavailable',
      expiresAt: timestamp + FAILURE_TTL_MS,
      provider: track.provider,
      providerTrackId: track.providerTrackId,
      verifiedAt: null,
      failureReason: failureReason(error),
    };
    const result = { track: null, state };
    verificationCache.set(key, { expiresAt: state.expiresAt, result });
    return result;
  }
}

export async function verifyHomeTracks(tracks = [], concurrency = MAX_CONCURRENCY) {
  const input = Array.isArray(tracks) ? tracks : [];
  const results = new Array(input.length);
  let cursor = 0;
  const worker = async () => {
    while (cursor < input.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await verifyHomeTrack(input[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, input.length) }, worker));
  return results;
}

export function clearHomeVerificationCache() {
  verificationCache.clear();
}

export function getHomeVerificationCacheSize() {
  return verificationCache.size;
}

export const HOME_VERIFICATION_TTLS = Object.freeze({ success: SUCCESS_TTL_MS, failure: FAILURE_TTL_MS });
