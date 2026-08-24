import React, { useState, useEffect } from 'react';
import {
  ChevronDown,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Repeat,
  Repeat1,
  Shuffle,
  Heart,
  Download,
  Check,
  Loader2,
  ListMusic,
  Share2,
  Trash2,
  Sliders,
  Video,
  Music,
  MoreVertical,
  Volume2,
  VolumeX,
  Radio,
  Sparkles
} from 'lucide-react';
import { useMusicPlayer } from '../context/MusicPlayerContext';
import { SyncedLyrics } from './SyncedLyrics';
import { TuneMixModal } from './TuneMixModal';
import { TrackContextMenu } from './TrackContextMenu';
import { ArtworkImage } from './ArtworkImage';
import { AudioVisualizer } from './AudioVisualizer';
import { androidLifecycleService } from '../services/androidLifecycleService';
import { api } from '../services/api';
import { Track } from '../types';

export const FullScreenPlayer: React.FC = () => {
  const {
    currentTrack,
    isPlaying,
    isLoading,
    currentTime,
    duration,
    playbackFormat,
    togglePlaybackFormat,
    shuffleEnabled,
    repeatMode,
    queue,
    queueIndex,
    isFullScreenPlayerOpen,
    setFullScreenPlayerOpen,
    isTuneModalOpen,
    setTuneModalOpen,
    activeLyrics,
    togglePlay,
    nextTrack,
    previousTrack,
    seek,
    toggleShuffle,
    cycleRepeatMode,
    toggleFavorite,
    isFavorite,
    downloadTrack,
    deleteDownloadedTrack,
    downloadedTrackIds,
    playTrack,
    removeFromQueue,
    clearQueue,
  } = useMusicPlayer();

  const [activeTab, setActiveTab] = useState<'queue' | 'lyrics' | 'related'>('queue');
  const [isDownloading, setIsDownloading] = useState(false);
  const [relatedTracks, setRelatedTracks] = useState<Track[]>([]);
  const [isLoadingRelated, setIsLoadingRelated] = useState(false);

  // Android hardware back button integration
  useEffect(() => {
    if (!isFullScreenPlayerOpen) return;
    const unregister = androidLifecycleService.registerBackHandler(() => {
      setFullScreenPlayerOpen(false);
      return true;
    });
    return () => unregister();
  }, [isFullScreenPlayerOpen, setFullScreenPlayerOpen]);

  // Fetch related tracks when currentTrack changes
  useEffect(() => {
    if (currentTrack && activeTab === 'related') {
      setIsLoadingRelated(true);
      api.getRelatedTracks(currentTrack.id, currentTrack.artist, currentTrack.genre, currentTrack.title)
        .then((tracks) => setRelatedTracks(tracks))
        .catch(() => setRelatedTracks([]))
        .finally(() => setIsLoadingRelated(false));
    }
  }, [currentTrack, activeTab]);

  if (!isFullScreenPlayerOpen || !currentTrack) return null;

  const isDownloaded = downloadedTrackIds.has(currentTrack.id);
  const isLiked = isFavorite(currentTrack.id);

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '0:00';
    const minutes = Math.floor(secs / 60);
    const seconds = Math.floor(secs % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const handleDownloadToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDownloading(true);
    try {
      if (isDownloaded) {
        await deleteDownloadedTrack(currentTrack.id);
      } else {
        await downloadTrack(currentTrack);
      }
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#060608] text-white flex flex-col justify-between select-none overflow-hidden animate-in fade-in slide-in-from-bottom duration-300"
      style={{
        paddingTop: 'max(var(--sat), 12px)',
        paddingBottom: 'max(var(--sab), 16px)',
      }}
    >
      {/* 1. DYNAMIC MULTI-LAYER AMBIENT GLOW BACKDROP */}
      <div
        className="absolute inset-0 opacity-30 blur-[120px] scale-125 pointer-events-none transition-all duration-1000"
        style={{
          backgroundImage: `radial-gradient(circle at 50% 35%, #ff0000 0%, transparent 65%), url(${currentTrack.thumbnail})`,
          backgroundPosition: 'center',
          backgroundSize: 'cover',
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-[#060608]/90 pointer-events-none" />

      {/* 2. TOP BAR */}
      <header className="relative z-10 px-4 py-2 flex items-center justify-between">
        <button
          onClick={() => setFullScreenPlayerOpen(false)}
          className="p-2.5 rounded-full bg-white/5 hover:bg-white/10 active:scale-95 transition-all text-[#aaaaaa] hover:text-white min-w-[44px] min-h-[44px] flex items-center justify-center backdrop-blur-md border border-white/5 shadow-sm"
          aria-label="Collapse player"
        >
          <ChevronDown className="w-6 h-6" />
        </button>

        {/* Audio / Video Toggle Pill */}
        <div className="flex items-center bg-[#141418]/80 backdrop-blur-md border border-white/10 rounded-full p-1 shadow-inner">
          <button
            onClick={() => playbackFormat !== 'audio' && togglePlaybackFormat()}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all ${
              playbackFormat === 'audio'
                ? 'bg-white text-black shadow-md'
                : 'text-[#888888] hover:text-white'
            }`}
          >
            <Music className="w-3.5 h-3.5" />
            <span>Song</span>
          </button>
          <button
            onClick={() => playbackFormat !== 'video' && togglePlaybackFormat()}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all ${
              playbackFormat === 'video'
                ? 'bg-white text-black shadow-md'
                : 'text-[#888888] hover:text-white'
            }`}
          >
            <Video className="w-3.5 h-3.5" />
            <span>Video</span>
          </button>
        </div>

        {/* Tune Mix & Actions */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setTuneModalOpen(true)}
            className="p-2.5 rounded-full bg-white/5 hover:bg-white/10 text-[#aaaaaa] hover:text-white min-w-[44px] min-h-[44px] flex items-center justify-center transition-all active:scale-95 backdrop-blur-md border border-white/5 shadow-sm"
            title="Tune Mix"
          >
            <Sliders className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* 3. MAIN CENTER: ARTWORK, LIVE SPECTRUM & CONTROLS */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 max-w-lg mx-auto w-full min-h-0">
        {/* Animated Artwork Container with Dynamic Drop Shadow */}
        <div className="relative group my-auto">
          <div
            className={`w-full aspect-square max-w-[300px] sm:max-w-[340px] rounded-3xl overflow-hidden shadow-2xl bg-[#141416] border border-white/10 transition-all duration-500 ${
              isPlaying ? 'scale-[1.02] shadow-[0_20px_50px_rgba(255,0,0,0.3)]' : 'scale-95 shadow-black/80'
            }`}
          >
            <ArtworkImage
              src={currentTrack.thumbnail}
              alt={currentTrack.title}
              className="w-full h-full object-cover shadow-inner"
            />
          </div>
        </div>

        {/* Track Title & Artist */}
        <div className="w-full mt-4 mb-1 flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-xl sm:text-2xl font-black text-white truncate tracking-tight">
              {currentTrack.title}
            </h2>
            <p className="text-sm sm:text-base text-[#aaaaaa] font-medium truncate mt-0.5">
              {currentTrack.artist}
            </p>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => toggleFavorite(currentTrack)}
              className={`p-2.5 rounded-full hover:bg-white/10 active:scale-90 transition-all min-w-[44px] min-h-[44px] flex items-center justify-center ${
                isLiked ? 'text-[#ff0000]' : 'text-[#888888] hover:text-white'
              }`}
              aria-label="Favorite track"
            >
              <Heart className={`w-6 h-6 ${isLiked ? 'fill-current' : ''}`} />
            </button>

            <button
              onClick={handleDownloadToggle}
              disabled={isDownloading}
              className={`p-2.5 rounded-full hover:bg-white/10 active:scale-90 transition-all min-w-[44px] min-h-[44px] flex items-center justify-center ${
                isDownloaded ? 'text-emerald-400' : 'text-[#888888] hover:text-white'
              }`}
              aria-label="Download track"
            >
              {isDownloading ? (
                <Loader2 className="w-6 h-6 animate-spin text-[#ff0000]" />
              ) : isDownloaded ? (
                <Check className="w-6 h-6 text-emerald-400" />
              ) : (
                <Download className="w-6 h-6" />
              )}
            </button>

            <TrackContextMenu track={currentTrack} />
          </div>
        </div>

        {/* Live Audio Visualizer Spectrum */}
        <div className="w-full flex justify-center py-1">
          <AudioVisualizer isPlaying={isPlaying} barCount={26} />
        </div>

        {/* Progress Scrubber */}
        <div className="w-full mt-2">
          <div className="relative group">
            <input
              type="range"
              min={0}
              max={duration || 1}
              step={0.1}
              value={currentTime}
              onChange={(e) => seek(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-[#252528] rounded-full appearance-none cursor-pointer accent-[#ff0000] focus:outline-none"
            />
          </div>
          <div className="flex justify-between text-xs text-[#888888] font-mono mt-1">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Playback Controls with 60fps Micro-interactions */}
        <div className="w-full flex items-center justify-between mt-3 px-2">
          {/* Shuffle */}
          <button
            onClick={toggleShuffle}
            className={`p-3 rounded-full min-w-[48px] min-h-[48px] flex items-center justify-center transition-colors active:scale-90 ${
              shuffleEnabled ? 'text-[#ff0000]' : 'text-[#888888] hover:text-white'
            }`}
            aria-label="Toggle shuffle"
          >
            <Shuffle className="w-5 h-5" />
          </button>

          {/* Previous */}
          <button
            onClick={previousTrack}
            className="p-3 text-white hover:text-[#ff4e4e] active:scale-90 transition-all min-w-[48px] min-h-[48px] flex items-center justify-center"
            aria-label="Previous track"
          >
            <SkipBack className="w-7 h-7 fill-current" />
          </button>

          {/* Large Circular Play / Pause Button */}
          <button
            onClick={togglePlay}
            className="w-16 h-16 rounded-full bg-gradient-to-tr from-white via-zinc-100 to-white text-black flex items-center justify-center shadow-[0_10px_25px_rgba(255,255,255,0.25)] active:scale-95 hover:scale-105 transition-all"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isLoading ? (
              <Loader2 className="w-8 h-8 animate-spin text-black" />
            ) : isPlaying ? (
              <Pause className="w-8 h-8 fill-current" />
            ) : (
              <Play className="w-8 h-8 fill-current ml-1" />
            )}
          </button>

          {/* Next */}
          <button
            onClick={nextTrack}
            className="p-3 text-white hover:text-[#ff4e4e] active:scale-90 transition-all min-w-[48px] min-h-[48px] flex items-center justify-center"
            aria-label="Next track"
          >
            <SkipForward className="w-7 h-7 fill-current" />
          </button>

          {/* Repeat */}
          <button
            onClick={cycleRepeatMode}
            className={`p-3 rounded-full min-w-[48px] min-h-[48px] flex items-center justify-center transition-colors active:scale-90 ${
              repeatMode !== 'off' ? 'text-[#ff0000]' : 'text-[#888888] hover:text-white'
            }`}
            aria-label={`Repeat mode: ${repeatMode}`}
          >
            {repeatMode === 'one' ? <Repeat1 className="w-5 h-5" /> : <Repeat className="w-5 h-5" />}
          </button>
        </div>
      </main>

      {/* 4. 3-TAB DRAWER (UP NEXT / LYRICS / RELATED) */}
      <footer className="relative z-10 max-w-lg mx-auto w-full px-4 mt-2">
        {/* Tab Headers */}
        <div className="flex items-center justify-around border-b border-[#202024] pb-2">
          {(['queue', 'lyrics', 'related'] as const).map((tab) => {
            const isActive = activeTab === tab;
            const labels = { queue: 'UP NEXT', lyrics: 'LYRICS', related: 'RELATED' };
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`text-xs font-bold tracking-wider py-1.5 transition-colors relative ${
                  isActive ? 'text-white' : 'text-[#717171] hover:text-[#aaaaaa]'
                }`}
              >
                {labels[tab]}
                {isActive && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#ff0000] rounded-full" />
                )}
              </button>
            );
          })}
        </div>

        {/* Tab Content Panel (Scrollable) */}
        <div className="h-44 overflow-y-auto no-scrollbar pt-2 pb-1">
          {/* TAB 1: UP NEXT QUEUE */}
          {activeTab === 'queue' && (
            <div className="space-y-1">
              {queue.map((track, idx) => {
                const isCurrent = idx === queueIndex;
                return (
                  <div
                    key={`${track.id}-${idx}`}
                    onClick={() => playTrack(track, queue)}
                    className={`flex items-center gap-3 p-2 rounded-xl cursor-pointer transition-colors ${
                      isCurrent ? 'bg-[#1e1e24] text-white' : 'hover:bg-white/5 text-[#aaaaaa]'
                    }`}
                  >
                    <span className="text-xs font-mono w-4 text-center text-[#717171]">
                      {isCurrent ? <Play className="w-3 h-3 text-[#ff0000] fill-current" /> : idx + 1}
                    </span>
                    <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0 bg-[#1e1e22]">
                      <ArtworkImage src={track.thumbnail} alt={track.title} className="w-full h-full object-cover" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`text-xs font-bold truncate ${isCurrent ? 'text-[#ff4e4e]' : 'text-white'}`}>
                        {track.title}
                      </p>
                      <p className="text-[11px] text-[#717171] truncate">{track.artist}</p>
                    </div>
                    {queue.length > 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFromQueue(idx);
                        }}
                        className="p-1.5 text-[#717171] hover:text-white rounded-full hover:bg-white/10"
                        title="Remove from queue"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB 2: SYNCED LYRICS */}
          {activeTab === 'lyrics' && (
            <div className="h-full flex items-center justify-center p-2 text-center overflow-y-auto no-scrollbar max-h-36">
              {activeLyrics ? (
                <SyncedLyrics
                  lyricsData={activeLyrics}
                  currentTime={currentTime}
                  onLineClick={seek}
                />
              ) : (
                <p className="text-xs text-[#717171] italic">Lyrics not available for this song.</p>
              )}
            </div>
          )}

          {/* TAB 3: RELATED / RECOMMENDATIONS */}
          {activeTab === 'related' && (
            <div className="space-y-1">
              {isLoadingRelated ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="w-5 h-5 text-[#ff0000] animate-spin" />
                </div>
              ) : relatedTracks.length > 0 ? (
                relatedTracks.map((track) => (
                  <div
                    key={track.id}
                    onClick={() => playTrack(track)}
                    className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 cursor-pointer transition-colors"
                  >
                    <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0 bg-[#1e1e22]">
                      <ArtworkImage src={track.thumbnail} alt={track.title} className="w-full h-full object-cover" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-white truncate">{track.title}</p>
                      <p className="text-[11px] text-[#717171] truncate">{track.artist}</p>
                    </div>
                    <Play className="w-3.5 h-3.5 text-[#717171] group-hover:text-white" />
                  </div>
                ))
              ) : (
                <p className="text-xs text-[#717171] text-center py-4">No related tracks found.</p>
              )}
            </div>
          )}
        </div>
      </footer>

      {/* Tune Mix Modal */}
      {isTuneModalOpen && (
        <TuneMixModal
          isOpen={isTuneModalOpen}
          onClose={() => setTuneModalOpen(false)}
        />
      )}
    </div>
  );
};
