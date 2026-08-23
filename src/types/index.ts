export interface Track {
  id: string;
  title: string;
  artist: string;
  album?: string;
  thumbnail: string;
  duration: number; // in seconds
  views?: string;
  genre?: string;
  streamUrl?: string;
  isOffline?: boolean;
  downloadedAt?: number;
  fileSize?: number;
}

export interface MoodStation {
  id: string;
  name: string;
  color: string;
  count: string;
  icon: string;
}

export interface SyncedLyricLine {
  time: number; // in seconds
  text: string;
}

export interface LyricData {
  syncedLyrics: string | null;
  plainLyrics: string | null;
  parsedLines?: SyncedLyricLine[];
}

export interface AdCreative {
  id: string;
  title: string;
  sponsor: string;
  audioUrl: string;
  bannerUrl: string;
  ctaText: string;
  ctaUrl: string;
}

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  thumbnail?: string;
  tracks: Track[];
  createdAt: number;
}

export type PlaybackMode = 'repeat-none' | 'repeat-one' | 'repeat-all' | 'shuffle';
export type AudioQuality = 'high' | 'standard'; // high: 160kbps Opus, standard: 128kbps AAC
