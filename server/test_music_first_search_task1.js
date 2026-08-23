import { musicProvider } from './providers/musicProvider.js';
import { contentClassifier, CONTENT_TYPES } from './catalog/contentClassifier.js';
import { searchIntentEngine, INTENT_TYPES } from './catalog/searchIntentEngine.js';

async function runMusicFirstSearchTests() {
  console.log('🧪 Starting MRJ Music Task 1: Music-First Search Test Suite...\n');
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

  // 1. EXTENDED TRACK MODEL SPECIFICATION
  console.log('1. Testing Extended Track Model Specification...');
  const testAudio = contentClassifier.normalizeTrack({
    id: 'test_aud_1',
    title: 'Shayraana (Official Audio)',
    artist: 'Pritam, Arijit Singh',
    duration: 210,
  });

  assert(testAudio.contentType === CONTENT_TYPES.MUSIC, 'contentType is "music"');
  assert(testAudio.isOfficialMusic === true, 'isOfficialMusic is boolean true');
  assert(testAudio.isAudioOnly === true, 'isAudioOnly is boolean true');
  assert(testAudio.isMusicVideo === false, 'isMusicVideo is boolean false');
  assert(testAudio.isLive === false, 'isLive is boolean false');
  assert(testAudio.isCover === false, 'isCover is boolean false');
  assert(testAudio.isRemix === false, 'isRemix is boolean false');
  assert(testAudio.isSlowed === false, 'isSlowed is boolean false');
  assert(testAudio.isLyricsVideo === false, 'isLyricsVideo is boolean false');
  assert(testAudio.isShort === false, 'isShort is boolean false');
  assert(testAudio.isReaction === false, 'isReaction is boolean false');
  assert(testAudio.isCompilation === false, 'isCompilation is boolean false');
  assert(testAudio.provider === 'youtube', 'provider is "youtube"');
  assert(testAudio.providerTrackId === 'test_aud_1', 'providerTrackId matches videoId');

  // 2. CONTENT CLASSIFICATION
  console.log('\n2. Testing Content Classification of YouTube Candidates...');
  const mvTrack = contentClassifier.normalizeTrack({
    id: 'mv_1',
    title: 'Shayraana Official Music Video',
    artist: 'Zee Music Company',
    duration: 245,
  });
  assert(mvTrack.isMusicVideo === true, 'Classified Official Music Video');

  const lyricsTrack = contentClassifier.normalizeTrack({
    id: 'lyr_1',
    title: 'Shayraana with Lyrics',
    artist: 'SingAlong',
    duration: 240,
  });
  assert(lyricsTrack.isLyricsVideo === true, 'Classified Lyrics Video');

  const coverTrack = contentClassifier.normalizeTrack({
    id: 'cov_1',
    title: 'Shayraana Acoustic Cover',
    artist: 'Indie Singer',
    duration: 200,
  });
  assert(coverTrack.isCover === true, 'Classified Cover Song');

  const slowedTrack = contentClassifier.normalizeTrack({
    id: 'slow_1',
    title: 'Shayraana (Slowed + Reverb)',
    artist: 'Lofi Chills',
    duration: 260,
  });
  assert(slowedTrack.isSlowed === true, 'Classified Slowed/Reverb');

  const reactionTrack = contentClassifier.normalizeTrack({
    id: 'react_1',
    title: 'American Reacts to Shayraana For The First Time',
    artist: 'Vlogger',
    duration: 650,
  });
  assert(reactionTrack.isReaction === true, 'Classified Reaction Video');

  const compilationTrack = contentClassifier.normalizeTrack({
    id: 'comp_1',
    title: 'Top Bollywood Songs 2026 Nonstop Jukebox',
    artist: 'Various',
    duration: 3600,
  });
  assert(compilationTrack.isCompilation === true, 'Classified Compilation Jukebox');

  // 3. MUSIC-FIRST RANKING & EXACT MATCH TEST
  console.log('\n3. Testing Music-First Candidate Ranking & Exact Match...');
  const baseIntent = searchIntentEngine.parse('Shayraana');
  const scoreAudio = contentClassifier.scoreCandidate(testAudio, baseIntent);
  const scoreMV = contentClassifier.scoreCandidate(mvTrack, baseIntent);
  const scoreLyrics = contentClassifier.scoreCandidate(lyricsTrack, baseIntent);
  const scoreCover = contentClassifier.scoreCandidate(coverTrack, baseIntent);
  const scoreReaction = contentClassifier.scoreCandidate(reactionTrack, baseIntent);

  assert(scoreAudio > scoreMV, `Official Audio score (${scoreAudio}) > Music Video score (${scoreMV})`);
  assert(scoreMV > scoreLyrics, `Music Video score (${scoreMV}) > Lyrics Video score (${scoreLyrics})`);
  assert(scoreLyrics > scoreCover, `Lyrics Video score (${scoreLyrics}) > Cover score (${scoreCover})`);
  assert(scoreCover > scoreReaction, `Cover score (${scoreCover}) > Reaction score (${scoreReaction})`);

  // 4. USER INTENT QUERIES
  console.log('\n4. Testing User Intent Driven Scoring Adjustments...');
  const videoIntent = searchIntentEngine.parse('Shayraana official video');
  const mvScoreOnVideoIntent = contentClassifier.scoreVideoCandidate(mvTrack, videoIntent);
  assert(videoIntent.wantsVideo === true, 'wantsVideo parsed true for "official video"');
  assert(mvScoreOnVideoIntent >= 100, 'Music Video boosted for video query');

  const lyricsIntent = searchIntentEngine.parse('Shayraana lyrics');
  const lyricsScoreOnLyricsIntent = contentClassifier.scoreCandidate(lyricsTrack, lyricsIntent);
  const audioScoreOnLyricsIntent = contentClassifier.scoreCandidate(testAudio, lyricsIntent);
  assert(lyricsIntent.wantsLyrics === true, 'wantsLyrics parsed true for "lyrics"');
  assert(lyricsScoreOnLyricsIntent > audioScoreOnLyricsIntent, `Lyrics video (${lyricsScoreOnLyricsIntent}) ranks above audio (${audioScoreOnLyricsIntent}) for lyrics search`);

  const liveIntent = searchIntentEngine.parse('Shayraana live');
  assert(liveIntent.wantsLive === true, 'wantsLive parsed true for "live"');

  const slowedIntent = searchIntentEngine.parse('Shayraana slowed reverb');
  assert(slowedIntent.wantsSlowed === true, 'wantsSlowed parsed true for "slowed reverb"');

  // 5. LIVE SEARCH ON 12 REQUIRED QUERIES
  console.log('\n5. Testing Live Search on all 12 Required Queries...');
  const testQueries = [
    'Shayraana',
    'Kesariya',
    'Tum Hi Ho',
    'Tose Naina',
    'Blinding Lights',
    'Shape of You',
    'Arijit Singh',
    'Taylor Swift',
    'Shayraana official video',
    'Shayraana lyrics',
    'Shayraana live',
    'Shayraana slowed reverb',
  ];

  for (const q of testQueries) {
    const res = await musicProvider.search(q);
    assert(Array.isArray(res.songs), `Query "${q}" returned songs array`);
    assert(Array.isArray(res.videos), `Query "${q}" returned videos array`);

    if (q === 'Shayraana') {
      assert(res.songs.length > 0, 'Shayraana returned music songs');
      assert(res.songs[0].contentType === 'music', 'Top Shayraana result is classified as music');
      assert(res.songs[0].playbackFormat === 'audio', 'Top Shayraana song has playbackFormat: audio');
    }

    if (q === 'Shayraana official video') {
      assert(res.videos.length > 0, 'Shayraana official video returned video candidates');
      assert(res.videos[0].playbackFormat === 'video', 'Top video result has playbackFormat: video');
    }
  }

  console.log(`\n======================================================`);
  console.log(`🎉 TASK 1 TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log(`======================================================\n`);

  if (failed > 0) process.exit(1);
}

runMusicFirstSearchTests().catch(console.error);
