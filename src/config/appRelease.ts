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
  version: '3.20.8',
  buildNumber: 349,
  releaseDate: '2026-09-18',
  apkFileName: 'mrj-music-v3.20.8.apk',
  apkDownloadUrl: '/downloads/mrj-music.apk',
  fileSizeFormatted: '18 MB',
  fileSizeBytes: 18991800,
  minAndroidVersion: 'Android 8.0 (Oreo) or higher',
  targetAndroidVersion: 'Android 14 (API 34)',
  sha256: '69af20c9df804da72928b58dec0fd63b9524978c0fd5c2cfda34aa11a3e9e301',
  isAvailable: true,
  features: [
    'Official YouTube Music High-Precision Search Engine & Instant Keystroke Suggestions',
    'Ultra HD 800x800 Studio Master Posters & 1080p Artwork across all devices',
    '320kbps High-Bitrate Studio Audio Streaming Pipeline',
    'Deep Dynamic AI/ML Infinite Queue Replenishment with Skip Penalties',
    'Smart Downloads 2.0 & Manual Download ID Resolution with Offline Toasts',
    'Native Phone Call Interruption & Auto-Resume Bridge',
    'MediaSession Lock-Screen ±10s Seek & Background WakeLock Auto-Reacquisition',
  ],
};
