import axios from 'axios';
import { musicProvider } from '../providers/musicProvider.js';
import { contentClassifier } from '../catalog/contentClassifier.js';

// Cache for viral & trending sounds with 1-hour TTL
class ViralTrendService {
  constructor() {
    this.cache = new Map();
    this.lastFetched = 0;
    this.TTL = 60 * 60 * 1000; // 1 hour
  }

  // Viral Reels & TikTok Trend Seed Queries
  getTrendingQueriesByRegion(region = 'IN') {
    const regionUpper = (region || 'IN').toUpperCase();
    if (regionUpper === 'IN') {
      return [
        'instagram reels trending songs 2026 hindi',
        'viral reels audio punjabi hindi hits',
        'trending reels background music',
        'latest viral songs reels shorts india',
        'punjabi viral reels audio',
      ];
    }
    return [
      'instagram reels trending songs viral',
      'tiktok viral songs 2026',
      'spotify viral 50 global hits',
      'billboard hot 100 trending music',
    ];
  }

  async getViralReelsTracks(region = 'IN', limit = 20) {
    const cacheKey = `viral_${(region || 'IN').toUpperCase()}`;
    const now = Date.now();

    if (this.cache.has(cacheKey) && now - this.lastFetched < this.TTL) {
      return this.cache.get(cacheKey).slice(0, limit);
    }

    try {
      const queries = this.getTrendingQueriesByRegion(region);
      const randomQuery = queries[Math.floor(Math.random() * queries.length)];
      
      const searchRes = await musicProvider.search(randomQuery, 'songs', 30);
      const rawSongs = searchRes.songs || searchRes.tracks || [];

      const normalized = rawSongs
        .map(t => contentClassifier.normalizeTrack(t))
        .filter(t => !t.isCompilation && !t.isReaction && t.duration > 45 && t.duration < 420)
        .map(t => ({
          ...t,
          isViral: true,
          badge: '🔥 Reels Viral',
          viralPlatform: 'Instagram Reels / Shorts',
        }));

      if (normalized.length > 0) {
        this.cache.set(cacheKey, normalized);
        this.lastFetched = now;
        return normalized.slice(0, limit);
      }
    } catch (e) {
      console.warn('Viral reels scraper notice:', e.message);
    }

    // Fallback Curated High-Engagement Viral Hits
    const fallbackViral = [
      { id: 'RLzC55ai0eo', title: 'Heeriye', artist: 'Jasleen Royal & Arijit Singh', duration: 199, thumbnail: 'https://i.ytimg.com/vi/RLzC55ai0eo/hqdefault.jpg', isViral: true, badge: '🔥 Reels Viral' },
      { id: '73vZDNKa_Wg', title: 'Maan Meri Jaan', artist: 'King', duration: 196, thumbnail: 'https://i.ytimg.com/vi/73vZDNKa_Wg/hqdefault.jpg', isViral: true, badge: '🔥 Reels Viral' },
      { id: 'fHI8X4OXluQ', title: 'Blinding Lights', artist: 'The Weeknd', duration: 204, thumbnail: 'https://i.ytimg.com/vi/fHI8X4OXluQ/hqdefault.jpg', isViral: true, badge: '🔥 Reels Viral' },
      { id: 'V1Z586zoeeE', title: 'As It Was', artist: 'Harry Styles', duration: 166, thumbnail: 'https://i.ytimg.com/vi/V1Z586zoeeE/hqdefault.jpg', isViral: true, badge: '🔥 Reels Viral' },
      { id: '6RdS6wLu7RY', title: 'Kesariya', artist: 'Arijit Singh & Pritam', duration: 271, thumbnail: 'https://i.ytimg.com/vi/6RdS6wLu7RY/hqdefault.jpg', isViral: true, badge: '🔥 Reels Viral' },
      { id: 'IqwIOlhfCak', title: 'Badass', artist: 'Anirudh Ravichander', duration: 236, thumbnail: 'https://i.ytimg.com/vi/IqwIOlhfCak/hqdefault.jpg', isViral: true, badge: '🔥 Reels Viral' },
    ];

    this.cache.set(cacheKey, fallbackViral);
    return fallbackViral.slice(0, limit);
  }
}

export const viralTrendService = new ViralTrendService();
