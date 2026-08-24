import { Track, AppSettings, SmartDownloadConfig } from '../types';
import { offlineStorage } from './offlineStorage';
import { api, API_BASE } from './api';
import { Network } from '@capacitor/network';
import { Capacitor } from '@capacitor/core';

export interface SmartDownloadStatus {
  isUpdating: boolean;
  progressPercent: number;
  currentTrackTitle?: string;
  totalTracks: number;
  downloadedTracks: number;
  lastUpdated?: number;
  error?: string;
}

export interface CandidateCategory {
  category: 'favorites' | 'listenAgain' | 'personalizedMix' | 'discovery' | 'recent' | 'artist';
  track: Track;
  reason: string;
  score: number;
}

class SmartDownloadEngine {
  private status: SmartDownloadStatus = {
    isUpdating: false,
    progressPercent: 0,
    totalTracks: 0,
    downloadedTracks: 0,
  };

  private listeners: ((status: SmartDownloadStatus) => void)[] = [];

  public subscribe(listener: (status: SmartDownloadStatus) => void): () => void {
    this.listeners.push(listener);
    listener(this.status);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify(update: Partial<SmartDownloadStatus>) {
    this.status = { ...this.status, ...update };
    for (const listener of this.listeners) {
      try {
        listener(this.status);
      } catch {}
    }
  }

  public getStatus(): SmartDownloadStatus {
    return this.status;
  }

  /**
   * Scores a candidate track based on familiarity, user affinity, and discovery signals.
   */
  public calculateSmartDownloadScore(
    track: Track,
    context: {
      likedTrackIds: Set<string>;
      historyTrackIds: Set<string>;
      topArtists: Set<string>;
      topGenres: Set<string>;
      skippedIds: Set<string>;
      discoveryCompletionRatio: number;
    }
  ): { score: number; reason: string } {
    let score = 50; // Base score
    let reason = 'Recommended for offline listening';

    const isLiked = context.likedTrackIds.has(track.id);
    const isHistory = context.historyTrackIds.has(track.id);
    const isTopArtist = context.topArtists.has(track.artist.toLowerCase());
    const isSkipped = context.skippedIds.has(track.id);

    if (isLiked) {
      score += 35;
      reason = 'From your Liked Songs';
    } else if (isHistory) {
      score += 25;
      reason = 'Based on your recent listening';
    } else if (isTopArtist) {
      score += 20;
      reason = `Downloaded because you listen to ${track.artist} often`;
    } else {
      // Discovery track
      const discoveryWeight = context.discoveryCompletionRatio >= 0.6 ? 20 : 10;
      score += discoveryWeight;
      reason = 'Similar to your favorite music';
    }

    if (isSkipped) {
      score -= 35;
    }

    return { score: Math.max(0, Math.min(100, score)), reason };
  }

  /**
   * Generates a diversified candidate pool for Smart Downloads.
   */
  public async generateCandidatePool(settings: AppSettings): Promise<CandidateCategory[]> {
    const likedTracks = await offlineStorage.getLikedTracks();
    const historyTracks = await offlineStorage.getHistory();
    const existingDownloads = await offlineStorage.getAllDownloadedTracks();
    const existingIds = new Set(existingDownloads.map((t) => t.id));

    // Extract top artist affinities
    const artistCounts: Record<string, number> = {};
    for (const t of [...likedTracks, ...historyTracks]) {
      const art = t.artist.toLowerCase();
      artistCounts[art] = (artistCounts[art] || 0) + 1;
    }
    const topArtists = new Set(
      Object.entries(artistCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([art]) => art)
    );

    const likedTrackIds = new Set(likedTracks.map((t) => t.id));
    const historyTrackIds = new Set(historyTracks.map((t) => t.id));
    const topGenres = new Set<string>();
    const skippedIds = new Set<string>();

    const context = {
      likedTrackIds,
      historyTrackIds,
      topArtists,
      topGenres,
      skippedIds,
      discoveryCompletionRatio: 0.7,
    };

    const candidates: CandidateCategory[] = [];
    const addedIds = new Set<string>();

    // 1. Favorites (High-priority familiar songs)
    for (const track of likedTracks.slice(0, 15)) {
      if (addedIds.has(track.id)) continue;
      addedIds.add(track.id);
      const { score, reason } = this.calculateSmartDownloadScore(track, context);
      candidates.push({ category: 'favorites', track, reason, score: score + 15 });
    }

    // 2. Listen Again (Frequently played from history)
    for (const track of historyTracks.slice(0, 15)) {
      if (addedIds.has(track.id)) continue;
      addedIds.add(track.id);
      const { score, reason } = this.calculateSmartDownloadScore(track, context);
      candidates.push({ category: 'listenAgain', track, reason, score });
    }

    // 3. Online Personalized Recommendations & Daily Mixes (when online)
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        const homeData = await api.getPersonalizedHome();
        const quickPicks = homeData.personalized?.quickPicks || [];
        const dailyMixes = homeData.personalized?.dailyMixes || [];

        for (const track of quickPicks.slice(0, 10)) {
          if (addedIds.has(track.id)) continue;
          addedIds.add(track.id);
          const { score } = this.calculateSmartDownloadScore(track, context);
          candidates.push({
            category: 'personalizedMix',
            track,
            reason: 'From your Quick Picks',
            score: score + 10,
          });
        }

        for (const mix of dailyMixes) {
          if (mix.tracks) {
            for (const track of mix.tracks.slice(0, 5)) {
              if (addedIds.has(track.id)) continue;
              addedIds.add(track.id);
              const { score } = this.calculateSmartDownloadScore(track, context);
              candidates.push({
                category: 'personalizedMix',
                track,
                reason: `From your ${mix.title}`,
                score: score + 5,
              });
            }
          }
        }
      } catch (err) {
        console.warn('Smart download candidate generation notice:', err);
      }
    }

