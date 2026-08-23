export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: number;
}

export type ContentType = 'music' | 'video' | 'podcast' | 'unknown';
export type PlaybackFormat = 'audio' | 'video';

export interface Track {
  id: string;
  title: string;
  rawTitle?: string;
  artist: string;
  album?: string;
  thumbnail: string;
  duration: number; // in seconds
  views?: string;
  genre?: string;
  audioUrl?: string;
  contentType?: ContentType;
  isOfficialMusic?: boolean;
  isAudioOnly?: boolean;
  isMusicVideo?: boolean;
  isLive?: boolean;
  isCover?: boolean;
  isRemix?: boolean;
  isSlowed?: boolean;
  isLyricsVideo?: boolean;
  isShort?: boolean;
  isReaction?: boolean;
  isCompilation?: boolean;
  isPodcast?: boolean;
  sourceType?: string;
  provider?: string;
  providerTrackId?: string;
  playbackFormat?: PlaybackFormat;
  musicScore?: number;
  videoScore?: number;
  recommendationReason?: string;
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
  userId?: string;
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
  time: number;
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

export interface TuneConfig {
  artistVariety: number; // 0 - 100
  discoveryLevel: number; // 0 - 100
  energy: number; // 0 - 100
  mood?: string | null;
}

export interface OnRepeatStats {
  songs: Track[];
  artists: { name: string; thumbnail: string }[];
}

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

export interface ListeningEvent {
  eventType: string;
  trackId?: string;
  title?: string;
  artist?: string;
  genre?: string;
  duration?: number;
  completionPercent?: number;
  skipped?: boolean;
  source?: string;
  timestamp?: number;
  sessionId?: string;
  query?: string;
}
