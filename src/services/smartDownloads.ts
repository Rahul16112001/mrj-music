import { offlineStorage } from './offlineStorage';
import { api } from './api';

class SmartDownloadManager {
  private isRunning: boolean = false;

  async checkAndRunSmartDownloads(): Promise<number> {
    if (this.isRunning || !navigator.onLine) return 0;
    this.isRunning = true;

    try {
      const settings = await offlineStorage.getSettings();
      const config = settings.smartDownloads;

      if (!config || !config.enabled) {
        this.isRunning = false;
        return 0;
      }

      // Check current downloaded tracks
      const downloadedTracks = await offlineStorage.getAllDownloadedTracks();
      const downloadedIds = new Set(downloadedTracks.map(t => t.id));

      if (downloadedTracks.length >= config.maxTracks) {
        this.isRunning = false;
        return 0;
      }

      // Pool candidate tracks from Liked Songs and Recent History
      const liked = await offlineStorage.getLikedTracks();
      const history = await offlineStorage.getHistory();

      const candidates = [...liked, ...history].filter(t => !downloadedIds.has(t.id));
      let downloadedCount = 0;

      for (const track of candidates) {
        if (downloadedTracks.length + downloadedCount >= config.maxTracks) break;

        try {
          const streamBlob = await api.downloadAudioBlob(track.id);
          if (streamBlob) {
            const lyrics = await api.getLyrics(track.title, track.artist, track.duration);
            await offlineStorage.saveDownloadedTrack(track, streamBlob, lyrics);
            downloadedCount++;
          }
        } catch (e) {
          console.warn(`Smart download failed for ${track.title}:`, e);
        }
      }

      this.isRunning = false;
      return downloadedCount;
    } catch (err) {
      this.isRunning = false;
      console.warn('Smart downloads run error:', err);
      return 0;
    }
  }
}

export const smartDownloads = new SmartDownloadManager();
