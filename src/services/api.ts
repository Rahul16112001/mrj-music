import { Capacitor } from '@capacitor/core';
import { Track, MoodStation, LyricData, AdCreative, Artist, Album, User, Playlist, AppSettings, ListeningEvent, PlaybackFormat } from '../types';

export const getApiBase = (): string => {
  if (typeof window !== 'undefined') {
    const isNativeApp = Capacitor.isNativePlatform() ||
      window.location.protocol === 'capacitor:' ||
      window.location.protocol === 'file:' ||
      (window.location.hostname === 'localhost' && window.location.port !== '5173' && window.location.port !== '3000');

    if (isNativeApp) {
      return 'https://mrj-music.vercel.app/api';
    }
  }
  return '/api';
};

export const API_BASE = getApiBase();

const getAuthHeaders = () => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('MRJ_AUTH_TOKEN') : null;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

export interface SearchSuggestionsResult {
  query: string;
  intent?: string;
  recent?: string[];
  popular?: string[];
  personalized?: string[];
  suggestions: string[];
  songs: Track[];
  artists: any[];
  albums: any[];
  videos?: Track[];
  podcasts?: Track[];
}

export const api = {
  // ==================== AUTH API ====================
  async sendSignupOtp(email: string, name?: string): Promise<{ status: string; message: string; otp?: string; expiresAt?: number }> {
    const res = await fetch(`${API_BASE}/auth/signup-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, name }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to send verification code');
    return data;
  },

  async verifySignupOtp(
    email: string,
    otp: string,
    password: string,
    name: string,
    ageGroup?: string,
    gender?: string
  ): Promise<{ user: User; token: string; refreshToken: string }> {
    const res = await fetch(`${API_BASE}/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp, password, name, ageGroup, gender }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Verification failed');
    return data;
  },

  async register(
    name: string,
    email: string,
    password: string,
    ageGroup?: string,
    gender?: string
  ): Promise<{ user: User; token: string; refreshToken: string }> {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, ageGroup, gender }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Registration failed');
    return data;
  },

  async login(email: string, password: string): Promise<{ user: User; token: string; refreshToken: string }> {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');
    return data;
  },

  async refreshToken(): Promise<{ token: string; refreshToken: string; user: User } | null> {
    const rfToken = typeof window !== 'undefined' ? localStorage.getItem('MRJ_REFRESH_TOKEN') : null;
    if (!rfToken) return null;

    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: rfToken }),
      });
      if (!res.ok) {
        localStorage.removeItem('MRJ_AUTH_TOKEN');
        localStorage.removeItem('MRJ_REFRESH_TOKEN');
        return null;
      }
      const data = await res.json();
      localStorage.setItem('MRJ_AUTH_TOKEN', data.token);
      localStorage.setItem('MRJ_REFRESH_TOKEN', data.refreshToken);
      return data;
    } catch {
      return null;
    }
  },

  async logout(): Promise<void> {
    const rfToken = typeof window !== 'undefined' ? localStorage.getItem('MRJ_REFRESH_TOKEN') : null;
    try {
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ refreshToken: rfToken }),
      });
    } catch {}
    localStorage.removeItem('MRJ_AUTH_TOKEN');
    localStorage.removeItem('MRJ_REFRESH_TOKEN');
  },

  async getMe(): Promise<User | null> {
    try {
      let res = await fetch(`${API_BASE}/auth/me`, { headers: getAuthHeaders() });
      if (res.status === 401) {
        const refreshed = await this.refreshToken();
        if (refreshed) {
          res = await fetch(`${API_BASE}/auth/me`, { headers: getAuthHeaders() });
        }
      }
      if (!res.ok) return null;
      const data = await res.json();
      return data.user || null;
    } catch {
      return null;
    }
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/auth/change-password`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Password change failed');
    return data;
  },

  async deleteAccount(password: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/auth/account`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
      body: JSON.stringify({ password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Account deletion failed');
    return data;
  },

  async forgotPassword(email: string): Promise<{ success: boolean; message: string; devToken?: string }> {
    const res = await fetch(`${API_BASE}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    return await res.json();
  },

  async resetPassword(token: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, newPassword }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Password reset failed');
    return data;
  },

  // ==================== SEARCH SUGGESTIONS & HISTORY ====================
  async getSearchSuggestions(query: string = '', signal?: AbortSignal): Promise<SearchSuggestionsResult> {
    try {
      const res = await fetch(`${API_BASE}/music/suggestions?q=${encodeURIComponent(query)}`, {
        headers: getAuthHeaders(),
        signal,
      });
      if (!res.ok) throw new Error('Suggestions failed');
      const data = await res.json();
      return {
        query: data.query || query,
        recent: data.recent || [],
        popular: data.popular || [],
        personalized: data.personalized || [],
        suggestions: data.suggestions || [],
        songs: data.songs || [],
        artists: data.artists || [],
        albums: data.albums || [],
      };
    } catch {
      return { query, suggestions: [], songs: [], artists: [], albums: [] };
    }
  },

  async getSearchHistory(): Promise<string[]> {
    try {
      const res = await fetch(`${API_BASE}/user/search-history`, { headers: getAuthHeaders() });
      if (!res.ok) return [];
      const data = await res.json();
      return data.history || [];
    } catch {
      return [];
    }
  },

  async addSearchHistory(query: string): Promise<string[]> {
    try {
      const res = await fetch(`${API_BASE}/user/search-history`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ query }),
      });
      const data = await res.json();
      return data.history || [];
    } catch {
      return [];
    }
  },

  async removeSearchHistory(query: string): Promise<string[]> {
    try {
      const res = await fetch(`${API_BASE}/user/search-history/${encodeURIComponent(query)}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      return data.history || [];
    } catch {
      return [];
    }
  },

  async clearSearchHistory(): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/user/search-history`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  // ==================== OFFICIAL CHARTS API ====================
  async getTrending(region: string = 'GLOBAL'): Promise<{ tracks: Track[]; region: string; updatedAt: number }> {
    try {
      const res = await fetch(`${API_BASE}/charts/trending?region=${encodeURIComponent(region)}`);
      if (!res.ok) throw new Error('Trending fetch failed');
      const data = await res.json();
      return { tracks: data.tracks || [], region: data.region || region, updatedAt: data.updatedAt || Date.now() };
    } catch {
      return { tracks: [], region, updatedAt: Date.now() };
    }
  },

  async getTopSongs(region: string = 'GLOBAL'): Promise<{ tracks: Track[]; region: string; updatedAt: number }> {
    try {
      const res = await fetch(`${API_BASE}/charts/top-songs?region=${encodeURIComponent(region)}`);
      if (!res.ok) throw new Error('Top songs fetch failed');
      const data = await res.json();
      return { tracks: data.tracks || [], region: data.region || region, updatedAt: data.updatedAt || Date.now() };
    } catch {
      return { tracks: [], region, updatedAt: Date.now() };
    }
  },

  async getTopArtists(region: string = 'GLOBAL'): Promise<{ artists: any[]; region: string }> {
    try {
      const res = await fetch(`${API_BASE}/charts/top-artists?region=${encodeURIComponent(region)}`);
      if (!res.ok) throw new Error('Top artists fetch failed');
      const data = await res.json();
      return { artists: data.artists || [], region: data.region || region };
    } catch {
      return { artists: [], region };
    }
  },

  async getCategories(): Promise<any[]> {
    try {
      const res = await fetch(`${API_BASE}/charts/categories`);
      if (!res.ok) throw new Error('Categories fetch failed');
      const data = await res.json();
      return data.categories || [];
    } catch {
      return [];
    }
  },

  async getCategoryTracks(categoryId: string): Promise<Track[]> {
    try {
      const res = await fetch(`${API_BASE}/charts/category/${encodeURIComponent(categoryId)}`);
      if (!res.ok) throw new Error('Category tracks fetch failed');
      const data = await res.json();
      return data.tracks || [];
    } catch {
      return [];
    }
  },

  // ==================== RECOMMENDATION & AUTOPLAY API ====================
  async getPersonalizedHome(region: string = 'IN'): Promise<{
    personalized: {
      greeting?: string;
      timeOfDay?: { sectionTitle: string; tracks: Track[] };
      quickPicks: Track[];
      dailyMixes: any[];
      listenAgain: Track[];
      recommendedForYou: Track[];
      becauseYouLike: any;
    };
    discovery: { newReleases: Track[]; topArtists: any[] };
    charts: { trendingRegional: Track[]; trendingWorldwide: Track[]; topSongs: Track[]; topArtists: any[]; region: string; updatedAt: number };
    moods: MoodStation[];
  }> {
    try {
      const res = await fetch(`${API_BASE}/recommendations/home?region=${encodeURIComponent(region)}`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Home recommendation failed');
      const data = await res.json();
      return {
        personalized: data.personalized || { quickPicks: [], dailyMixes: [], listenAgain: [], recommendedForYou: [], becauseYouLike: null },
        discovery: data.discovery || { newReleases: [], topArtists: [] },
        charts: data.charts || { trendingRegional: [], trendingWorldwide: [], topSongs: [], topArtists: [], region, updatedAt: Date.now() },
        moods: data.moods || [],
      };
    } catch {
      return {
        personalized: { quickPicks: [], dailyMixes: [], listenAgain: [], recommendedForYou: [], becauseYouLike: null },
        discovery: { newReleases: [], topArtists: [] },
        charts: { trendingRegional: [], trendingWorldwide: [], topSongs: [], topArtists: [], region, updatedAt: Date.now() },
        moods: [],
      };
    }
  },

  async getNextRecommendations(options: {
    currentTrack?: Track | null;
    playedTrackIds?: string[];
    currentQueueIds?: string[];
    mood?: string | null;
    sessionSearches?: string[];
  }): Promise<{ tracks: Track[] }> {
    try {
      const res = await fetch(`${API_BASE}/recommendations/next`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(options),
      });
      if (!res.ok) throw new Error('Next recommendations failed');
      const data = await res.json();
      return { tracks: data.tracks || [] };
    } catch {
      return { tracks: [] };
    }
  },

  async tuneRecommendations(tuneConfig: any, currentTrack?: Track | null, currentQueueIds?: string[]): Promise<{ tracks: Track[] }> {
    try {
      const res = await fetch(`${API_BASE}/recommendations/tune`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ tuneConfig, currentTrack, currentQueueIds }),
      });
      if (!res.ok) throw new Error('Tune recommendations failed');
      const data = await res.json();
      return { tracks: data.tracks || [] };
    } catch {
      return { tracks: [] };
    }
  },

  async sendFeedback(eventType: string, track?: Track | null, artist?: string): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/recommendations/feedback`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ eventType, track, artist }),
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  async getRelatedTracks(trackId: string, artist?: string, genre?: string, title?: string): Promise<Track[]> {
    try {
      const res = await fetch(
        `${API_BASE}/recommendations/related/${encodeURIComponent(trackId)}?artist=${encodeURIComponent(artist || '')}&genre=${encodeURIComponent(genre || '')}&title=${encodeURIComponent(title || '')}`,
        { headers: getAuthHeaders() }
      );
      if (!res.ok) throw new Error('Related fetch failed');
      const data = await res.json();
      return data.tracks || [];
    } catch {
      return [];
    }
  },

  async getRadio(videoId: string): Promise<Track[]> {
    try {
      const res = await fetch(`${API_BASE}/recommendations/radio/${videoId}`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Radio fetch failed');
      const data = await res.json();
      return data.radio || [];
    } catch {
      return [];
    }
  },

  async getMoodStation(mood: string): Promise<{ mood: string; tracks: Track[] }> {
    try {
      const res = await fetch(`${API_BASE}/recommendations/mood/${encodeURIComponent(mood)}`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Mood fetch failed');
      const data = await res.json();
      return { mood: data.mood, tracks: data.tracks || [] };
    } catch {
      return { mood, tracks: [] };
    }
  },

  // ==================== USER CLOUD DATA API ====================
  async getUserLikes(): Promise<Track[]> {
    try {
      const res = await fetch(`${API_BASE}/user/likes`, { headers: getAuthHeaders() });
      if (!res.ok) return [];
      const data = await res.json();
      return data.likes || [];
    } catch {
      return [];
    }
  },

  async likeTrack(track: Track): Promise<Track[]> {
    try {
      const res = await fetch(`${API_BASE}/user/likes`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ track }),
      });
      const data = await res.json();
      return data.likes || [];
    } catch {
      return [];
    }
  },

  async unlikeTrack(trackId: string): Promise<Track[]> {
    try {
      const res = await fetch(`${API_BASE}/user/likes/${trackId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      return data.likes || [];
    } catch {
      return [];
    }
  },

  async getUserPlaylists(): Promise<Playlist[]> {
    try {
      const res = await fetch(`${API_BASE}/user/playlists`, { headers: getAuthHeaders() });
      if (!res.ok) return [];
      const data = await res.json();
      return data.playlists || [];
    } catch {
      return [];
    }
  },

  async saveUserPlaylist(playlist: Playlist): Promise<Playlist | null> {
    try {
      const res = await fetch(`${API_BASE}/user/playlists`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(playlist),
      });
      const data = await res.json();
      return data.playlist || null;
    } catch {
      return null;
    }
  },

  async deleteUserPlaylist(playlistId: string): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/user/playlists/${playlistId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      return !!data.success;
    } catch {
      return false;
    }
  },

  async getUserHistory(): Promise<any[]> {
    try {
      const res = await fetch(`${API_BASE}/user/history`, { headers: getAuthHeaders() });
      if (!res.ok) return [];
      const data = await res.json();
      return data.history || [];
    } catch {
      return [];
    }
  },

  async postEvents(events: ListeningEvent[]): Promise<void> {
    try {
      await fetch(`${API_BASE}/user/events`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ events }),
      });
    } catch {}
  },

  async migrateLocalData(localData: { likedTracks: Track[]; playlists: Playlist[]; history: any[] }): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/user/migrate`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(localData),
      });
      const data = await res.json();
      return !!data.status;
    } catch {
      return false;
    }
  },

  // ==================== MUSIC CATALOG API ====================
  async getCharts(): Promise<{ trending: Track[]; quickPicks: Track[] }> {
    try {
      const res = await fetch(`${API_BASE}/music/charts`);
      if (!res.ok) throw new Error('Charts fetch failed');
      const data = await res.json();
      return { trending: data.trending || [], quickPicks: data.quickPicks || [] };
    } catch {
      return { trending: [], quickPicks: [] };
    }
  },

  async search(query: string, type: string = 'all'): Promise<{
    query: string;
    intent?: string;
    songs: Track[];
    videos: Track[];
    artists: any[];
    albums: any[];
    podcasts: any[];
    results: Track[];
  }> {
    try {
      const res = await fetch(`${API_BASE}/music/search?q=${encodeURIComponent(query)}&type=${type}`);
      if (!res.ok) throw new Error('Search failed');
      const data = await res.json();
      return {
        query: data.query || query,
        intent: data.intent || 'SONG',
        songs: data.songs || [],
        videos: data.videos || [],
        artists: data.artists || [],
        albums: data.albums || [],
        podcasts: data.podcasts || [],
        results: data.results || data.songs || [],
      };
    } catch {
      return { query, songs: [], videos: [], artists: [], albums: [], podcasts: [], results: [] };
    }
  },

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

  async resolvePlaybackSource(
    track: Track,
    format: PlaybackFormat = 'audio'
  ): Promise<{
    sourceId: string;
    canonicalTrackId: string;
    provider: string;
    providerTrackId: string;
    title: string;
    artist: string;
    duration: number;
    format: string;
    sourceType: string;
    confidenceScore: number;
  } | null> {
    try {
      const canonId = track.canonicalTrackId || track.id;
      const res = await fetch(
        `${API_BASE}/music/resolve-source?id=${encodeURIComponent(canonId)}&title=${encodeURIComponent(track.title)}&artist=${encodeURIComponent(track.artist)}&duration=${track.duration || 210}&format=${format}`
      );
      if (!res.ok) return null;
      const data = await res.json();
      return data.source || null;
    } catch {
      return null;
    }
  },

  async downloadAudioBlob(trackId: string): Promise<Blob | null> {
    try {
      const res = await fetch(`${API_BASE}/music/download/${trackId}`);
      if (!res.ok) return null;
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) return null;
      const blob = await res.blob();
      if (blob.size < 1000) return null;
      return blob;
    } catch {
      return null;
    }
  },

  async getLyrics(title: string, artist: string, duration?: number): Promise<LyricData> {
    try {
      const res = await fetch(`${API_BASE}/music/lyrics?track=${encodeURIComponent(title)}&artist=${encodeURIComponent(artist)}&duration=${duration || ''}`);
      if (!res.ok) throw new Error('Lyrics fetch failed');
      return await res.json();
    } catch {
      return { syncedLyrics: null, plainLyrics: null };
    }
  },

  async getAdBundle(): Promise<{ audioAds: AdCreative[]; displayBanners: any[] }> {
    try {
      const res = await fetch(`${API_BASE}/ads/bundle`);
      if (!res.ok) return { audioAds: [], displayBanners: [] };
      return await res.json();
    } catch {
      return { audioAds: [], displayBanners: [] };
    }
  }
};
