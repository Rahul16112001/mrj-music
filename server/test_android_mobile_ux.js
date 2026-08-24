import fs from 'fs';
import path from 'path';
import { trackIdentityManager } from './catalog/trackIdentityManager.js';
import { searchRelevanceEngine } from './catalog/searchRelevanceEngine.js';
import { db } from './db/schema.js';

async function runAndroidMobileUxTests() {
  console.log('📱 Starting MRJ Music: Android Production & Mobile UX Test Suite...\n');
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

  // =========================================================================
  // 1. ANDROID MANIFEST & CAPACITOR PLUGIN AUDIT
  // =========================================================================
  console.log('=========================================================================');
  console.log('1. ANDROID MANIFEST & CAPACITOR PLUGINS AUDIT');
  console.log('=========================================================================');

  const manifestPath = path.resolve('android/app/src/main/AndroidManifest.xml');
  assert(fs.existsSync(manifestPath), 'AndroidManifest.xml exists');
  const manifestContent = fs.readFileSync(manifestPath, 'utf8');

  assert(manifestContent.includes('android.permission.INTERNET'), 'Permission INTERNET configured');
  assert(manifestContent.includes('android.permission.WAKE_LOCK'), 'Permission WAKE_LOCK configured');
  assert(manifestContent.includes('android.permission.FOREGROUND_SERVICE'), 'Permission FOREGROUND_SERVICE configured');
  assert(manifestContent.includes('android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK'), 'Permission FOREGROUND_SERVICE_MEDIA_PLAYBACK configured');
  assert(manifestContent.includes('android.permission.ACCESS_NETWORK_STATE'), 'Permission ACCESS_NETWORK_STATE configured');

  const capConfigPath = path.resolve('android/app/src/main/assets/capacitor.plugins.json');
  assert(fs.existsSync(capConfigPath), 'Capacitor plugins JSON exists');
  const capPlugins = JSON.parse(fs.readFileSync(capConfigPath, 'utf8'));
  const pluginNames = capPlugins.map((p) => p.pkg);
  assert(pluginNames.includes('@capacitor/app'), '@capacitor/app plugin synced');
  assert(pluginNames.includes('@capacitor/status-bar'), '@capacitor/status-bar plugin synced');
  assert(pluginNames.includes('@capacitor/network'), '@capacitor/network plugin synced');
  assert(pluginNames.includes('@capacitor/splash-screen'), '@capacitor/splash-screen plugin synced');

  // =========================================================================
  // 2. SAFE-AREAS & CSS TOKENS AUDIT
  // =========================================================================
  console.log('\n=========================================================================');
  console.log('2. SAFE-AREAS, VIEWPORT & DESIGN SYSTEM TOKENS');
  console.log('=========================================================================');

  const cssPath = path.resolve('src/index.css');
  assert(fs.existsSync(cssPath), 'src/index.css exists');
  const cssContent = fs.readFileSync(cssPath, 'utf8');

  assert(cssContent.includes('--sat: env(safe-area-inset-top'), 'CSS defines --sat safe-area-inset-top');
  assert(cssContent.includes('--sab: env(safe-area-inset-bottom'), 'CSS defines --sab safe-area-inset-bottom');
  assert(cssContent.includes('100dvh'), 'Dynamic viewport height (100dvh) configured');
  assert(cssContent.includes('-webkit-tap-highlight-color: transparent'), 'Tap highlight removed for native feel');
  assert(cssContent.includes('#030303'), 'OLED pitch-black #030303 theme configured');

  // =========================================================================
  // 3. MEDIASESSION, LOCK SCREEN & CONTROLS AUDIT
  // =========================================================================
  console.log('\n=========================================================================');
  console.log('3. MEDIASESSION, LOCK SCREEN & CONTROLS AUDIT');
  console.log('=========================================================================');

  const mediaSessionPath = path.resolve('src/services/mediaSession.ts');
  assert(fs.existsSync(mediaSessionPath), 'src/services/mediaSession.ts exists');
  const mediaSessionContent = fs.readFileSync(mediaSessionPath, 'utf8');

  assert(mediaSessionContent.includes("sizes: '512x512'"), '512x512 high-resolution artwork configured for notification');
  assert(mediaSessionContent.includes("'nexttrack'"), 'Next track action handler registered');
  assert(mediaSessionContent.includes("'previoustrack'"), 'Previous track action handler registered');
  assert(mediaSessionContent.includes("'seekto'"), 'Seek to position action handler registered');
  assert(mediaSessionContent.includes('setPositionState'), 'Position state sync configured');

  // =========================================================================
  // 4. ANDROID HARDWARE BACK BUTTON & LIFECYCLE AUDIT
  // =========================================================================
  console.log('\n=========================================================================');
  console.log('4. ANDROID HARDWARE BACK BUTTON & LIFECYCLE SERVICE');
  console.log('=========================================================================');

  const lifecyclePath = path.resolve('src/services/androidLifecycleService.ts');
  assert(fs.existsSync(lifecyclePath), 'src/services/androidLifecycleService.ts exists');
  const lifecycleContent = fs.readFileSync(lifecyclePath, 'utf8');

  assert(lifecycleContent.includes("App.addListener('backButton'"), 'Hardware back button listener configured');
  assert(lifecycleContent.includes('registerBackHandler'), 'Back handler LIFO registration stack supported');
  assert(lifecycleContent.includes('StatusBar.setStyle'), 'StatusBar dark styling configured');
  assert(lifecycleContent.includes("Network.addListener('networkStatusChange'"), 'Network status monitoring configured');

  // =========================================================================
  // 5. MOBILE NAVIGATION & MINI PLAYER DOCKING AUDIT
  // =========================================================================
  console.log('\n=========================================================================');
  console.log('5. MOBILE NAVIGATION & MINI PLAYER DOCKING HIERARCHY');
  console.log('=========================================================================');

  const bottomNavPath = path.resolve('src/components/BottomNav.tsx');
  const bottomNavContent = fs.readFileSync(bottomNavPath, 'utf8');
  assert(bottomNavContent.includes('fixed bottom-0'), 'BottomNav pinned to bottom-0 on mobile');
  assert(bottomNavContent.includes('var(--sab)'), 'BottomNav respects safe-area-inset-bottom');

  const playerBarPath = path.resolve('src/components/PlayerBar.tsx');
  const playerBarContent = fs.readFileSync(playerBarPath, 'utf8');
  assert(playerBarContent.includes('calc(56px + max(var(--sab)'), 'MiniPlayer docked directly above BottomNav on mobile');
  assert(playerBarContent.includes('hidden lg:block'), 'PlayerBar renders full wide bar on desktop');

  const fullPlayerPath = path.resolve('src/components/FullScreenPlayer.tsx');
  const fullPlayerContent = fs.readFileSync(fullPlayerPath, 'utf8');
  assert(fullPlayerContent.includes('androidLifecycleService.registerBackHandler'), 'FullScreenPlayer dismisses on Android hardware back button');
  assert(fullPlayerContent.includes('max(var(--sat)'), 'FullScreenPlayer respects safe-area top');
  assert(fullPlayerContent.includes('max(var(--sab)'), 'FullScreenPlayer respects safe-area bottom');

  // =========================================================================
  // 6. TRACK IDENTITY & CANONICAL RESOLUTION IN QUEUE
  // =========================================================================
  console.log('\n=========================================================================');
  console.log('6. TRACK IDENTITY & PLAYBACK INTEGRITY');
  console.log('=========================================================================');

  const testTrack = {
    id: 'desi-kalakaar|yo-yo-honey-singh',
    canonicalTrackId: 'desi-kalakaar|yo-yo-honey-singh',
    title: 'Desi Kalakaar',
    artist: 'Yo Yo Honey Singh',
    duration: 258,
  };

  const resolvedAudio = await trackIdentityManager.fetchAndResolveSource(testTrack, 'audio');
  assert(resolvedAudio !== null, 'Audio source resolved for Desi Kalakaar');
  assert(resolvedAudio.duration < 300, `Audio duration is studio track (${resolvedAudio.duration}s) not 9:57 MV`);
  assert(resolvedAudio.confidenceScore >= 90, `Audio source match confidence: ${resolvedAudio.confidenceScore}%`);

  console.log(`\n======================================================`);
  console.log(`🎉 ANDROID MOBILE UX TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log(`======================================================\n`);

  if (failed > 0) process.exit(1);
}

runAndroidMobileUxTests().catch(console.error);
