import { API_BASE } from './api';
import { nativePlayerBridge } from './nativePlayerBridge';
import { Capacitor } from '@capacitor/core';

export interface UpdateInfo {
  isUpdateAvailable: boolean;
  currentVersion: string;
  latestVersion: string;
  buildNumber: number;
  releaseDate?: string;
  title: string;
  changelog: string[];
  apkDownloadUrl: string;
  apkFileName: string;
  fileSize: string;
  fileSizeBytes: number;
  isMandatory: boolean;
}

class UpdateService {
  private lastCheckTime = 0;
  private cachedUpdateInfo: UpdateInfo | null = null;

  /**
   * Check for updates against central release server.
   */
  async checkForUpdates(force = false): Promise<UpdateInfo | null> {
    if (!force && this.cachedUpdateInfo && Date.now() - this.lastCheckTime < 5 * 60 * 1000) {
      return this.cachedUpdateInfo;
    }

    try {
      const versionInfo = await nativePlayerBridge.getAppVersion();
      const currentVer = versionInfo.version || '2.1.0';

      const res = await fetch(`${API_BASE}/app/check-update?version=${encodeURIComponent(currentVer)}`);
      if (!res.ok) throw new Error('Update check failed');

      const data: UpdateInfo = await res.json();
      this.lastCheckTime = Date.now();
      this.cachedUpdateInfo = data;
      return data;
    } catch (err) {
      console.warn('Update check notice:', err);
      return null;
    }
  }

  /**
   * Triggers download and installation of APK update.
   */
  async performUpdate(
    apkUrl: string,
    onProgress?: (percent: number) => void
  ): Promise<{ success: boolean; message: string }> {
    if (Capacitor.isNativePlatform()) {
      try {
        onProgress?.(10);
        // Direct browser/system download manager intent on Android
        window.open(apkUrl, '_system');
        onProgress?.(100);
        return { success: true, message: 'Downloading update package...' };
      } catch (err: any) {
        return { success: false, message: err?.message || 'Failed to start download' };
      }
    } else {
      window.open(apkUrl, '_blank');
      return { success: true, message: 'Opening download link...' };
    }
  }
}

export const updateService = new UpdateService();
