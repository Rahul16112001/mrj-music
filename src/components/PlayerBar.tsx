import React, { useState } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Repeat,
  Repeat1,
  Shuffle,
  Mic2,
  ListMusic,
  Maximize2,
  Download,
  Check,
  Heart,
  Loader2,
  Radio
} from 'lucide-react';
import { useMusicPlayer } from '../context/MusicPlayerContext';
import { ArtworkImage } from './ArtworkImage';
import { AudioVisualizer } from './AudioVisualizer';

export const PlayerBar: React.FC = () => {
  const {
    currentTrack,
    isPlaying,
    isLoading,
    currentTime,
    duration,
    progress,
    volume,
    isMuted,
    shuffleEnabled,
    repeatMode,
    downloadedTrackIds,
    togglePlay,
    nextTrack,
    previousTrack,
    seek,
    setVolume,
    toggleMute,
    toggleShuffle,
    cycleRepeatMode,
    setFullScreenPlayerOpen,
    isLyricsOpen,
    setLyricsOpen,
    isQueueOpen,
    setQueueOpen,
    toggleFavorite,
    isFavorite,
    downloadTrack,
    deleteDownloadedTrack,
  } = useMusicPlayer();

  const [isHoveringScrubber, setIsHoveringScrubber] = useState(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  if (!currentTrack) return null;

  const isDownloaded = downloadedTrackIds.has(currentTrack.id);
  const isLiked = isFavorite(currentTrack.id);

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '0:00';
    const minutes = Math.floor(secs / 60);
    const seconds = Math.floor(secs % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const handleScrub = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    seek(percent * duration);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setHoverTime(percent * duration);
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
    <>
      {/* ========================================================================= */}
      {/* 1. MOBILE MINI PLAYER (Rendered directly above BottomNav on mobile)       */}
      {/* ========================================================================= */}
      <div
        className="lg:hidden fixed left-2 right-2 z-30 bg-[#0e0e12]/90 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.6)] overflow-hidden select-none cursor-pointer transition-all duration-300 active:scale-[0.99]"
        style={{ bottom: 'calc(56px + max(var(--sab), 6px) + 6px)' }}
        onClick={() => setFullScreenPlayerOpen(true)}
      >
        {/* Progress Line */}
        <div className="w-full h-1 bg-[#1e1e24] relative">
          <div
            className="h-full bg-gradient-to-r from-red-600 via-rose-500 to-red-600 transition-all duration-150 shadow-[0_0_8px_rgba(255,0,0,0.8)]"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Mini Player Row */}
        <div className="flex items-center justify-between p-2 gap-3 h-14">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 bg-[#1e1e24] shadow-md border border-white/5 relative">
              <ArtworkImage
                src={currentTrack.thumbnail}
                alt={currentTrack.title}
                className="w-full h-full object-cover"
              />
              {isPlaying && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <div className="flex items-end gap-0.5 h-3">
                    <span className="w-0.5 bg-white animate-pulse h-full" />
                    <span className="w-0.5 bg-white animate-pulse h-2" style={{ animationDelay: '0.2s' }} />
                    <span className="w-0.5 bg-white animate-pulse h-3" style={{ animationDelay: '0.4s' }} />
                  </div>
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-xs font-bold text-white truncate">
                {currentTrack.title}
              </h4>
              <p className="text-[11px] text-[#999999] truncate">
                {currentTrack.artist}
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => toggleFavorite(currentTrack)}
              className={`p-2 rounded-full min-w-[40px] min-h-[40px] flex items-center justify-center transition-colors active:scale-90 ${
                isLiked ? 'text-[#ff0000]' : 'text-[#888888] hover:text-white'
              }`}
              aria-label="Like track"
            >
              <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
            </button>

            <button
              onClick={togglePlay}
              className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center shadow-lg active:scale-90 hover:scale-105 transition-transform"
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-black" />
              ) : isPlaying ? (
                <Pause className="w-4 h-4 fill-current" />
              ) : (
                <Play className="w-4 h-4 fill-current ml-0.5" />
              )}
            </button>

            <button
              onClick={nextTrack}
              className="p-2 text-[#888888] hover:text-white min-w-[40px] min-h-[40px] flex items-center justify-center transition-colors active:scale-90"
              aria-label="Next track"
            >
              <SkipForward className="w-4 h-4 fill-current" />
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. DESKTOP PLAYER BAR (Fixed at bottom on desktop screens >= lg)           */}
      {/* ========================================================================= */}
      <div className="hidden lg:block fixed bottom-0 left-0 right-0 z-50 bg-[#09090c]/90 backdrop-blur-2xl border-t border-white/10 select-none shadow-[0_-10px_40px_rgba(0,0,0,0.7)]">
        {/* Scrubber right on top edge */}
        <div
          className="relative h-1.5 hover:h-2.5 bg-[#1e1e24] cursor-pointer transition-all group"
          onClick={handleScrub}
          onMouseEnter={() => setIsHoveringScrubber(true)}
          onMouseLeave={() => {
            setIsHoveringScrubber(false);
            setHoverTime(null);
          }}
          onMouseMove={handleMouseMove}
        >
          <div
            className="h-full bg-gradient-to-r from-red-600 via-rose-500 to-red-500 relative shadow-[0_0_10px_rgba(255,0,0,0.9)]"
            style={{ width: `${progress}%` }}
          >
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white border-2 border-[#ff0000] rounded-full scale-0 group-hover:scale-100 transition-transform shadow-lg" />
          </div>

          {isHoveringScrubber && hoverTime !== null && (
            <div
              className="absolute bottom-3.5 -translate-x-1/2 px-2.5 py-1 bg-[#18181b] border border-white/20 rounded-lg text-[11px] font-bold text-white shadow-2xl pointer-events-none"
              style={{ left: `${(hoverTime / duration) * 100}%` }}
            >
              {formatTime(hoverTime)}
            </div>
          )}
        </div>

        {/* Desktop Player Body */}
        <div className="h-20 px-8 flex items-center justify-between gap-6">
          {/* Left: Track Information */}
          <div className="flex items-center gap-4 min-w-0 max-w-sm">
            <div
              onClick={() => setFullScreenPlayerOpen(true)}
              className="relative w-14 h-14 rounded-xl overflow-hidden shrink-0 group cursor-pointer shadow-lg bg-[#18181b] border border-white/10"
            >
              <ArtworkImage
                src={currentTrack.thumbnail}
                alt={currentTrack.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity backdrop-blur-sm">
                <Maximize2 className="w-5 h-5 text-white" />
              </div>
            </div>

            <div className="min-w-0">
              <h4
                onClick={() => setFullScreenPlayerOpen(true)}
                className="text-sm font-black text-white truncate cursor-pointer hover:underline tracking-tight"
              >
                {currentTrack.title}
              </h4>
              <p className="text-xs text-[#8e8e93] font-medium truncate hover:text-white cursor-pointer transition-colors mt-0.5">
                {currentTrack.artist}
              </p>
            </div>

            {/* Like / Download */}
            <div className="flex items-center gap-1 shrink-0 ml-2">
              <button
                onClick={() => toggleFavorite(currentTrack)}
                className={`p-2 rounded-full hover:bg-white/10 active:scale-90 transition-all ${
                  isLiked ? 'text-[#ff0000]' : 'text-[#8e8e93] hover:text-white'
                }`}
                title="Like"
              >
                <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
              </button>

              <button
                onClick={handleDownloadToggle}
                disabled={isDownloading}
                className={`p-2 rounded-full hover:bg-white/10 active:scale-90 transition-all ${
                  isDownloaded ? 'text-emerald-400' : 'text-[#8e8e93] hover:text-white'
                }`}
                title={isDownloaded ? 'Saved Offline' : 'Download for Offline'}
              >
                {isDownloading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-[#ff0000]" />
                ) : isDownloaded ? (
                  <Check className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Center: Playback Controls & Waveform */}
          <div className="flex flex-col items-center gap-1.5 flex-1 max-w-lg">
            <div className="flex items-center gap-6">
              <button
                onClick={toggleShuffle}
                className={`p-2 transition-colors active:scale-90 ${
                  shuffleEnabled ? 'text-[#ff0000]' : 'text-[#8e8e93] hover:text-white'
                }`}
                title="Shuffle (S)"
              >
                <Shuffle className="w-4 h-4" />
              </button>

              <button
                onClick={previousTrack}
                className="p-2 text-white hover:text-[#ff4e4e] active:scale-90 transition-all"
                title="Previous (J)"
              >
                <SkipBack className="w-5 h-5 fill-current" />
              </button>

              <button
                onClick={togglePlay}
                className="w-11 h-11 rounded-full bg-gradient-to-tr from-white via-zinc-100 to-white text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-[0_4px_16px_rgba(255,255,255,0.3)]"
                title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin text-black" />
                ) : isPlaying ? (
                  <Pause className="w-5 h-5 fill-current" />
                ) : (
                  <Play className="w-5 h-5 fill-current ml-0.5" />
                )}
              </button>

              <button
                onClick={nextTrack}
                className="p-2 text-white hover:text-[#ff4e4e] active:scale-90 transition-all"
                title="Next (K)"
              >
                <SkipForward className="w-5 h-5 fill-current" />
              </button>

              <button
                onClick={cycleRepeatMode}
                className={`p-2 transition-colors active:scale-90 ${
                  repeatMode !== 'off' ? 'text-[#ff0000]' : 'text-[#8e8e93] hover:text-white'
                }`}
                title={`Repeat: ${repeatMode}`}
              >
                {repeatMode === 'one' ? <Repeat1 className="w-4 h-4" /> : <Repeat className="w-4 h-4" />}
              </button>
            </div>

            <div className="w-full flex items-center gap-3 text-[11px] text-[#8e8e93] font-mono">
              <span className="w-9 text-right">{formatTime(currentTime)}</span>
              <div className="flex-1 h-1 bg-[#1e1e24] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-red-600 to-rose-500 rounded-full"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="w-9 text-left">{formatTime(duration)}</span>
            </div>
          </div>

          {/* Right: Panels & Volume Slider */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setLyricsOpen(!isLyricsOpen);
                if (!isLyricsOpen) setQueueOpen(false);
              }}
              className={`p-2 rounded-full hover:bg-white/10 transition-colors ${
                isLyricsOpen ? 'text-[#ff0000]' : 'text-[#8e8e93] hover:text-white'
              }`}
              title="Lyrics"
            >
              <Mic2 className="w-4 h-4" />
            </button>

            <button
              onClick={() => {
                setQueueOpen(!isQueueOpen);
                if (!isQueueOpen) setLyricsOpen(false);
              }}
              className={`p-2 rounded-full hover:bg-white/10 transition-colors ${
                isQueueOpen ? 'text-[#ff0000]' : 'text-[#8e8e93] hover:text-white'
              }`}
              title="Queue"
            >
              <ListMusic className="w-4 h-4" />
            </button>

            {/* Volume Control */}
            <div className="flex items-center gap-2 pl-2 border-l border-white/10">
              <button
                onClick={toggleMute}
                className="p-1.5 text-[#8e8e93] hover:text-white transition-colors"
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-4 h-4 text-[#ff4e4e]" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={isMuted ? 0 : volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="w-20 h-1 bg-[#1e1e24] rounded-full appearance-none cursor-pointer accent-[#ff0000] focus:outline-none"
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
