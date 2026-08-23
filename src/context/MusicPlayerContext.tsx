import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Track, LyricData, AdCreative, PlaybackMode, AudioQuality } from '../types';
import { api } from '../services/api';
import { offlineStorage } from '../services/offlineStorage';
import { offlineAdEngine } from '../services/offlineAdEngine';
import { recommendationEngine } from '../services/recommendationEngine';
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
  
  // Actions
  playTrack: (track: Track, newQueue?: Track[]) => Promise<void>;
  togglePlay: () => void;
  nextTrack: () => void;
  previousTrack: () => void;
  seek: (seconds: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  cyclePlaybackMode: () => void;
  setAudioQuality: (quality: AudioQuality) => void;
  addToQueue: (track: Track) => void;
  removeFromQueue: (index: number) => void;
  toggleFavorite: (track: Track) => void;
  isFavorite: (trackId: string) => boolean;
  downloadTrack: (track: Track) => Promise<boolean>;
  deleteDownloadedTrack: (trackId: string) => Promise<boolean>;
  setFullScreenPlayerOpen: (open: boolean) => void;
  setLyricsOpen: (open: boolean) => void;
  setQueueOpen: (open: boolean) => void;
  dismissAd: () => void;
}

const MusicPlayerContext = createContext<MusicPlayerContextType | null>(null);

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
  const [isOfflineMode, setIsOfflineMode] = useState(!navigator.onLine);
  const [downloadedTrackIds, setDownloadedTrackIds] = useState<Set<string>>(new Set());

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize HTML5 Audio element and online/offline listeners
  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'auto';
    audioRef.current = audio;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      if (audio.duration) {
        setDuration(audio.duration);
      }
    };

    const handleLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration)) {
        setDuration(audio.duration);
      }
      setIsLoading(false);
    };

    const handleWaiting = () => setIsLoading(true);
    const handleCanPlay = () => setIsLoading(false);

    const handleEnded = () => {
      if (playbackMode === 'repeat-one') {
        audio.currentTime = 0;
        audio.play();
      } else {
        handleNextTrack();
      }
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('waiting', handleWaiting);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('ended', handleEnded);

    // Online / Offline Detection
    const handleOnline = () => {
      setIsOfflineMode(false);
      offlineAdEngine.syncAdBundle();
    };
    const handleOffline = () => setIsOfflineMode(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Load initial offline tracks list
    refreshDownloadedIds();
    offlineAdEngine.syncAdBundle();

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('waiting', handleWaiting);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('ended', handleEnded);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [playbackMode]);

  const refreshDownloadedIds = async () => {
    const tracks = await offlineStorage.getAllDownloadedTracks();
    setDownloadedTrackIds(new Set(tracks.map(t => t.id)));
  };

  // Play a track (Online streaming or Offline local blob)
  const playTrack = async (track: Track, newQueue?: Track[]) => {
    if (!audioRef.current) return;
    setIsLoading(true);
    setCurrentTrack(track);
    recommendationEngine.recordPlay(track);

    if (newQueue) {
      setQueue(newQueue);
      const idx = newQueue.findIndex(t => t.id === track.id);
      setQueueIndex(idx !== -1 ? idx : 0);
    } else if (!queue.some(t => t.id === track.id)) {
      setQueue(prev => [...prev, track]);
    }

    // Check offline ad trigger
    const adCheck = offlineAdEngine.onTrackStart();
    if (adCheck.shouldPlayAd && adCheck.ad) {
      setActiveAd(adCheck.ad);
      setIsAdPlaying(true);
    }

    try {
      let playbackUrl = '';
      let lyricsData: LyricData | null = null;

      // 1. Check if track is saved in Offline Storage
      const offlineRecord = await offlineStorage.getOfflineAudio(track.id);
      if (offlineRecord) {
        playbackUrl = offlineRecord.blobUrl;
        lyricsData = offlineRecord.lyrics || null;
      } else {
        // 2. Fetch live stream URL from backend API
        const streamInfo = await api.getStreamUrl(track.id);
        playbackUrl = streamInfo.streamUrl;
      }

      // Fetch lyrics if online and not in offline storage
      if (!lyricsData && navigator.onLine) {
        api.getLyrics(track.title, track.artist, track.duration).then(l => {
          setActiveLyrics(l);
        });
      } else {
        setActiveLyrics(lyricsData);
      }

      audioRef.current.src = playbackUrl;
      await audioRef.current.play();
      setIsPlaying(true);
      setIsLoading(false);

      // Lock Screen & MediaSession integration
      setupMediaSession(track, {
        onPlay: togglePlay,
        onPause: togglePlay,
        onNext: handleNextTrack,
        onPrevious: handlePreviousTrack,
        onSeek: seek,
      });

      // Auto-fetch related songs for dynamic radio if queue is ending
      if (newQueue && newQueue.length <= 3 && navigator.onLine) {
        api.getRadio(track.id).then(radioTracks => {
          if (radioTracks.length > 0) {
            setQueue(prev => [...prev, ...radioTracks.filter(rt => !prev.some(p => p.id === rt.id))]);
          }
        });
      }
    } catch (err) {
      console.error('Audio play error:', err);
      setIsLoading(false);
      setIsPlaying(false);
    }
  };

  const togglePlay = () => {
    if (!audioRef.current || !currentTrack) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
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
    if (!audioRef.current) return;
    if (audioRef.current.currentTime > 3) {
      audioRef.current.currentTime = 0;
      return;
    }
    if (queue.length === 0) return;
    let prevIdx = queueIndex - 1;
    if (prevIdx < 0) {
      prevIdx = queue.length - 1;
    }
    setQueueIndex(prevIdx);
    playTrack(queue[prevIdx]);
  };

  const seek = (seconds: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = seconds;
    setCurrentTime(seconds);
  };

  const setVolume = (val: number) => {
    if (!audioRef.current) return;
    audioRef.current.volume = val;
    setVolumeState(val);
    if (val > 0 && isMuted) {
      setIsMuted(false);
      audioRef.current.muted = false;
    }
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    const nextMute = !isMuted;
    audioRef.current.muted = nextMute;
    setIsMuted(nextMute);
  };

  const cyclePlaybackMode = () => {
    const modes: PlaybackMode[] = ['repeat-none', 'repeat-all', 'repeat-one', 'shuffle'];
    const nextIdx = (modes.indexOf(playbackMode) + 1) % modes.length;
    setPlaybackMode(modes[nextIdx]);
  };

  const addToQueue = (track: Track) => {
    setQueue(prev => [...prev, track]);
  };

  const removeFromQueue = (index: number) => {
    setQueue(prev => prev.filter((_, i) => i !== index));
  };

  const toggleFavorite = (track: Track) => {
    recommendationEngine.toggleLike(track);
  };

  const isFavorite = (trackId: string) => {
    return recommendationEngine.isLiked(trackId);
  };

  // Download track for offline listening
  const downloadTrack = async (track: Track): Promise<boolean> => {
    try {
      const streamInfo = await api.getStreamUrl(track.id);
      const lyrics = await api.getLyrics(track.title, track.artist, track.duration);
      await offlineStorage.downloadAndSaveTrack(track, streamInfo.streamUrl, lyrics);
      await refreshDownloadedIds();
      return true;
    } catch (err) {
      console.error('Download failed:', err);
      return false;
    }
  };

  const deleteDownloadedTrack = async (trackId: string): Promise<boolean> => {
    const res = await offlineStorage.removeTrack(trackId);
    await refreshDownloadedIds();
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
        removeFromQueue,
        toggleFavorite,
        isFavorite,
        downloadTrack,
        deleteDownloadedTrack,
        setFullScreenPlayerOpen,
        setLyricsOpen,
        setQueueOpen,
        dismissAd,
      }}
    >
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
