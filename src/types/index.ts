export interface Track {
  id: string;
  title: string;
  artist: string;
  album?: string;
  thumbnail: string;
  duration: number; // in seconds
  views?: string;
  genre?: string;
  audioUrl?: string; // Direct audio stream url if resolved
  isOffline?: boolean;
  downloadedAt?: number;
  fileSize?: number;
  quality?: string;
  bitrate?: string;
}

export interface Artist {
  id: string;
  name: string;
  thumbnail: string;
  subscribers?: string;
  monthlyListeners?: string;
  bio?: string;
  topSongs: Track[];
  albums: Album[];
  singles: Track[];
  relatedArtists: { id: string; name: string; thumbnail: string; listeners?: string }[];
}

export interface Album {
  id: string;
  title: string;
  artist: string;
  artistId?: string;
  thumbnail: string;
  year?: string;
  trackCount: number;
  totalDuration?: number;
  tracks: Track[];
}

export interface Playlist {
  id: string;
  title: string;
  description?: string;
  thumbnail?: string;
  trackCount: number;
  tracks: Track[];
  createdAt: number;
  updatedAt: number;
  isCustom?: boolean;
}

export interface LyricData {
  syncedLyrics: string | null;
  plainLyrics: string | null;
}

export interface SyncedLyricLine {
  time: number; // seconds
  text: string;
}

export interface MoodStation {
  id: string;
  name: string;
  color: string;
  count: string;
  icon?: string;
}

export interface AdCreative {
  id: string;
  title: string;
  sponsor: string;
  audioUrl?: string;
  bannerUrl: string;
  ctaText: string;
  ctaUrl: string;
  isOfflineCached?: boolean;
}

export type PlaybackMode = 'repeat-none' | 'repeat-all' | 'repeat-one' | 'shuffle';

export type AudioQuality = 'auto' | 'standard' | 'high';

export interface SmartDownloadConfig {
  enabled: boolean;
  maxTracks: number;
  storageLimitMB: number;
  wifiOnly: boolean;
  preferredQuality: AudioQuality;
}

export interface AppSettings {
  audioQuality: AudioQuality;
  autoplayRadio: boolean;
  smartDownloads: SmartDownloadConfig;
  theme: 'oled-dark' | 'midnight-dark';
  analyticsEnabled: boolean;
  anonymousInstallationId: string;
}

export interface BackupData {
  version: string;
  exportedAt: number;
  playlists: Playlist[];
  likedTracks: Track[];
  history: Track[];
  settings: AppSettings;
}
