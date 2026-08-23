import { AdCreative } from '../types';
import { api } from './api';

const AD_CACHE_KEY = 'MRJ_CACHED_OFFLINE_ADS';
const PLAY_COUNTER_KEY = 'MRJ_PLAYBACK_COUNTER';
const AD_TRIGGER_INTERVAL = 4; // Trigger ad every 4 songs

class OfflineAdEngine {
  private playCount: number;
  private cachedAds: AdCreative[] = [];

  constructor() {
    this.playCount = parseInt(localStorage.getItem(PLAY_COUNTER_KEY) || '0', 10);
    this.loadCachedAds();
  }

  private loadCachedAds() {
    const raw = localStorage.getItem(AD_CACHE_KEY);
    if (raw) {
      try {
        this.cachedAds = JSON.parse(raw);
      } catch {
        this.cachedAds = [];
      }
    }
  }

  /**
   * Syncs and updates offline ad cache when internet connection is available
   */
  async syncAdBundle() {
    if (!navigator.onLine) return;
    try {
      const bundle = await api.getAdBundle();
      if (bundle.audioAds && bundle.audioAds.length > 0) {
        this.cachedAds = bundle.audioAds;
        localStorage.setItem(AD_CACHE_KEY, JSON.stringify(bundle.audioAds));
      }
    } catch {
      // Keep existing cache
    }
  }

  /**
   * Called on every song start. Returns an AdCreative if an ad is scheduled to play.
   */
  onTrackStart(): { shouldPlayAd: boolean; ad?: AdCreative } {
    this.playCount++;
    localStorage.setItem(PLAY_COUNTER_KEY, String(this.playCount));

    if (this.playCount % AD_TRIGGER_INTERVAL === 0 && this.cachedAds.length > 0) {
      // Pick next ad in rotation
      const index = (this.playCount / AD_TRIGGER_INTERVAL) % this.cachedAds.length;
      const selectedAd = this.cachedAds[Math.floor(index)];
      return {
        shouldPlayAd: true,
        ad: selectedAd,
      };
    }

    return { shouldPlayAd: false };
  }

  getAdInterval(): number {
    return AD_TRIGGER_INTERVAL;
  }

  getSongsUntilNextAd(): number {
    return AD_TRIGGER_INTERVAL - (this.playCount % AD_TRIGGER_INTERVAL);
  }
}

export const offlineAdEngine = new OfflineAdEngine();
