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
  const [isOfflineMode, setIsOfflineMode] = useState(!navigator.onLine);
  const [downloadedTrackIds, setDownloadedTrackIds] = useState<Set<string>>(new Set());

  const ytPlayerRef = useRef<any>(null);
  const htmlAudioRef = useRef<HTMLAudioElement | null>(null);
  const pollTimerRef = useRef<any>(null);
  const isUsingHtmlAudio = useRef<boolean>(false);

  // Load YouTube IFrame API and HTML5 fallback audio
  useEffect(() => {
    // 1. HTML5 audio for offline downloaded playback
    const audio = new Audio();
    htmlAudioRef.current = audio;

    audio.onended = () => handleNextTrack();
    audio.ontimeupdate = () => {
      if (isUsingHtmlAudio.current) {
        setCurrentTime(audio.currentTime);
        if (audio.duration) setDuration(audio.duration);
      }
    };

    // 2. Load YouTube IFrame API Script
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag);
    }

    const initYt = () => {
      if (window.YT && window.YT.Player) {
        const container = document.getElementById('mrj-yt-audio-container');
        if (container && !ytPlayerRef.current) {
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
                ytPlayerRef.current?.setVolume(volume * 100);
              },
              onStateChange: (event: any) => {
                if (event.data === window.YT.PlayerState.PLAYING) {
                  setIsPlaying(true);
                  setIsLoading(false);
                  const dur = ytPlayerRef.current?.getDuration();
                  if (dur) setDuration(dur);
                } else if (event.data === window.YT.PlayerState.PAUSED) {
                  setIsPlaying(false);
                } else if (event.data === window.YT.PlayerState.ENDED) {
                  handleNextTrack();
                } else if (event.data === window.YT.PlayerState.BUFFERING) {
                  setIsLoading(true);
                }
              },
              onError: () => {
                setIsLoading(false);
              },
            },
          });
        }
      }
    };

    window.onYouTubeIframeAPIReady = initYt;
    if (window.YT && window.YT.Player) initYt();

    // 3. Polling interval to smoothly update currentTime from YouTube Player
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

    // Online / Offline Detection
    const handleOnline = () => {
      setIsOfflineMode(false);
      offlineAdEngine.syncAdBundle();
    };
    const handleOffline = () => setIsOfflineMode(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    refreshDownloadedIds();
    offlineAdEngine.syncAdBundle();

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const refreshDownloadedIds = async () => {
    const tracks = await offlineStorage.getAllDownloadedTracks();
    setDownloadedTrackIds(new Set(tracks.map(t => t.id)));
  };

  // Play a track
  const playTrack = async (track: Track, newQueue?: Track[]) => {
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

    // Check offline/online ad trigger
    const adCheck = offlineAdEngine.onTrackStart();
    if (adCheck.shouldPlayAd && adCheck.ad) {
      setActiveAd(adCheck.ad);
      setIsAdPlaying(true);
    }

    try {
      // 1. Check if track is saved in Offline Storage
      const offlineRecord = await offlineStorage.getOfflineAudio(track.id);
      if (offlineRecord && htmlAudioRef.current) {
        isUsingHtmlAudio.current = true;
        ytPlayerRef.current?.pauseVideo?.();
        htmlAudioRef.current.src = offlineRecord.blobUrl;
        await htmlAudioRef.current.play();
        setActiveLyrics(offlineRecord.lyrics || null);
        setIsPlaying(true);
        setIsLoading(false);
      } else {
        // 2. Play via YouTube High-Fi Engine
        isUsingHtmlAudio.current = false;
        htmlAudioRef.current?.pause();

        if (ytPlayerRef.current && typeof ytPlayerRef.current.loadVideoById === 'function') {
          ytPlayerRef.current.loadVideoById(track.id);
          ytPlayerRef.current.playVideo();
        }

        // Fetch Synced Lyrics
        api.getLyrics(track.title, track.artist, track.duration).then(l => {
          setActiveLyrics(l);
        });

        setIsPlaying(true);
      }

      // Lock-Screen MediaSession Integration
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
      console.error('Audio play error:', err);
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
        ytPlayerRef.current.pauseVideo?.();
        setIsPlaying(false);
      } else {
        ytPlayerRef.current.playVideo?.();
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
      ytPlayerRef.current.seekTo(seconds, true);
    }
    setCurrentTime(seconds);
  };

  const setVolume = (val: number) => {
    setVolumeState(val);
    if (htmlAudioRef.current) htmlAudioRef.current.volume = val;
    if (ytPlayerRef.current && typeof ytPlayerRef.current.setVolume === 'function') {
      ytPlayerRef.current.setVolume(val * 100);
    }
    if (val > 0 && isMuted) setIsMuted(false);
  };

  const toggleMute = () => {
    const nextMute = !isMuted;
    setIsMuted(nextMute);
    if (htmlAudioRef.current) htmlAudioRef.current.muted = nextMute;
    if (ytPlayerRef.current) {
      if (nextMute) ytPlayerRef.current.mute?.();
      else ytPlayerRef.current.unMute?.();
    }
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
      const lyrics = await api.getLyrics(track.title, track.artist, track.duration);
      // Sample high-quality offline audio blob for offline mode
      const streamUrl = 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=lofi-study-112191.mp3';
      await offlineStorage.downloadAndSaveTrack(track, streamUrl, lyrics);
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
      {/* Hidden YouTube Audio Stream Container */}
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
