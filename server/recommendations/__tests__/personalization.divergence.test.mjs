/**
 * D6 — Personalization Divergence Test (import-based, NO socket / NO HTTP server).
 *
 * Simulates three users with clearly different tastes:
 *   User A -> Punjabi   (Diljit Dosanjh / Karan Aujla)
 *   User B -> Bollywood (Arijit Singh)
 *   User C -> Hollywood (The Weeknd / Taylor Swift)
 *
 * It feeds behavioral events + search history through the REAL personalization
 * pipeline (personalizationEngine -> db.saveTasteProfile), then calls the REAL
 * getPersonalizedHome() and getNextRecommendations(), and asserts the results
 * DIVERGE per user (different top artists, different dominant genre).
 *
 * Runs with plain `node` against the in-memory embedded DB (no DATABASE_URL).
 *
 *   node server/recommendations/__tests__/personalization.divergence.test.mjs
 *
 * NOTE: the ONLY stub in this file is musicProvider's *network* retrieval
 * (getTasteCandidatePool / getCandidatePool), forced to return [] so the test is
 * deterministic and offline. All scoring, taste-profile math, candidate blending,
 * filtering and ranking under test is the real production code. The local catalog
 * (chartService.VERIFIED_CATALOG) supplies the candidate corpus.
 */

// Ensure the embedded (in-memory) store is used — never touch a real Postgres.
delete process.env.DATABASE_URL;

import { db } from '../../db/schema.js';
import { cloudRecommendationService } from '../cloudRecommendationService.js';
import { nextTrackService } from '../nextTrackService.js';
import { musicProvider } from '../../providers/musicProvider.js';

// ---- TEST-ONLY STUB: force network retrieval offline/deterministic. ----
// Both services import this same object instance, so both see the stub.
musicProvider.getTasteCandidatePool = async () => [];
musicProvider.getCandidatePool = async () => [];

let failures = 0;
function assert(cond, msg) {
  if (cond) {
    console.log(`  PASS: ${msg}`);
  } else {
    console.error(`  FAIL: ${msg}`);
    failures++;
  }
}

// Plurality (most common) genre in a list of normalized tracks.
function dominantGenre(tracks) {
  const counts = {};
  for (const t of tracks || []) {
    const g = (t.genre || 'Unknown');
    counts[g] = (counts[g] || 0) + 1;
  }
  let best = null;
  let bestN = -1;
  for (const [g, n] of Object.entries(counts)) {
    if (n > bestN) {
      best = g;
      bestN = n;
    }
  }
  return best;
}

function genreCount(tracks, genre) {
  return (tracks || []).filter((t) => (t.genre || '').toLowerCase() === genre.toLowerCase()).length;
}

// Build a batch of strong-taste events for a user (likes + full completions).
function tasteEvents(specs) {
  const events = [];
  for (const s of specs) {
    events.push({
      eventType: 'PLAY_COMPLETED',
      trackId: s.trackId,
      title: s.title,
      artist: s.artist,
      genre: s.genre,
      completionPercent: 98,
    });
    events.push({
      eventType: 'LIKE',
      trackId: s.trackId,
      title: s.title,
      artist: s.artist,
      genre: s.genre,
    });
  }
  return events;
}

