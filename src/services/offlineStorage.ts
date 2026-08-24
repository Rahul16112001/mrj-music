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

export interface OfflineRecord {
  id: string;
  track: Track;
  audioBlob: Blob;
  lyrics?: LyricData;
  downloadedAt: number;
  fileSize: number;
  downloadType: 'manual' | 'smart';
  priorityScore: number;
  category: string;
  downloadReason?: string;
  offlineEligible: boolean;
  lastPlayedAt?: number;
}

const DEFAULT_SETTINGS: AppSettings = {
  audioQuality: 'high',
  autoplayRadio: true,
  smartDownloads: {
    enabled: true,
    maxTracks: 50,
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

  async saveDownloadedTrack(
    track: Track,
    audioBlob: Blob,
    lyrics?: LyricData,
    downloadType: 'manual' | 'smart' = 'manual',
    priorityScore: number = 50,
    category: string = 'general',
    downloadReason?: string
  ): Promise<Track> {
    const db = await this.dbPromise;
    const offlineTrack: Track = {
      ...track,
      isOffline: true,
      downloadedAt: Date.now(),
      fileSize: audioBlob.size,
      downloadType,
      priorityScore,
      downloadCategory: category,
      downloadReason: downloadReason || (downloadType === 'smart' ? 'Recommended for offline listening' : 'Saved to Downloads'),
      offlineEligible: true,
    };

    const record: OfflineRecord = {
      id: track.id,
      track: offlineTrack,
      audioBlob,
      lyrics,
      downloadedAt: Date.now(),
      fileSize: audioBlob.size,
      downloadType,
      priorityScore,
      category,
      downloadReason: offlineTrack.downloadReason,
      offlineEligible: true,
      lastPlayedAt: Date.now(),
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

  async getAllDownloadRecords(): Promise<OfflineRecord[]> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.DOWNLOADS, 'readonly');
      const store = tx.objectStore(STORES.DOWNLOADS);
      const req = store.getAll();

      req.onsuccess = () => resolve((req.result || []) as OfflineRecord[]);
      req.onerror = () => reject(req.error);
    });
  }

  async getSmartDownloads(): Promise<Track[]> {
    const records = await this.getAllDownloadRecords();
    return records.filter(r => r.downloadType === 'smart').map(r => r.track);
  }

  async getManualDownloads(): Promise<Track[]> {
    const records = await this.getAllDownloadRecords();
    return records.filter(r => r.downloadType !== 'smart').map(r => r.track);
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

  async deleteDownloadedTrack(trackId: string): Promise<boolean> {
    return this.removeTrack(trackId);
  }

  /**
   * Clears ALL Smart Downloads from local storage, strictly protecting Manual Downloads.
   */
  async deleteSmartDownloads(): Promise<number> {
    const records = await this.getAllDownloadRecords();
    const smartRecords = records.filter(r => r.downloadType === 'smart');
    for (const record of smartRecords) {
      await this.removeTrack(record.id);
    }
    return smartRecords.length;
  }

  /**
   * Storage Eviction: Evicts lowest scoring Smart Downloads to free up required bytes.
   * MANUAL DOWNLOADS ARE NEVER EVICTED.
   */
  async evictLowestPrioritySmartDownloads(bytesNeeded: number): Promise<number> {
    const records = await this.getAllDownloadRecords();
    const smartRecords = records
      .filter(r => r.downloadType === 'smart')
      .sort((a, b) => (a.priorityScore || 0) - (b.priorityScore || 0)); // Ascending (lowest score first)

    let freedBytes = 0;
    let evictedCount = 0;

    for (const record of smartRecords) {
      if (freedBytes >= bytesNeeded) break;
      await this.removeTrack(record.id);
      freedBytes += record.fileSize || 3500000;
      evictedCount++;
    }

    return evictedCount;
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

  async getStorageBreakdown(): Promise<{
    manualBytes: number;
    smartBytes: number;
    totalBytes: number;
    manualCount: number;
    smartCount: number;
    formatted: string;
  }> {
    const records = await this.getAllDownloadRecords();
    let manualBytes = 0;
    let smartBytes = 0;
    let manualCount = 0;
    let smartCount = 0;

    for (const r of records) {
      const size = r.fileSize || 3500000;
      if (r.downloadType === 'smart') {
        smartBytes += size;
        smartCount++;
      } else {
        manualBytes += size;
        manualCount++;
      }
    }

    const totalBytes = manualBytes + smartBytes;
    let formatted = `${(totalBytes / 1024 / 1024).toFixed(1)} MB`;
    if (totalBytes > 1024 * 1024 * 1024) {
      formatted = `${(totalBytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
    }

    return {
      manualBytes,
      smartBytes,
      totalBytes,
      manualCount,
      smartCount,
      formatted,
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

  async saveLikedTrack(track: Track): Promise<boolean> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.LIKED, 'readwrite');
      const store = tx.objectStore(STORES.LIKED);
      const req = store.put(track);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  async removeLikedTrack(trackId: string): Promise<boolean> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.LIKED, 'readwrite');
      const store = tx.objectStore(STORES.LIKED);
      const req = store.delete(trackId);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  async isLiked(trackId: string): Promise<boolean> {
    const db = await this.dbPromise;
    return new Promise((resolve) => {
      const tx = db.transaction(STORES.LIKED, 'readonly');
      const store = tx.objectStore(STORES.LIKED);
      const req = store.get(trackId);
      req.onsuccess = () => resolve(!!req.result);
      req.onerror = () => resolve(false);
    });
  }

  async toggleLike(track: Track): Promise<boolean> {
    const exists = await this.isLiked(track.id);
    if (exists) {
      await this.removeLikedTrack(track.id);
      return false;
    } else {
      await this.saveLikedTrack(track);
      return true;
    }
  }

  // ==================== 4. LISTENING HISTORY ====================

  async recordPlay(track: Track): Promise<void> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.HISTORY, 'readwrite');
      const store = tx.objectStore(STORES.HISTORY);
      const req = store.put({
        ...track,
        playedAt: Date.now(),
      });

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
        const tracks = (req.result || []) as (Track & { playedAt?: number })[];
        tracks.sort((a, b) => (b.playedAt || 0) - (a.playedAt || 0));
        resolve(tracks);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async clearHistory(): Promise<boolean> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.HISTORY, 'readwrite');
      const store = tx.objectStore(STORES.HISTORY);
      const req = store.clear();
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  // ==================== 5. APP SETTINGS ====================

  async getSettings(): Promise<AppSettings> {
    const db = await this.dbPromise;
    return new Promise((resolve) => {
      const tx = db.transaction(STORES.SETTINGS, 'readonly');
      const store = tx.objectStore(STORES.SETTINGS);
      const req = store.get('app_settings');

      req.onsuccess = () => {
        if (req.result && req.result.data) {
          resolve({ ...DEFAULT_SETTINGS, ...req.result.data });
        } else {
          resolve(DEFAULT_SETTINGS);
        }
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

  async addTrackToPlaylist(playlistId: string, track: Track): Promise<boolean> {
    const playlist = await this.getPlaylist(playlistId);
    if (!playlist) return false;
    if (!playlist.tracks.some(t => t.id === track.id)) {
      playlist.tracks.push(track);
      playlist.trackCount = playlist.tracks.length;
      playlist.updatedAt = Date.now();
      await this.savePlaylist(playlist);
    }
    return true;
  }

  async removeTrackFromPlaylist(playlistId: string, trackId: string): Promise<boolean> {
    const playlist = await this.getPlaylist(playlistId);
    if (!playlist) return false;
    playlist.tracks = playlist.tracks.filter(t => t.id !== trackId);
    playlist.trackCount = playlist.tracks.length;
    playlist.updatedAt = Date.now();
    await this.savePlaylist(playlist);
    return true;
  }
}

export const offlineStorage = new OfflineStorageManager();