    // Sort by highest priority score
    candidates.sort((a, b) => b.score - a.score);
    return candidates;
  }

  /**
   * Main Execution: Runs Smart Download synchronization cycle.
   */
  public async syncSmartDownloads(force: boolean = false): Promise<void> {
    if (this.status.isUpdating) return;

    const settings = await offlineStorage.getSettings();
    if (!settings.smartDownloads.enabled && !force) return;

    // 1. Network Check (Wi-Fi Only validation)
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.notify({ error: 'Device is offline' });
      return;
    }

    if (settings.smartDownloads.wifiOnly) {
      try {
        const networkStatus = await Network.getStatus();
        if (networkStatus.connectionType !== 'wifi' && networkStatus.connectionType !== 'unknown') {
          this.notify({ error: 'Wi-Fi only mode active' });
          return;
        }
      } catch {}
    }

    this.notify({
      isUpdating: true,
      progressPercent: 0,
      totalTracks: 0,
      downloadedTracks: 0,
      error: undefined,
    });

    try {
      // 2. Generate candidate pool
      const candidates = await this.generateCandidatePool(settings);
      const maxTracks = settings.smartDownloads.maxTracks || 50;
      const maxBytes = (settings.smartDownloads.storageLimitMB || 500) * 1024 * 1024;

      const targetPool = candidates.slice(0, maxTracks);
      this.notify({ totalTracks: targetPool.length });

      let currentBreakdown = await offlineStorage.getStorageBreakdown();
      let completedCount = 0;

      for (let i = 0; i < targetPool.length; i++) {
        const candidate = targetPool[i];
        this.notify({
          currentTrackTitle: candidate.track.title,
          progressPercent: Math.round(((i + 1) / targetPool.length) * 100),
        });

        // Skip if already downloaded
        const alreadyExists = await offlineStorage.isDownloaded(candidate.track.id);
        if (alreadyExists) {
          completedCount++;
          this.notify({ downloadedTracks: completedCount });
          continue;
        }

        // Storage limit check & eviction
        const estimatedSize = 3800000; // ~3.8 MB per track
        if (currentBreakdown.totalBytes + estimatedSize > maxBytes) {
          // Evict lowest-scoring smart downloads to make room
          const evicted = await offlineStorage.evictLowestPrioritySmartDownloads(estimatedSize * 2);
          if (evicted === 0) {
            // Cannot free more smart downloads (only manual downloads remain)
            break;
          }
          currentBreakdown = await offlineStorage.getStorageBreakdown();
        }

        // 3. Audio Download & Validation
        try {
          const downloadRes = await this.downloadAndValidateTrack(candidate.track);
          if (downloadRes.success && downloadRes.blob) {
            await offlineStorage.saveDownloadedTrack(
              candidate.track,
              downloadRes.blob,
              downloadRes.lyrics,
              'smart',
              candidate.score,
              candidate.category,
              candidate.reason
            );
            completedCount++;
            this.notify({ downloadedTracks: completedCount });
            currentBreakdown = await offlineStorage.getStorageBreakdown();
          }
        } catch (downloadErr) {
          console.warn(`Smart download failed for "${candidate.track.title}":`, downloadErr);
        }
      }

      this.notify({
        isUpdating: false,
        lastUpdated: Date.now(),
        currentTrackTitle: undefined,
        progressPercent: 100,
      });
    } catch (err: any) {
      this.notify({
        isUpdating: false,
        error: err?.message || 'Smart download sync failed',
      });
    }
  }

  /**
   * Downloads and validates audio blob before storing.
   */
  private async downloadAndValidateTrack(
    track: Track
  ): Promise<{ success: boolean; blob?: Blob; lyrics?: any }> {
    try {
      const blob: Blob | null = await api.downloadAudioBlob(track.canonicalTrackId || track.id);

      // Only accept genuine audio blobs (> 50KB)
      if (!blob || blob.size < 50000 || blob.type.includes('json') || blob.type.includes('text')) {
        return { success: false };
      }

      // Try fetching lyrics
      let lyrics = undefined;
      try {
        const lyricsRes = await api.getLyrics(track.title, track.artist, track.duration);
        if (lyricsRes && lyricsRes.plainLyrics) {
          lyrics = lyricsRes;
        }
      } catch {}

      return { success: true, blob, lyrics };
    } catch (err) {
      return { success: false };
    }
  }
}

export const smartDownloadEngine = new SmartDownloadEngine();
