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
  version: '3.20.5',
  buildNumber: 346,
  releaseDate: '2026-09-17',
  apkFileName: 'mrj-music-v3.20.5.apk',
  apkDownloadUrl: '/downloads/mrj-music.apk',
  fileSizeFormatted: '18 MB',
  fileSizeBytes: 18983656,
  minAndroidVersion: 'Android 8.0 (Oreo) or higher',
  targetAndroidVersion: 'Android 14 (API 34)',
  sha256: 'c6c4ba649c63ecfe07fc0d1a225040aa5c593892c730721978509d40acad8944',
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
