import { api } from './api';
import { offlineStorage } from './offlineStorage';
import { ListeningEvent, Track, Playlist } from '../types';

class SyncService {
  private eventQueue: ListeningEvent[] = [];
  private flushTimer: any = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.flushTimer = setInterval(() => this.flushEvents(), 15000);
      window.addEventListener('online', () => {
        this.flushEvents();
        this.pullCloudLibrary();
      });
    }
  }

  // Queue a behavioral listening event
  queueEvent(event: ListeningEvent) {
    this.eventQueue.push({
      ...event,
      timestamp: event.timestamp || Date.now(),
    });

    if (this.eventQueue.length >= 10) {
      this.flushEvents();
    }
  }

  // Flush queued events to backend
  async flushEvents() {
    if (this.eventQueue.length === 0 || !navigator.onLine) return;

    const batch = [...this.eventQueue];
    this.eventQueue = [];

    try {
      await api.postEvents(batch);
    } catch {
      // Re-queue on failure
      this.eventQueue = [...batch, ...this.eventQueue];
    }
  }

  // Pull cloud library and synchronize with local storage
  async pullCloudLibrary() {
    if (!navigator.onLine) return;

    try {
      const token = localStorage.getItem('MRJ_AUTH_TOKEN');
      if (!token) return;

      const [cloudLikes, cloudPlaylists] = await Promise.all([
        api.getUserLikes(),
        api.getUserPlaylists(),
      ]);

      if (Array.isArray(cloudLikes)) {
        for (const track of cloudLikes) {
          const isLikedLocally = await offlineStorage.isLiked(track.id);
          if (!isLikedLocally) {
            await offlineStorage.toggleLike(track);
          }
        }
      }

      if (Array.isArray(cloudPlaylists)) {
        for (const playlist of cloudPlaylists) {
          await offlineStorage.savePlaylist(playlist);
        }
      }
    } catch (e) {
      console.warn('Cloud sync error:', e);
    }
  }
}

export const syncService = new SyncService();
