import { Track, MoodStation, LyricData, AdCreative, Artist, Album } from '../types';

const API_BASE = '/api';

export const api = {
  // 1. Fetch Global Charts & Mood Stations
  async getCharts(): Promise<{ trending: Track[]; quickPicks: Track[]; moods: MoodStation[] }> {
    try {
      const res = await fetch(`${API_BASE}/music/charts`);
      if (!res.ok) throw new Error('Charts fetch failed');
      const data = await res.json();
      return {
        trending: data.trending || [],
        quickPicks: data.quickPicks || [],
        moods: data.moods || [],
      };
    } catch {
      return { trending: [], quickPicks: [], moods: [] };
    }
  },

  // 2. Real-Time Worldwide Search with Type Filter
  async search(query: string, type: string = 'all'): Promise<{ results: Track[]; artists: any[]; albums: any[] }> {
    try {
      const res = await fetch(`${API_BASE}/music/search?q=${encodeURIComponent(query)}&type=${type}`);
      if (!res.ok) throw new Error('Search failed');
      const data = await res.json();
      return {
        results: data.results || [],
        artists: data.artists || [],
        albums: data.albums || [],
      };
    } catch {
      return { results: [], artists: [], albums: [] };
    }
  },

  // 3. Artist Scraper
  async getArtist(artistName: string): Promise<Artist | null> {
    try {
      const res = await fetch(`${API_BASE}/music/artist/${encodeURIComponent(artistName)}`);
      if (!res.ok) throw new Error('Artist fetch failed');
      const data = await res.json();
      return data.artist || null;
    } catch {
      return null;
    }
  },

  // 4. Album Scraper
  async getAlbum(albumId: string): Promise<Album | null> {
    try {
      const res = await fetch(`${API_BASE}/music/album/${albumId}`);
      if (!res.ok) throw new Error('Album fetch failed');
      const data = await res.json();
      return data.album || null;
    } catch {
      return null;
    }
  },

  // 5. Audio Stream Resolver
  async getStreamUrl(trackId: string): Promise<{ streamUrl: string; quality: string }> {
    try {
      const res = await fetch(`${API_BASE}/music/stream/${trackId}`);
      if (!res.ok) throw new Error('Stream fetch failed');
      const data = await res.json();
      return {
        streamUrl: data.streamUrl,
        quality: data.quality || 'Opus 160kbps (High-Fi)',
      };
    } catch {
      return {
        streamUrl: `https://www.youtube.com/watch?v=${trackId}`,
        quality: 'Opus 160kbps (High-Fi)',
      };
    }
  },

  // 6. Direct Audio Download Blob
  async downloadAudioBlob(trackId: string): Promise<Blob | null> {
    try {
      const res = await fetch(`${API_BASE}/music/download/${trackId}`);
      if (!res.ok) return null;
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        // Fallback for online-only track
        return null;
      }
      return await res.blob();
    } catch {
      return null;
    }
  },

  // 7. Synchronized Real-Time Lyrics
  async getLyrics(title: string, artist: string, duration?: number): Promise<LyricData> {
    try {
      const res = await fetch(`${API_BASE}/music/lyrics?track=${encodeURIComponent(title)}&artist=${encodeURIComponent(artist)}&duration=${duration || ''}`);
      if (!res.ok) throw new Error('Lyrics fetch failed');
      return await res.json();
    } catch {
      return {
        syncedLyrics: null,
        plainLyrics: null,
      };
    }
  },

  // 8. Radio Recommendations
  async getRadio(videoId: string): Promise<Track[]> {
    try {
      const res = await fetch(`${API_BASE}/music/recommendations?videoId=${videoId}`);
      if (!res.ok) throw new Error('Radio fetch failed');
      const data = await res.json();
      return data.radioQueue || [];
    } catch {
      return [];
    }
  },

  // 9. Pre-cache Ad Bundle
  async getAdBundle(): Promise<{ audioAds: AdCreative[]; displayBanners: any[] }> {
    try {
      const res = await fetch(`${API_BASE}/ads/bundle`);
      if (!res.ok) throw new Error('Ad bundle fetch failed');
      return await res.json();
    } catch {
      return {
        audioAds: [],
        displayBanners: []
      };
    }
  }
};
