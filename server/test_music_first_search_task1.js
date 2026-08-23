import { musicProvider } from './providers/musicProvider.js';
import { searchRelevanceEngine } from './catalog/searchRelevanceEngine.js';
import { searchSuggestionService } from './catalog/searchSuggestionService.js';
import { searchIntentEngine } from './catalog/searchIntentEngine.js';

async function runSearchRelevanceTestSuite() {
  console.log('🧪 Starting MRJ Music: Search Relevance & Autocomplete Quality Test Suite...\n');
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

  // 1. TEST CASE: Broad Query "desi"
  console.log('1. Testing Broad Query: "desi"...');
  const resDesi = await musicProvider.search('desi');
  assert(resDesi.songs.length > 0, `Returned ${resDesi.songs.length} songs for "desi"`);
  
  // Verify that all returned songs contain "desi" in title or artist or album
  const allMatchDesi = resDesi.songs.every((s) => {
    const text = `${s.title} ${s.artist} ${s.album || ''}`.toLowerCase();
    return text.includes('desi');
  });
  assert(allMatchDesi, 'All top songs for "desi" actually contain the keyword "desi"');

  // Verify that unrelated songs (Bewafa, Brown Munde, Na Ja) are NOT present
  const hasUnrelated = resDesi.songs.some((s) => {
    const t = s.title.toLowerCase();
    return t === 'bewafa' || t === 'brown munde' || t === 'na ja';
  });
  assert(!hasUnrelated, 'Unrelated popular songs (Bewafa, Brown Munde, Na Ja) are completely excluded');

  // 2. TEST CASE: Exact Song Query "desi kalakaar"
  console.log('\n2. Testing Exact Song Query: "desi kalakaar"...');
  const resDK = await musicProvider.search('desi kalakaar');
  const topDK = resDK.songs[0];
  assert(topDK !== undefined, 'Top song returned for "desi kalakaar"');
  assert(topDK.title.toLowerCase().includes('desi kalakaar'), `Top song is "${topDK.title}"`);
  assert(topDK.artist.toLowerCase().includes('honey singh'), `Top artist is "${topDK.artist}"`);
  assert(topDK.relevanceScore >= 500, `High relevance score (${topDK.relevanceScore})`);

  // 3. TEST CASE: Artist Query "yo yo honey singh"
  console.log('\n3. Testing Artist Query: "yo yo honey singh"...');
  const resArtist = await musicProvider.search('yo yo honey singh');
  assert(resArtist.songs.length > 0, `Returned ${resArtist.songs.length} songs for artist`);
  const allHoneySingh = resArtist.songs.every((s) => s.artist.toLowerCase().includes('honey singh'));
  assert(allHoneySingh, 'All returned songs belong to "Yo Yo Honey Singh"');

  // 4. TEST CASE: Query "desi girl"
  console.log('\n4. Testing Song Query: "desi girl"...');
  const resDG = await musicProvider.search('desi girl');
  assert(resDG.songs.length > 0, 'Found songs for "desi girl"');
  assert(resDG.songs[0].title.toLowerCase().includes('desi girl'), `Top song is "${resDG.songs[0].title}"`);

  // 5. TEST CASE: Query "desi boyz"
  console.log('\n5. Testing Song Query: "desi boyz"...');
  const resDB = await musicProvider.search('desi boyz');
  assert(resDB.songs.length > 0, 'Found songs for "desi boyz"');
  assert(resDB.songs[0].title.toLowerCase().includes('desi boyz'), `Top song is "${resDB.songs[0].title}"`);

  // 6. TEST CASE: Query "kesariya"
  console.log('\n6. Testing Song Query: "kesariya"...');
  const resKes = await musicProvider.search('kesariya');
  assert(resKes.songs[0].title.toLowerCase().includes('kesariya'), `Top song is "${resKes.songs[0].title}"`);

  // 7. TEST CASE: Query "shayraana"
  console.log('\n7. Testing Song Query: "shayraana"...');
  const resShay = await musicProvider.search('shayraana');
  assert(resShay.songs[0].title.toLowerCase().includes('shayraana') || resShay.songs[0].title.toLowerCase().includes('shaayraana'), `Top song is "${resShay.songs[0].title}"`);

  // 8. TEST CASE: Query "tum hi ho"
  console.log('\n8. Testing Song Query: "tum hi ho"...');
  const resTum = await musicProvider.search('tum hi ho');
  assert(resTum.songs[0].title.toLowerCase().includes('tum hi ho'), `Top song is "${resTum.songs[0].title}"`);

  // 9. TEST CASE: Non-existent Query "xyzabc123notreal" (Hard Threshold Gate)
  console.log('\n9. Testing Non-existent Query: "xyzabc123notreal"...');
  const resFake = await musicProvider.search('xyzabc123notreal');
  assert(resFake.songs.length === 0, 'Zero songs returned (hard relevance gate prevents random trending tracks)');

  // 10. TEST CASE: Autocomplete Quality & Separation
  console.log('\n10. Testing Autocomplete Quality for "desi" and "desi k"...');
  const sugDesi = await searchSuggestionService.getSuggestions('desi');
  assert(sugDesi.suggestions.length > 0, 'Suggestions returned for "desi"');
  assert(sugDesi.suggestions.some((s) => s.toLowerCase().includes('desi')), 'Suggestions contain "desi" variations');
  assert(sugDesi.songs.every((s) => `${s.title} ${s.artist}`.toLowerCase().includes('desi')), 'Autocomplete songs are strictly relevant to "desi"');

  const sugDesiK = await searchSuggestionService.getSuggestions('desi k');
  assert(sugDesiK.suggestions.some((s) => s.toLowerCase().startsWith('desi k')), 'Progressive autocomplete prioritizes "desi k..." matches');

  console.log(`\n======================================================`);
  console.log(`🎉 SEARCH RELEVANCE TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log(`======================================================\n`);

  if (failed > 0) process.exit(1);
}

runSearchRelevanceTestSuite().catch(console.error);
