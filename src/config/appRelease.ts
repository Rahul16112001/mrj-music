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
  version: '3.1.0',
  buildNumber: 301,
  releaseDate: 'August 2026',
  apkFileName: 'mrj-music-v3.1.0.apk',
  apkDownloadUrl: 'https://github.com/Rahul16112001/mrj-music/releases/download/v3.1.0/mrj-music-v3.1.0.apk',
  fileSizeFormatted: '111 MB',
  fileSizeBytes: 116375238,
  minAndroidVersion: 'Android 8.0 (Oreo) or higher',
  targetAndroidVersion: 'Android 14 (API 34)',
  sha256: 'c6aac4e8c8e2fd9a559899cabd4d259d00020c1040b53ff8e2d2598cbd3d45d2',
  isAvailable: true,
  features: [
    '100% Native Jetpack Compose & Material 3 Interface',
    'AndroidX Media3 / ExoPlayer 1.3.1 Engine with Audio Focus & Ducking',
    'Persistent Background MediaSessionService with Lock Screen & Bluetooth AVRCP Controls',
    'Smart Downloads with App-Private Offline Vault & WorkManager',
    'In-App Android Package Installer Upgrade Mechanism',
  ],
};
