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
  fileSizeFormatted: '961 KB',
  fileSizeBytes: 984064,
  minAndroidVersion: 'Android 8.0 (Oreo) or higher',
  targetAndroidVersion: 'Android 14 (API 34)',
  sha256: 'ad1836ce4a0739e418d8335477e06a590a6083c0720c6e5ccccd9ed807fb82be',
  isAvailable: true,
  features: [
    'Music-First Canonical Catalog & Audio-First Streaming',
    'Smart Downloads 2.0 with Personalized Offline Vault',
    'Hardware Back Button & System Lock Screen Controls',
    'Zero-data Offline Recommendations & Adaptive Autoplay',
    'Edge-to-edge OLED Dark Aesthetic with Dynamic Fluid Layout',
  ],
};
