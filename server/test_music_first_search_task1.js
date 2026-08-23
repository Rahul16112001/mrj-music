import { musicProvider } from './providers/musicProvider.js';
import { canonicalMusicResolver } from './catalog/canonicalMusicResolver.js';
import { contentClassifier, CONTENT_TYPES } from './catalog/contentClassifier.js';
import { searchIntentEngine } from './catalog/searchIntentEngine.js';

async function runTask1CTests() {
  console.log('🧪 Starting MRJ Music Task 1C: Canonical Album-Track Resolution Test Suite...\n');
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

  // 1. CANONICAL MUSIC ENTITY RESOLUTION FOR "DESI KALAKAAR"
  console.log('1. Testing Canonical Music Entity Resolution for "desi kalakaar"...');
  const resDesi = await musicProvider.search('desi kalakaar');
  const topSong = resDesi.songs[0];

  assert(topSong !== undefined, 'Song 1 returned');
  assert(topSong.title.toLowerCase().includes('desi kalakaar'), `Canonical Title is "${topSong.title}"`);
  assert(topSong.artist.toLowerCase().includes('honey singh'), `Canonical Artist is "${topSong.artist}"`);
  assert(topSong.album.toLowerCase().includes('desi kalakaar'), `Canonical Album is "${topSong.album}"`);
  assert(topSong.releaseYear === '2014', `Canonical Year is "${topSong.releaseYear}"`);
  assert(topSong.duration >= 240 && topSong.duration <= 270, `Canonical Track Duration is ${topSong.duration}s (~4:13, NOT 9:57 music video)`);
  assert(topSong.duration !== 597 && topSong.duration !== 598, 'Duration does NOT inherit 9:57 music video duration');
  assert(topSong.id.includes('desi-kalakaar'), `Canonical Entity ID is "${topSong.id}"`);
  assert(topSong.playbackFormat === 'audio', 'PlaybackFormat is "audio"');
  assert(topSong.providerTrackId !== undefined, `Playable ProviderTrackId is "${topSong.providerTrackId}"`);
  assert(topSong.audioSource !== undefined, 'Attached decoupled audioSource object');

  // 2. VIDEO DISSOCIATION
  console.log('\n2. Testing Decoupled Video Presentation for "desi kalakaar"...');
  const topVideo = resDesi.videos[0];
  assert(topVideo !== undefined, 'Top video candidate returned in videos[]');
  assert(topVideo.playbackFormat === 'video', 'Video playbackFormat is "video"');
  assert(resDesi.videos.some((v) => v.duration > 500), 'Long-form music video is placed in videos[], NOT songs[]');

  // 3. REAL ALBUMS & REAL ARTISTS (No synthetic templates)
  console.log('\n3. Testing Real Albums and Artists Resolution...');
  assert(resDesi.albums.length > 0, 'Real albums returned');
  assert(!resDesi.albums[0].title.includes('Essentials'), `Album title is real: "${resDesi.albums[0].title}" (no "Essentials" template)`);
  assert(resDesi.artists.length > 0, 'Real artists returned');

  // 4. MANDATORY 7 QUERY TESTS
  console.log('\n4. Testing All 7 Mandatory Queries for Canonical Resolution...');
  const testQueries = [
    { q: 'desi kalakaar', expectedTitle: 'desi kalakaar', expectedYear: '2014' },
    { q: 'kesariya', expectedTitle: 'kesariya', expectedYear: '2022' },
    { q: 'tum hi ho', expectedTitle: 'tum hi ho', expectedYear: '2013' },
    { q: 'shayraana', expectedTitle: 'shaayraana', expectedYear: '2014' },
    { q: 'tose naina', expectedTitle: 'tose naina', expectedYear: '2013' },
    { q: 'blinding lights', expectedTitle: 'blinding lights', expectedYear: '2019' },
    { q: 'shape of you', expectedTitle: 'shape of you', expectedYear: '2017' },
  ];

  for (const item of testQueries) {
    const res = await musicProvider.search(item.q);
    const s = res.songs[0];
    assert(s !== undefined, `Query "${item.q}" returned canonical song`);
    assert(
      s.title.toLowerCase().includes(item.expectedTitle) || item.expectedTitle.includes(s.title.toLowerCase()),
      `Query "${item.q}" has title "${s.title}"`
    );
    assert(
      s.duration >= 150 && s.duration <= 320,
      `Query "${item.q}" has canonical studio duration (${s.duration}s)`
    );
    assert(
      s.releaseYear === item.expectedYear,
      `Query "${item.q}" resolved release year "${s.releaseYear}"`
    );
    assert(s.playbackFormat === 'audio', `Query "${item.q}" plays format "audio"`);
  }

  console.log(`\n======================================================`);
  console.log(`🎉 TASK 1C TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log(`======================================================\n`);

  if (failed > 0) process.exit(1);
}

runTask1CTests().catch(console.error);
