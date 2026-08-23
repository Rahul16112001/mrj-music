import { dbClient } from './db/client.js';
import { db } from './db/schema.js';
import { authService } from './auth/authService.js';
import { cloudRecommendationService } from './recommendations/cloudRecommendationService.js';

async function runPostgresTests() {
  console.log('🧪 Starting MRJ Music Production Database Test Suite...\n');
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

  // TEST 1: Database Health Check
  console.log('1. Testing Database Connection & Health Check...');
  const health = await dbClient.healthCheck();
  assert(health.status === 'connected', `Database connected (Driver: ${health.driver})`);

  // TEST 2: User Creation & Unique Email Constraint in Database
  console.log('\n2. Testing User Creation & Database Constraints...');
  const emailA = 'user_pg_a_' + Date.now() + '@example.com';
  const regA = await authService.register('Alice Postgres', emailA, 'SecurePass123!');
  assert(regA.user && regA.user.id, 'User record created in database');
  assert(regA.user.email === emailA.toLowerCase(), 'Email normalized to lowercase');

  // Attempt duplicate email insertion
  try {
    await authService.register('Duplicate Alice', emailA.toUpperCase(), 'OtherPass456!');
    assert(false, 'Duplicate email should be blocked by UNIQUE constraint');
  } catch (err) {
    assert(err.message.includes('already exists') || err.message.includes('unique') || err.code === '23505', 'Database UNIQUE constraint enforced');
  }

  // TEST 3: Login & Session Records
  console.log('\n3. Testing Login & Session Management in Database...');
  const loginA = await authService.login(emailA, 'SecurePass123!', 'Mozilla/5.0 Test', '127.0.0.1');
  assert(loginA.token && loginA.refreshToken, 'Access token & refresh token returned');

  // TEST 4: Token Refresh & Session Rotation
  console.log('\n4. Testing Token Refresh & Session Rotation...');
  const refreshA = await authService.refreshAccessToken(loginA.refreshToken);
  assert(refreshA.token && refreshA.refreshToken, 'New token pair generated upon refresh');
  assert(refreshA.refreshToken !== loginA.refreshToken, 'Refresh token rotated securely in database');

  // TEST 5: Session Revocation on Logout
  console.log('\n5. Testing Session Revocation on Logout...');
  await authService.logout(refreshA.refreshToken);
  try {
    await authService.refreshAccessToken(refreshA.refreshToken);
    assert(false, 'Revoked refresh token should fail');
  } catch (err) {
    assert(err.message.includes('Invalid or expired') || err.message.includes('revoked'), 'Revoked session cannot be refreshed');
  }

  // TEST 6: Multi-User Data Isolation in PostgreSQL
  console.log('\n6. Testing Multi-User Data Isolation in Relational Store...');
  const emailB = 'user_pg_b_' + Date.now() + '@example.com';
  const regB = await authService.register('Bob Postgres', emailB, 'SecurePassBob123!');

  const userAId = regA.user.id;
  const userBId = regB.user.id;

  // Add likes for User A and User B
  await db.addLikedTrack(userAId, { id: 'song_a_1', title: 'Song A1', artist: 'Artist A' });
  await db.addLikedTrack(userBId, { id: 'song_b_1', title: 'Song B1', artist: 'Artist B' });

  const likesA = await db.getLikedTracks(userAId);
  const likesB = await db.getLikedTracks(userBId);

  assert(likesA.some(t => t.id === 'song_a_1') && !likesA.some(t => t.id === 'song_b_1'), "User A only sees User A's liked tracks");
  assert(likesB.some(t => t.id === 'song_b_1') && !likesB.some(t => t.id === 'song_a_1'), "User B only sees User B's liked tracks");

  // TEST 7: Relational Playlists & Playlist Tracks
  console.log('\n7. Testing Relational Playlists & Playlist Tracks...');
  const plA = await db.savePlaylist(userAId, {
    title: "Alice's Favorites",
    description: 'Relational playlist test',
    tracks: [
      { id: 'trk_1', title: 'Track 1', artist: 'Artist 1' },
      { id: 'trk_2', title: 'Track 2', artist: 'Artist 2' },
    ],
  });

  assert(plA && plA.id, 'Playlist created in database');
  assert(plA.tracks.length === 2, 'Playlist tracks relationally stored');

  const fetchedPlsA = await db.getPlaylists(userAId);
  const fetchedPlsB = await db.getPlaylists(userBId);

  assert(fetchedPlsA.some(p => p.id === plA.id), "User A retrieves User A's playlist");
  assert(!fetchedPlsB.some(p => p.id === plA.id), "User B cannot see User A's playlist");

  // TEST 8: High-Volume Listening Event Logging
  console.log('\n8. Testing High-Volume Listening Events & Taste Profile in Database...');
  await cloudRecommendationService.processEvents(userAId, [
    { eventType: 'PLAY_STARTED', trackId: 'trk_test_1', artist: 'Pritam', genre: 'Bollywood' },
    { eventType: 'PLAY_COMPLETED', trackId: 'trk_test_1', artist: 'Pritam', genre: 'Bollywood', completionPercent: 100 },
    { eventType: 'LIKE', trackId: 'trk_test_1', artist: 'Pritam', genre: 'Bollywood' },
    { eventType: 'SKIP', trackId: 'trk_skip_1', artist: 'Noise Group', genre: 'Noise' },
  ]);

  const profileA = await db.getTasteProfile(userAId);
  assert(profileA.preferred_artists['Pritam'] >= 7, 'Taste profile artist score updated');
  assert(profileA.liked_artists.includes('Pritam'), 'Artist recorded in liked_artists');
  assert(profileA.total_plays >= 1, 'Total plays recorded in database');

  const historyA = await db.getUserHistory(userAId);
  assert(historyA.length >= 1, 'Listening history query returns event log');

  // TEST 9: Cascading User Deletion
  console.log('\n9. Testing Cascading User Account Deletion...');
  const deleted = await db.deleteUser(userAId);
  assert(deleted === true, 'User record deleted from database');

  const checkUser = await db.findUserById(userAId);
  assert(checkUser === null, 'User lookup returns null after deletion');

  const checkLikes = await db.getLikedTracks(userAId);
  assert(checkLikes.length === 0, 'Associated liked tracks purged on cascade');

  const checkPlaylists = await db.getPlaylists(userAId);
  assert(checkPlaylists.length === 0, 'Associated playlists purged on cascade');

  // Clean up User B
  await db.deleteUser(userBId);

  console.log(`\n========================================`);
  console.log(`🎉 TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log(`========================================\n`);

  if (failed > 0) process.exit(1);
}

runPostgresTests().catch(console.error);
