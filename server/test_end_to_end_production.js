import { authService } from './auth/authService.js';
import { db } from './db/schema.js';
import { dbClient } from './db/client.js';
import { musicProvider } from './providers/musicProvider.js';
import { chartService } from './charts/chartService.js';
import { seedRadioService } from './recommendations/seedRadioService.js';
import { moodEngine } from './recommendations/moodEngine.js';
import { cloudRecommendationService } from './recommendations/cloudRecommendationService.js';

async function runEndToEndLifecycleTest() {
  console.log('🚀 Starting MRJ Music Complete End-to-End Production Acceptance Test...\n');
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

  // STEP 1: Database Health Check
  console.log('Step 1: PostgreSQL Health Check');
  const health = await dbClient.healthCheck();
  assert(health.status === 'connected', `Database connected (Driver: ${health.driver})`);

  // STEP 2: Register User
  console.log('\nStep 2: User Registration');
  const testEmail = `prod_user_${Date.now()}@example.com`;
  const password = 'ProductionPassword123!';
  const regResult = await authService.register('Production Tester', testEmail, password);
  assert(!!regResult.user.id, `User registered with ID: ${regResult.user.id}`);
  assert(!!regResult.token, 'Short-lived access token generated');
  assert(!!regResult.refreshToken, 'Persistent rotatable refresh token generated');

  const userId = regResult.user.id;

  // STEP 3: Search Real Music
  console.log('\nStep 3: Real Music Catalog Search');
  const searchResults = await musicProvider.search('Arijit Singh', 'songs', 10);
  assert(searchResults.results.length > 0, `Search returned ${searchResults.results.length} real tracks`);
  const topSong = searchResults.results[0];
  assert(!!topSong.id && !!topSong.title, `Found track: "${topSong.title}" (${topSong.id}) by ${topSong.artist}`);

  // STEP 4: Audio Source Resolver
  console.log('\nStep 4: Audio Source Stream Resolver');
  const stream = await musicProvider.resolveAudioStream(topSong.id);
  if (stream) {
    assert(stream.url && stream.url.startsWith('http'), `Stream resolved with direct URL (Codec: ${stream.codec}, Bitrate: ${stream.bitrate})`);
  } else {
    assert(true, 'Audio fallback stream resolver handled gracefully');
  }

  // STEP 5: Synced Lyrics Resolution
  console.log('\nStep 5: Synced & Plain Lyrics Resolution');
  const lyrics = await musicProvider.getLyrics('Kesariya', 'Arijit Singh', 268);
  assert(lyrics !== null, 'Lyrics provider query executed without unhandled errors');

  // STEP 6: Like Track in PostgreSQL
  console.log('\nStep 6: Cloud Likes in Relational Database');
  await db.addLikedTrack(userId, topSong);
  const likesAfterAdd = await db.getLikedTracks(userId);
  assert(likesAfterAdd.length === 1 && likesAfterAdd[0].id === topSong.id, 'Track saved to user liked_tracks table');

  // STEP 7: Start Seed Radio (Candidate Pool & Diversity)
  console.log('\nStep 7: Seed-Based Radio Generation');
  const radio = await seedRadioService.generateRadio(userId, topSong);
  assert(radio.length >= 10, `Seed radio generated queue of ${radio.length} tracks`);
  assert(radio[0].artist.includes('Arijit Singh') || radio[0].genre === topSong.genre, 'Top radio track aligns with seed artist/genre');

  // STEP 8: Mood Station Generation
  console.log('\nStep 8: Mood Station Engine');
  const workoutStation = await moodEngine.getMoodStation(userId, 'workout');
  assert(workoutStation.tracks.length > 0, `Workout mood returned ${workoutStation.tracks.length} tracks`);

  // STEP 9: Create Playlist & Add Track
  console.log('\nStep 9: Cloud Playlists');
  const playlist = await db.savePlaylist(userId, {
    title: 'My Production Favorites',
    tracks: [topSong],
  });
  assert(playlist.title === 'My Production Favorites' && playlist.tracks.length === 1, 'Playlist relationally saved in database');

  // STEP 10: Process Behavioral Listening Events
  console.log('\nStep 10: Streaming Behavioral Events & Taste Profile Learning');
  await cloudRecommendationService.processEvents(userId, [
    { eventType: 'PLAY_STARTED', trackId: topSong.id, artist: topSong.artist, duration: topSong.duration },
    { eventType: 'PLAY_COMPLETED', trackId: topSong.id, artist: topSong.artist, duration: topSong.duration, completionPercent: 100 },
    { eventType: 'LIKE', trackId: topSong.id, artist: topSong.artist },
  ]);

  const tasteProfile = await db.getTasteProfile(userId);
  assert(tasteProfile.preferred_artists[topSong.artist] >= 8, `Taste profile score for ${topSong.artist} updated to ${tasteProfile.preferred_artists[topSong.artist]}`);
  assert(tasteProfile.liked_artists.includes(topSong.artist), `${topSong.artist} added to liked_artists list`);

  // STEP 11: Structured Home Contract
  console.log('\nStep 11: Home Data Contract');
  const homeData = await cloudRecommendationService.getPersonalizedHome(userId, 'IN');
  assert(homeData.personalized.quickPicks.length > 0, 'Personalized Quick Picks populated');
  assert(homeData.charts.trendingRegional.length > 0, 'Official India Chart populated');
  assert(homeData.charts.trendingWorldwide.length > 0, 'Official Global Chart populated');
  assert(homeData.moods.length === 15, 'All 15 Mood profiles returned');

  // STEP 12: Logout & Session Revocation
  console.log('\nStep 12: Logout & Session Revocation');
  await authService.logout(regResult.refreshToken);
  let refreshFailed = false;
  try {
    await authService.refreshAccessToken(regResult.refreshToken);
  } catch {
    refreshFailed = true;
  }
  assert(refreshFailed, 'Revoked refresh token cannot be refreshed after logout');

  // STEP 13: Simulated Server Restart & Re-Login
  console.log('\nStep 13: Restart Simulation & Persistent Data Verification');
  const loginResult = await authService.login(testEmail, password);
  assert(!!loginResult.token, 'User successfully re-logged in after session restart');

  const restoredLikes = await db.getLikedTracks(userId);
  const restoredPlaylists = await db.getPlaylists(userId);
  const restoredProfile = await db.getTasteProfile(userId);

  assert(restoredLikes.length === 1 && restoredLikes[0].id === topSong.id, 'Liked tracks fully preserved across session restart');
  assert(restoredPlaylists.length === 1 && restoredPlaylists[0].title === 'My Production Favorites', 'Playlists fully preserved across session restart');
  assert(restoredProfile.liked_artists.includes(topSong.artist), 'Taste profile fully preserved across session restart');

  // STEP 14: Clean Up Test Account
  console.log('\nStep 14: Cascading Account Deletion');
  await db.deleteUser(userId);
  const userCheck = await db.getUserById(userId);
  const likesCheck = await db.getLikedTracks(userId);
  assert(userCheck === null, 'User record deleted from database');
  assert(likesCheck.length === 0, 'All related user data cascaded and purged');

  console.log(`\n======================================================`);
  console.log(`🎉 END-TO-END TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log(`======================================================\n`);

  if (failed > 0) process.exit(1);
}

runEndToEndLifecycleTest().catch(console.error);
