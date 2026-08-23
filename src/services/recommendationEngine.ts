import { Track } from '../types';

const HISTORY_KEY = 'MRJ_LISTEN_HISTORY';
const LIKED_KEY = 'MRJ_LIKED_TRACKS';

export const recommendationEngine = {
  // Add track to user history
  recordPlay(track: Track) {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      let history: Track[] = raw ? JSON.parse(raw) : [];
      // Remove duplicate and unshift to top
      history = [track, ...history.filter(t => t.id !== track.id)].slice(0, 50);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch {
      // Ignore
    }
  },

  // Get recently played
  getRecentlyPlayed(): Track[] {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  // Get Liked tracks
  getLikedTracks(): Track[] {
    try {
      const raw = localStorage.getItem(LIKED_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  // Toggle like track
  toggleLike(track: Track): boolean {
    try {
      const liked = this.getLikedTracks();
      const exists = liked.some(t => t.id === track.id);
      let updated: Track[];
      if (exists) {
        updated = liked.filter(t => t.id !== track.id);
      } else {
        updated = [track, ...liked];
      }
      localStorage.setItem(LIKED_KEY, JSON.stringify(updated));
      return !exists;
    } catch {
      return false;
    }
  },

  isLiked(trackId: string): boolean {
    const liked = this.getLikedTracks();
    return liked.some(t => t.id === trackId);
  }
};
