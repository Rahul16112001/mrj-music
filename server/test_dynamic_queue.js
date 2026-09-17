import assert from 'node:assert/strict';
import { mlIntelligenceEngine } from './recommendations/mlIntelligenceEngine.js';
import { multiSourceProvider } from './providers/multiSourceProvider.js';
import { clearHomeVerificationCache } from './home/homeTrackVerifier.js';
import { clearVerifiedDynamicQueueCache, getVerifiedDynamicQueue } from './recommendations/verifiedDynamicQueueService.js';

const originalGenerate = mlIntelligenceEngine.generateDynamicQueue;
const originalResolve = multiSourceProvider.resolveStream;
const originalFetch = globalThis.fetch;
let resolveCount = 0;

mlIntelligenceEngine.generateDynamicQueue = async () => ({ queue: [
  { provider: 'youtube_music', providerTrackId: 'queue-1', title: 'Track One', artist: 'Artist One', artworkUrl: 'https://img.test/one.jpg' },
  { provider: 'youtube_music', providerTrackId: 'queue-1', title: 'Track One', artist: 'Artist One', artworkUrl: 'https://img.test/one.jpg' },
  { provider: 'youtube_music', providerTrackId: 'queue-2', title: 'Track Two', artist: 'Artist Two', artworkUrl: 'https://img.test/two.jpg' },
] });
multiSourceProvider.resolveStream = async (track) => {
  resolveCount += 1;
  return { ok: true, url: `https://audio.test/${track.providerTrackId}.mp3`, provider: 'youtube_music', providerTrackId: track.providerTrackId, mimeType: 'audio/mpeg' };
};
globalThis.fetch = async () => ({ ok: true, status: 200, headers: { get: () => 'image/jpeg' } });

try {
  clearHomeVerificationCache();
  clearVerifiedDynamicQueueCache();
  const first = await getVerifiedDynamicQueue({ currentTrackId: 'ytm_seed', playedTrackIds: [], currentQueueIds: [] });
  assert.equal(first.verified, true);
  assert.equal(first.queue.length, 2);
  assert.equal(new Set(first.queue.map((track) => track.canonicalTrackId)).size, 2);
  const beforeCached = resolveCount;
  const second = await getVerifiedDynamicQueue({ currentTrackId: 'ytm_seed', playedTrackIds: [], currentQueueIds: [] });
  assert.equal(second.queue.length, 2);
  assert.equal(resolveCount, beforeCached);
  console.log('dynamic queue verification tests: PASS');
} finally {
  mlIntelligenceEngine.generateDynamicQueue = originalGenerate;
  multiSourceProvider.resolveStream = originalResolve;
  globalThis.fetch = originalFetch;
}
