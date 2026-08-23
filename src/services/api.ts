import { Track, MoodStation, LyricData, AdCreative, Artist, Album, User, Playlist, AppSettings, ListeningEvent } from '../types';

const API_BASE = '/api';

const getAuthHeaders = () => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('MRJ_AUTH_TOKEN') : null;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

export const api = {
  // ==================== AUTH API ====================
  async register(name: string, email: string, password: string): Promise<{ user: User; token: string; refreshToken: string }> {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
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

  // ==================== RECOMMENDATION API ====================
  async getPersonalizedHome(): Promise<{ quickPicks: Track[]; trending: Track[]; dailyMixes: any[]; moods: MoodStation[] }> {
    try {
      const res = await fetch(`${API_BASE}/recommendations/home`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Home recommendation failed');
      const data = await res.json();
      return {
        quickPicks: data.quickPicks || [],
        trending: data.trending || [],
        dailyMixes: data.dailyMixes || [],
        moods: data.moods || [],
      };
    } catch {
      return { quickPicks: [], trending: [], dailyMixes: [], moods: [] };
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

  async search(query: string, type: string = 'all'): Promise<{ results: Track[]; artists: any[] }> {
    try {
      const res = await fetch(`${API_BASE}/music/search?q=${encodeURIComponent(query)}&type=${type}`);
      if (!res.ok) throw new Error('Search failed');
      const data = await res.json();
      return { results: data.results || [], artists: data.artists || [] };
    } catch {
      return { results: [], artists: [] };
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

  async downloadAudioBlob(trackId: string): Promise<Blob | null> {
    try {
      const res = await fetch(`${API_BASE}/music/download/${trackId}`);
      if (!res.ok) return null;
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) return null;
      const blob = await res.blob();
      // Ensure real audio blob
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
