import { Track, LyricData } from '../types';

const DB_NAME = 'MRJ_MUSIC_OFFLINE_DB';
const DB_VERSION = 1;
const STORE_NAME = 'downloaded_tracks';

interface OfflineRecord {
  id: string;
  track: Track;
  audioBlob: Blob;
  lyrics?: LyricData;
  downloadedAt: number;
  fileSize: number;
}

class OfflineStorageManager {
  private dbPromise: Promise<IDBDatabase>;

  constructor() {
    this.dbPromise = this.initDB();
  }

  private initDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event: any) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Downloads track audio from URL and stores it as a Blob into IndexedDB
   */
  async downloadAndSaveTrack(track: Track, streamUrl: string, lyrics?: LyricData): Promise<Track> {
    const response = await fetch(streamUrl);
    if (!response.ok) throw new Error('Audio download failed');
    const audioBlob = await response.blob();

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
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(record);

      req.onsuccess = () => resolve(offlineTrack);
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Retrieves an offline track and creates a playback ObjectURL
   */
  async getOfflineAudio(trackId: string): Promise<{ blobUrl: string; lyrics?: LyricData; track: Track } | null> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(trackId);

      req.onsuccess = () => {
        const record = req.result as OfflineRecord | undefined;
        if (!record) return resolve(null);

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

  /**
   * Checks if a track is downloaded
   */
  async isDownloaded(trackId: string): Promise<boolean> {
    const db = await this.dbPromise;
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.count(trackId);

      req.onsuccess = () => resolve(req.result > 0);
      req.onerror = () => resolve(false);
    });
  }

  /**
   * Retrieves all downloaded tracks
   */
  async getAllDownloadedTracks(): Promise<Track[]> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();

      req.onsuccess = () => {
        const records = (req.result || []) as OfflineRecord[];
        const tracks = records.map(r => r.track);
        resolve(tracks);
      };
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Removes a downloaded track from offline storage
   */
  async removeTrack(trackId: string): Promise<boolean> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(trackId);

      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Calculates total offline storage usage
   */
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
}

export const offlineStorage = new OfflineStorageManager();
