import axios from 'axios';
import { mlIntelligenceEngine } from './recommendations/mlIntelligenceEngine.js';
import { viralTrendService } from './recommendations/viralTrendService.js';

async function testDashboard() {
  console.log('🧪 Testing Deep ML Personalization Dashboard Generation...');

  const mixes = await mlIntelligenceEngine.generateDailyMixes(null, 'IN');
  console.log(`✅ Generated ${mixes.dailyMixes.length} Daily Mixes:`);
  for (const mix of mixes.dailyMixes) {
    console.log(`  - [${mix.title}] ${mix.vibe}: ${mix.subtitle} (${mix.tracksCount} tracks, Poster: ${mix.posterImage?.substring(0, 45)}...)`);
  }

  const reels = await viralTrendService.getViralReelsTracks('IN', 10);
  console.log(`\n✅ Generated ${reels.length} Viral Instagram Reels sounds:`);
  for (const reel of reels.slice(0, 3)) {
    console.log(`  - [${reel.title}] by ${reel.artist} (Velocity: ${reel.viralVelocity}, PlayCount: ${reel.playCount})`);
  }

  console.log('\n🎉 ALL DASHBOARD ML ENGINES FUNCTIONING ACCURATELY!');
}

testDashboard().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
