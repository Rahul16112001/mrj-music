import { musicProvider } from './providers/musicProvider.js';
import { contentClassifier, CONTENT_TYPES } from './catalog/contentClassifier.js';
import { searchIntentEngine, INTENT_TYPES } from './catalog/searchIntentEngine.js';

async function runTask1BTests() {
  console.log('🧪 Starting MRJ Music Task 1B: Music-First Classification & Search Test Suite...\n');
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

  // 1. CONTENT CLASSIFICATION FUNCTION CONTRACT
  console.log('1. Testing classifySearchResult() Contract & Reasons...');
  const testCandidate = {
    id: 'test_123',
    title: 'Desi Kalakaar Full AUDIO Song | Yo Yo Honey Singh | Desi Kalakaar',
    artist: 'T-Series',
    duration: 235,
  };
  const classification = contentClassifier.classifySearchResult(testCandidate);
  assert(classification.contentType === CONTENT_TYPES.MUSIC, 'Classified canonical music');
  assert(classification.isOfficialMusic === true, 'isOfficialMusic is true for T-Series audio');
  assert(classification.isAudioOnly === true, 'isAudioOnly is true');
  assert(Array.isArray(classification.reasons), 'reasons is an array');
  assert(classification.musicEntityKey.includes('desi kalakaar'), 'musicEntityKey generated accurately');

  // 2. NEGATIVE CANDIDATE CLASSIFICATIONS
  console.log('\n2. Testing Negative Candidate Classifications...');
  const lofiTrack = contentClassifier.classifySearchResult({
    title: 'Desi Kalakaar Lofi Flip | Yo Yo Honey Singh | Sonakshi Sinha',
    artist: 'Reverb World',
    duration: 210,
  });
  assert(lofiTrack.contentType === CONTENT_TYPES.SLOWED, 'Lofi Flip classified as SLOWED');
  assert(lofiTrack.isSlowed === true, 'isSlowed is true for Lofi Flip');
  assert(lofiTrack.isAudioOnly === false, 'isAudioOnly is false for Lofi Flip');

  const amvTrack = contentClassifier.classifySearchResult({
    title: 'DESI KALAKAAR [AMW/EDIT] | Yo Yo Honey Singh',
    artist: 'AMV Master',
    duration: 180,
  });
  assert(amvTrack.contentType === CONTENT_TYPES.VIDEO, 'AMW/EDIT classified as VIDEO');
  assert(amvTrack.isAudioOnly === false, 'isAudioOnly is false for AMV');

  const slowedTrack = contentClassifier.classifySearchResult({
    title: 'Desi Kalakar - Lofi + Slowed | Honey Singh | Reverb World',
    artist: 'Reverb World',
    duration: 240,
  });
  assert(slowedTrack.contentType === CONTENT_TYPES.SLOWED, 'Slowed + Reverb classified as SLOWED');

  // 3. INTENT-DRIVEN SCORING FOR DESI KALAKAR
  console.log('\n3. Testing Scoring on Normal vs Explicit Intent...');
  const normalIntent = searchIntentEngine.parse('desi kalakar');
  const slowedIntent = searchIntentEngine.parse('desi kalakar slowed reverb');

  const officialTrack = contentClassifier.normalizeTrack(testCandidate);
  const lofiNormalized = contentClassifier.normalizeTrack({
    id: 'lofi_1',
    title: 'Desi Kalakaar Lofi Flip',
    artist: 'Reverb World',
    duration: 210,
  });

  const officialScoreNormal = contentClassifier.scoreCandidate(officialTrack, normalIntent);
  const lofiScoreNormal = contentClassifier.scoreCandidate(lofiNormalized, normalIntent);
  assert(officialScoreNormal > lofiScoreNormal, `Normal search: Official (${officialScoreNormal}) > Lofi (${lofiScoreNormal})`);

  const officialScoreSlowed = contentClassifier.scoreCandidate(officialTrack, slowedIntent);
  const lofiScoreSlowed = contentClassifier.scoreCandidate(lofiNormalized, slowedIntent);
  assert(lofiScoreSlowed > officialScoreSlowed, `Slowed search: Lofi (${lofiScoreSlowed}) > Official (${officialScoreSlowed})`);

  // 4. LIVE SEARCH MANDATORY TESTS
  console.log('\n4. Testing Live Search on Mandatory Queries...');

  // Test: desi kalakar
  console.log('Testing "desi kalakar"...');
  const resDesi = await musicProvider.search('desi kalakar');
  assert(resDesi.songs.length > 0, '"desi kalakar" returned canonical songs');
  assert(
    !resDesi.songs[0].title.toLowerCase().includes('lofi') &&
    !resDesi.songs[0].title.toLowerCase().includes('slowed') &&
    !resDesi.songs[0].title.toLowerCase().includes('amv'),
    `Top song "${resDesi.songs[0].title}" is NOT Lofi/Slowed/AMV`
  );
  assert(resDesi.songs[0].playbackFormat === 'audio', 'Song playbackFormat is audio');

  // Test: shayraana
  console.log('Testing "shayraana"...');
  const resShayraana = await musicProvider.search('shayraana');
  assert(resShayraana.songs.length > 0, '"shayraana" returned songs');
  assert(resShayraana.songs[0].contentType === 'music', 'Top Shayraana is canonical music');

  // Test: kesariya
  console.log('Testing "kesariya"...');
  const resKesariya = await musicProvider.search('kesariya');
  assert(resKesariya.songs.length > 0, '"kesariya" returned songs');
  assert(resKesariya.songs[0].contentType === 'music', 'Top Kesariya is canonical music');

  // Test: tum hi ho
  console.log('Testing "tum hi ho"...');
  const resTumHiHo = await musicProvider.search('tum hi ho');
  assert(resTumHiHo.songs.length > 0, '"tum hi ho" returned songs');

  // Test: blinding lights
  console.log('Testing "blinding lights"...');
  const resBlinding = await musicProvider.search('blinding lights');
  assert(resBlinding.songs.length > 0, '"blinding lights" returned songs');

  // Test: shape of you
  console.log('Testing "shape of you"...');
  const resShape = await musicProvider.search('shape of you');
  assert(resShape.songs.length > 0, '"shape of you" returned songs');

  // 5. EXPLICIT VARIANT SEARCH TESTS
  console.log('\n5. Testing Explicit Variant Intent Searches...');
  const variantQueries = [
    { q: 'desi kalakar slowed reverb', expectedType: 'slowed' },
    { q: 'desi kalakar remix', expectedType: 'remix' },
    { q: 'desi kalakar live', expectedType: 'live' },
    { q: 'desi kalakar cover', expectedType: 'cover' },
    { q: 'desi kalakar lyrics', expectedType: 'lyrics' },
  ];

  for (const { q, expectedType } of variantQueries) {
    const res = await musicProvider.search(q);
    assert(res.songs.length > 0, `Query "${q}" returned results in songs`);
    assert(
      res.songs[0].contentType === expectedType || res.songs[0].title.toLowerCase().includes(expectedType),
      `Top result for "${q}" matches requested variant (${res.songs[0].contentType})`
    );
  }

  console.log(`\n======================================================`);
  console.log(`🎉 TASK 1B TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log(`======================================================\n`);

  if (failed > 0) process.exit(1);
}

runTask1BTests().catch(console.error);
