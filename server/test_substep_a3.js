import { predictiveSearchEngine } from './recommendations/predictiveSearchEngine.js';

async function runTests() {
  console.log('🧪 Starting Sub-Step A.3 Verification Tests (Predictive Search & Intent Engine)...');

  // 1. Test Trending Keywords (India vs Global)
  const inTrending = predictiveSearchEngine.getTrendingKeywords('IN');
  console.log(`✅ Trending Keywords for India (${inTrending.length}):`, inTrending.slice(0, 4));
  if (!inTrending.includes('Tauba Tauba') || !inTrending.includes('Arijit Singh')) {
    throw new Error('Expected Indian trending keywords missing');
  }

  const globalTrending = predictiveSearchEngine.getTrendingKeywords('US');
  console.log(`✅ Trending Keywords for Global/US (${globalTrending.length}):`, globalTrending.slice(0, 4));
  if (!globalTrending.includes('Taylor Swift') || !globalTrending.includes('The Weeknd')) {
    throw new Error('Expected Global trending keywords missing');
  }

  // 2. Test Single Key Intent: typing 'a'
  console.log('\n🔍 Testing Single-Letter Intent: query = "a"...');
  const resA = await predictiveSearchEngine.predictIntent('a', 'IN');
  console.log('✅ Predictive suggestions for "a":', resA.suggestions);
  console.log('✅ Top Prediction for "a":', resA.topPrediction);
  if (!resA.suggestions.length) throw new Error('Expected suggestions for "a"');

  // 3. Test Prefix Intent: typing 'kar' (should predict Karan Aujla as Top Prediction Artist)
  console.log('\n🔍 Testing Partial Artist Intent: query = "kar"...');
  const resKar = await predictiveSearchEngine.predictIntent('kar', 'IN');
  console.log('✅ Predictive suggestions for "kar":', resKar.suggestions);
  console.log('✅ Top Prediction for "kar":', resKar.topPrediction);
  if (!resKar.topPrediction || resKar.topPrediction.title !== 'Karan Aujla') {
    throw new Error('Expected Karan Aujla as Top Prediction for "kar"');
  }

  // 4. Test Partial Song Intent: typing 'tau' (should predict Tauba Tauba as Top Prediction Song)
  console.log('\n🔍 Testing Partial Song Intent: query = "tau"...');
  const resTau = await predictiveSearchEngine.predictIntent('tau', 'IN');
  console.log('✅ Predictive suggestions for "tau":', resTau.suggestions);
  console.log('✅ Top Prediction for "tau":', resTau.topPrediction);
  if (!resTau.topPrediction || resTau.topPrediction.title !== 'Tauba Tauba') {
    throw new Error('Expected Tauba Tauba as Top Prediction for "tau"');
  }

  // 5. Test Global Intent: typing 'tay' (should predict Taylor Swift)
  console.log('\n🔍 Testing Global Artist Intent: query = "tay"...');
  const resTay = await predictiveSearchEngine.predictIntent('tay', 'US');
  console.log('✅ Predictive suggestions for "tay":', resTay.suggestions);
  console.log('✅ Top Prediction for "tay":', resTay.topPrediction);
  if (!resTay.topPrediction || resTay.topPrediction.title !== 'Taylor Swift') {
    throw new Error('Expected Taylor Swift as Top Prediction for "tay"');
  }

  // 6. Test Instant Songs Results
  console.log('\n🔍 Testing Instant Song Results: query = "Apna Bana Le"...');
  const resSong = await predictiveSearchEngine.predictIntent('Apna Bana Le', 'IN');
  console.log(`✅ Instant songs returned: ${resSong.instantSongs.length} tracks`);
  if (resSong.instantSongs.length > 0) {
    console.log('  Top Instant Track:', resSong.instantSongs[0].title, 'by', resSong.instantSongs[0].artist);
  }

  console.log('\n🎉 ALL SUB-STEP A.3 TESTS PASSED SUCCESSFULLY!');
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
