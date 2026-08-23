import { contentClassifier, CONTENT_TYPES } from './catalog/contentClassifier.js';
import { chartService } from './charts/chartService.js';
import { seedRadioService } from './recommendations/seedRadioService.js';
import { moodEngine } from './recommendations/moodEngine.js';
import { cloudRecommendationService } from './recommendations/cloudRecommendationService.js';
import { authService } from './auth/authService.js';
import { db } from './db/schema.js';

async function runArchitectureTests() {
  console.log('🧪 Starting MRJ Music Architecture & Charts Verification Test Suite...\n');
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

  // TEST 1: Catalog Content Classifier
  console.log('1. Testing Content Classifier & Compilation Filtering...');
  const comp1 = contentClassifier.isCompilation('TOP HITS 2026 NONSTOP BEST SONGS');
  const comp2 = contentClassifier.isCompilation('Bollywood Romantic Jukebox All Songs');
  const comp3 = contentClassifier.isCompilation('1 Hour Study Beats Lofi Hip Hop');
  const official1 = contentClassifier.isCompilation('Kesariya (Official Audio)', 'Arijit Singh', 268);
  const official2 = contentClassifier.isCompilation('Blinding Lights', 'The Weeknd', 200);

  assert(comp1 === true, 'Detected "TOP HITS 2026" as compilation');
  assert(comp2 === true, 'Detected "Bollywood Jukebox" as compilation');
  assert(comp3 === true, 'Detected "1 Hour Study Beats" as compilation');
  assert(official1 === false, 'Allowed official song "Kesariya"');
  assert(official2 === false, 'Allowed official song "Blinding Lights"');

  // TEST 2: Official Regional & Global Charts
  console.log('\n2. Testing Official Charts Service...');
  const indiaTrending = await chartService.getTrending('IN');
  const globalTrending = await chartService.getTrending('GLOBAL');
  const topSongsIN = await chartService.getTopSongs('IN');
  const topArtistsGlobal = await chartService.getTopArtists('GLOBAL');

  assert(indiaTrending.tracks.length >= 10, 'India Trending returns populated chart list');
  assert(indiaTrending.region === 'IN', 'India Trending tagged with region: IN');
  assert(indiaTrending.tracks[0].rank === 1, 'First track is rank #1');
  assert(indiaTrending.updatedAt > 0, 'Chart contains updated timestamp');
  assert(indiaTrending.source === 'Official Music Charts Provider', 'Chart references official source');

  assert(globalTrending.tracks.length >= 10, 'Global Trending returns populated chart list');
  assert(globalTrending.region === 'GLOBAL', 'Global Trending tagged with region: GLOBAL');
  assert(globalTrending.tracks[0].id !== indiaTrending.tracks[0].id, 'Global Chart differs from India Chart');

  assert(topSongsIN.chartType === 'weekly_top_songs', 'Top Songs returns weekly chart type');
  assert(topArtistsGlobal.artists.length >= 5, 'Top Artists returns top creators');

  // TEST 3: Multi-User Personalization Differentiation
  console.log('\n3. Testing Multi-User Taste Profile Differentiation...');
  const userAEmail = 'alice_music_' + Date.now() + '@example.com';
  const userBEmail = 'bob_music_' + Date.now() + '@example.com';

  const userA = await authService.register('Alice Pop', userAEmail, 'PassAlice123!');
  const userB = await authService.register('Bob Rock', userBEmail, 'PassBob123!');

  // User A interacts with Pop / Bollywood
  await cloudRecommendationService.processEvents(userA.user.id, [
    { eventType: 'PLAY_COMPLETED', trackId: 'trk_pop_1', artist: 'Dua Lipa', genre: 'Pop' },
    { eventType: 'LIKE', trackId: 'trk_pop_1', artist: 'Dua Lipa', genre: 'Pop' },
  ]);

  // User B interacts with Rock
  await cloudRecommendationService.processEvents(userB.user.id, [
    { eventType: 'PLAY_COMPLETED', trackId: 'trk_rock_1', artist: 'Queen', genre: 'Rock' },
    { eventType: 'LIKE', trackId: 'trk_rock_1', artist: 'Queen', genre: 'Rock' },
  ]);

  const profileA = await db.getTasteProfile(userA.user.id);
  const profileB = await db.getTasteProfile(userB.user.id);

  assert(profileA.preferred_artists['Dua Lipa'] > 0 && !profileA.preferred_artists['Queen'], "User A taste profile tailored to User A's activity");
  assert(profileB.preferred_artists['Queen'] > 0 && !profileB.preferred_artists['Dua Lipa'], "User B taste profile tailored to User B's activity");

  // TEST 4: Chart vs Personalization Invariance
  console.log('\n4. Testing Chart Invariance vs Personalization...');
  const chartForAlice = await chartService.getTrending('GLOBAL');
  const chartForBob = await chartService.getTrending('GLOBAL');

  assert(chartForAlice.tracks[0].id === chartForBob.tracks[0].id, 'Global Chart #1 is identical for all users');

  // TEST 5: Real Seed Radio Candidate Pool & Diversity Filter
  console.log('\n5. Testing Seed Radio Candidate Pool & Diversity Constraints...');
  const candidatePool = [];
  for (let i = 1; i <= 25; i++) {
    candidatePool.push({ id: `seed_cand_dua_${i}`, title: `Dua Track ${i}`, artist: 'Dua Lipa', genre: 'Pop', duration: 210 });
    candidatePool.push({ id: `seed_cand_weeknd_${i}`, title: `Weeknd Track ${i}`, artist: 'The Weeknd', genre: 'Pop', duration: 200 });
    candidatePool.push({ id: `seed_cand_comp_${i}`, title: `TOP HITS 2026 JUKEBOX ${i}`, artist: 'Various', duration: 1800 });
    candidatePool.push({ id: `seed_cand_other_${i}`, title: `Other Track ${i}`, artist: `Artist ${i}`, genre: 'Rock', duration: 190 });
  }

  const radio = await seedRadioService.generateRadio(userA.user.id, { id: 'seed_main', title: 'Levitating', artist: 'Dua Lipa', genre: 'Pop' }, candidatePool);
  assert(radio.length >= 10, 'Seed radio returns populated queue');
  assert(radio[0].artist === 'Dua Lipa', 'Top song matches seed artist similarity');
  assert(!radio.some(t => t.title.includes('TOP HITS 2026')), 'Compilation videos purged from radio queue');

  const artistOccurrences = {};
  for (const t of radio) {
    artistOccurrences[t.artist] = (artistOccurrences[t.artist] || 0) + 1;
  }
  const maxArtistReps = Math.max(...Object.values(artistOccurrences));
  assert(maxArtistReps <= 2, `Artist diversity enforced (max tracks per artist: ${maxArtistReps} <= 2)`);

  // TEST 6: Mood Engine
  console.log('\n6. Testing Mood Engine Differentiation...');
  const workoutStation = await moodEngine.getMoodStation(userA.user.id, 'workout');
  const romanceStation = await moodEngine.getMoodStation(userA.user.id, 'romance');

  assert(workoutStation.moodId === 'workout', 'Workout station returned');
  assert(romanceStation.moodId === 'romance', 'Romance station returned');
  assert(workoutStation.tracks.length > 0 && romanceStation.tracks.length > 0, 'Mood stations contain tracks');

  // TEST 7: Home Data Contract
  console.log('\n7. Testing Home Page Data Contract Separation...');
  const homeContract = await cloudRecommendationService.getPersonalizedHome(userA.user.id, 'IN');

  assert(homeContract.personalized && homeContract.personalized.quickPicks, 'Home contract contains personalized section');
  assert(homeContract.charts && homeContract.charts.trendingRegional, 'Home contract contains charts section');
  assert(homeContract.discovery && homeContract.discovery.topArtists, 'Home contract contains discovery section');
  assert(homeContract.moods && homeContract.moods.length === 15, 'Home contract returns all 15 mood profiles');

  // Clean up test accounts
  await db.deleteUser(userA.user.id);
  await db.deleteUser(userB.user.id);

  console.log(`\n========================================`);
  console.log(`🎉 TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log(`========================================\n`);

  if (failed > 0) process.exit(1);
}

runArchitectureTests().catch(console.error);
