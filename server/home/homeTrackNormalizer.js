import crypto from 'crypto';
import {
  firstString,
  normalizeArtworkUrl,
  normalizeDuration,
  normalizeProvider,
} from '../providers/providerUtils.js';

const SUPPORTED_PROVIDERS = new Set([
  'youtube_music',
  'jiosaavn',
  'jamendo',
  'audius',
  'youtube_video',
  'youtube',
  'scraper',
]);

const ENTITY_MAP = Object.freeze({
  '&amp;': '&',
  '&apos;': "'",
  '&#39;': "'",
  '&quot;': '"',
  '&lt;': '<',
  '&gt;': '>',
  '&nbsp;': ' ',
});

function decodeHtmlEntities(value) {
  return String(value || '')
    .replace(/&(amp|apos|quot|lt|gt|nbsp);|&#(39|x27);/gi, (match, named, numeric) => {
      if (numeric) return "'";
      return ENTITY_MAP[match.toLowerCase()] || match;
    })
    .replace(/\s+/g, ' ')
    .trim();
}

function text(value) {
  return decodeHtmlEntities(value);
}

function artistText(raw) {
  const mappedArtists = raw?.more_info?.artistMap?.primary_artists
    || raw?.artistMap?.primary_artists
    || raw?.artists
    || raw?.primary_artists;

  if (Array.isArray(mappedArtists)) {
    const names = mappedArtists
      .map((artist) => text(typeof artist === 'string' ? artist : artist?.name))
      .filter(Boolean);
    if (names.length) return names.join(', ');
  }

  return text(firstString(
    raw?.artist,
    raw?.artistName,
    raw?.primaryArtists,
    raw?.primary_artists,
    raw?.uploader,
    raw?.uploaderName,
  ));
}

function normalizedKey(value) {
  return text(value)
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function metadataMatches(actual, expected) {
  const expectedKey = normalizedKey(expected);
  if (!expectedKey) return true;
  const actualKey = normalizedKey(actual);
  if (!actualKey) return false;
  return actualKey === expectedKey || actualKey.includes(expectedKey) || expectedKey.includes(actualKey);
}

function providerTrackId(raw, provider) {
  return firstString(
    raw?.providerTrackId,
    raw?.provider_track_id,
    raw?.trackId,
    raw?.songId,
    raw?.songid,
    raw?.videoId,
    raw?.video_id,
    raw?.id,
    provider === 'youtube_music' && typeof raw?.canonicalTrackId === 'string'
      ? raw.canonicalTrackId.replace(/^ytm_/, '')
      : null,
  );
}

function canonicalId(raw, provider, providerId) {
  const supplied = firstString(raw?.canonicalTrackId, raw?.canonical_track_id);
  if (provider === 'youtube_music') {
    const id = supplied?.startsWith('ytm_') ? supplied.slice(4) : providerId;
    return id ? `ytm_${id}` : null;
  }

  if (supplied && /^(?:canonical_[a-z0-9_]+|map_[a-f0-9]+)$/i.test(supplied)) {
    return supplied;
  }

  const readableId = providerId
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48) || 'track';
  const disambiguator = crypto
    .createHash('sha256')
    .update(`${provider}:${providerId}`)
    .digest('hex')
    .slice(0, 12);
  return `canonical_${provider}_${readableId}_${disambiguator}`;
}

function highResolutionArtwork(rawArtwork, provider) {
  const artwork = normalizeArtworkUrl(rawArtwork);
  if (!artwork) return null;

  try {
    const url = new URL(artwork);
    if (provider === 'jiosaavn') {
      url.pathname = url.pathname.replace(/(?:50x50|150x150|500x500)/gi, '800x800');
      url.searchParams.set('size', '800x800');
    } else if (provider === 'jamendo') {
      url.searchParams.set('width', '800');
      url.searchParams.set('height', '800');
    }
    return url.toString();
  } catch {
    return artwork;
  }
}

function hasMinimumArtworkQuality(url) {
  const explicitSize = String(url || '').match(/(?:^|[^0-9])([0-9]{2,4})x([0-9]{2,4})(?:[^0-9]|$)/i);
  if (explicitSize) return Number(explicitSize[1]) >= 300 && Number(explicitSize[2]) >= 300;
  if (/\/default\.jpg$/i.test(url) || /[?&](?:w|width|size)=?(?:1?[0-9]{1,2}|2[0-9]{2})(?:[^0-9]|$)/i.test(url)) return false;
  return true;
}

function durationSeconds(raw) {
  const value = raw?.duration ?? raw?.durationSec ?? raw?.duration_seconds;
  const duration = normalizeDuration(value);
  if (duration === null) return null;
  // Some provider payloads expose milliseconds while music APIs generally use seconds.
  return duration > 10_000 ? Math.round(duration / 1000) : duration;
}

/**
 * Convert a provider candidate into the strict Home feed contract.
 * Stream verification is deliberately separate and is performed by homeTrackVerifier.
 */
export function normalizeHomeTrack(raw = {}, options = {}) {
  if (!raw || typeof raw !== 'object') return null;

  const providerValue = normalizeProvider(raw.provider || raw.sourceType || options.provider);
  const provider = providerValue === 'youtube' ? 'youtube_video' : providerValue;
  if (!provider || !SUPPORTED_PROVIDERS.has(provider)) return null;

  const id = providerTrackId(raw, provider);
  if (!id) return null;

  const title = text(firstString(raw.title, raw.trackTitle, raw.name, raw.rawTitle));
  const artist = artistText(raw);
  if (!title || !artist) return null;
  if (!metadataMatches(title, options.requestedTitle) || !metadataMatches(artist, options.requestedArtist)) return null;

  const canonicalTrackId = canonicalId(raw, provider, id);
  const artworkUrl = highResolutionArtwork(
    firstString(raw.artworkUrl, raw.artwork, raw.thumbnail, raw.cover, raw.image, raw.albumArt),
    provider,
  );
  if (!canonicalTrackId || !artworkUrl || !hasMinimumArtworkQuality(artworkUrl)) return null;

  return Object.freeze({
    canonicalTrackId,
    provider,
    providerTrackId: id,
    title,
    artist,
    album: text(firstString(raw.album, raw.albumName, raw.releaseName)) || null,
    duration: durationSeconds(raw),
    artworkUrl,
    sourceAvailable: raw.sourceAvailable === true,
    verificationStatus: firstString(raw.verificationStatus, raw.verification_status) || 'pending',
    providerMetadata: raw.providerMetadata || raw.provider_metadata || {},
  });
}

export function homeTrackKey(track) {
  return firstString(track?.canonicalTrackId) || null;
}

export function isHomeTrackMetadataMatch(track, expected = {}) {
  return Boolean(track)
    && metadataMatches(track.title, expected.title || expected.requestedTitle)
    && metadataMatches(track.artist, expected.artist || expected.requestedArtist);
}

export { decodeHtmlEntities, normalizedKey };