const USERS = {
  A: {
    id: 'user_punjabi_A',
    label: 'Punjabi',
    expectedGenre: 'Punjabi',
    expectedArtists: ['Diljit Dosanjh', 'Karan Aujla'],
    searches: ['karan aujla', 'diljit dosanjh'],
    events: tasteEvents([
      { trackId: 'mH_LFkWxpI0', title: 'Lover', artist: 'Diljit Dosanjh', genre: 'Punjabi' },
      { trackId: 'cl0a3i2wFcc', title: 'Born to Shine', artist: 'Diljit Dosanjh', genre: 'Punjabi' },
      { trackId: 'LK7-_dgAVQE', title: 'Tauba Tauba', artist: 'Karan Aujla', genre: 'Punjabi' },
      { trackId: 'cWMxCE2HTag', title: 'Softly', artist: 'Karan Aujla', genre: 'Punjabi' },
    ]),
    seed: { id: 'XTp5jaRU3Ws', title: 'Wavy', artist: 'Karan Aujla', genre: 'Punjabi' },
  },
  B: {
    id: 'user_bollywood_B',
    label: 'Bollywood',
    expectedGenre: 'Bollywood',
    expectedArtists: ['Arijit Singh'],
    searches: ['arijit singh', 'kesariya'],
    events: tasteEvents([
      { trackId: '_Wv2iV8b0hA', title: 'Satranga', artist: 'Arijit Singh', genre: 'Bollywood' },
      { trackId: '1tsCjcq0G-U', title: 'O Maahi', artist: 'Arijit Singh', genre: 'Bollywood' },
      { trackId: '6RdS6wLu7RY', title: 'Kesariya', artist: 'Arijit Singh & Pritam', genre: 'Bollywood' },
      { trackId: 'VAdGW7QDJiU', title: 'Chaleya', artist: 'Arijit Singh & Anirudh', genre: 'Bollywood' },
    ]),
    seed: { id: 'u2NAuswnTKs', title: 'Apna Bana Le', artist: 'Arijit Singh & Sachin-Jigar', genre: 'Bollywood' },
  },
  C: {
    id: 'user_hollywood_C',
    label: 'Hollywood',
    expectedGenre: 'Hollywood',
    expectedArtists: ['The Weeknd', 'Taylor Swift', 'Dua Lipa'],
    searches: ['the weeknd', 'dua lipa'],
    events: tasteEvents([
      { trackId: '4NRXx6U8ABQ', title: 'Blinding Lights', artist: 'The Weeknd', genre: 'Hollywood' },
      { trackId: 'dqt8Z1k0oWQ', title: 'Starboy', artist: 'The Weeknd ft. Daft Punk', genre: 'Hollywood' },
      { trackId: 'ic8j13piAhQ', title: 'Cruel Summer', artist: 'Taylor Swift', genre: 'Hollywood' },
      { trackId: 'TUVcZfQe-Kw', title: 'Levitating', artist: 'Dua Lipa', genre: 'Hollywood' },
    ]),
    seed: { id: 'k2qgadSvNyU', title: 'New Rules', artist: 'Dua Lipa', genre: 'Hollywood' },
  },
};

async function seedUser(u) {
  await cloudRecommendationService.processEvents(u.id, u.events);
  for (const q of u.searches) {
    await db.addSearchHistory(u.id, q);
  }
}

