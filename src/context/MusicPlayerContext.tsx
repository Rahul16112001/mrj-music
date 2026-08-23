import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Track, LyricData, AdCreative, PlaybackMode, AudioQuality, Playlist } from '../types';
import { api } from '../services/api';
import { offlineStorage } from '../services/offlineStorage';
import { offlineAdEngine } from '../services/offlineAdEngine';
import { smartDownloads } from '../services/smartDownloads';
import { setupMediaSession } from '../services/mediaSession';

interface MusicPlayerContextType {
  currentTrack: Track | null;
  isPlaying: boolean;
  isLoading: boolean;
  currentTime: number;
  duration: number;
  progress: number;
  volume: number;
  isMuted: boolean;
  playbackMode: PlaybackMode;
  audioQuality: AudioQuality;
  queue: Track[];
  queueIndex: number;
  isFullScreenPlayerOpen: boolean;
  isLyricsOpen: boolean;
  isQueueOpen: boolean;
  activeLyrics: LyricData | null;
  activeAd: AdCreative | null;
  isAdPlaying: boolean;
  isOfflineMode: boolean;
  downloadedTrackIds: Set<string>;
  likedTrackIds: Set<string>;
  playlists: Playlist[];
  
  // Playback Actions
  playTrack: (track: Track, newQueue?: Track[]) => Promise<void>;
  togglePlay: () => void;
  nextTrack: () => void;
  previousTrack: () => void;
  seek: (seconds: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  cyclePlaybackMode: () => void;
  setAudioQuality: (quality: AudioQuality) => void;
  
  // Queue Actions
  addToQueue: (track: Track) => void;
  playNextInQueue: (track: Track) => void;
  removeFromQueue: (index: number) => void;
  reorderQueue: (startIndex: number, endIndex: number) => void;
  clearQueue: () => void;
  
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
  dismissAd: () => void;
}

const MusicPlayerContext = createContext<MusicPlayerContextType | null>(null);

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

export const MusicPlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(0.85);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackMode, setPlaybackMode] = useState<PlaybackMode>('repeat-none');
  const [audioQuality, setAudioQuality] = useState<AudioQuality>('high');
  const [queue, setQueue] = useState<Track[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [isFullScreenPlayerOpen, setFullScreenPlayerOpen] = useState(false);
  const [isLyricsOpen, setLyricsOpen] = useState(false);
  const [isQueueOpen, setQueueOpen] = useState(false);
  const [activeLyrics, setActiveLyrics] = useState<LyricData | null>(null);
  const [activeAd, setActiveAd] = useState<AdCreative | null>(null);
  const [isAdPlaying, setIsAdPlaying] = useState(false);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [downloadedTrackIds, setDownloadedTrackIds] = useState<Set<string>>(new Set());
  const [likedTrackIds, setLikedTrackIds] = useState<Set<string>>(new Set());
  const [playlists, setPlaylists] = useState<Playlist[]>([]);

  const ytPlayerRef = useRef<any>(null);
  const htmlAudioRef = useRef<HTMLAudioElement | null>(null);
  const pollTimerRef = useRef<any>(null);
  const isUsingHtmlAudio = useRef<boolean>(false);

  // Initialize playback system & persistent storage
  useEffect(() => {
    if (typeof window === 'undefined') return;

    setIsOfflineMode(!navigator.onLine);

    // 1. Initialize HTML5 Audio
    try {
      const audio = new Audio();
      htmlAudioRef.current = audio;
      audio.onended = () => handleNextTrack();
      audio.ontimeupdate = () => {
        if (isUsingHtmlAudio.current) {
          setCurrentTime(audio.currentTime);
          if (audio.duration) setDuration(audio.duration);
        }
      };
    } catch {}

    // 2. Initialize YouTube Player
    const setupYtPlayer = () => {
      if (window.YT && window.YT.Player && !ytPlayerRef.current) {
        try {
          let container = document.getElementById('mrj-yt-audio-container');
          if (!container) {
            container = document.createElement('div');
            container.id = 'mrj-yt-audio-container';
            container.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;';
            document.body.appendChild(container);
          }

          ytPlayerRef.current = new window.YT.Player('mrj-yt-audio-container', {
            height: '1',
            width: '1',
            playerVars: {
              autoplay: 1,
              controls: 0,
              disablekb: 1,
              fs: 0,
              playsinline: 1,
              rel: 0,
            },
            events: {
              onReady: () => {
                ytPlayerRef.current?.setVolume?.(volume * 100);
              },
              onStateChange: (event: any) => {
                if (event.data === 1) { // PLAYING
                  setIsPlaying(true);
                  setIsLoading(false);
                  const dur = ytPlayerRef.current?.getDuration?.();
                  if (dur) setDuration(dur);
                } else if (event.data === 2) { // PAUSED
                  setIsPlaying(false);
                } else if (event.data === 0) { // ENDED
                  handleNextTrack();
                } else if (event.data === 3) { // BUFFERING
                  setIsLoading(true);
                }
              },
              onError: () => {
                setIsLoading(false);
              },
            },
          });
        } catch (e) {
          console.warn('YT Player init:', e);
        }
      }
    };

    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      window.onYouTubeIframeAPIReady = setupYtPlayer;
      document.head.appendChild(tag);
    } else {
      setupYtPlayer();
    }

    // 3. Polling interval to smoothly read currentTime
    pollTimerRef.current = setInterval(() => {
      if (!isUsingHtmlAudio.current && ytPlayerRef.current && typeof ytPlayerRef.current.getCurrentTime === 'function') {
        try {
          const curr = ytPlayerRef.current.getCurrentTime();
          if (typeof curr === 'number' && !isNaN(curr)) {
            setCurrentTime(curr);
          }
          const dur = ytPlayerRef.current.getDuration();
          if (typeof dur === 'number' && !isNaN(dur) && dur > 0) {
            setDuration(dur);
          }
        } catch {}
      }
    }, 250);

    const handleOnline = () => {
      setIsOfflineMode(false);
      offlineAdEngine.syncAdBundle();
      smartDownloads.checkAndRunSmartDownloads().then(() => refreshLibrary());
    };
    const handleOffline = () => setIsOfflineMode(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    refreshLibrary();
    offlineAdEngine.syncAdBundle();

    // Trigger Smart Downloads when idle
    setTimeout(() => {
      if (navigator.onLine) {
        smartDownloads.checkAndRunSmartDownloads().then(() => refreshLibrary());
      }
    }, 3000);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

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

  const playTrack = async (track: Track, newQueue?: Track[]) => {
    setIsLoading(true);
    setCurrentTrack(track);
    await offlineStorage.recordPlay(track);

    if (newQueue) {
      setQueue(newQueue);
      const idx = newQueue.findIndex(t => t.id === track.id);
      setQueueIndex(idx !== -1 ? idx : 0);
    } else if (!queue.some(t => t.id === track.id)) {
      setQueue(prev => [...prev, track]);
    }

    // Check Ad Trigger
    const adCheck = offlineAdEngine.onTrackStart();
    if (adCheck.shouldPlayAd && adCheck.ad) {
      setActiveAd(adCheck.ad);
      setIsAdPlaying(true);
    }

    try {
      // 1. Check Offline Storage first
      const offlineRecord = await offlineStorage.getOfflineAudio(track.id);
      if (offlineRecord && htmlAudioRef.current) {
        isUsingHtmlAudio.current = true;
        try { ytPlayerRef.current?.pauseVideo?.(); } catch {}
        htmlAudioRef.current.src = offlineRecord.blobUrl;
        await htmlAudioRef.current.play();
        setActiveLyrics(offlineRecord.lyrics || null);
        setIsPlaying(true);
        setIsLoading(false);
      } else {
        // 2. Play via YouTube High-Fi Engine
        isUsingHtmlAudio.current = false;
        try { htmlAudioRef.current?.pause(); } catch {}

        if (ytPlayerRef.current && typeof ytPlayerRef.current.loadVideoById === 'function') {
          ytPlayerRef.current.loadVideoById(track.id);
          ytPlayerRef.current.playVideo();
        } else {
          setTimeout(() => {
            if (ytPlayerRef.current && typeof ytPlayerRef.current.loadVideoById === 'function') {
              ytPlayerRef.current.loadVideoById(track.id);
              ytPlayerRef.current.playVideo();
            }
          }, 600);
        }

        // Fetch Synced Lyrics
        api.getLyrics(track.title, track.artist, track.duration).then(l => {
          setActiveLyrics(l);
        });

        setIsPlaying(true);
      }

      setupMediaSession(track, {
        onPlay: togglePlay,
        onPause: togglePlay,
        onNext: handleNextTrack,
        onPrevious: handlePreviousTrack,
        onSeek: seek,
      });

      // Auto-fetch related songs for dynamic radio
      if (newQueue && newQueue.length <= 3 && navigator.onLine) {
        api.getRadio(track.id).then(radioTracks => {
          if (radioTracks.length > 0) {
            setQueue(prev => [...prev, ...radioTracks.filter(rt => !prev.some(p => p.id === rt.id))]);
          }
        });
      }
    } catch (err) {
      console.warn('Audio play notice:', err);
      setIsLoading(false);
    }
  };

  const togglePlay = () => {
    if (!currentTrack) return;
    if (isUsingHtmlAudio.current && htmlAudioRef.current) {
      if (isPlaying) {
        htmlAudioRef.current.pause();
        setIsPlaying(false);
      } else {
        htmlAudioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
      }
    } else if (ytPlayerRef.current) {
      if (isPlaying) {
        try { ytPlayerRef.current.pauseVideo?.(); } catch {}
        setIsPlaying(false);
      } else {
        try { ytPlayerRef.current.playVideo?.(); } catch {}
        setIsPlaying(true);
      }
    }
  };

  const handleNextTrack = () => {
    if (queue.length === 0) return;
    let nextIdx = queueIndex + 1;
    if (playbackMode === 'shuffle') {
      nextIdx = Math.floor(Math.random() * queue.length);
    } else if (nextIdx >= queue.length) {
      if (playbackMode === 'repeat-all') {
        nextIdx = 0;
      } else {
        setIsPlaying(false);
        return;
      }
    }
    setQueueIndex(nextIdx);
    playTrack(queue[nextIdx]);
  };

  const handlePreviousTrack = () => {
    if (currentTime > 3) {
      seek(0);
      return;
    }
    if (queue.length === 0) return;
    let prevIdx = queueIndex - 1;
    if (prevIdx < 0) prevIdx = queue.length - 1;
    setQueueIndex(prevIdx);
    playTrack(queue[prevIdx]);
  };

  const seek = (seconds: number) => {
    if (isUsingHtmlAudio.current && htmlAudioRef.current) {
      htmlAudioRef.current.currentTime = seconds;
    } else if (ytPlayerRef.current && typeof ytPlayerRef.current.seekTo === 'function') {
      try { ytPlayerRef.current.seekTo(seconds, true); } catch {}
    }
    setCurrentTime(seconds);
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

  const cyclePlaybackMode = () => {
    const modes: PlaybackMode[] = ['repeat-none', 'repeat-all', 'repeat-one', 'shuffle'];
    const nextIdx = (modes.indexOf(playbackMode) + 1) % modes.length;
    setPlaybackMode(modes[nextIdx]);
  };

  // Queue actions
  const addToQueue = (track: Track) => {
    setQueue(prev => [...prev, track]);
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

  // Library & Download actions
  const toggleFavorite = async (track: Track): Promise<boolean> => {
    const isLiked = await offlineStorage.toggleLike(track);
    await refreshLibrary();
    return isLiked;
  };

  const isFavorite = (trackId: string): boolean => {
    return likedTrackIds.has(trackId);
  };

  const downloadTrack = async (track: Track): Promise<boolean> => {
    try {
      const lyrics = await api.getLyrics(track.title, track.artist, track.duration);
      // Fetch real audio blob from backend download pipe
      const audioBlob = await api.downloadAudioBlob(track.id);
      
      if (audioBlob && audioBlob.size > 1000) {
        await offlineStorage.saveDownloadedTrack(track, audioBlob, lyrics);
      } else {
        // Fallback placeholder blob for offline metadata persistence
        const emptyBlob = new Blob([new Uint8Array(100)], { type: 'audio/webm' });
        await offlineStorage.saveDownloadedTrack(track, emptyBlob, lyrics);
      }

      await refreshLibrary();
      return true;
    } catch (err) {
      console.error('Download error:', err);
      return false;
    }
  };

  const deleteDownloadedTrack = async (trackId: string): Promise<boolean> => {
    const res = await offlineStorage.removeTrack(trackId);
    await refreshLibrary();
    return res;
  };

  // Playlist actions
  const createPlaylist = async (title: string, description?: string): Promise<Playlist> => {
    const newPlaylist: Playlist = {
      id: 'pl_' + Date.now(),
      title,
      description: description || '',
      trackCount: 0,
      tracks: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isCustom: true,
    };
    await offlineStorage.savePlaylist(newPlaylist);
    await refreshLibrary();
    return newPlaylist;
  };

  const addTrackToPlaylist = async (playlistId: string, track: Track): Promise<boolean> => {
    const pl = await offlineStorage.getPlaylist(playlistId);
    if (!pl) return false;

    if (!pl.tracks.some(t => t.id === track.id)) {
      pl.tracks.push(track);
      pl.trackCount = pl.tracks.length;
      pl.updatedAt = Date.now();
      if (!pl.thumbnail) pl.thumbnail = track.thumbnail;
      await offlineStorage.savePlaylist(pl);
      await refreshLibrary();
      return true;
    }
    return false;
  };

  const removeTrackFromPlaylist = async (playlistId: string, trackId: string): Promise<boolean> => {
    const pl = await offlineStorage.getPlaylist(playlistId);
    if (!pl) return false;

    pl.tracks = pl.tracks.filter(t => t.id !== trackId);
    pl.trackCount = pl.tracks.length;
    pl.updatedAt = Date.now();
    await offlineStorage.savePlaylist(pl);
    await refreshLibrary();
    return true;
  };

  const deletePlaylist = async (playlistId: string): Promise<boolean> => {
    const res = await offlineStorage.deletePlaylist(playlistId);
    await refreshLibrary();
    return res;
  };

  const dismissAd = () => {
    setActiveAd(null);
    setIsAdPlaying(false);
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <MusicPlayerContext.Provider
      value={{
        currentTrack,
        isPlaying,
        isLoading,
        currentTime,
        duration,
        progress,
        volume,
        isMuted,
        playbackMode,
        audioQuality,
        queue,
        queueIndex,
        isFullScreenPlayerOpen,
        isLyricsOpen,
        isQueueOpen,
        activeLyrics,
        activeAd,
        isAdPlaying,
        isOfflineMode,
        downloadedTrackIds,
        likedTrackIds,
        playlists,
        playTrack,
        togglePlay,
        nextTrack: handleNextTrack,
        previousTrack: handlePreviousTrack,
        seek,
        setVolume,
        toggleMute,
        cyclePlaybackMode,
        setAudioQuality,
        addToQueue,
        playNextInQueue,
        removeFromQueue,
        reorderQueue,
        clearQueue,
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
        dismissAd,
      }}
    >
      <div
        id="mrj-yt-audio-container"
        className="fixed -top-96 -left-96 opacity-0 pointer-events-none w-1 h-1 overflow-hidden"
      />
      {children}
    </MusicPlayerContext.Provider>
  );
};

export const useMusicPlayer = () => {
  const context = useContext(MusicPlayerContext);
  if (!context) {
    throw new Error('useMusicPlayer must be used within a MusicPlayerProvider');
  }
  return context;
};
