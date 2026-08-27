import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { Track, LyricData, AdCreative, PlaybackMode, AudioQuality, Playlist, PlaybackFormat, TuneConfig } from '../types';
import { api, API_BASE } from '../services/api';
import { offlineStorage } from '../services/offlineStorage';
import { offlineAdEngine } from '../services/offlineAdEngine';
import { smartDownloadEngine } from '../services/smartDownloadEngine';
import { offlineRecommendationEngine } from '../services/offlineRecommendationEngine';
import { setupMediaSession, updateMediaSessionPosition } from '../services/mediaSession';
import { syncService } from '../services/syncService';
import { nativePlayerBridge } from '../services/nativePlayerBridge';

export type RepeatMode = 'off' | 'all' | 'one';
export type QueueSourceType = 'single' | 'album' | 'playlist' | 'artist' | 'radio' | 'mood' | 'search' | 'downloaded' | 'recommendation';

interface MusicPlayerContextType {
  currentTrack: Track | null;
  isPlaying: boolean;
  isLoading: boolean;
  currentTime: number;
  duration: number;
  progress: number;
  volume: number;
  isMuted: boolean;
  
  // Independent Playback & Format Modes
  playbackFormat: PlaybackFormat;
  shuffleEnabled: boolean;
  repeatMode: RepeatMode;
  autoplayEnabled: boolean;
  sourceType: QueueSourceType;
  audioQuality: AudioQuality;
  tuneConfig: TuneConfig;
  
  // Authoritative Queue
  queue: Track[];
  queueIndex: number;
  sourceQueue: Track[];
  playbackHistory: Track[];
  
  // UI & Panels
  isFullScreenPlayerOpen: boolean;
  isLyricsOpen: boolean;
  isQueueOpen: boolean;
  isTuneModalOpen: boolean;
  activeLyrics: LyricData | null;
  activeAd: AdCreative | null;
  isAdPlaying: boolean;
  isOfflineMode: boolean;
  downloadedTrackIds: Set<string>;
  likedTrackIds: Set<string>;
  playlists: Playlist[];
  
