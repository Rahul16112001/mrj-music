import { mlIntelligenceEngine } from './mlIntelligenceEngine.js';
import { normalizeHomeTrack } from '../home/homeTrackNormalizer.js';
import { verifyHomeTracks } from '../home/homeTrackVerifier.js';

const CACHE_TTL_MS = 15 * 60 * 1000;
const cache = new Map();

export async function getVerifiedDynamicQueue({ userId = null, currentTrack = null, currentTrackId = null, playedTrackIds = [], currentQueueIds = [], countryCode = 'IN', localHour = null, sessionId = null, searchSessionId = null, mood = null, circadian = null, isEarlySkip = false }) {
  const seedId = currentTrackId || currentTrack?.canonicalTrackId || currentTrack?.id || 'none';
  const key = `${userId || 'anonymous'}:${seedId}`;
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const queueData = await mlIntelligenceEngine.generateDynamicQueue(userId, {
    currentTrack: currentTrack || (currentTrackId ? { canonicalTrackId: currentTrackId, id: currentTrackId } : null),
    playedTrackIds: Array.isArray(playedTrackIds) ? playedTrackIds.slice(-20) : [],
    currentQueueIds: Array.isArray(currentQueueIds) ? currentQueueIds : [],
    countryCode,
    localHour: localHour !== null && localHour !== undefined ? Number(localHour) : null,
    sessionId: searchSessionId || sessionId,
    isEarlySkip: Boolean(isEarlySkip),
    mood,
    circadian,
  });
  const played = new Set(playedTrackIds);
  const queued = new Set(currentQueueIds);
  const artistCounts = new Map();
  const seenCanonicalIds = new Set();
  const candidates = Array.isArray(queueData?.queue) ? queueData.queue : (Array.isArray(queueData?.tracks) ? queueData.tracks : []);
  const normalized = candidates.map((track) => normalizeHomeTrack(track)).filter(Boolean).filter((track) => {
    const artistKey = track.artist.toLowerCase();
    const count = artistCounts.get(artistKey) || 0;
    if (seenCanonicalIds.has(track.canonicalTrackId) || played.has(track.canonicalTrackId) || queued.has(track.canonicalTrackId) || count >= 3) return false;
    seenCanonicalIds.add(track.canonicalTrackId);
    artistCounts.set(artistKey, count + 1);
    return true;
  }).slice(0, 25);
  const topToVerify = normalized.slice(0, 3);
  const remaining = normalized.slice(3);
  const verifiedTop = await verifyHomeTracks(topToVerify, 3).catch(() => []);
  const validTop = verifiedTop
    .filter((result) => result.track?.sourceAvailable === true)
    .map((result) => ({ ...result.track, thumbnail: result.track.artworkUrl }));
  const validRemaining = remaining.map((track) => ({
    ...track,
    id: track.canonicalTrackId || track.id,
    thumbnail: track.artworkUrl || track.thumbnail,
    sourceAvailable: true,
  }));
  const queue = [...validTop, ...validRemaining];
  const value = { status: 'success', ...(queueData || {}), queue, tracks: queue, verified: true, context: { searchSessionId: searchSessionId || null, mood, circadian } };
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  return value;
}

export function clearVerifiedDynamicQueueCache() { cache.clear(); }

export const VERIFIED_DYNAMIC_QUEUE_CACHE_TTL_MS = CACHE_TTL_MS;
