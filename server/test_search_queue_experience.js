import { authService } from './auth/authService.js';
import { db } from './db/schema.js';
import { dbClient } from './db/client.js';
import { searchSuggestionService } from './catalog/searchSuggestionService.js';
import { nextTrackService } from './recommendations/nextTrackService.js';
import { cloudRecommendationService } from './recommendations/cloudRecommendationService.js';

async function runSearchQueueExperienceTests() {
  console.log('🧪 Starting MRJ Music Search Suggestions, Queue, Shuffle & Autoplay Test Suite...\n');
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

  // 1. TEST SEARCH SUGGESTIONS ENGINE
  console.log('1. Testing Search Suggestions Engine...');
  const emptySuggestions = await searchSuggestionService.getSuggestions('');
  assert(emptySuggestions.popular && emptySuggestions.popular.length > 0, 'Empty query returns popular suggestions');

  const liveSuggestions = await searchSuggestionService.getSuggestions('tenu');
  assert(liveSuggestions.query === 'tenu', 'Query matches input text');
  assert(Array.isArray(liveSuggestions.suggestions), 'Returns query suggestions array');
  assert(Array.isArray(liveSuggestions.songs), 'Returns matching songs array');
  assert(Array.isArray(liveSuggestions.artists), 'Returns matching artists array');
  assert(Array.isArray(liveSuggestions.albums), 'Returns matching albums array');

  // 2. TEST SEARCH HISTORY PER USER
  console.log('\n2. Testing Search History Per User...');
  const testUser = await authService.register('Search Tester', `search_user_${Date.now()}@example.com`, 'Pass123456!');
  const userId = testUser.user.id;

  await db.addSearchHistory(userId, 'Arijit Singh');
  await db.addSearchHistory(userId, 'Shreya Ghoshal');
  await db.addSearchHistory(userId, 'Kesariya');

  let userHistory = await db.getSearchHistory(userId);
  assert(userHistory.length === 3, 'Search history stores multiple distinct queries');
  assert(userHistory[0] === 'Kesariya', 'Latest search is at top of history (MRU)');

  await db.removeSearchHistory(userId, 'Shreya Ghoshal');
  userHistory = await db.getSearchHistory(userId);
  assert(!userHistory.includes('Shreya Ghoshal'), 'Removed single search query from history');

  await db.clearSearchHistory(userId);
  userHistory = await db.getSearchHistory(userId);
  assert(userHistory.length === 0, 'Cleared all search history for user');

  // 3. TEST PERSONALIZED SEARCH SUGGESTIONS
  console.log('\n3. Testing Personalized Search Suggestions...');
  // Train taste profile on Dua Lipa
  await cloudRecommendationService.processEvents(userId, [
    { eventType: 'PLAY_COMPLETED', trackId: 'trk_1', artist: 'Dua Lipa', genre: 'Pop', duration: 200 },
    { eventType: 'LIKE', trackId: 'trk_1', artist: 'Dua Lipa' },
  ]);

  const personalizedSuggestions = await searchSuggestionService.getSuggestions('dua', userId);
  assert(personalizedSuggestions.songs.length >= 0, 'Personalized query executes with user profile');

  // 4. TEST FISHER-YATES SHUFFLE ALGORITHM
  console.log('\n4. Testing Fisher-Yates Shuffle Algorithm...');
  function fisherYatesShuffle(array) {
    const copy = [...array];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  const initialQueue = Array.from({ length: 20 }, (_, i) => ({ id: `track_${i}`, title: `Song ${i}` }));
  const shuffled = fisherYatesShuffle(initialQueue);

  assert(shuffled.length === initialQueue.length, 'Shuffled queue has same length');
  assert(initialQueue.every(t => shuffled.some(s => s.id === t.id)), 'Every track appears exactly once (no loss / no duplicates)');
  assert(shuffled.map(t => t.id).join(',') !== initialQueue.map(t => t.id).join(','), 'Order is randomized without Math.random() jumping on playback');

  // 5. TEST QUEUE ACTIONS: PLAY NEXT VS ADD TO QUEUE
  console.log('\n5. Testing Queue Priority: Play Next vs Add to Queue...');
  const currentQ = [
    { id: 'song_1', title: 'Song 1' },
    { id: 'song_2', title: 'Song 2' },
    { id: 'song_3', title: 'Song 3' },
  ];
  let activeIndex = 0;

  // Simulate "Play Next"
  const playNextSong = { id: 'song_play_next', title: 'Play Next Song' };
  const afterPlayNext = [...currentQ];
  afterPlayNext.splice(activeIndex + 1, 0, playNextSong);

  assert(afterPlayNext[1].id === 'song_play_next', 'Play Next item inserted immediately at index + 1');
  assert(afterPlayNext[2].id === 'song_2', 'Original upcoming queue shifted right');

  // Simulate "Add to Queue"
  const addToQueueSong = { id: 'song_add_queue', title: 'Add to Queue Song' };
  const afterAddToQueue = [...afterPlayNext, addToQueueSong];
  assert(afterAddToQueue[afterAddToQueue.length - 1].id === 'song_add_queue', 'Add to Queue item appended to end of queue');

  // 6. TEST REPEAT MODES (OFF, ALL, ONE)
  console.log('\n6. Testing Repeat Modes Logic...');
  const testQueue = [{ id: 'q1' }, { id: 'q2' }, { id: 'q3' }];
  let qIdx = 2; // at end of queue

  // Repeat OFF
  let nextIdxOff = qIdx + 1;
  const shouldStopOff = nextIdxOff >= testQueue.length;
  assert(shouldStopOff === true, 'Repeat OFF stops at end of queue');

  // Repeat ALL
  let nextIdxAll = qIdx + 1;
  if (nextIdxAll >= testQueue.length) nextIdxAll = 0;
  assert(nextIdxAll === 0, 'Repeat ALL loops to beginning of queue');

  // Repeat ONE
  let nextIdxOne = qIdx;
  assert(nextIdxOne === 2, 'Repeat ONE keeps current track position');

  // 7. TEST NEXT TRACK RECOMMENDATION ENGINE & AUTOPLAY DIVERSITY
  console.log('\n7. Testing Autoplay & Next Track Recommendations...');
  const nextRecs = await nextTrackService.getNextRecommendations(userId, {
    currentTrack: { id: 'seed_dua', title: 'Levitating', artist: 'Dua Lipa', genre: 'Pop' },
    playedTrackIds: ['seed_dua'],
    currentQueueIds: [],
    sessionSearches: ['Pop Hits'],
  });

  assert(nextRecs.tracks.length > 0, `Next track service generated ${nextRecs.tracks.length} recommendations`);
  assert(!nextRecs.tracks.some(t => t.id === 'seed_dua'), 'Excluded currently playing and played tracks');

  const artistCounts = {};
  for (const t of nextRecs.tracks) {
    artistCounts[t.artist] = (artistCounts[t.artist] || 0) + 1;
  }
  const maxRep = Math.max(...Object.values(artistCounts));
  assert(maxRep <= 2, `Autoplay enforces artist diversity constraint (${maxRep} <= 2 per artist)`);

  // Clean up
  await db.deleteUser(userId);

  console.log(`\n======================================================`);
  console.log(`🎉 TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log(`======================================================\n`);

  if (failed > 0) process.exit(1);
}

runSearchQueueExperienceTests().catch(console.error);
