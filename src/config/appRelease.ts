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
  version: '3.18.0',
  buildNumber: 330,
  releaseDate: 'August 2026',
  apkFileName: 'mrj-music-v3.18.0.apk',
  apkDownloadUrl: 'https://github.com/Rahul16112001/mrj-music/releases/download/v3.18.0/mrj-music-v3.18.0.apk',
  fileSizeFormatted: '18 MB',
  fileSizeBytes: 18389855,
  minAndroidVersion: 'Android 8.0 (Oreo) or higher',
  targetAndroidVersion: 'Android 14 (API 34)',
  sha256: 'f2b86ee678ee964a9c7280cf034cc6d74b7241621765a82c1e5ae077b2c071a2',
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
