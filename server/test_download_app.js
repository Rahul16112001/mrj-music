import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { APP_RELEASE } from '../src/config/appRelease.ts';

console.log('🧪 Starting MRJ Music: Android Download App & APK Verification Suite...\n');

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

// 1. APK FILE & INTEGRITY TESTS
console.log('=========================================================================');
console.log('1. ANDROID APK HOSTING & CHECKSUM VERIFICATION');
console.log('=========================================================================');

const apkPath = path.resolve(process.cwd(), 'public/downloads/mrj-music.apk');
assert(fs.existsSync(apkPath), 'public/downloads/mrj-music.apk exists');

if (fs.existsSync(apkPath)) {
  const stats = fs.statSync(apkPath);
  assert(stats.size > 100000, `APK size is valid (>100KB): ${Math.round(stats.size / 1024)} KB`);

  const fileBuffer = fs.readFileSync(apkPath);
  const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
  assert(hash === APP_RELEASE.sha256, `SHA-256 checksum matches release config (${hash})`);
}

// 2. CONFIGURATION SINGLE SOURCE OF TRUTH
console.log('\n=========================================================================');
console.log('2. APP RELEASE CONFIGURATION INTEGRITY');
console.log('=========================================================================');

assert(APP_RELEASE.version === '3.1.0', `Release version is v${APP_RELEASE.version}`);
assert(APP_RELEASE.isAvailable === true, 'APK is marked as available for production');
assert(APP_RELEASE.apkDownloadUrl.startsWith('/downloads/'), `Download URL is relative production path: ${APP_RELEASE.apkDownloadUrl}`);
assert(APP_RELEASE.features.length >= 4, `Features highlight list populated (${APP_RELEASE.features.length} items)`);

// 3. UI COMPONENTS & ROUTE VERIFICATION
console.log('\n=========================================================================');
console.log('3. SIDEBAR & DOWNLOAD ROUTE INTEGRATION');
console.log('=========================================================================');

const sidebarCode = fs.readFileSync(path.resolve(process.cwd(), 'src/components/Sidebar.tsx'), 'utf-8');
assert(sidebarCode.includes('to="/download"'), 'Sidebar contains NavLink to /download');
assert(sidebarCode.includes('Download App'), 'Sidebar displays prominent "Download App" label');
assert(sidebarCode.includes('Get MRJ Music for Android'), 'Sidebar displays descriptive subtitle');

const appCode = fs.readFileSync(path.resolve(process.cwd(), 'src/App.tsx'), 'utf-8');
assert(appCode.includes('path="/download"'), 'App.tsx registers /download route');
assert(appCode.includes('path="/download-app"'), 'App.tsx registers /download-app route alias');

const downloadPageCode = fs.readFileSync(path.resolve(process.cwd(), 'src/pages/DownloadApp.tsx'), 'utf-8');
assert(downloadPageCode.includes('MRJ Music for Android'), 'DownloadApp page renders hero heading');
assert(downloadPageCode.includes('Download APK') || downloadPageCode.includes('Download Android App'), 'DownloadApp page renders download CTA');
assert(downloadPageCode.includes('qrApiUrl') || downloadPageCode.includes('QrCode'), 'DownloadApp page supports QR code for phone scanning');
assert(downloadPageCode.includes('APP_DOWNLOAD_PAGE_OPENED'), 'DownloadApp page logs anonymous page opened analytics');
assert(downloadPageCode.includes('APP_DOWNLOAD_CLICKED'), 'DownloadApp page logs anonymous download clicked analytics');

const settingsCode = fs.readFileSync(path.resolve(process.cwd(), 'src/pages/Settings.tsx'), 'utf-8');
assert(settingsCode.includes('to="/download"'), 'Settings page includes link to download Android app');

console.log('\n======================================================');
console.log(`🎉 DOWNLOAD APP TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
console.log('======================================================\n');

if (failed > 0) {
  process.exit(1);
}
