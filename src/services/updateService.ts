import { API_BASE } from './api';

export interface WebVersionInfo {
  version: string;
  build?: string;
  latestVersion?: string;
  apkDownloadUrl?: string;
  apkFileName?: string;
  downloadUrl?: string;
  changelog?: string[];
  title?: string;
  updatedAt?: string;
}

export interface UpdateCheckResult {
  platform: 'web' | 'android';
  isUpdateAvailable: boolean;
  currentVersion: string;
  latestVersion: string;
  build?: string;
  title: string;
  changelog: string[];
  action: 'reload' | 'apk';
  apkDownloadUrl?: string;
  message: string;
}

class UpdateService {
  private lastCheckTime = 0;
  private cachedUpdateInfo: UpdateCheckResult | null = null;
  public readonly LATEST_APK_URL = 'https://github.com/Rahul16112001/mrj-music/releases/download/v3.7.0/mrj-music-v3.7.0.apk';

  async checkForUpdates(force = false): Promise<UpdateCheckResult | null> {
    if (!force && this.cachedUpdateInfo && Date.now() - this.lastCheckTime < 5 * 60 * 1000) {
      return this.cachedUpdateInfo;
    }

    try {
      const isAndroid = typeof navigator !== 'undefined' && (/Android/i.test(navigator.userAgent) || Boolean((window as any)?.Capacitor?.isNativePlatform?.()));
      
      let remoteData: any = null;
      try {
        const res = await fetch(`${API_BASE}/app/check-update?platform=${isAndroid ? 'android' : 'web'}&version=2.1.0`, { cache: 'no-store' });
        if (res.ok) {
          remoteData = await res.json();
        }
      } catch {}

      if (!remoteData || !remoteData.latestVersion) {
        try {
          const res2 = await fetch(`${API_BASE}/version.json`, { cache: 'no-store' });
          if (res2.ok) {
            remoteData = await res2.json();
          }
        } catch {}
      }

      const currentVersion = this.getCurrentWebVersion();
      const latestVersion = remoteData?.latestVersion || remoteData?.version || '3.7.0';
      const isUpdateAvailable = latestVersion !== currentVersion;
      const isApk = isAndroid || Boolean(remoteData?.apkDownloadUrl);
      const apkUrl = remoteData?.apkDownloadUrl || this.LATEST_APK_URL;

      const result: UpdateCheckResult = {
        platform: isApk ? 'android' : 'web',
        isUpdateAvailable,
        currentVersion,
        latestVersion,
        build: remoteData?.build || '307',
        title: isApk ? 'MRJ Music v3.7.0 Full Update' : 'MRJ Music Web Update',
        changelog: remoteData?.changelog || [
          '❤️ Cloud Favorites & Liked Songs Library Sync with 1-Tap Play All',
          '🎤 Real-Time Synced Lyrics Engine with Auto-Scroll & Tap-to-Seek',
          '🚀 100% Uninterrupted Background & Lockscreen Playback across all devices',
          '⚡ Instant in-app update & direct one-tap install',
          '🎵 Complete song streaming & unplayable track auto-recovery'
        ],
        action: isApk ? 'apk' : 'reload',
        apkDownloadUrl: apkUrl,
        message: isUpdateAvailable
          ? isApk
            ? `Version ${latestVersion} is available! Tap Update to install on your phone.`
            : `Version ${latestVersion} is available. Refresh to update.`
          : 'You are on the latest version of MRJ Music.',
      };

      this.lastCheckTime = Date.now();
      this.cachedUpdateInfo = result;
      return result;
    } catch (err) {
      console.warn('Update check notice:', err);
      return null;
    }
  }

  getCurrentWebVersion(): string {
    return '2.1.0'; // Ensures older versions always match against 3.1.0 and prompt update
  }

  isDismissed(version: string): boolean {
    try {
      if (typeof window === 'undefined') return false;
      return (
        sessionStorage.getItem(`MRJ_DISMISSED_WEB_UPDATE_${version}`) === 'true' ||
        localStorage.getItem(`MRJ_DISMISSED_WEB_UPDATE_${version}`) === 'true'
      );
    } catch {
      return false;
    }
  }

  dismissUpdate(version: string) {
    try {
      if (typeof window === 'undefined') return;
      sessionStorage.setItem(`MRJ_DISMISSED_WEB_UPDATE_${version}`, 'true');
      localStorage.setItem(`MRJ_DISMISSED_WEB_UPDATE_${version}`, 'true');
    } catch {}
  }

  async performUpdate(): Promise<{ success: boolean; message: string }> {
    try {
      if (typeof window !== 'undefined') {
        const isAndroid = /Android/i.test(navigator.userAgent) || Boolean((window as any)?.Capacitor?.isNativePlatform?.());
        if (isAndroid) {
          window.location.href = this.LATEST_APK_URL;
          return { success: true, message: 'Downloading update...' };
        }

        // Clear caches if service workers / cache API exist
        if ('caches' in window) {
          try {
            const keys = await caches.keys();
            await Promise.all(keys.map((k) => caches.delete(k)));
          } catch {}
        }
        window.location.reload();
      }
      return { success: true, message: 'Reloading...' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Failed to update' };
    }
  }
}

export const updateService = new UpdateService();
