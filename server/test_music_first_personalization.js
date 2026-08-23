import { authService } from './auth/authService.js';
import { db } from './db/schema.js';
import { contentClassifier, CONTENT_TYPES } from './catalog/contentClassifier.js';
import { searchIntentEngine, INTENT_TYPES } from './catalog/searchIntentEngine.js';
import { searchSuggestionService } from './catalog/searchSuggestionService.js';
import { nextTrackService } from './recommendations/nextTrackService.js';
import { personalizationEngine, sessionManager } from './recommendations/personalizationEngine.js';
import { cloudRecommendationService } from './recommendations/cloudRecommendationService.js';

async function runMusicFirstPersonalizationTests() {
  console.log('🧪 Starting MRJ Music Music-First & Deep Personalization Test Suite...\n');
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

  // 1. TEST CONTENT CLASSIFIER & NORMALIZATION
  console.log('1. Testing Content Classifier & Normalization...');
  const audioTrack = contentClassifier.normalizeTrack({
    id: 'aud_1',
    title: 'Shayraana (Official Audio)',
    artist: 'Pritam, Arijit Singh',
    duration: 210,
  });
  assert(audioTrack.contentType === CONTENT_TYPES.MUSIC, 'Official audio classified as MUSIC');
  assert(audioTrack.isOfficialMusic === true, 'isOfficialMusic flagged true');
  assert(audioTrack.isAudioOnly === true, 'isAudioOnly flagged true');

  const videoTrack = contentClassifier.normalizeTrack({
    id: 'vid_1',
    title: 'Shayraana Official Music Video',
    artist: 'T-Series',
    duration: 245,
  });
  assert(videoTrack.isMusicVideo === true, 'Music video flagged correctly');

  const podcastTrack = contentClassifier.normalizeTrack({
    id: 'pod_1',
    title: 'The Ranveer Show Episode 120 Podcast',
    artist: 'Ranveer Allahbadia',
    duration: 3600,
  });
  assert(podcastTrack.contentType === CONTENT_TYPES.PODCAST, 'Podcast classified as PODCAST');
  assert(podcastTrack.isPodcast === true, 'isPodcast flagged true');

  const compilationTrack = contentClassifier.normalizeTrack({
    id: 'comp_1',
    title: 'Top Bollywood Hits 2026 Nonstop Jukebox',
    artist: 'Various',
    duration: 4200,
  });
  assert(compilationTrack.isCompilation === true, 'Compilation detected and flagged');

  // 2. TEST SEARCH INTENT ENGINE
  console.log('\n2. Testing Search Intent Engine...');
  const songIntent = searchIntentEngine.parse('Shayraana');
  assert(songIntent.primaryIntent === INTENT_TYPES.SONG, 'Standard search detected as SONG intent');

  const lyricsIntent = searchIntentEngine.parse('Shayraana lyrics');
  assert(lyricsIntent.wantsLyrics === true, 'Detected LYRICS intent modifier');
  assert(lyricsIntent.cleanQuery === 'shayraana', 'Cleaned query stripped of intent modifier');

  const liveIntent = searchIntentEngine.parse('Coldplay live in concert');
  assert(liveIntent.wantsLive === true, 'Detected LIVE concert intent modifier');

  const remixIntent = searchIntentEngine.parse('Kesariya slowed and reverb');
  assert(remixIntent.wantsSlowed === true, 'Detected SLOWED/REMIX intent');

  const moodIntent = searchIntentEngine.parse('workout punjabi');
  assert(moodIntent.detectedMood === 'workout', 'Detected workout MOOD');
  assert(moodIntent.detectedLanguage === 'punjabi', 'Detected Punjabi LANGUAGE');

  // 3. TEST MUSIC AUDIO PRIORITY OVER VIDEO
  console.log('\n3. Testing Audio Priority over Video in Candidate Ranking...');
  const parsedSongIntent = searchIntentEngine.parse('Shayraana');
  const audioScore = contentClassifier.scoreCandidate(audioTrack, parsedSongIntent);
  const videoScore = contentClassifier.scoreCandidate(videoTrack, parsedSongIntent);
  assert(audioScore > videoScore, `Audio track score (${audioScore}) exceeds video score (${videoScore})`);

  // 4. TEST TWO-TIER PERSONALIZATION & SESSION INTENT DECAY
  console.log('\n4. Testing Two-Tier Personalization: Long-Term vs Session Profile...');
  const user = await authService.register('Personalization User', `perso_${Date.now()}@example.com`, 'Pass123456!');
  const userId = user.user.id;
  const sessionId = 'session_test_1';

  // Seed long term profile with Bollywood / Arijit Singh
  await personalizationEngine.processBehavioralEvent(userId, {
    eventType: 'LIKE',
    artist: 'Arijit Singh',
    genre: 'Bollywood',
  });

  // Session: Search Punjabi & play Punjabi tracks
  sessionManager.recordSessionEvent(sessionId, {
    searchQuery: 'Punjabi Hits',
    artist: 'Sidhu Moose Wala',
    genre: 'Punjabi',
    weight: 25,
  });

  const sessionRecs = await nextTrackService.getNextRecommendations(userId, {
    currentTrack: { id: 'trk_sidhu', artist: 'Sidhu Moose Wala', genre: 'Punjabi', title: '295' },
    sessionId,
    sessionSearches: ['Punjabi Hits'],
  });

  assert(sessionRecs.tracks.length > 0, 'Session recommendation returned tracks');
  assert(sessionRecs.tracks[0].recommendationReason !== undefined, 'Recommendation has contextual attribution reason');

  // 5. TEST BEHAVIORAL EVENT HIERARCHY & FEEDBACK
  console.log('\n5. Testing Behavioral Event Hierarchy & Negative Suppression...');
  // Early Skip (< 15s) vs Late Skip (> 70%)
  await personalizationEngine.processBehavioralEvent(userId, {
    eventType: 'SKIP_EARLY',
    artist: 'Badshah',
  });
  let profile = await db.getTasteProfile(userId);
  assert((profile.preferred_artists?.['Badshah'] || 0) === 0, 'Early skip suppresses artist score');

  // Don't Recommend Artist feedback
  await personalizationEngine.processBehavioralEvent(userId, {
    eventType: 'DONT_RECOMMEND_ARTIST',
    artist: 'Spam Artist',
  });
  profile = await db.getTasteProfile(userId);
  assert(profile.disliked_artists.includes('Spam Artist'), 'Artist added to disliked_artists blacklist');

  const filteredRecs = await nextTrackService.getNextRecommendations(userId, {
    currentTrack: { id: 'seed_any', artist: 'Arijit Singh', genre: 'Bollywood', title: 'Song' },
  });
  assert(!filteredRecs.tracks.some(t => t.artist === 'Spam Artist'), 'Disliked artist excluded from all recommendations');

  // 6. TEST TUNE MIX CONTROLLER
  console.log('\n6. Testing Tune Mix Controller (Artist Variety & Discovery)...');
  // High Discovery Level
  const discoveryRecs = await nextTrackService.getNextRecommendations(userId, {
    currentTrack: { id: 'seed_disc', artist: 'Arijit Singh', genre: 'Bollywood', title: 'Song' },
    tuneConfig: { artistVariety: 100, discoveryLevel: 90, energy: 50 },
  });
  const uniqueArtists = new Set(discoveryRecs.tracks.map(t => t.artist));
  assert(uniqueArtists.size === discoveryRecs.tracks.length, 'High variety restricts to 1 track per artist');

  // 7. TEST ON REPEAT & 6 DAILY MIXES CONTRACT
  console.log('\n7. Testing Deep Home Contract (Listen Again, On Repeat, 6 Daily Mixes)...');
  const homeData = await cloudRecommendationService.getPersonalizedHome(userId, 'IN');
  assert(homeData.personalized.dailyMixes.length === 6, 'Generated 6 distinct daily mixes');
  assert(Array.isArray(homeData.personalized.listenAgain), 'Listen Again section populated');
  assert(homeData.personalized.onRepeat !== undefined, 'On Repeat stats section populated');
  assert(homeData.personalized.becauseYouLike !== undefined, 'Because You Like section populated');

  // Cleanup
  await db.deleteUser(userId);

  console.log(`\n======================================================`);
  console.log(`🎉 TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log(`======================================================\n`);

  if (failed > 0) process.exit(1);
}

runMusicFirstPersonalizationTests().catch(console.error);
