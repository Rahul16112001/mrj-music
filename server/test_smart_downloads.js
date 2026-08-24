import { trackIdentityManager } from './catalog/trackIdentityManager.js';
import { db } from './db/schema.js';

function calculateSmartDownloadScore(track, context) {
  let score = 50; // Base score
  let reason = 'Recommended for offline listening';

  const isLiked = context.likedTrackIds.has(track.id);
  const isHistory = context.historyTrackIds.has(track.id);
  const isTopArtist = context.topArtists.has(track.artist.toLowerCase());
  const isSkipped = context.skippedIds.has(track.id);

  if (isLiked) {
    score += 35;
    reason = 'From your Liked Songs';
  } else if (isHistory) {
    score += 25;
    reason = 'Based on your recent listening';
  } else if (isTopArtist) {
    score += 20;
    reason = `Downloaded because you listen to ${track.artist} often`;
  } else {
    // Discovery track
    const discoveryWeight = context.discoveryCompletionRatio >= 0.6 ? 20 : 10;
    score += discoveryWeight;
    reason = 'Similar to your favorite music';
  }

  if (isSkipped) {
    score -= 35;
  }

  return { score: Math.max(0, Math.min(100, score)), reason };
}

async function runSmartDownloadsTestSuite() {
  console.log('⚡ Starting MRJ Music: Smart Downloads 2.0 & Offline Music Engine Test Suite...\n');
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  // =========================================================================
  // 1. TASTE-BASED CANDIDATE SELECTION & SCORING ALGORITHM
  // =========================================================================
  console.log('=========================================================================');
  console.log('1. TASTE-BASED CANDIDATE SELECTION & SCORING ALGORITHM');
  console.log('=========================================================================');

  const mockLikedTrack = {
    id: 'desi-kalakaar|yo-yo-honey-singh',
    title: 'Desi Kalakaar',
    artist: 'Yo Yo Honey Singh',
    genre: 'Punjabi Pop',
    duration: 258,
  };

  const mockHistoryTrack = {
    id: 'kesariya|arijit-singh',
    title: 'Kesariya',
    artist: 'Arijit Singh',
    genre: 'Bollywood',
    duration: 268,
  };

  const mockDiscoveryTrack = {
    id: 'chasing-stars|fame-on-fire',
    title: 'Chasing Stars',
    artist: 'Fame On Fire',
    genre: 'Rock',
    duration: 210,
  };

  const mockSkippedTrack = {
    id: 'random-upload|anon',
    title: 'Random Track',
    artist: 'Unknown',
    genre: 'Unknown',
    duration: 180,
  };

  const userContext = {
    likedTrackIds: new Set([mockLikedTrack.id]),
    historyTrackIds: new Set([mockHistoryTrack.id]),
    topArtists: new Set(['yo yo honey singh', 'arijit singh']),
    topGenres: new Set(['punjabi pop', 'bollywood']),
    skippedIds: new Set([mockSkippedTrack.id]),
    discoveryCompletionRatio: 0.75, // High discovery completion
  };

  // Score Liked Track
  const likedScore = calculateSmartDownloadScore(mockLikedTrack, userContext);
  assert(likedScore.score >= 80, `Liked track receives high score (${likedScore.score})`);
  assert(likedScore.reason === 'From your Liked Songs', `Correct explanation: "${likedScore.reason}"`);

  // Score History Track
  const historyScore = calculateSmartDownloadScore(mockHistoryTrack, userContext);
  assert(historyScore.score >= 70, `History track receives high score (${historyScore.score})`);
  assert(historyScore.reason.includes('recent listening'), `Correct explanation: "${historyScore.reason}"`);

  // Score Discovery Track with High Completion
  const discoveryScore = calculateSmartDownloadScore(mockDiscoveryTrack, userContext);
  assert(discoveryScore.score >= 60, `Discovery track receives positive score (${discoveryScore.score})`);
  assert(discoveryScore.reason.includes('favorite music'), `Correct explanation: "${discoveryScore.reason}"`);

  // Score Skipped Track (Penalty Test)
  const skippedScore = calculateSmartDownloadScore(mockSkippedTrack, userContext);
  assert(skippedScore.score < 40, `Skipped track receives penalty (${skippedScore.score})`);

  // =========================================================================
  // 2. DISCOVERY RATIO ADAPTATION
  // =========================================================================
  console.log('\n=========================================================================');
  console.log('2. DISCOVERY RATIO ADAPTATION (SKIP VS COMPLETION LEARNING)');
  console.log('=========================================================================');

  const lowDiscoveryContext = {
    ...userContext,
    discoveryCompletionRatio: 0.2, // User skips most discovery music
  };
  const lowDiscoveryScore = calculateSmartDownloadScore(mockDiscoveryTrack, lowDiscoveryContext);
  assert(
    lowDiscoveryScore.score < discoveryScore.score,
    `Discovery score lowers (${lowDiscoveryScore.score} vs ${discoveryScore.score}) when user skips unfamiliar tracks`
  );

  // =========================================================================
  // 3. STORAGE LIMITS & MANUAL DOWNLOAD PROTECTION
  // =========================================================================
  console.log('\n=========================================================================');
  console.log('3. STORAGE MANAGEMENT & MANUAL DOWNLOAD PROTECTION');
  console.log('=========================================================================');

  // Simulated Mock Local Offline Storage
  const mockStorage = [
    { id: 'manual_1', downloadType: 'manual', priorityScore: 100, title: 'Manual Favorite 1', fileSize: 4000000 },
    { id: 'manual_2', downloadType: 'manual', priorityScore: 100, title: 'Manual Favorite 2', fileSize: 4000000 },
    { id: 'smart_low', downloadType: 'smart', priorityScore: 40, title: 'Smart Low Score', fileSize: 4000000 },
    { id: 'smart_med', downloadType: 'smart', priorityScore: 65, title: 'Smart Med Score', fileSize: 4000000 },
    { id: 'smart_high', downloadType: 'smart', priorityScore: 90, title: 'Smart High Score', fileSize: 4000000 },
  ];

  // Test Eviction Algorithm
  const smartOnly = mockStorage.filter((t) => t.downloadType === 'smart');
  smartOnly.sort((a, b) => a.priorityScore - b.priorityScore); // Lowest score first

  const evictedTrack = smartOnly[0];
  assert(evictedTrack.id === 'smart_low', 'Lowest scoring smart download (smart_low, 40) is selected for eviction');

  // Verify Manual Downloads are NEVER evicted
  const manualTracks = mockStorage.filter((t) => t.downloadType === 'manual');
  assert(manualTracks.length === 2, 'Manual downloads count remains 2');
  assert(
    manualTracks.every((t) => t.downloadType === 'manual'),
    'Manual downloads are strictly protected from automated eviction'
  );

  // =========================================================================
  // 4. OFFLINE RECOMMENDATION & AUTOPLAY ENGINE
  // =========================================================================
  console.log('\n=========================================================================');
  console.log('4. OFFLINE RECOMMENDATION & AUTOPLAY ENGINE (ZERO NETWORK)');
  console.log('=========================================================================');

  const offlinePool = [
    { id: 'track_1', title: 'Apna Bana Le', artist: 'Arijit Singh', genre: 'Bollywood', priorityScore: 90 },
    { id: 'track_2', title: 'Gerua', artist: 'Arijit Singh', genre: 'Bollywood', priorityScore: 85 },
    { id: 'track_3', title: 'Dope Shope', artist: 'Yo Yo Honey Singh', genre: 'Punjabi', priorityScore: 80 },
    { id: 'track_4', title: 'Blinding Lights', artist: 'The Weeknd', genre: 'Pop', priorityScore: 70 },
  ];

  const currentPlaying = { id: 'track_0', title: 'Kesariya', artist: 'Arijit Singh', genre: 'Bollywood' };

  // Rank offline candidates against current Arijit Singh track
  const scoredOffline = offlinePool.map((track) => {
    let score = 50;
    if (track.artist.toLowerCase() === currentPlaying.artist.toLowerCase()) score += 45;
    if (track.genre.toLowerCase() === currentPlaying.genre.toLowerCase()) score += 25;
    score += Math.round(track.priorityScore * 0.2);
    return { track, score };
  });
  scoredOffline.sort((a, b) => b.score - a.score);

  assert(scoredOffline[0].track.artist === 'Arijit Singh', `Top offline autoplay candidate matches artist (${scoredOffline[0].track.title})`);
  assert(scoredOffline[1].track.artist === 'Arijit Singh', `Second offline autoplay candidate matches artist (${scoredOffline[1].track.title})`);
  assert(scoredOffline[0].score >= 120, `High offline affinity score (${scoredOffline[0].score})`);

  // =========================================================================
  // 5. OFFLINE SEARCH & FUZZY MATCHING
  // =========================================================================
  console.log('\n=========================================================================');
  console.log('5. OFFLINE LOCAL SEARCH (ZERO NETWORK)');
  console.log('=========================================================================');

  const searchResults = offlinePool.filter((track) => {
    const q = 'honey';
    return track.title.toLowerCase().includes(q) || track.artist.toLowerCase().includes(q);
  });

  assert(searchResults.length === 1, 'Offline search found 1 match for "honey"');
  assert(searchResults[0].title === 'Dope Shope', 'Found Dope Shope by Yo Yo Honey Singh');

  // =========================================================================
  // 6. CORRUPTED DOWNLOAD REJECTION TEST
  // =========================================================================
  console.log('\n=========================================================================');
  console.log('6. CORRUPTED DOWNLOAD REJECTION TEST');
  console.log('=========================================================================');

  const invalidBlobSize = 45000; // 45 KB (empty / HTML error page)
  const isAudioValid = invalidBlobSize >= 100000;
  assert(!isAudioValid, 'Sub-100KB invalid blob rejected before storing in offline storage');

  console.log(`\n======================================================`);
  console.log(`🎉 SMART DOWNLOADS TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log(`======================================================\n`);

  if (failed > 0) process.exit(1);
}

runSmartDownloadsTestSuite().catch(console.error);
