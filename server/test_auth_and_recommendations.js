import { authService } from './auth/authService.js';
import { db } from './db/schema.js';
import { cloudRecommendationService } from './recommendations/cloudRecommendationService.js';

async function runTests() {
  console.log('🧪 Starting MRJ Music Test Suite...\n');
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

  // TEST 1: User Registration
  console.log('1. Testing User Registration...');
  const testEmail = 'testuser_' + Date.now() + '@example.com';
  const regResult = await authService.register('Rahul Test', testEmail, 'Password123!');
  assert(regResult.user && regResult.user.id, 'User created with ID');
  assert(regResult.user.email === testEmail.toLowerCase(), 'Email normalized to lowercase');
  assert(regResult.token && typeof regResult.token === 'string', 'JWT session token returned');

  // TEST 2: Duplicate Email Rejection
  console.log('\n2. Testing Duplicate Email Registration...');
  try {
    await authService.register('Duplicate User', testEmail.toUpperCase(), 'Password123!');
    assert(false, 'Duplicate registration should throw');
  } catch (err) {
    assert(err.message.includes('already exists'), 'Duplicate registration blocked');
  }

  // TEST 3: User Login
  console.log('\n3. Testing Login (Email + Password only)...');
  const loginResult = await authService.login(testEmail, 'Password123!');
  assert(loginResult.user && loginResult.token, 'Login successful with valid credentials');

  // TEST 4: Invalid Password Rejection
  console.log('\n4. Testing Invalid Password Rejection...');
  try {
    await authService.login(testEmail, 'WrongPassword!');
    assert(false, 'Invalid login should throw');
  } catch (err) {
    assert(err.message.includes('Invalid email or password'), 'Invalid login rejected');
  }

  // TEST 5: Token Verification
  console.log('\n5. Testing Session Token Verification...');
  const verified = authService.verifyToken(loginResult.token);
  assert(verified && verified.userId === loginResult.user.id, 'JWT verified and matched user ID');

  // TEST 6: Change Password
  console.log('\n6. Testing Password Change...');
  const pwResult = await authService.changePassword(loginResult.user.id, 'Password123!', 'NewPassword456!');
  assert(pwResult.success === true, 'Password changed successfully');

  // Verify new password works and old fails
  try {
    await authService.login(testEmail, 'Password123!');
    assert(false, 'Old password should fail');
  } catch (err) {
    assert(true, 'Old password rejected after change');
  }
  const newLogin = await authService.login(testEmail, 'NewPassword456!');
  assert(newLogin.user.id === loginResult.user.id, 'Login succeeds with new password');

  // TEST 7: Cloud Taste Profile & Event Processing
  console.log('\n7. Testing Behavioral Event Tracking & Taste Profile...');
  const userId = loginResult.user.id;
  cloudRecommendationService.processEvents(userId, [
    { eventType: 'PLAY_STARTED', trackId: 'trk_1', artist: 'Arijit Singh', genre: 'Bollywood' },
    { eventType: 'PLAY_COMPLETED', trackId: 'trk_1', artist: 'Arijit Singh', genre: 'Bollywood', completionPercent: 100 },
    { eventType: 'LIKE', trackId: 'trk_1', artist: 'Arijit Singh', genre: 'Bollywood' },
    { eventType: 'SKIP', trackId: 'trk_2', artist: 'Unknown Artist', genre: 'Heavy Metal' },
  ]);

  const profile = db.getTasteProfile(userId);
  assert(profile.preferredArtists['Arijit Singh'] >= 7, 'Artist affinity increased on completion + like');
  assert(profile.likedArtists.includes('Arijit Singh'), 'Artist added to likedArtists list');
  assert(profile.totalPlays >= 1, 'Total plays recorded');
  assert(profile.totalSkips >= 1, 'Total skips recorded');

  // TEST 8: Seed-Based Radio Scoring
  console.log('\n8. Testing Seed-Based Radio Generation...');
  const candidatePool = [
    { id: 'c1', title: 'Tum Hi Ho', artist: 'Arijit Singh', genre: 'Bollywood' },
    { id: 'c2', title: 'Channa Mereya', artist: 'Arijit Singh', genre: 'Bollywood' },
    { id: 'c3', title: 'Despacito', artist: 'Luis Fonsi', genre: 'Latin' },
    { id: 'c4', title: 'Shape of You', artist: 'Ed Sheeran', genre: 'Pop' },
  ];

  const radio = cloudRecommendationService.getSeedRadio(userId, { id: 'c0', artist: 'Arijit Singh', genre: 'Bollywood' }, candidatePool);
  assert(radio.length > 0, 'Radio returns queue');
  assert(radio[0].artist === 'Arijit Singh', 'Top radio candidate matches seed artist/genre similarity');

  // TEST 9: Account Deletion
  console.log('\n9. Testing Account Deletion...');
  const delResult = await authService.deleteAccount(userId, 'NewPassword456!');
  assert(delResult.success === true, 'Account deleted');
  const userCheck = db.findUserById(userId);
  assert(userCheck === null, 'User cloud records purged from database');

  console.log(`\n========================================`);
  console.log(`🎉 TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log(`========================================\n`);

  if (failed > 0) process.exit(1);
}

runTests().catch(console.error);
