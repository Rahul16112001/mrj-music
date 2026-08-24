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
  Loader2
} from 'lucide-react';
import { useMusicPlayer } from '../context/MusicPlayerContext';
import { ArtworkImage } from './ArtworkImage';

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
        className="lg:hidden fixed left-2 right-2 z-30 bg-[#161618]/95 backdrop-blur-xl border border-[#26262a] rounded-2xl shadow-2xl overflow-hidden select-none cursor-pointer transition-all duration-300"
        style={{ bottom: 'calc(56px + max(var(--sab), 6px) + 6px)' }}
        onClick={() => setFullScreenPlayerOpen(true)}
      >
        {/* Progress Line */}
        <div className="w-full h-1 bg-[#252528] relative">
          <div
            className="h-full bg-[#ff0000] transition-all duration-150"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Mini Player Row */}
        <div className="flex items-center justify-between p-2 gap-3 h-14">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 bg-[#222226] shadow-md">
              <ArtworkImage
                src={currentTrack.thumbnail}
                alt={currentTrack.title}
                className="w-full h-full object-cover"
              />
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
              className={`p-2 rounded-full min-w-[40px] min-h-[40px] flex items-center justify-center transition-colors ${
                isLiked ? 'text-[#ff0000]' : 'text-[#888888] hover:text-white'
              }`}
              aria-label="Like track"
            >
              <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
            </button>

            <button
              onClick={togglePlay}
              className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center shadow-lg active:scale-95 transition-transform"
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
              className="p-2 text-[#888888] hover:text-white min-w-[40px] min-h-[40px] flex items-center justify-center transition-colors"
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
      <div className="hidden lg:block fixed bottom-0 left-0 right-0 z-50 bg-[#0d0d0f] border-t border-[#202024] select-none">
        {/* Scrubber right on top edge */}
        <div
          className="relative h-1 hover:h-2 bg-[#222226] cursor-pointer transition-all group"
          onClick={handleScrub}
          onMouseEnter={() => setIsHoveringScrubber(true)}
          onMouseLeave={() => {
            setIsHoveringScrubber(false);
            setHoverTime(null);
          }}
          onMouseMove={handleMouseMove}
        >
          <div
            className="h-full bg-[#ff0000] relative"
            style={{ width: `${progress}%` }}
          >
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-[#ff0000] rounded-full scale-0 group-hover:scale-100 transition-transform shadow-md" />
          </div>

          {isHoveringScrubber && hoverTime !== null && (
            <div
              className="absolute bottom-3 -translate-x-1/2 px-2 py-1 bg-[#181818] border border-[#333333] rounded text-[11px] font-bold text-white shadow-xl pointer-events-none"
              style={{ left: `${(hoverTime / duration) * 100}%` }}
            >
              {formatTime(hoverTime)}
            </div>
          )}
        </div>

        {/* Desktop Player Body */}
        <div className="h-18 px-6 flex items-center justify-between gap-4">
          {/* Left: Track Information */}
          <div className="flex items-center gap-3.5 min-w-0 max-w-sm">
            <div
              onClick={() => setFullScreenPlayerOpen(true)}
              className="relative w-12 h-12 rounded-lg overflow-hidden shrink-0 group cursor-pointer shadow-md bg-[#212121]"
            >
              <img
                src={currentTrack.thumbnail}
                alt={currentTrack.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
              />
              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <Maximize2 className="w-4 h-4 text-white" />
              </div>
            </div>

            <div className="min-w-0">
              <h4
                onClick={() => setFullScreenPlayerOpen(true)}
                className="text-sm font-bold text-white truncate cursor-pointer hover:underline"
              >
                {currentTrack.title}
              </h4>
              <p className="text-xs text-[#aaaaaa] truncate hover:text-white cursor-pointer transition-colors">
                {currentTrack.artist}
              </p>
            </div>

            {/* Like / Download */}
            <div className="flex items-center gap-1 shrink-0 ml-1">
              <button
                onClick={() => toggleFavorite(currentTrack)}
                className={`p-2 rounded-full hover:bg-[#212121] transition-colors ${
                  isLiked ? 'text-[#ff0000]' : 'text-[#aaaaaa] hover:text-white'
                }`}
                title="Like"
              >
                <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
              </button>

              <button
                onClick={handleDownloadToggle}
                disabled={isDownloading}
                className={`p-2 rounded-full hover:bg-[#212121] transition-colors ${
                  isDownloaded ? 'text-emerald-400' : 'text-[#aaaaaa] hover:text-white'
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

          {/* Center: Playback Controls */}
          <div className="flex flex-col items-center gap-1 flex-1 max-w-md">
            <div className="flex items-center gap-5">
              <button
                onClick={toggleShuffle}
                className={`p-2 transition-colors ${
                  shuffleEnabled ? 'text-[#ff0000]' : 'text-[#aaaaaa] hover:text-white'
                }`}
                title="Shuffle (S)"
              >
                <Shuffle className="w-4 h-4" />
              </button>

              <button
                onClick={previousTrack}
                className="p-2 text-[#aaaaaa] hover:text-white transition-colors"
                title="Previous (J)"
              >
                <SkipBack className="w-5 h-5 fill-current" />
              </button>

              <button
                onClick={togglePlay}
                className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-md"
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
                className="p-2 text-[#aaaaaa] hover:text-white transition-colors"
                title="Next (K)"
              >
                <SkipForward className="w-5 h-5 fill-current" />
              </button>

              <button
                onClick={cycleRepeatMode}
                className={`p-2 transition-colors ${
                  repeatMode !== 'off' ? 'text-[#ff0000]' : 'text-[#aaaaaa] hover:text-white'
                }`}
                title={`Repeat: ${repeatMode}`}
              >
                {repeatMode === 'one' ? <Repeat1 className="w-4 h-4" /> : <Repeat className="w-4 h-4" />}
              </button>
            </div>

            <div className="w-full flex items-center gap-2 text-[11px] text-[#717171] font-mono">
              <span>{formatTime(currentTime)}</span>
              <div className="flex-1 h-1 bg-[#262626] rounded-full overflow-hidden">
                <div className="h-full bg-[#ff0000]" style={{ width: `${progress}%` }} />
              </div>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Right: Panels & Volume */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setLyricsOpen(!isLyricsOpen);
                if (!isLyricsOpen) setQueueOpen(false);
              }}
              className={`p-2 rounded-full hover:bg-[#212121] transition-colors ${
                isLyricsOpen ? 'text-[#ff0000]' : 'text-[#aaaaaa] hover:text-white'
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
              className={`p-2 rounded-full hover:bg-[#212121] transition-colors ${
                isQueueOpen ? 'text-[#ff0000]' : 'text-[#aaaaaa] hover:text-white'
              }`}
              title="Queue"
            >
              <ListMusic className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={toggleMute}
                className="p-2 text-[#aaaaaa] hover:text-white transition-colors"
                title={isMuted ? 'Unmute (M)' : 'Mute (M)'}
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-4 h-4" />
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
                className="w-20 h-1 bg-[#333333] rounded-lg appearance-none cursor-pointer"
                title="Volume (Up/Down)"
              />
            </div>

            <button
              onClick={() => setFullScreenPlayerOpen(true)}
              className="p-2 text-[#aaaaaa] hover:text-white hover:bg-[#212121] rounded-full transition-colors ml-2"
              title="Full Screen Player"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
