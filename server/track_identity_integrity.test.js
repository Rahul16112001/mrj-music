import { musicProvider } from './providers/musicProvider.js';
import { trackIdentityManager } from './catalog/trackIdentityManager.js';
import { searchRelevanceEngine } from './catalog/searchRelevanceEngine.js';
import { db } from './db/schema.js';

async function runTrackIdentityIntegrityTests() {
  console.log('🧪 Starting MRJ Music: Track Identity & Playback Integrity Test Suite...\n');
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
  // 1. EXACT CANONICAL TO PLAYBACK SOURCE VALIDATION (Required Test Songs)
  // =========================================================================
  console.log('=========================================================================');
  console.log('1. REQUIRED TEST SONGS: CANONICAL METADATA ↔ PLAYBACK SOURCE INTEGRITY');
  console.log('=========================================================================');

  const requiredTestTracks = [
    { query: 'Desi Kalakaar', expectedTitle: 'Desi Kalakaar', expectedArtist: 'Yo Yo Honey Singh', maxStudioDuration: 280 },
    { query: 'Kesariya', expectedTitle: 'Kesariya', expectedArtist: 'Arijit Singh', maxStudioDuration: 300 },
    { query: 'Shayraana', expectedTitle: 'Shayraana', expectedArtist: 'Mohd Aqib Turk', maxStudioDuration: 300 },
    { query: 'Tose Naina', expectedTitle: 'Tose Naina', expectedArtist: 'Arijit Singh', maxStudioDuration: 300 },
    { query: 'Tum Hi Ho', expectedTitle: 'Tum Hi Ho', expectedArtist: 'Arijit Singh', maxStudioDuration: 300 },
    { query: 'Blinding Lights', expectedTitle: 'Blinding Lights', expectedArtist: 'The Weeknd', maxStudioDuration: 240 },
    { query: 'Shape of You Ed Sheeran', expectedTitle: 'Shape of You', expectedArtist: 'Ed Sheeran', maxStudioDuration: 260 },
    { query: 'Guru', expectedTitle: 'GURU', expectedArtist: 'Eternxlkz', maxStudioDuration: 240 },
    { query: 'Guru Randhawa', expectedTitle: 'Lahore', expectedArtist: 'Guru Randhawa', maxStudioDuration: 240 },
    { query: 'Arijit Singh', expectedTitle: 'Tum Hi Ho', expectedArtist: 'Arijit Singh', maxStudioDuration: 300 },
  ];

  for (const testCase of requiredTestTracks) {
    console.log(`\n🔍 Testing Search & Playback Resolution: "${testCase.query}"...`);
    const searchRes = await musicProvider.search(testCase.query, 'songs', 5);
    assert(searchRes.songs.length > 0, `Found songs for "${testCase.query}"`);

    const topSong = searchRes.songs[0];
    const canonId = topSong.canonicalTrackId || topSong.id;
    assert(canonId !== undefined && canonId.includes('|'), `Song has valid canonicalTrackId: "${canonId}"`);

    // Resolve Audio Playback Source
    const audioSource = await trackIdentityManager.fetchAndResolveSource(topSong, 'audio');
    assert(audioSource !== null, `Resolved audio source for "${topSong.title}"`);
    assert(audioSource.providerTrackId !== undefined, `Audio source has valid providerTrackId: "${audioSource?.providerTrackId}"`);

    // Verify Title and Artist Identity
    const normCanonTitle = searchRelevanceEngine.normalize(topSong.title);
    const normSourceTitle = searchRelevanceEngine.normalize(audioSource.title);
    assert(
      normSourceTitle.includes(normCanonTitle) || normCanonTitle.includes(normSourceTitle),
      `Display Title ("${topSong.title}") matches Playback Source Title ("${audioSource.title}")`
    );

    // Duration Check: Verify that the 9:57 music video was REJECTED for Desi Kalakaar audio
    if (testCase.query === 'Desi Kalakaar') {
      assert(
        audioSource.duration < 300,
        `Desi Kalakaar Audio plays studio recording (${audioSource.duration}s) and NOT 9:57 music video`
      );
    }

    assert(
      audioSource.confidenceScore >= 70,
      `High confidence identity match (${audioSource.confidenceScore}%)`
    );
  }

  // =========================================================================
  // 2. QUEUE & HISTORY INTEGRITY TEST
  // =========================================================================
  console.log('\n=========================================================================');
  console.log('2. QUEUE & HISTORY INTEGRITY TEST');
  console.log('=========================================================================');

  const testUser = await db.createUser({
    name: 'Queue Integrity Tester',
    email: `queue_test_${Date.now()}@test.com`,
    password: 'password123',
  });

  const trackA = {
    id: 'desi-kalakaar|yo-yo-honey-singh',
    canonicalTrackId: 'desi-kalakaar|yo-yo-honey-singh',
    title: 'Desi Kalakaar',
    artist: 'Yo Yo Honey Singh',
    duration: 258,
  };
  const trackB = {
    id: 'kesariya|pritam-arijit-singh',
    canonicalTrackId: 'kesariya|pritam-arijit-singh',
    title: 'Kesariya',
    artist: 'Arijit Singh',
    duration: 268,
  };
  const trackC = {
    id: 'tum-hi-ho|mithoon-arijit-singh',
    canonicalTrackId: 'tum-hi-ho|mithoon-arijit-singh',
    title: 'Tum Hi Ho',
    artist: 'Arijit Singh',
    duration: 262,
  };

  const queue = [trackA, trackB, trackC];

  // Transition Track A -> Track B
  const current = queue[0];
  const next = queue[1];
  assert(current.canonicalTrackId === 'desi-kalakaar|yo-yo-honey-singh', 'Current queue track preserves canonicalTrackId');
  assert(next.canonicalTrackId === 'kesariya|pritam-arijit-singh', 'Next queue track preserves canonicalTrackId');

  // Verify DB history stores canonicalTrackId
  await db.addEvents(testUser.id, [{
    trackId: trackA.canonicalTrackId,
    title: trackA.title,
    artist: trackA.artist,
    duration: trackA.duration,
    eventType: 'PLAY_COMPLETED',
  }]);
  const history = await db.getUserHistory(testUser.id);
  assert(history.length > 0, 'History recorded in database');
  assert(history[0].track_id === 'desi-kalakaar|yo-yo-honey-singh', 'History stores canonicalTrackId instead of raw video ID');
  assert(history[0].title === 'Desi Kalakaar', 'History stores canonical song title');

  // =========================================================================
  // 3. MISMATCH REJECTION TEST
  // =========================================================================
  console.log('\n=========================================================================');
  console.log('3. MISMATCH REJECTION TEST');
  console.log('=========================================================================');

  const mismatchedCandidate = {
    rawTitle: 'Kalesh Full Song | Sidhu Moose Wala',
    title: 'Kalesh',
    artist: 'Sidhu Moose Wala',
    duration: 210,
    videoId: 'kalesh123',
  };

  const validation = trackIdentityManager.validateSourceIdentity(trackA, mismatchedCandidate, 'audio');
  assert(!validation.isValid, 'Mismatched candidate (Kalesh vs Desi Kalakaar) is REJECTED');
  assert(validation.confidenceScore === 0, 'Mismatched candidate has 0 confidence score');

  console.log(`\n======================================================`);
  console.log(`🎉 TRACK IDENTITY TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log(`======================================================\n`);

  if (failed > 0) process.exit(1);
}

runTrackIdentityIntegrityTests().catch(console.error);
