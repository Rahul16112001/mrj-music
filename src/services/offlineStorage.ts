import { Track, LyricData, Playlist, AppSettings, SmartDownloadConfig } from '../types';

const DB_NAME = 'MRJ_MUSIC_V2_DB';
const DB_VERSION = 2;

const STORES = {
  DOWNLOADS: 'downloaded_tracks',
  PLAYLISTS: 'playlists',
  LIKED: 'liked_tracks',
  HISTORY: 'history',
  SETTINGS: 'settings',
};

interface OfflineRecord {
  id: string;
  track: Track;
  audioBlob: Blob;
  lyrics?: LyricData;
  downloadedAt: number;
  fileSize: number;
}

const DEFAULT_SETTINGS: AppSettings = {
  audioQuality: 'high',
  autoplayRadio: true,
  smartDownloads: {
    enabled: true,
    maxTracks: 20,
    storageLimitMB: 500,
    wifiOnly: true,
    preferredQuality: 'high',
  },
  theme: 'oled-dark',
  analyticsEnabled: false,
  anonymousInstallationId: 'mrj_inst_' + Math.random().toString(36).substring(2, 12),
};

class OfflineStorageManager {
  private dbPromise: Promise<IDBDatabase>;

  constructor() {
    this.dbPromise = this.initDB();
  }

