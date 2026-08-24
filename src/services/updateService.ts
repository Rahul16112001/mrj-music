import { API_BASE } from './api';

export interface WebVersionInfo {
  version: string;
  build: string;
  updatedAt: string;
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
  message: string;
}

class UpdateService {
  private lastCheckTime = 0;
  private cachedUpdateInfo: UpdateCheckResult | null = null;

  async checkForUpdates(force = false): Promise<UpdateCheckResult | null> {
    if (!force && this.cachedUpdateInfo && Date.now() - this.lastCheckTime < 5 * 60 * 1000) {
      return this.cachedUpdateInfo;
    }

    try {
      const res = await fetch(`${API_BASE}/version.json`, { cache: 'no-store' });
      if (!res.ok) throw new Error('Version check failed');

      const remoteVersion: WebVersionInfo = await res.json();
      const currentVersion = this.getCurrentWebVersion();

      const isUpdateAvailable = remoteVersion.version !== currentVersion;

      const result: UpdateCheckResult = {
        platform: 'web',
        isUpdateAvailable,
        currentVersion,
        latestVersion: remoteVersion.version,
        build: remoteVersion.build,
        title: 'MRJ Music Web Update',
        changelog: [
          '🔐 Production security hardening',
          '🛠️ Stream resilience improvements',
          '🎨 UI stability fixes'
        ],
        action: 'reload',
        message: isUpdateAvailable
          ? `Version ${remoteVersion.version} is available. Refresh to update.`
          : 'You are on the latest version.',
      };

      this.lastCheckTime = Date.now();
      this.cachedUpdateInfo = result;
      return result;
    } catch (err) {
      console.warn('Web update check notice:', err);
      return null;
    }
  }

  getCurrentWebVersion(): string {
    return '2.1.0';
  }

  async performUpdate(): Promise<{ success: boolean; message: string }> {
    try {
      window.location.reload();
      return { success: true, message: 'Reloading...' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Failed to reload' };
    }
  }
}

export const updateService = new UpdateService();
