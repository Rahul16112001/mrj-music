import { authService } from './auth/authService.js';
import { db } from './db/schema.js';
import { cloudRecommendationService } from './recommendations/cloudRecommendationService.js';
import { musicProvider } from './providers/musicProvider.js';

async function runTests() {
  console.log('🧪 Starting MRJ Music Production Verification Test Suite...\n');
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

  // TEST 1: User Registration & Tokens
  console.log('1. Testing User Registration & Token Generation...');
  const testEmail = 'prod_test_' + Date.now() + '@example.com';
  const regResult = await authService.register('Rahul Engineer', testEmail, 'StrongPassword123!');
  assert(regResult.user && regResult.user.id, 'User created with unique ID');
  assert(regResult.user.email === testEmail.toLowerCase(), 'Email normalized to lowercase');
  assert(regResult.token && typeof regResult.token === 'string', 'Short-lived access token returned');
  assert(regResult.refreshToken && typeof regResult.refreshToken === 'string', 'Rotatable refresh token returned');

  // TEST 2: Duplicate Email Rejection
  console.log('\n2. Testing Duplicate Email Registration...');
  try {
    await authService.register('Duplicate', testEmail.toUpperCase(), 'OtherPassword123!');
    assert(false, 'Duplicate registration should throw');
  } catch (err) {
    assert(err.message.includes('already exists'), 'Duplicate email rejected by DB constraint');
  }

  // TEST 3: User Login
  console.log('\n3. Testing Login...');
  const loginResult = await authService.login(testEmail, 'StrongPassword123!');
  assert(loginResult.user && loginResult.token && loginResult.refreshToken, 'Login successful with token pair');

  // TEST 4: Invalid Password Rejection
  console.log('\n4. Testing Invalid Password Rejection...');
  try {
    await authService.login(testEmail, 'IncorrectPassword!');
    assert(false, 'Invalid login should throw');
  } catch (err) {
    assert(err.message.includes('Invalid email or password'), 'Invalid credentials safely rejected');
  }

  // TEST 5: Access Token Verification
  console.log('\n5. Testing Access Token Verification...');
  const verified = authService.verifyAccessToken(loginResult.token);
  assert(verified && verified.userId === loginResult.user.id, 'Access token verified with correct payload');

  // TEST 6: Token Refresh Flow
  console.log('\n6. Testing Token Refresh Flow...');
  const refreshResult = await authService.refreshAccessToken(loginResult.refreshToken);
  assert(refreshResult.token && refreshResult.refreshToken, 'New token pair generated upon refresh');
  assert(refreshResult.refreshToken !== loginResult.refreshToken, 'Refresh token rotated securely');

  // TEST 7: Session Revocation on Logout
  console.log('\n7. Testing Session Revocation on Logout...');
  await authService.logout(refreshResult.refreshToken);
  try {
    await authService.refreshAccessToken(refreshResult.refreshToken);
    assert(false, 'Revoked refresh token should fail');
  } catch (err) {
    assert(err.message.includes('Invalid or expired refresh token') || err.message.includes('revoked'), 'Revoked session cannot be refreshed');
  }

  // TEST 8: Password Reset Single-Use Lifecycle
  console.log('\n8. Testing Secure Password Reset...');
  const resetReq = await authService.forgotPassword(testEmail);
  assert(resetReq.success === true, 'Forgot password request processed');
  const devToken = resetReq.devToken;
  assert(devToken && typeof devToken === 'string', 'Cryptographic reset token generated');

  const resetResult = await authService.resetPassword(devToken, 'BrandNewPassword456!');
  assert(resetResult.success === true, 'Password reset successful');

  // Try re-using same reset token
  try {
    await authService.resetPassword(devToken, 'AnotherPassword789!');
    assert(false, 'Reusing reset token should fail');
  } catch (err) {
    assert(err.message.includes('Invalid or expired'), 'Single-use reset token invalidated after use');
  }

  // Verify new password works
  const newLogin = await authService.login(testEmail, 'BrandNewPassword456!');
  assert(newLogin.user.id === loginResult.user.id, 'Login succeeds with new password');

  // TEST 9: User Isolation (User A cannot access User B's data)
  console.log('\n9. Testing Multi-User Data Isolation...');
  const userBEmail = 'user_b_' + Date.now() + '@example.com';
  const userB = await authService.register('User B', userBEmail, 'PasswordB123!');
  
  db.addLikedTrack(newLogin.user.id, { id: 'trk_a1', title: 'Song A1', artist: 'Artist A' });
  db.addLikedTrack(userB.user.id, { id: 'trk_b1', title: 'Song B1', artist: 'Artist B' });

  const likesA = db.getLikedTracks(newLogin.user.id);
  const likesB = db.getLikedTracks(userB.user.id);

  assert(likesA.some(t => t.id === 'trk_a1') && !likesA.some(t => t.id === 'trk_b1'), "User A only sees User A's likes");
  assert(likesB.some(t => t.id === 'trk_b1') && !likesB.some(t => t.id === 'trk_a1'), "User B only sees User B's likes");

  // TEST 10: Behavioral Event Streaming & Taste Profile
  console.log('\n10. Testing Behavioral Event Streaming & Taste Profile...');
  const userId = newLogin.user.id;
  cloudRecommendationService.processEvents(userId, [
    { eventType: 'PLAY_STARTED', trackId: 'trk_arijit_1', artist: 'Arijit Singh', genre: 'Bollywood' },
    { eventType: 'PLAY_COMPLETED', trackId: 'trk_arijit_1', artist: 'Arijit Singh', genre: 'Bollywood', completionPercent: 100 },
    { eventType: 'LIKE', trackId: 'trk_arijit_1', artist: 'Arijit Singh', genre: 'Bollywood' },
    { eventType: 'SKIP', trackId: 'trk_other', artist: 'Random Band', genre: 'Noise' },
  ]);

  const profile = db.getTasteProfile(userId);
  assert(profile.preferred_artists['Arijit Singh'] >= 7, 'Artist affinity increased on completion + like');
  assert(profile.liked_artists.includes('Arijit Singh'), 'Artist added to liked_artists list');
  assert(profile.total_plays >= 1, 'Total plays recorded in DB');
  assert(profile.total_skips >= 1, 'Total skips recorded in DB');

  // TEST 11: 100+ Candidate Seed Radio Scoring & Diversity
  console.log('\n11. Testing Seed-Based Radio Scoring & Diversity Filter...');
  const candidatePool = [];
  for (let i = 1; i <= 30; i++) {
    candidatePool.push({ id: `c_arijit_${i}`, title: `Arijit Song ${i}`, artist: 'Arijit Singh', genre: 'Bollywood' });
    candidatePool.push({ id: `c_weeknd_${i}`, title: `Weeknd Song ${i}`, artist: 'The Weeknd', genre: 'Pop' });
    candidatePool.push({ id: `c_other_${i}`, title: `Other Song ${i}`, artist: `Artist ${i}`, genre: 'Rock' });
  }

  const radio = cloudRecommendationService.getSeedRadio(userId, { id: 'seed_1', artist: 'Arijit Singh', genre: 'Bollywood' }, candidatePool);
  assert(radio.length >= 10, 'Seed radio returns populated queue');
  assert(radio[0].artist === 'Arijit Singh', 'Top ranked tracks match seed artist similarity');
  
  // Verify max 2 tracks per artist diversity constraint
  const artistCounts = {};
  for (const t of radio) {
    artistCounts[t.artist] = (artistCounts[t.artist] || 0) + 1;
  }
  const maxPerArtist = Math.max(...Object.values(artistCounts));
  assert(maxPerArtist <= 2, `Diversity constraint met (max tracks per artist in queue: ${maxPerArtist} <= 2)`);

  // TEST 12: Account Deletion
  console.log('\n12. Testing Permanent Account Deletion...');
  const delResult = await authService.deleteAccount(userId, 'BrandNewPassword456!');
  assert(delResult.success === true, 'Account deletion reported success');
  const userCheck = db.findUserById(userId);
  assert(userCheck === null, 'User record completely purged from database');

  console.log(`\n========================================`);
  console.log(`🎉 TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log(`========================================\n`);

  if (failed > 0) process.exit(1);
}

runTests().catch(console.error);