  private initDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        return reject(new Error('IndexedDB not supported'));
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event: any) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORES.DOWNLOADS)) {
          db.createObjectStore(STORES.DOWNLOADS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORES.PLAYLISTS)) {
          db.createObjectStore(STORES.PLAYLISTS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORES.LIKED)) {
          db.createObjectStore(STORES.LIKED, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORES.HISTORY)) {
          db.createObjectStore(STORES.HISTORY, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
          db.createObjectStore(STORES.SETTINGS, { keyPath: 'key' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // ==================== 1. DOWNLOADED TRACKS ====================

  async saveDownloadedTrack(track: Track, audioBlob: Blob, lyrics?: LyricData): Promise<Track> {
    const db = await this.dbPromise;
    const offlineTrack: Track = {
      ...track,
      isOffline: true,
      downloadedAt: Date.now(),
      fileSize: audioBlob.size,
    };

    const record: OfflineRecord = {
      id: track.id,
      track: offlineTrack,
      audioBlob,
      lyrics,
      downloadedAt: Date.now(),
      fileSize: audioBlob.size,
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.DOWNLOADS, 'readwrite');
      const store = tx.objectStore(STORES.DOWNLOADS);
      const req = store.put(record);

      req.onsuccess = () => resolve(offlineTrack);
      req.onerror = () => reject(req.error);
    });
  }

  async getOfflineAudio(trackId: string): Promise<{ blobUrl: string; lyrics?: LyricData; track: Track } | null> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.DOWNLOADS, 'readonly');
      const store = tx.objectStore(STORES.DOWNLOADS);
      const req = store.get(trackId);

      req.onsuccess = () => {
        const record = req.result as OfflineRecord | undefined;
        if (!record || !record.audioBlob) return resolve(null);

        const blobUrl = URL.createObjectURL(record.audioBlob);
        resolve({
          blobUrl,
          lyrics: record.lyrics,
          track: record.track,
        });
      };
      req.onerror = () => reject(req.error);
    });
  }

  async isDownloaded(trackId: string): Promise<boolean> {
    const db = await this.dbPromise;
    return new Promise((resolve) => {
      const tx = db.transaction(STORES.DOWNLOADS, 'readonly');
      const store = tx.objectStore(STORES.DOWNLOADS);
      const req = store.count(trackId);

      req.onsuccess = () => resolve(req.result > 0);
      req.onerror = () => resolve(false);
    });
  }

  async getAllDownloadedTracks(): Promise<Track[]> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.DOWNLOADS, 'readonly');
      const store = tx.objectStore(STORES.DOWNLOADS);
      const req = store.getAll();

      req.onsuccess = () => {
        const records = (req.result || []) as OfflineRecord[];
        const tracks = records.map(r => r.track);
        resolve(tracks);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async removeTrack(trackId: string): Promise<boolean> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.DOWNLOADS, 'readwrite');
      const store = tx.objectStore(STORES.DOWNLOADS);
      const req = store.delete(trackId);

      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  async getStorageUsage(): Promise<{ totalBytes: number; formatted: string; count: number }> {
    const tracks = await this.getAllDownloadedTracks();
    const totalBytes = tracks.reduce((sum, t) => sum + (t.fileSize || 3500000), 0);

    let formatted = `${(totalBytes / 1024 / 1024).toFixed(1)} MB`;
    if (totalBytes > 1024 * 1024 * 1024) {
      formatted = `${(totalBytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
    }

    return {
      totalBytes,
      formatted,
      count: tracks.length,
    };
  }

  // ==================== 2. PLAYLISTS ====================

  async getAllPlaylists(): Promise<Playlist[]> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.PLAYLISTS, 'readonly');
      const store = tx.objectStore(STORES.PLAYLISTS);
      const req = store.getAll();

      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async getPlaylist(id: string): Promise<Playlist | null> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.PLAYLISTS, 'readonly');
      const store = tx.objectStore(STORES.PLAYLISTS);
      const req = store.get(id);

      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async savePlaylist(playlist: Playlist): Promise<Playlist> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.PLAYLISTS, 'readwrite');
      const store = tx.objectStore(STORES.PLAYLISTS);
      const req = store.put(playlist);

      req.onsuccess = () => resolve(playlist);
      req.onerror = () => reject(req.error);
    });
  }

  async deletePlaylist(id: string): Promise<boolean> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.PLAYLISTS, 'readwrite');
      const store = tx.objectStore(STORES.PLAYLISTS);
      const req = store.delete(id);

      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  // ==================== 3. LIKED TRACKS ====================

  async getLikedTracks(): Promise<Track[]> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.LIKED, 'readonly');
      const store = tx.objectStore(STORES.LIKED);
      const req = store.getAll();

      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async toggleLike(track: Track): Promise<boolean> {
    const db = await this.dbPromise;
    const liked = await this.getLikedTracks();
    const exists = liked.some(t => t.id === track.id);

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.LIKED, 'readwrite');
      const store = tx.objectStore(STORES.LIKED);

      if (exists) {
        const req = store.delete(track.id);
        req.onsuccess = () => resolve(false);
        req.onerror = () => reject(req.error);
      } else {
        const req = store.put(track);
        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error);
      }
    });
  }

  async isLiked(trackId: string): Promise<boolean> {
    const db = await this.dbPromise;
    return new Promise((resolve) => {
      const tx = db.transaction(STORES.LIKED, 'readonly');
      const store = tx.objectStore(STORES.LIKED);
      const req = store.count(trackId);

      req.onsuccess = () => resolve(req.result > 0);
      req.onerror = () => resolve(false);
    });
  }

  // ==================== 4. LISTENING HISTORY ====================

  async recordPlay(track: Track): Promise<void> {
    const db = await this.dbPromise;
    const historyItem = {
      ...track,
      playedAt: Date.now(),
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.HISTORY, 'readwrite');
      const store = tx.objectStore(STORES.HISTORY);
      const req = store.put(historyItem);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async getHistory(): Promise<Track[]> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.HISTORY, 'readonly');
      const store = tx.objectStore(STORES.HISTORY);
      const req = store.getAll();

      req.onsuccess = () => {
        const items = (req.result || []) as (Track & { playedAt?: number })[];
        items.sort((a, b) => (b.playedAt || 0) - (a.playedAt || 0));
        resolve(items.slice(0, 100));
      };
      req.onerror = () => reject(req.error);
    });
  }

  async clearHistory(): Promise<void> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.HISTORY, 'readwrite');
      const store = tx.objectStore(STORES.HISTORY);
      const req = store.clear();

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // ==================== 5. SETTINGS ====================

  async getSettings(): Promise<AppSettings> {
    const db = await this.dbPromise;
    return new Promise((resolve) => {
      const tx = db.transaction(STORES.SETTINGS, 'readonly');
      const store = tx.objectStore(STORES.SETTINGS);
      const req = store.get('app_settings');

      req.onsuccess = () => {
        resolve(req.result ? { ...DEFAULT_SETTINGS, ...req.result.data } : DEFAULT_SETTINGS);
      };
      req.onerror = () => resolve(DEFAULT_SETTINGS);
    });
  }

  async saveSettings(settings: AppSettings): Promise<void> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.SETTINGS, 'readwrite');
      const store = tx.objectStore(STORES.SETTINGS);
      const req = store.put({ key: 'app_settings', data: settings });

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }
}

export const offlineStorage = new OfflineStorageManager();
