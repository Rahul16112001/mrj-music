import { chartService } from '../charts/chartService.js';
import { cloudRecommendationService } from '../recommendations/cloudRecommendationService.js';
import { mlIntelligenceEngine } from '../recommendations/mlIntelligenceEngine.js';
import { viralTrendService } from '../recommendations/viralTrendService.js';
import { db } from '../db/schema.js';
import { normalizeHomeTrack } from './homeTrackNormalizer.js';
import { verifyHomeTracks } from './homeTrackVerifier.js';

const FEED_CACHE_TTL_MS = 30 * 60 * 1000;
const STALE_MAX_MS = 24 * 60 * 60 * 1000;
const feedCache = new Map();
const REFRESHING = new Map();

function section(name, tracks) {
  return { id: name, title: name, tracks };
}

function flatten(value) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (Array.isArray(item)) return item;
    if (Array.isArray(item?.tracks)) return item.tracks;
    return item ? [item] : [];
  });
}

function candidateKey(track) {
  return track?.canonicalTrackId || `${track?.provider}:${track?.providerTrackId}`;
}

async function collectCandidates({ userId, region }) {
  const [dailyMixes, viral, regionalCharts, worldwideCharts, likes, history, legacyHome] = await Promise.all([
    mlIntelligenceEngine.generateDailyMixes(userId, region).catch(() => []),
    viralTrendService.getViralReelsTracks(region, 20).catch(() => []),
    chartService.getTrending(region).catch(() => ({ tracks: [] })),
    chartService.getTrending('GLOBAL').catch(() => ({ tracks: [] })),
    userId ? db.getLikedTracks(userId).catch(() => []) : Promise.resolve([]),
    userId ? db.getUserHistory(userId).catch(() => []) : Promise.resolve([]),
    cloudRecommendationService.getPersonalizedHome(userId, region).catch(() => null),
  ]);

  const mixes = flatten(dailyMixes?.dailyMixes || dailyMixes);
  const viralTracks = flatten(viral?.tracks || viral);
  const regionalTracks = flatten(regionalCharts?.tracks || regionalCharts);
  const worldwideTracks = flatten(worldwideCharts?.tracks || worldwideCharts);
  const quickPicks = flatten([
    likes,
    history,
    legacyHome?.personalized?.quickPicks,
    legacyHome?.personalized?.listenAgain,
  ]);

  return {
    quickPicks,
    dailyMixes: [...mixes, ...flatten(legacyHome?.personalized?.dailyMixes)],
    viralTracks: [...viralTracks, ...flatten(legacyHome?.viralReels)],
    regionalCharts: [...regionalTracks, ...flatten(legacyHome?.charts?.trendingRegional), ...flatten(legacyHome?.circadianSection?.tracks)],
    worldwideCharts: [...worldwideTracks, ...flatten(legacyHome?.charts?.trendingWorldwide)],
  };
}

async function buildFeed({ userId = null, region = 'IN' }) {
  const candidates = await collectCandidates({ userId, region: String(region || 'IN').toUpperCase() });
  const seen = new Set();
  const normalized = {};

  for (const [name, list] of Object.entries(candidates)) {
    normalized[name] = [];
    // Verify a bounded Home slice. The feed contract requires every returned
    // track to be verified; it does not require resolving the entire chart.
    for (const raw of list.slice(0, 16)) {
      const track = normalizeHomeTrack(raw, { provider: raw?.provider || raw?.sourceType });
      if (!track) continue;
      const key = candidateKey(track);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      normalized[name].push(track);
    }
  }

  const allTracks = Object.values(normalized).flat();
  const verificationResults = await verifyHomeTracks(allTracks, 5);
  const verifiedByKey = new Map(
    verificationResults
      .filter((result) => result?.track?.sourceAvailable === true)
      .map((result) => [candidateKey(result.track), result.track]),
  );
  const verifiedSections = Object.fromEntries(
    Object.entries(normalized).map(([name, tracks]) => [
      name,
      tracks.filter((track) => verifiedByKey.has(candidateKey(track))).map((track) => verifiedByKey.get(candidateKey(track))),
    ]),
  );
  // Keep every Home section useful when a chart provider is temporarily
  // unavailable. Reuse already verified candidates; never introduce an
  // unverified track merely to fill the layout.
  const verifiedFallback = [
    ...verifiedSections.dailyMixes,
    ...verifiedSections.viralTracks,
    ...verifiedSections.quickPicks,
  ];
  if (verifiedSections.regionalCharts.length === 0) verifiedSections.regionalCharts = verifiedFallback;
  if (verifiedSections.worldwideCharts.length === 0) verifiedSections.worldwideCharts = verifiedFallback;

  return {
    status: 'success',
    ready: true,
    generatedAt: new Date().toISOString(),
    region: String(region || 'IN').toUpperCase(),
    sourceAvailable: true,
    sections: [
      section('quick_picks', verifiedSections.quickPicks.slice(0, 12)),
      section('daily_mixes', verifiedSections.dailyMixes.slice(0, 12)),
      section('viral_tracks', verifiedSections.viralTracks.slice(0, 20)),
      section('regional_charts', verifiedSections.regionalCharts.slice(0, 20)),
      section('worldwide_charts', verifiedSections.worldwideCharts.slice(0, 20)),
    ],
  };
}

async function refresh(key, params) {
  if (REFRESHING.has(key)) return REFRESHING.get(key);
  const promise = buildFeed(params)
    .then((feed) => {
      feedCache.set(key, { feed, fetchedAt: Date.now() });
      return feed;
    })
    .finally(() => REFRESHING.delete(key));
  REFRESHING.set(key, promise);
  return promise;
}

export async function getHomeFeed(params = {}) {
  const userId = params.userId || null;
  const region = String(params.region || 'IN').toUpperCase();
  const key = `${userId || 'anonymous'}:${region}`;
  const cached = feedCache.get(key);
  const age = cached ? Date.now() - cached.fetchedAt : Infinity;

  if (cached && age <= STALE_MAX_MS) {
    if (age > FEED_CACHE_TTL_MS) refresh(key, { userId, region }).catch((error) => console.warn('[home-feed] refresh failed', error.message));
    return { ...cached.feed, cache: { state: age > FEED_CACHE_TTL_MS ? 'stale' : 'fresh', ageMs: age } };
  }

  // Never block a cold Home request on provider verification. The refresh is
  // deduplicated and continues in the background; clients can poll until the
  // ready feed replaces this skeleton response.
  refresh(key, { userId, region }).catch((error) => {
    console.warn('[home-feed] cold refresh failed', error.message);
  });
  return {
    status: 'warming_up',
    ready: false,
    generatedAt: null,
    region,
    sourceAvailable: false,
    sections: [
      section('quick_picks', []),
      section('daily_mixes', []),
      section('viral_tracks', []),
      section('regional_charts', []),
      section('worldwide_charts', []),
    ],
    cache: { state: 'warming', ageMs: null },
  };
}

export function clearHomeFeedCache() {
  feedCache.clear();
  REFRESHING.clear();
}

export const HOME_FEED_CACHE = Object.freeze({ freshTtlMs: FEED_CACHE_TTL_MS, staleMaxMs: STALE_MAX_MS });