async function run() {
  console.log('=== D6 Personalization Divergence Test ===\n');

  // 1. Seed all three users through the real pipeline.
  for (const key of Object.keys(USERS)) {
    await seedUser(USERS[key]);
  }

  // 2. Confirm the taste profiles actually persisted & diverged (D1 + D2 unlock).
  console.log('--- Persisted taste profiles ---');
  const profiles = {};
  for (const key of Object.keys(USERS)) {
    const u = USERS[key];
    const p = await db.getTasteProfile(u.id);
    profiles[key] = p;
    const topArtist = Object.entries(p.preferred_artists || {}).sort((a, b) => b[1] - a[1])[0];
    console.log(
      `User ${key} (${u.label}): topArtist=${topArtist ? `${topArtist[0]}(${topArtist[1]})` : 'none'}, ` +
        `genres=${JSON.stringify(p.preferred_genres)}, likedArtists=${JSON.stringify(p.liked_artists)}, ` +
        `total_plays=${p.total_plays}, completion_rate=${p.completion_rate}`
    );
    assert(Object.keys(p.preferred_artists || {}).length > 0, `User ${key} persisted preferred_artists`);
    assert((p.total_plays || 0) > 0, `User ${key} persisted total_plays (${p.total_plays})`);
  }
  console.log('');

  // 3. getPersonalizedHome divergence.
  console.log('--- getPersonalizedHome() ---');
  const homes = {};
  for (const key of Object.keys(USERS)) {
    const u = USERS[key];
    const home = await cloudRecommendationService.getPersonalizedHome(u.id, 'IN');
    homes[key] = home;

    const byl = home.personalized.becauseYouLike;
    const recGenre = dominantGenre(home.personalized.recommendedForYou);
    const mixTitle = home.personalized.dailyMixes?.[0]?.title;
    console.log(
      `User ${key} (${u.label}): becauseYouLike.artist=${byl?.artist || 'none'}, ` +
        `dailyMix[0]="${mixTitle}", recommendedForYou dominantGenre=${recGenre} ` +
        `(${genreCount(home.personalized.recommendedForYou, u.expectedGenre)}/${home.personalized.recommendedForYou.length} ${u.expectedGenre})`
    );

    // Shape preservation checks.
    assert(!!home.personalized && !!home.charts && !!home.discovery && !!home.moods, `User ${key} home keeps top-level shape`);
    assert(Array.isArray(home.personalized.dailyMixes) && home.personalized.dailyMixes.length > 0, `User ${key} has dailyMixes`);
    assert(typeof home.personalized.greeting === 'string', `User ${key} has greeting`);
    assert('timeOfDay' in home.personalized && 'quickPicks' in home.personalized && 'onRepeat' in home.personalized, `User ${key} keeps personalized keys`);

    // Personalization checks: top artist reflects the user, not a hardcoded default.
    assert(u.expectedArtists.includes(byl?.artist), `User ${key} becauseYouLike.artist is one of ${JSON.stringify(u.expectedArtists)} (got ${byl?.artist})`);
    assert(typeof mixTitle === 'string' && u.expectedArtists.some((a) => mixTitle.includes(a)), `User ${key} dailyMix[0] title names a real top artist`);
    assert(recGenre === u.expectedGenre, `User ${key} recommendedForYou dominated by ${u.expectedGenre} (got ${recGenre})`);
  }

  // Cross-user divergence: the three home feeds must differ.
  const artistA = homes.A.personalized.becauseYouLike?.artist;
  const artistB = homes.B.personalized.becauseYouLike?.artist;
  const artistC = homes.C.personalized.becauseYouLike?.artist;
  assert(new Set([artistA, artistB, artistC]).size === 3, `All three home becauseYouLike artists are distinct (${artistA} / ${artistB} / ${artistC})`);

  const domA = dominantGenre(homes.A.personalized.recommendedForYou);
  const domB = dominantGenre(homes.B.personalized.recommendedForYou);
  const domC = dominantGenre(homes.C.personalized.recommendedForYou);
  assert(new Set([domA, domB, domC]).size === 3, `All three home recommendedForYou dominant genres are distinct (${domA} / ${domB} / ${domC})`);

  // Track-id overlap between A (Punjabi) and C (Hollywood) recommendedForYou should be minimal.
  const idsA = new Set(homes.A.personalized.recommendedForYou.map((t) => t.id));
  const idsC = new Set(homes.C.personalized.recommendedForYou.map((t) => t.id));
  const overlapAC = [...idsA].filter((id) => idsC.has(id)).length;
  assert(overlapAC <= 2, `Punjabi vs Hollywood recommendedForYou overlap is minimal (${overlapAC} shared ids)`);
  console.log('');

  // 4. getNextRecommendations divergence (taste-driven, no seed track).
  console.log('--- getNextRecommendations() [no seed; pure taste] ---');
  const nexts = {};
  for (const key of Object.keys(USERS)) {
    const u = USERS[key];
    const rec = await nextTrackService.getNextRecommendations(u.id, {
      currentTrack: null,
      playedTrackIds: [],
      currentQueueIds: [],
      sessionSearches: u.searches,
    });
    nexts[key] = rec;
    const top5 = rec.tracks.slice(0, 5);
    const dom = dominantGenre(top5);
    console.log(
      `User ${key} (${u.label}): source=${rec.source}, count=${rec.count}, ` +
        `top5 dominantGenre=${dom} [${top5.map((t) => `${t.title}~${t.genre}`).join(', ')}]`
    );
    assert(rec && Array.isArray(rec.tracks) && typeof rec.source === 'string' && typeof rec.count === 'number', `User ${key} getNextRecommendations keeps {source,count,tracks} shape`);
    assert(rec.count > 0, `User ${key} produced recommendations`);
    assert(dom === u.expectedGenre, `User ${key} next-track top-5 dominated by ${u.expectedGenre} (got ${dom})`);
  }

  const nDomA = dominantGenre(nexts.A.tracks.slice(0, 5));
  const nDomB = dominantGenre(nexts.B.tracks.slice(0, 5));
  const nDomC = dominantGenre(nexts.C.tracks.slice(0, 5));
  assert(new Set([nDomA, nDomB, nDomC]).size === 3, `All three next-track top-5 dominant genres are distinct (${nDomA} / ${nDomB} / ${nDomC})`);

  // 5. getNextRecommendations WITH a seed track (blends seed + taste).
  console.log('\n--- getNextRecommendations() [with genre-matched seed] ---');
  for (const key of Object.keys(USERS)) {
    const u = USERS[key];
    const rec = await nextTrackService.getNextRecommendations(u.id, {
      currentTrack: u.seed,
      playedTrackIds: [],
      currentQueueIds: [],
      sessionSearches: u.searches,
    });
    const top5 = rec.tracks.slice(0, 5);
    const dom = dominantGenre(top5);
    console.log(`User ${key} (${u.label}): seed="${u.seed.title}" -> top5 dominantGenre=${dom}, count=${rec.count}`);
    assert(rec.count > 0, `User ${key} seeded recommendations produced`);
    assert(dom === u.expectedGenre, `User ${key} seeded top-5 stays in ${u.expectedGenre} (got ${dom})`);
    // The seed itself must not be recommended back.
    assert(!rec.tracks.some((t) => t.id === u.seed.id), `User ${key} seed track excluded from its own recommendations`);
  }

  console.log(`\n=== ${failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED'} ===`);
  process.exit(failures === 0 ? 0 : 1);
}

run().catch((err) => {
  console.error('TEST CRASHED:', err);
  process.exit(1);
});
