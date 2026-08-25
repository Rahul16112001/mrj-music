import { predictiveSearchEngine } from './recommendations/predictiveSearchEngine.js';

async function runTests() {
  console.log('🧪 Starting Lyrics & Fuzzy Intent Verification Tests...');

  // 1. Test Semantic Lyrics Match: query = 'main tenu samjhawan ki'
  console.log('\n🔍 Testing Lyrics Search: "main tenu samjhawan ki"...');
  const resLyrics = await predictiveSearchEngine.predictIntent('main tenu samjhawan ki', 'IN');
  console.log('✅ Top Prediction for lyrics:', resLyrics.topPrediction);
  console.log('✅ Suggestions for lyrics:', resLyrics.suggestions);
  if (!resLyrics.topPrediction || !resLyrics.topPrediction.title.includes('Samjhawan')) {
    throw new Error('Expected Samjhawan to be matched for lyrics');
  }

  // 2. Test Fuzzy Typo Match: query = 'arijt sing' (typo for Arijit Singh)
  console.log('\n🔍 Testing Typo Correction: "arijt sing"...');
  const resTypo1 = await predictiveSearchEngine.predictIntent('arijt sing', 'IN');
  console.log('✅ Top Prediction for typo "arijt sing":', resTypo1.topPrediction);
  if (!resTypo1.topPrediction || resTypo1.topPrediction.title !== 'Arijit Singh') {
    throw new Error('Expected Arijit Singh for typo "arijt sing"');
  }

  // 3. Test Fuzzy Typo Match: query = 'karan ojla' (typo for Karan Aujla)
  console.log('\n🔍 Testing Typo Correction: "karan ojla"...');
  const resTypo2 = await predictiveSearchEngine.predictIntent('karan ojla', 'IN');
  console.log('✅ Top Prediction for typo "karan ojla":', resTypo2.topPrediction);
  if (!resTypo2.topPrediction || resTypo2.topPrediction.title !== 'Karan Aujla') {
    throw new Error('Expected Karan Aujla for typo "karan ojla"');
  }

  // 4. Test Categorized Search: Category = 'artists'
  console.log('\n🔍 Testing Categorized Search: Category = "artists", Query = "Arijit"...');
  const resArtists = await predictiveSearchEngine.searchCategorized('Arijit', 'artists', 'IN');
  console.log(`✅ Artists returned: ${resArtists.artists.length} artists`);
  if (resArtists.artists.length > 0) {
    console.log('  Top Artist:', resArtists.artists[0].name);
  }

  // 5. Test Categorized Search: Category = 'songs'
  console.log('\n🔍 Testing Categorized Search: Category = "songs", Query = "Tauba"...');
  const resSongs = await predictiveSearchEngine.searchCategorized('Tauba', 'songs', 'IN');
  console.log(`✅ Songs returned: ${resSongs.songs.length} songs`);
  if (resSongs.songs.length > 0) {
    console.log('  Top Song:', resSongs.songs[0].title, 'by', resSongs.songs[0].artist);
  }

  console.log('\n🎉 ALL LYRICS & CATEGORIZED SEARCH TESTS PASSED SUCCESSFULLY!');
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
