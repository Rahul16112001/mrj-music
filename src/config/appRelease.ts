export interface AppReleaseInfo {
  version: string;
  buildNumber: number;
  releaseDate: string;
  apkFileName: string;
  apkDownloadUrl: string;
  fileSizeFormatted: string;
  fileSizeBytes: number;
  minAndroidVersion: string;
  targetAndroidVersion: string;
  sha256: string;
  isAvailable: boolean;
  features: string[];
}

export const APP_RELEASE: AppReleaseInfo = {
  version: '2.0.0',
  buildNumber: 200,
  releaseDate: 'August 2026',
  apkFileName: 'mrj-music.apk',
  apkDownloadUrl: '/downloads/mrj-music.apk',
  fileSizeFormatted: '64.4 MB',
  fileSizeBytes: 67579573,
  minAndroidVersion: 'Android 8.0 (Oreo) or higher',
  targetAndroidVersion: 'Android 14 (API 34)',
  sha256: '1779a5f183cf4c9c5c99c1cb3c1e706ac8228fb825bff4b4cb05e2b835046655',
  isAvailable: true,
  features: [
    'Native AndroidX Media3 / ExoPlayer Engine with Audio Focus & Ducking',
    'Persistent Background MediaSessionService with Lock Screen & Bluetooth AVRCP Controls',
    'Smart Downloads 2.0 with Native App-Private Offline Vault & WorkManager',
    'Music-First Canonical Catalog & Lossless Quality Switching',
    'Edge-to-Edge Fluid Mobile UI with Hardware Gesture Navigation',
  ],
};
