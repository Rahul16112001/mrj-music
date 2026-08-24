import { Track, Playlist } from '../types';
import { offlineStorage } from './offlineStorage';

class OfflineRecommendationEngine {
  /**
   * Generates next offline tracks for autoplay / queue replenishment without network access.
   */
  public async getNextOfflineTracks(
    currentTrack?: Track | null,
    count: number = 5,
    excludeIds: string[] = []
  ): Promise<Track[]> {
    const downloadedTracks = await offlineStorage.getAllDownloadedTracks();
    if (downloadedTracks.length === 0) return [];

    const excludeSet = new Set(excludeIds);
    if (currentTrack) excludeSet.add(currentTrack.id);

    const candidates = downloadedTracks.filter((t) => !excludeSet.has(t.id));
    if (candidates.length === 0) {
      // If all tracks were played in this session, return all available except current
      return downloadedTracks.filter((t) => t.id !== currentTrack?.id).slice(0, count);
    }

    if (!currentTrack) {
      return candidates.slice(0, count);
    }

    // Rank candidate tracks based on local affinity with current track
    const currentArtist = currentTrack.artist.toLowerCase();
    const currentGenre = (currentTrack.genre || '').toLowerCase();

    const scored = candidates.map((track) => {
      let score = 50; // Base score
      const trackArtist = track.artist.toLowerCase();
      const trackGenre = (track.genre || '').toLowerCase();

      // 1. Exact artist match
      if (trackArtist === currentArtist || trackArtist.includes(currentArtist) || currentArtist.includes(trackArtist)) {
        score += 45;
      }

      // 2. Genre overlap
      if (currentGenre && trackGenre && (trackGenre.includes(currentGenre) || currentGenre.includes(trackGenre))) {
        score += 25;
      }

      // 3. Smart Download Priority Score bonus
      if (track.priorityScore) {
        score += Math.round(track.priorityScore * 0.2);
      }

      return { track, score };
    });

    // Sort descending by score
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, count).map((s) => s.track);
  }

  /**
   * Generates a randomized offline queue with multiple shuffle modes.
   */
  public async getOfflineShuffleQueue(
    mode: 'all' | 'smart' | 'manual' = 'all'
  ): Promise<Track[]> {
    let pool: Track[] = [];

    if (mode === 'smart') {
      pool = await offlineStorage.getSmartDownloads();
    } else if (mode === 'manual') {
      pool = await offlineStorage.getManualDownloads();
    } else {
      pool = await offlineStorage.getAllDownloadedTracks();
    }

    if (pool.length <= 1) return pool;

    // Fisher-Yates Shuffle
    const shuffled = [...pool];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    return shuffled;
  }

  /**
   * Local fast fuzzy search across downloaded tracks and offline playlists.
   */
  public async searchOffline(
    query: string
  ): Promise<{ songs: Track[]; playlists: Playlist[] }> {
    const cleanQuery = query.toLowerCase().trim();
    if (!cleanQuery) return { songs: [], playlists: [] };

    const downloadedTracks = await offlineStorage.getAllDownloadedTracks();
    const playlists = await offlineStorage.getAllPlaylists();

    const matchingSongs = downloadedTracks.filter((track) => {
      const title = track.title.toLowerCase();
      const artist = track.artist.toLowerCase();
      const album = (track.album || '').toLowerCase();
      return title.includes(cleanQuery) || artist.includes(cleanQuery) || album.includes(cleanQuery);
    });

    const matchingPlaylists = playlists.filter((pl) => {
      return pl.title.toLowerCase().includes(cleanQuery);
    });

    return {
      songs: matchingSongs,
      playlists: matchingPlaylists,
    };
  }
}

export const offlineRecommendationEngine = new OfflineRecommendationEngine();