  // Playback Actions
  playTrack: (track: Track, newQueue?: Track[], source?: QueueSourceType, format?: PlaybackFormat) => Promise<void>;
  togglePlay: () => void;
  togglePlaybackFormat: () => void;
  nextTrack: () => void;
  previousTrack: () => void;
  seek: (seconds: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  cycleRepeatMode: () => void;
  toggleAutoplay: () => void;
  setAudioQuality: (quality: AudioQuality) => void;
  setTuneConfig: (config: TuneConfig) => void;
  sendFeedback: (eventType: string, track?: Track | null, artist?: string) => Promise<void>;
  
  // Queue Actions
  addToQueue: (track: Track) => void;
  playNextInQueue: (track: Track) => void;
  removeFromQueue: (index: number) => void;
  reorderQueue: (startIndex: number, endIndex: number) => void;
  clearQueue: () => void;
  shuffleDownloads: () => Promise<void>;
  
  // Library Actions
  toggleFavorite: (track: Track) => Promise<boolean>;
  isFavorite: (trackId: string) => boolean;
  downloadTrack: (track: Track) => Promise<boolean>;
  deleteDownloadedTrack: (trackId: string) => Promise<boolean>;
  createPlaylist: (title: string, description?: string) => Promise<Playlist>;
  addTrackToPlaylist: (playlistId: string, track: Track) => Promise<boolean>;
  removeTrackFromPlaylist: (playlistId: string, trackId: string) => Promise<boolean>;
  deletePlaylist: (playlistId: string) => Promise<boolean>;
  refreshLibrary: () => Promise<void>;

  // UI Actions
  setFullScreenPlayerOpen: (open: boolean) => void;
  setLyricsOpen: (open: boolean) => void;
  setQueueOpen: (open: boolean) => void;
  setTuneModalOpen: (open: boolean) => void;
  dismissAd: () => void;
}

const MusicPlayerContext = createContext<MusicPlayerContextType | null>(null);

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

const lyricsCache = new Map<string, LyricData>();

// Fisher-Yates Shuffle Algorithm (Bag Model)
function fisherYatesShuffle<T>(array: T[]): T[] {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export const MusicPlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(0.85);
  const [isMuted, setIsMuted] = useState(false);

  // Playback & Queue Modes
  const [playbackFormat, setPlaybackFormat] = useState<PlaybackFormat>('audio');
  const [shuffleEnabled, setShuffleEnabled] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('off');
  const [autoplayEnabled, setAutoplayEnabled] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('MRJ_AUTOPLAY_ENABLED');
      return saved !== null ? saved === 'true' : true;
    }
    return true;
  });
  const [sourceType, setSourceType] = useState<QueueSourceType>('single');
  const [audioQuality, setAudioQuality] = useState<AudioQuality>('high');
  const [tuneConfig, setTuneConfig] = useState<TuneConfig>({
    artistVariety: 50,
    discoveryLevel: 40,
    energy: 50,
    mood: null,
  });

  // Authoritative Queues
  const [queue, setQueue] = useState<Track[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [sourceQueue, setSourceQueue] = useState<Track[]>([]);
  const [playbackHistory, setPlaybackHistory] = useState<Track[]>([]);

  // UI Panels & Library State
  const [isFullScreenPlayerOpen, setFullScreenPlayerOpen] = useState(false);
  const [isLyricsOpen, setLyricsOpen] = useState(false);
  const [isQueueOpen, setQueueOpen] = useState(false);
  const [isTuneModalOpen, setTuneModalOpen] = useState(false);
  const [activeLyrics, setActiveLyrics] = useState<LyricData | null>(null);
  const [activeAd, setActiveAd] = useState<AdCreative | null>(null);
  const [isAdPlaying, setIsAdPlaying] = useState(false);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [downloadedTrackIds, setDownloadedTrackIds] = useState<Set<string>>(new Set());
  const [likedTrackIds, setLikedTrackIds] = useState<Set<string>>(new Set());
  const [playlists, setPlaylists] = useState<Playlist[]>([]);

  const ytPlayerRef = useRef<any>(null);
  const ytPlayerReadyRef = useRef<boolean>(false);
  const pendingPlayIdRef = useRef<string | null>(null);
  const htmlAudioRef = useRef<HTMLAudioElement | null>(null);
  const pollTimerRef = useRef<any>(null);
  const isUsingHtmlAudio = useRef<boolean>(false);
  const wakeLockRef = useRef<any>(null);
  const milestoneRef = useRef<Set<number>>(new Set());
  const autoplayGenerationId = useRef<number>(0);
  const lastSeekTargetRef = useRef<number | null>(null);
  const lastSeekTimestampRef = useRef<number>(0);
  const isFetchingAutoplay = useRef<boolean>(false);
  const sessionIdRef = useRef<string>('sess_' + Math.random().toString(36).substring(2, 9));
  // Ref always points to the latest handleTrackEnded — prevents stale-closure autoplay failure
  const handleTrackEndedRef = useRef<() => void>(() => {});
  const currentTrackRef = useRef<Track | null>(null);
  const loadWatchdogTimerRef = useRef<any>(null);

  // High-Fidelity Audio Failover Helper
  const triggerAudioFallback = (targetTrack: Track | null) => {
    if (loadWatchdogTimerRef.current) {
      clearTimeout(loadWatchdogTimerRef.current);
      loadWatchdogTimerRef.current = null;
    }
    if (!targetTrack) {
      setIsLoading(false);
      return;
    }
    const fallbackUrl = targetTrack.previewUrl || (targetTrack.audioSource?.providerTrackId ? `https://mrj-music.vercel.app/api/music/stream-raw/${targetTrack.audioSource.providerTrackId}` : null);
    if (fallbackUrl && htmlAudioRef.current) {
      console.log('⚡ YouTube iframe blocked or timeout. Seamlessly switching to HQ direct audio stream:', targetTrack.title);
      isUsingHtmlAudio.current = true;
      try { ytPlayerRef.current?.pauseVideo?.(); } catch {}
      htmlAudioRef.current.src = fallbackUrl;
      htmlAudioRef.current.play().then(() => {
        setIsPlaying(true);
        setIsLoading(false);
      }).catch((err) => {
        console.warn('Direct stream fallback play notice:', err);
        setIsLoading(false);
      });
    } else {
      setIsLoading(false);
    }
  };

  // Initialize playback & library storage
  useEffect(() => {
    if (typeof window === 'undefined') return;

    setIsOfflineMode(!navigator.onLine);

    // Initialize Native Android Media3 Engine if on Android
    nativePlayerBridge.initialize({
      onPlaybackStateChange: (playing, loading) => {
        setIsPlaying(playing);
        setIsLoading(loading);
      },
      onTrackChange: (t) => {
        if (t) {
          setCurrentTrack(t);
          currentTrackRef.current = t;
        }
      },
      onPositionChange: (pos, dur) => {
        setCurrentTime(pos);
        if (dur) setDuration(dur);
      },
      onQueueChange: (q, idx) => {
        setQueue(q);
        setQueueIndex(idx);
      },
    });

    // 1. Initialize HTML5 Audio Element
    try {
      const audio = new Audio();
      htmlAudioRef.current = audio;
      audio.preload = 'auto';
      audio.setAttribute('playsinline', 'true');
      audio.setAttribute('webkit-playsinline', 'true');

      audio.onended = () => handleTrackEndedRef.current();

      audio.ontimeupdate = () => {
        if (isUsingHtmlAudio.current) {
          setCurrentTime(audio.currentTime);
          if (audio.duration) setDuration(audio.duration);
          checkMilestones(audio.currentTime, audio.duration);
          updateMediaSessionPosition(audio.currentTime, audio.duration);
        }
      };
    } catch {}

    // 2. Initialize YouTube Stream Player
    const setupYtPlayer = () => {
      if (typeof window === 'undefined') return;
      if (window.YT && window.YT.Player && !ytPlayerRef.current) {
        try {
          let container = document.getElementById('mrj-yt-audio-container');
          if (!container) {
            container = document.createElement('div');
            container.id = 'mrj-yt-audio-container';
            container.style.cssText = 'position:fixed;bottom:-9999px;right:-9999px;width:200px;height:200px;opacity:1;pointer-events:none;z-index:-1;';
            document.body.appendChild(container);
          }

          ytPlayerRef.current = new window.YT.Player('mrj-yt-audio-container', {
            height: '200',
            width: '200',
            host: 'https://www.youtube.com',
            playerVars: {
              autoplay: 1,
              controls: 0,
              disablekb: 1,
              fs: 0,
              playsinline: 1,
              rel: 0,
              enablejsapi: 1,
              origin: window.location.origin,
            },
            events: {
              onReady: () => {
                ytPlayerReadyRef.current = true;
                try {
                  ytPlayerRef.current?.setVolume?.(volume * 100);
                } catch {}
                if (pendingPlayIdRef.current) {
                  const toPlay = pendingPlayIdRef.current;
                  pendingPlayIdRef.current = null;
                  try {
                    ytPlayerRef.current?.loadVideoById({ videoId: toPlay, startSeconds: 0, suggestedQuality: 'highres' });
                    try { ytPlayerRef.current?.setPlaybackQuality?.('highres'); } catch {}
                    ytPlayerRef.current?.playVideo();
                    setIsPlaying(true);
                    setIsLoading(false);
                  } catch (e) {
                    console.warn('Pending play execution notice:', e);
                  }
                }
              },
              onStateChange: (event: any) => {
                if (event.data === 1) { // PLAYING
                  try { ytPlayerRef.current?.setPlaybackQuality?.('highres'); } catch {}
                  if (loadWatchdogTimerRef.current) {
                    clearTimeout(loadWatchdogTimerRef.current);
                    loadWatchdogTimerRef.current = null;
                  }
                  setIsPlaying(true);
                  setIsLoading(false);
                  acquireWakeLock();
                  const dur = ytPlayerRef.current?.getDuration?.();
                  if (dur) setDuration(dur);
                } else if (event.data === 2) { // PAUSED
                  setIsPlaying(false);
                  releaseWakeLock();
                } else if (event.data === 0) { // ENDED
                  handleTrackEndedRef.current();
                } else if (event.data === 3) { // BUFFERING
                  setIsLoading(true);
                }
              },
              onError: (err: any) => {
                console.warn('YouTube player error event:', err);
                triggerAudioFallback(currentTrackRef.current);
              },
            },
          });
        } catch (e) {
          console.warn('YouTube player setup notice:', e);
        }
      }
    };

    if (window.YT && window.YT.Player) {
      setupYtPlayer();
    } else {
      window.onYouTubeIframeAPIReady = setupYtPlayer;
      if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        tag.async = true;
        document.body.appendChild(tag);
      }
    }

    // 3. Time polling with seek stabilization filter
    pollTimerRef.current = setInterval(() => {
      if (!isUsingHtmlAudio.current && ytPlayerRef.current && typeof ytPlayerRef.current.getCurrentTime === 'function') {
        try {
          const curr = ytPlayerRef.current.getCurrentTime() || 0;
          const dur = ytPlayerRef.current.getDuration() || 0;

          // Anti-jitter: If user seeked within last 1200ms, prevent snapping back to old position
          if (Date.now() - lastSeekTimestampRef.current < 1200 && lastSeekTargetRef.current !== null) {
            if (Math.abs(curr - lastSeekTargetRef.current) > 2) {
              return;
            }
          }

          setCurrentTime(curr);
          if (dur > 0) setDuration(dur);
          checkMilestones(curr, dur);
          updateMediaSessionPosition(curr, dur);
        } catch {}
      }
    }, 500);

    refreshLibrary();

    const handleOnline = () => setIsOfflineMode(false);
    const handleOffline = () => setIsOfflineMode(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      releaseWakeLock();
    };
  }, []);

  useEffect(() => {
    if (ytPlayerRef.current && typeof ytPlayerRef.current.setVolume === 'function') {
      try {
        ytPlayerRef.current.setVolume(volume * 100);
      } catch {}
    }
  }, [volume]);

  const acquireWakeLock = async () => {
    try {
      if ('wakeLock' in navigator && !wakeLockRef.current) {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
      }
    } catch {}
  };

  const releaseWakeLock = () => {
    try {
      if (wakeLockRef.current) {
        wakeLockRef.current.release();
        wakeLockRef.current = null;
      }
    } catch {}
  };

  const checkMilestones = (curr: number, dur: number) => {
    if (dur <= 0) return;
    const pct = (curr / dur) * 100;
    if (pct >= 25 && !milestoneRef.current.has(25)) {
      milestoneRef.current.add(25);
      if (currentTrack) syncService.queueEvent({ eventType: 'PLAY_25', trackId: currentTrack.id, title: currentTrack.title, artist: currentTrack.artist, completionPercent: 25, sessionId: sessionIdRef.current });
    }
    if (pct >= 50 && !milestoneRef.current.has(50)) {
      milestoneRef.current.add(50);
      if (currentTrack) syncService.queueEvent({ eventType: 'PLAY_50', trackId: currentTrack.id, title: currentTrack.title, artist: currentTrack.artist, completionPercent: 50, sessionId: sessionIdRef.current });
    }
    if (pct >= 75 && !milestoneRef.current.has(75)) {
      milestoneRef.current.add(75);
      if (currentTrack) syncService.queueEvent({ eventType: 'PLAY_75', trackId: currentTrack.id, title: currentTrack.title, artist: currentTrack.artist, completionPercent: 75, sessionId: sessionIdRef.current });
    }
  };

  const refreshLibrary = async () => {
    try {
      const downloaded = await offlineStorage.getAllDownloadedTracks();
      setDownloadedTrackIds(new Set(downloaded.map(t => t.id)));

      const liked = await offlineStorage.getLikedTracks();
      setLikedTrackIds(new Set(liked.map(t => t.id)));

      const userPlaylists = await offlineStorage.getAllPlaylists();
      setPlaylists(userPlaylists);
    } catch (e) {
      console.warn('Library refresh notice:', e);
    }
  };

  // ==================== 1. PLAYBACK ENGINE ====================

  const playTrack = async (track: Track, newQueue?: Track[], source: QueueSourceType = 'single', format: PlaybackFormat = 'audio') => {
    setIsLoading(true);
    setCurrentTrack(track);
    setPlaybackFormat(format || track.playbackFormat || 'audio');
    milestoneRef.current.clear();

    // Background asynchronous tracking
    offlineStorage.recordPlay(track).catch(() => {});
    syncService.queueEvent({
      eventType: 'PLAY_STARTED',
      trackId: track.id,
      title: track.title,
      artist: track.artist,
      genre: track.genre,
      duration: track.duration,
      sessionId: sessionIdRef.current,
    });

    if (newQueue && newQueue.length > 0) {
      setSourceQueue(newQueue);
      setSourceType(source);
      if (shuffleEnabled) {
        const others = newQueue.filter(t => t.id !== track.id);
        const shuffled = [track, ...fisherYatesShuffle(others)];
        setQueue(shuffled);
        setQueueIndex(0);
      } else {
        setQueue(newQueue);
        const idx = newQueue.findIndex(t => t.id === track.id);
        setQueueIndex(idx !== -1 ? idx : 0);
      }
    } else {
      setQueue([track]);
      setQueueIndex(0);
      setSourceQueue([track]);
      setSourceType(source || 'single');

      // Auto-populate seed radio / autoplay queue in background
      api.getNextRecommendations({
        currentTrack: track,
        playedTrackIds: [track.id],
        currentQueueIds: [track.id],
      }).then(rec => {
        if (rec.tracks && rec.tracks.length > 0) {
          setQueue(prev => {
            const currentHead = prev[0] || track;
            const fresh = rec.tracks.filter(t => t.id !== currentHead.id && (t.providerTrackId || t.id) !== (currentHead.providerTrackId || currentHead.id));
            return [currentHead, ...fresh];
          });
        }
      }).catch(() => {});
    }

    // 1. Android Native Background Engine Routing
    if (nativePlayerBridge.isNativeAndroid()) {
      const activeQ = newQueue && newQueue.length > 0 ? newQueue : (queue.length > 0 ? queue : [track]);
      nativePlayerBridge.playTrack(track, activeQ);
      const cacheKey = `${track.title}|${track.artist}`.toLowerCase();
      const cachedLyrics = lyricsCache.get(cacheKey);
      if (cachedLyrics) {
        setActiveLyrics(cachedLyrics);
      } else {
        api.getLyrics(track.title, track.artist, track.duration).then(l => {
          lyricsCache.set(cacheKey, l);
          setActiveLyrics(l);
        }).catch(() => {});
      }
      checkAndTriggerAutoplay(queueIndex, activeQ);
      return;
    }

    try {
      // 2. Check Offline Storage first with automatic online fallback
      let playedOffline = false;
      const offlineRecord = await offlineStorage.getOfflineAudio(track.id);
      if (offlineRecord && offlineRecord.blobUrl && htmlAudioRef.current) {
        try {
          isUsingHtmlAudio.current = true;
          try { ytPlayerRef.current?.pauseVideo?.(); } catch {}
          htmlAudioRef.current.src = offlineRecord.blobUrl;
          await htmlAudioRef.current.play();
          setActiveLyrics(offlineRecord.lyrics || null);
          setIsPlaying(true);
          setIsLoading(false);
          playedOffline = true;
        } catch (e) {
          console.warn('Offline playback failed, falling back to stream:', e);
          playedOffline = false;
        }
      }

      if (!playedOffline) {
        // 3. Play Online Web Stream
        isUsingHtmlAudio.current = false;
        try { htmlAudioRef.current?.pause(); } catch {}

        const targetFormat = format || track.playbackFormat || 'audio';
        let streamId: string | null = (targetFormat === 'video' ? track.videoSource?.providerTrackId : track.audioSource?.providerTrackId) ||
          track.providerTrackId ||
          (!track.id.includes('|') && track.id.length >= 8 ? track.id : null);

        // If streamId is not direct YouTube video ID, resolve it
        if (!streamId || streamId.includes('|')) {
          try {
            const resolved = await api.resolvePlaybackSource(track, targetFormat);
            if (resolved && resolved.providerTrackId) {
              streamId = resolved.providerTrackId;
            } else {
              const res = await api.search(`${track.title} ${track.artist}`);
              const candidate = targetFormat === 'video' ? (res.videos[0] || res.songs[0]) : res.songs[0];
              const found = candidate?.providerTrackId || candidate?.id;
              if (found && !found.includes('|')) {
                streamId = found;
              }
            }
          } catch (err) {
            console.warn('Source resolve notice:', err);
          }
        }

        if (streamId) {
          currentTrackRef.current = track;

          // Clear any previous watchdog
          if (loadWatchdogTimerRef.current) {
            clearTimeout(loadWatchdogTimerRef.current);
            loadWatchdogTimerRef.current = null;
          }

          // Start 3.8s watchdog: If YouTube player does not transition to PLAYING within 3.8s, failover to HQ stream
          loadWatchdogTimerRef.current = setTimeout(() => {
            if (!isUsingHtmlAudio.current) {
              console.log('⏳ Stream buffering watchdog triggered for:', track.title);
              triggerAudioFallback(track);
            }
          }, 3800);

          if (ytPlayerRef.current && typeof ytPlayerRef.current.loadVideoById === 'function') {
            try {
              ytPlayerRef.current.loadVideoById({ videoId: streamId, startSeconds: 0, suggestedQuality: 'highres' });
              try { ytPlayerRef.current.setPlaybackQuality?.('highres'); } catch {}
              ytPlayerRef.current.playVideo();
              setIsPlaying(true);
            } catch (err) {
              console.warn('YT loadVideoById error:', err);
              triggerAudioFallback(track);
            }
          } else {
            pendingPlayIdRef.current = streamId;
          }
        } else {
          triggerAudioFallback(track);
        }

        // Fetch lyrics in background (with cache)
        const cacheKey = `${track.title}|${track.artist}`.toLowerCase();
        const cachedLyrics = lyricsCache.get(cacheKey);
        if (cachedLyrics) {
          setActiveLyrics(cachedLyrics);
        } else {
          api.getLyrics(track.title, track.artist, track.duration).then(l => {
            lyricsCache.set(cacheKey, l);
            setActiveLyrics(l);
          }).catch(() => {});
        }
      }

      setupMediaSession(track, {
        onPlay: () => {
          if (isUsingHtmlAudio.current && htmlAudioRef.current) htmlAudioRef.current.play();
          else if (ytPlayerRef.current) ytPlayerRef.current.playVideo?.();
          setIsPlaying(true);
          nativePlayerBridge.updateMetadata(track, true);
        },
        onPause: () => {
          if (isUsingHtmlAudio.current && htmlAudioRef.current) htmlAudioRef.current.pause();
          else if (ytPlayerRef.current) ytPlayerRef.current.pauseVideo?.();
          setIsPlaying(false);
          nativePlayerBridge.updateMetadata(track, false);
        },
        onNext: handleNextTrack,
        onPrevious: handlePreviousTrack,
        onSeek: seek,
      });

      nativePlayerBridge.updateMetadata(track, true);
      checkAndTriggerAutoplay(queueIndex, queue);
    } catch (err) {
      console.warn('Audio play notice:', err);
      setIsLoading(false);
    }
  };

  const togglePlaybackFormat = () => {
    const nextFormat = playbackFormat === 'audio' ? 'video' : 'audio';
    setPlaybackFormat(nextFormat);
    if (currentTrack) {
      const nextPlayableId = nextFormat === 'video'
        ? (currentTrack.videoSource?.providerTrackId || currentTrack.providerTrackId || currentTrack.id)
        : (currentTrack.audioSource?.providerTrackId || currentTrack.providerTrackId || currentTrack.id);

      if (nextPlayableId && !nextPlayableId.includes('|') && ytPlayerRef.current && typeof ytPlayerRef.current.loadVideoById === 'function') {
        const curr = ytPlayerRef.current.getCurrentTime() || 0;
        ytPlayerRef.current.loadVideoById({ videoId: nextPlayableId, startSeconds: curr });
        ytPlayerRef.current.playVideo();
      }
    }
  };

  const togglePlay = () => {
    if (!currentTrack) return;
    if (nativePlayerBridge.isNativeAndroid()) {
      nativePlayerBridge.togglePlay();
      return;
    }

    if (isUsingHtmlAudio.current && htmlAudioRef.current) {
      if (isPlaying) {
        htmlAudioRef.current.pause();
        setIsPlaying(false);
      } else {
        htmlAudioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
      }
    } else if (ytPlayerRef.current && typeof ytPlayerRef.current.playVideo === 'function') {
      if (isPlaying) {
        try { ytPlayerRef.current.pauseVideo(); } catch {}
        setIsPlaying(false);
      } else {
        try { ytPlayerRef.current.playVideo(); } catch {}
        setIsPlaying(true);
      }
    } else {
      setIsPlaying(!isPlaying);
    }
  };

  const handleTrackEnded = () => {
    if (currentTrack) {
      syncService.queueEvent({
        eventType: 'PLAY_COMPLETED',
        trackId: currentTrack.id,
        title: currentTrack.title,
        artist: currentTrack.artist,
        genre: currentTrack.genre,
        completionPercent: 100,
        sessionId: sessionIdRef.current,
      });
    }

    if (repeatMode === 'one') {
      seek(0);
      if (currentTrack) playTrack(currentTrack);
      return;
    }

    handleNextTrack();
  };
  // Always keep the ref pointing at the latest closure so stale-captured onended handlers work
  handleTrackEndedRef.current = handleTrackEnded;


  // ==================== 2. PROACTIVE AUTOPLAY GENERATION ====================

  const checkAndTriggerAutoplay = useCallback(async (currentIndex: number, currentQueue: Track[]) => {
    if (!autoplayEnabled || isFetchingAutoplay.current) return;
    const remaining = currentQueue.length - (currentIndex + 1);

    if (remaining <= 5) {
      isFetchingAutoplay.current = true;
      const genId = ++autoplayGenerationId.current;

      try {
        if (typeof navigator !== 'undefined' && navigator.onLine) {
          const nextBatch = await api.getNextRecommendations({
            currentTrack,
            playedTrackIds: playbackHistory.map(t => t.id),
            currentQueueIds: currentQueue.map(t => t.id),
          });

          if (genId === autoplayGenerationId.current && nextBatch.tracks.length > 0) {
            const uniqueNewTracks = nextBatch.tracks.filter(
              nt => !currentQueue.some(cq => cq.id === nt.id)
            );

            if (uniqueNewTracks.length > 0) {
              setQueue(prev => [...prev, ...uniqueNewTracks]);
            }
          }
        } else {
          // Zero-Network Offline Autoplay
          const offlineNext = await offlineRecommendationEngine.getNextOfflineTracks(
            currentTrack,
            5,
            [...playbackHistory.map(t => t.id), ...currentQueue.map(t => t.id)]
          );

          if (genId === autoplayGenerationId.current && offlineNext.length > 0) {
            setQueue(prev => [...prev, ...offlineNext]);
          }
        }
      } catch (e) {
        console.warn('Autoplay generation notice:', e);
      } finally {
        isFetchingAutoplay.current = false;
      }
    }
  }, [autoplayEnabled, currentTrack, playbackHistory]);

  // ==================== 3. NEXT & PREVIOUS BUTTONS ====================

  const handleNextTrack = async () => {
    if (nativePlayerBridge.isNativeAndroid()) {
      nativePlayerBridge.playNext();
      return;
    }

    if (currentTrack) {
      const isEarlySkip = currentTime < 15;
      syncService.queueEvent({
        eventType: isEarlySkip ? 'SKIP_EARLY' : 'SKIP_LATE',
        trackId: currentTrack.id,
        title: currentTrack.title,
        artist: currentTrack.artist,
        genre: currentTrack.genre,
        completionPercent: duration > 0 ? Math.round((currentTime / duration) * 100) : 0,
        sessionId: sessionIdRef.current,
      });

      setPlaybackHistory(prev => [currentTrack, ...prev.filter(t => t.id !== currentTrack.id)].slice(0, 30));
    }

    let nextIdx = queueIndex + 1;

    if (nextIdx >= queue.length) {
      if (repeatMode === 'all' && queue.length > 0) {
        nextIdx = 0;
      } else if (autoplayEnabled) {
        if (typeof navigator !== 'undefined' && navigator.onLine) {
          try {
            const res = await api.getNextRecommendations({
              currentTrack,
              playedTrackIds: playbackHistory.map(t => t.id),
              currentQueueIds: queue.map(t => t.id),
            });
            if (res.tracks.length > 0) {
              const nextTrackItem = res.tracks[0];
              setQueue(prev => [...prev, ...res.tracks]);
              setQueueIndex(queue.length);
              playTrack(nextTrackItem);
              return;
            }
          } catch {}
        }

        // Offline Fallback Autoplay
        const offlineTracks = await offlineRecommendationEngine.getNextOfflineTracks(
          currentTrack,
          5,
          playbackHistory.map(t => t.id)
        );
        if (offlineTracks.length > 0) {
          const nextTrackItem = offlineTracks[0];
          setQueue(prev => [...prev, ...offlineTracks]);
          setQueueIndex(queue.length);
          playTrack(nextTrackItem);
          return;
        }

        setIsPlaying(false);
        return;
      } else {
        setIsPlaying(false);
        return;
      }
    }

    setQueueIndex(nextIdx);
    playTrack(queue[nextIdx]);
    checkAndTriggerAutoplay(nextIdx, queue);
  };

  const handlePreviousTrack = async () => {
    if (nativePlayerBridge.isNativeAndroid()) {
      nativePlayerBridge.playPrevious();
      return;
    }

    if (currentTime > 3) {
      seek(0);
      return;
    }

    if (playbackHistory.length > 0) {
      const prevTrack = playbackHistory[0];
      setPlaybackHistory(prev => prev.slice(1));
      const existingIdx = queue.findIndex(t => t.id === prevTrack.id);
      if (existingIdx !== -1) {
        setQueueIndex(existingIdx);
      }
      playTrack(prevTrack);
      return;
    }

    let prevIdx = queueIndex - 1;
    if (prevIdx < 0) prevIdx = queue.length - 1;
    setQueueIndex(prevIdx);
    playTrack(queue[prevIdx]);
  };

  const seek = (seconds: number) => {
    lastSeekTargetRef.current = seconds;
    lastSeekTimestampRef.current = Date.now();
    setCurrentTime(seconds);

    if (nativePlayerBridge.isNativeAndroid()) {
      nativePlayerBridge.seekTo(seconds);
      return;
    }

    if (isUsingHtmlAudio.current && htmlAudioRef.current) {
      try { htmlAudioRef.current.currentTime = seconds; } catch {}
    } else if (ytPlayerRef.current && typeof ytPlayerRef.current.seekTo === 'function') {
      try { ytPlayerRef.current.seekTo(seconds, true); } catch {}
    }
  };

  const setVolume = (val: number) => {
    setVolumeState(val);
    if (htmlAudioRef.current) htmlAudioRef.current.volume = val;
    if (ytPlayerRef.current && typeof ytPlayerRef.current.setVolume === 'function') {
      try { ytPlayerRef.current.setVolume(val * 100); } catch {}
    }
    if (val > 0 && isMuted) setIsMuted(false);
  };

  const toggleMute = () => {
    const nextMute = !isMuted;
    setIsMuted(nextMute);
    if (htmlAudioRef.current) htmlAudioRef.current.muted = nextMute;
    if (ytPlayerRef.current) {
      try {
        if (nextMute) ytPlayerRef.current.mute?.();
        else ytPlayerRef.current.unMute?.();
      } catch {}
    }
  };

  // ==================== 4. USER FEEDBACK ACTIONS ====================

  const sendFeedback = async (eventType: string, track?: Track | null, artist?: string) => {
    const target = track || currentTrack;
    const targetArtist = artist || target?.artist;
    await api.sendFeedback(eventType, target, targetArtist);

    if (eventType === 'DONT_RECOMMEND_ARTIST' && targetArtist) {
      setQueue(prev => prev.filter(t => t.artist !== targetArtist));
    } else if (eventType === 'NOT_INTERESTED' && target) {
      setQueue(prev => prev.filter(t => t.id !== target.id));
    }
  };

  // ==================== 5. SHUFFLE, REPEAT & AUTOPLAY TOGGLES ====================

  const toggleShuffle = () => {
    const nextShuffle = !shuffleEnabled;
    setShuffleEnabled(nextShuffle);

    if (nativePlayerBridge.isNativeAndroid()) {
      nativePlayerBridge.setShuffle(nextShuffle);
      return;
    }

    if (queue.length <= 1) return;

    if (nextShuffle) {
      const current = currentTrack || queue[queueIndex];
      const upcoming = queue.slice(queueIndex + 1);
      const played = queue.slice(0, queueIndex);
      const shuffledUpcoming = fisherYatesShuffle(upcoming);
      setQueue([...played, current, ...shuffledUpcoming]);
    } else {
      if (sourceQueue.length > 0) {
        setQueue(sourceQueue);
        const idx = currentTrack ? sourceQueue.findIndex(t => t.id === currentTrack.id) : 0;
        setQueueIndex(idx !== -1 ? idx : 0);
      }
    }
  };

  const cycleRepeatMode = () => {
    const modes: RepeatMode[] = ['off', 'all', 'one'];
    const nextIdx = (modes.indexOf(repeatMode) + 1) % modes.length;
    setRepeatMode(modes[nextIdx]);
  };

  const toggleAutoplay = () => {
    const nextState = !autoplayEnabled;
    setAutoplayEnabled(nextState);
    localStorage.setItem('MRJ_AUTOPLAY_ENABLED', String(nextState));
  };

  // ==================== 6. QUEUE MUTATIONS ====================

  const addToQueue = (track: Track) => {
    setQueue(prev => [...prev, track]);
    syncService.queueEvent({ eventType: 'ADD_TO_QUEUE', trackId: track.id, title: track.title, artist: track.artist, sessionId: sessionIdRef.current });
  };

  const playNextInQueue = (track: Track) => {
    setQueue(prev => {
      const copy = [...prev];
      copy.splice(queueIndex + 1, 0, track);
      return copy;
    });
  };

  const removeFromQueue = (index: number) => {
    setQueue(prev => prev.filter((_, i) => i !== index));
    if (index < queueIndex) {
      setQueueIndex(prev => Math.max(0, prev - 1));
    }
  };

  const reorderQueue = (startIndex: number, endIndex: number) => {
    setQueue(prev => {
      const result = Array.from(prev);
      const [removed] = result.splice(startIndex, 1);
      result.splice(endIndex, 0, removed);
      return result;
    });
  };

  const clearQueue = () => {
    if (currentTrack) {
      setQueue([currentTrack]);
      setQueueIndex(0);
    } else {
      setQueue([]);
      setQueueIndex(0);
    }
  };

  const shuffleDownloads = async () => {
    const downloaded = await offlineStorage.getAllDownloadedTracks();
    if (downloaded.length === 0) return;

    const shuffled = fisherYatesShuffle(downloaded);
    playTrack(shuffled[0], shuffled, 'downloaded');
  };

  // ==================== 7. LIBRARY ACTIONS ====================

  const toggleFavorite = async (track: Track): Promise<boolean> => {
    const isFav = likedTrackIds.has(track.id);
    if (isFav) {
      await offlineStorage.removeLikedTrack(track.id);
      setLikedTrackIds(prev => {
        const next = new Set(prev);
        next.delete(track.id);
        return next;
      });
      syncService.queueEvent({ eventType: 'UNLIKE', trackId: track.id, title: track.title, artist: track.artist, sessionId: sessionIdRef.current });
      return false;
    } else {
      await offlineStorage.saveLikedTrack(track);
      setLikedTrackIds(prev => new Set(prev).add(track.id));
      syncService.queueEvent({ eventType: 'LIKE', trackId: track.id, title: track.title, artist: track.artist, sessionId: sessionIdRef.current });
      return true;
    }
  };

  const isFavorite = (trackId: string): boolean => {
    return likedTrackIds.has(trackId);
  };

  const downloadTrack = async (track: Track, type: 'manual' | 'smart' = 'manual'): Promise<boolean> => {
    try {
      const blob = await api.downloadAudioBlob(track.id);
      if (!blob) return false;
      const lyrics = await api.getLyrics(track.title, track.artist, track.duration);
      await offlineStorage.saveDownloadedTrack(track, blob, lyrics, type);
      setDownloadedTrackIds(prev => new Set(prev).add(track.id));
      return true;
    } catch {
      return false;
    }
  };

  const deleteDownloadedTrack = async (trackId: string): Promise<boolean> => {
    try {
      await offlineStorage.deleteDownloadedTrack(trackId);
      setDownloadedTrackIds(prev => {
        const next = new Set(prev);
        next.delete(trackId);
        return next;
      });
      return true;
    } catch {
      return false;
    }
  };

  const createPlaylist = async (title: string, description?: string): Promise<Playlist> => {
    const newPl = await offlineStorage.savePlaylist({
      id: 'pl_' + Math.random().toString(36).substring(2, 9),
      title,
      description: description || '',
      thumbnail: '',
      tracks: [],
      trackCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isCustom: true,
    });
    setPlaylists(prev => [...prev, newPl]);
    return newPl;
  };

  const addTrackToPlaylist = async (playlistId: string, track: Track): Promise<boolean> => {
    const success = await offlineStorage.addTrackToPlaylist(playlistId, track);
    if (success) {
      await refreshLibrary();
      syncService.queueEvent({ eventType: 'PLAYLIST_ADD', trackId: track.id, title: track.title, artist: track.artist, sessionId: sessionIdRef.current });
    }
    return success;
  };

  const removeTrackFromPlaylist = async (playlistId: string, trackId: string): Promise<boolean> => {
    const success = await offlineStorage.removeTrackFromPlaylist(playlistId, trackId);
    if (success) await refreshLibrary();
    return success;
  };

  const deletePlaylist = async (playlistId: string): Promise<boolean> => {
    const success = await offlineStorage.deletePlaylist(playlistId);
    if (success) {
      setPlaylists(prev => prev.filter(p => p.id !== playlistId));
    }
    return success;
  };

  const dismissAd = () => {
    setIsAdPlaying(false);
    setActiveAd(null);
  };

  return (
    <MusicPlayerContext.Provider
      value={{
        currentTrack,
        isPlaying,
        isLoading,
        currentTime,
        duration,
        progress: duration > 0 ? (currentTime / duration) * 100 : 0,
        volume,
        isMuted,
        playbackFormat,
        shuffleEnabled,
        repeatMode,
        autoplayEnabled,
        sourceType,
        audioQuality,
        tuneConfig,
        queue,
        queueIndex,
        sourceQueue,
        playbackHistory,
        isFullScreenPlayerOpen,
        isLyricsOpen,
        isQueueOpen,
        isTuneModalOpen,
        activeLyrics,
        activeAd,
        isAdPlaying,
        isOfflineMode,
        downloadedTrackIds,
        likedTrackIds,
        playlists,
        playTrack,
        togglePlay,
        togglePlaybackFormat,
        nextTrack: handleNextTrack,
        previousTrack: handlePreviousTrack,
        seek,
        setVolume,
        toggleMute,
        toggleShuffle,
        cycleRepeatMode,
        toggleAutoplay,
        setAudioQuality,
        setTuneConfig,
        sendFeedback,
        addToQueue,
        playNextInQueue,
        removeFromQueue,
        reorderQueue,
        clearQueue,
        shuffleDownloads,
        toggleFavorite,
        isFavorite,
        downloadTrack,
        deleteDownloadedTrack,
        createPlaylist,
        addTrackToPlaylist,
        removeTrackFromPlaylist,
        deletePlaylist,
        refreshLibrary,
        setFullScreenPlayerOpen,
        setLyricsOpen,
        setQueueOpen,
        setTuneModalOpen,
        dismissAd,
      }}
    >
      {children}
      <div
        id="mrj-yt-audio-container"
        style={{
          position: 'fixed',
          bottom: '-9999px',
          right: '-9999px',
          width: '200px',
          height: '200px',
          opacity: 1,
          pointerEvents: 'none',
          zIndex: -1,
        }}
      />
    </MusicPlayerContext.Provider>
  );
};

export const useMusicPlayer = () => {
  const context = useContext(MusicPlayerContext);
  if (!context) throw new Error('useMusicPlayer must be used within MusicPlayerProvider');
  return context;
};
