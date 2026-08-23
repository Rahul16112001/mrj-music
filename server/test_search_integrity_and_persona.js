import { musicProvider } from './providers/musicProvider.js';
import { searchRelevanceEngine } from './catalog/searchRelevanceEngine.js';
import { searchSuggestionService } from './catalog/searchSuggestionService.js';
import { trackIdentityManager } from './catalog/trackIdentityManager.js';
import { db } from './db/schema.js';

async function runIntegrityAndPersonaTestSuite() {
  console.log('🧪 Starting MRJ Music: Search Suggestions & Track Identity Integrity Test Suite...\n');
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
  // 1. BATCH SEARCH TRACK IDENTITY INTEGRITY TEST (10 Queries x Top Songs)
  // =========================================================================
  console.log('=========================================================================');
  console.log('1. BATCH SEARCH TRACK IDENTITY INTEGRITY TEST');
  console.log('=========================================================================');

  const testQueries = [
    'guru',
    'desi',
    'desi kalakaar',
    'shayraana',
    'kesariya',
    'tum hi ho',
    'arijit singh',
    'guru randhawa',
    'diljit dosanjh',
    'shape of you',
  ];

  for (const q of testQueries) {
    const res = await musicProvider.search(q, 'songs', 10);
    console.log(`\n🔍 Checking Query: "${q}" (${res.songs.length} songs returned)...`);

    assert(res.songs.length > 0, `Query "${q}" returned songs`);

    for (let i = 0; i < Math.min(res.songs.length, 5); i++) {
      const s = res.songs[i];
      const canonId = s.canonicalTrackId || s.canonicalMusicEntityId || s.id;
      assert(canonId !== undefined && canonId.length > 0, `Track ${i + 1} has valid canonicalTrackId: "${canonId}"`);

      // Verify display metadata matches audioSource
      if (s.audioSource) {
        const validation = trackIdentityManager.validateSourceIdentity(s, s.audioSource);
        assert(
          validation.isValid,
          `Track ${i + 1} "${s.title}" by "${s.artist}": audioSource identity match (Confidence: ${validation.confidenceScore}%, Reason: ${validation.reason})`
        );
      }
    }
  }

  // =========================================================================
  // 2. PERSONALIZED SEARCH SUGGESTIONS TEST (User A vs User B vs New User)
  // =========================================================================
  console.log('\n=========================================================================');
  console.log('2. PERSONALIZED SEARCH SUGGESTIONS TEST');
  console.log('=========================================================================');

  // Create mock users in DB
  const userA = await db.createUser({
    name: 'Punjabi User A',
    email: `punjabi_user_${Date.now()}@test.com`,
    password: 'password123',
  });
  await db.saveTasteProfile(userA.id, {
    preferred_artists: { 'Guru Randhawa': 5, 'Karan Aujla': 5, 'Diljit Dosanjh': 4 },
    preferred_genres: { Punjabi: 5, 'Bhangra/Pop': 4 },
    liked_artists: ['Guru Randhawa', 'Karan Aujla'],
    preferred_languages: ['pa'],
  });
  await db.addSearchHistory(userA.id, 'Guru Randhawa');
  await db.addSearchHistory(userA.id, 'Karan Aujla songs');

  const userB = await db.createUser({
    name: 'Hindi Bollywood User B',
    email: `bollywood_user_${Date.now()}@test.com`,
    password: 'password123',
  });
  await db.saveTasteProfile(userB.id, {
    preferred_artists: { 'Arijit Singh': 5, Pritam: 5, 'Shreya Ghoshal': 4 },
    preferred_genres: { Bollywood: 5, 'Hindi Pop': 5 },
    liked_artists: ['Arijit Singh', 'Pritam'],
    preferred_languages: ['hi'],
  });
  await db.addSearchHistory(userB.id, 'Arijit Singh');

  // Test suggestions for User A with query "guru"
  console.log('\nTesting User A (Punjabi preference) suggestions for "guru"...');
  const sugA = await searchSuggestionService.getSuggestions('guru', userA.id);
  console.log('User A Recent Searches:', sugA.recent);
  console.log('User A Suggestions:', sugA.suggestions);
  assert(sugA.recent.some((r) => r.toLowerCase().includes('guru')), 'User A has "Guru Randhawa" in Recent Searches');
  assert(
    sugA.suggestions.some((s) => s.toLowerCase().includes('guru randhawa')),
    'User A suggestions prioritize "Guru Randhawa"'
  );

  // Test suggestions for User B with query "guru"
  console.log('\nTesting User B (Hindi Bollywood preference) suggestions for "guru"...');
  const sugB = await searchSuggestionService.getSuggestions('guru', userB.id);
  console.log('User B Suggestions:', sugB.suggestions);
  assert(sugB.recent.length === 0, 'User B has 0 unrelated recent searches for "guru"');
  assert(sugB.suggestions.length > 0, 'User B receives valid query suggestions for "guru"');

  // Test New User (No history) with query "guru"
  console.log('\nTesting New User (No profile/history) suggestions for "guru"...');
  const sugNew = await searchSuggestionService.getSuggestions('guru', null);
  console.log('New User Suggestions:', sugNew.suggestions);
  assert(sugNew.recent.length === 0, 'New User has empty recent searches');
  assert(sugNew.suggestions.length > 0, 'New User receives general query suggestions');

  // =========================================================================
  // 3. HARD RELEVANCE GATE TEST
  // =========================================================================
  console.log('\n=========================================================================');
  console.log('3. HARD RELEVANCE GATE TEST');
  console.log('=========================================================================');
  const resEmpty = await musicProvider.search('xyzabc123notreal');
  assert(resEmpty.songs.length === 0, 'Non-existent query returns 0 songs (hard gate passed)');

  console.log(`\n======================================================`);
  console.log(`🎉 INTEGRITY & SUGGESTION TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log(`======================================================\n`);

  if (failed > 0) process.exit(1);
}

runIntegrityAndPersonaTestSuite().catch(console.error);
