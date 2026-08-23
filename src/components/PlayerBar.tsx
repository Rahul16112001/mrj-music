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
  MoreVertical,
  ThumbsDown,
  Sparkles
} from 'lucide-react';
import { useMusicPlayer } from '../context/MusicPlayerContext';

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
    playbackMode,
    audioQuality,
    downloadedTrackIds,
    togglePlay,
    nextTrack,
    previousTrack,
    seek,
    setVolume,
    toggleMute,
    cyclePlaybackMode,
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
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#121212] border-t border-[#262626] select-none">
      {/* 1. Red Progress Scrubber right on top edge */}
      <div
        className="relative h-1 hover:h-2 bg-[#2d2d2d] cursor-pointer transition-all group"
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

      {/* 2. Main Player Bar Body */}
      <div className="h-18 px-4 md:px-6 flex items-center justify-between gap-4">
        {/* Left: Track Information & Quick Actions */}
        <div className="flex items-center gap-3.5 min-w-0 max-w-xs md:max-w-sm">
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

          {/* Like / Dislike / Download Actions */}
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

        {/* Center: Playback Controls & Time */}
        <div className="flex flex-col items-center gap-1 flex-1 max-w-md">
          <div className="flex items-center gap-3 md:gap-5">
            {/* Previous */}
            <button
              onClick={previousTrack}
              className="p-2 text-[#aaaaaa] hover:text-white transition-colors"
              title="Previous (J)"
            >
              <SkipBack className="w-5 h-5 fill-current" />
            </button>

            {/* Play / Pause Circular Button */}
            <button
              onClick={togglePlay}
              className="w-10 h-10 rounded-full bg-white text-black hover:scale-105 active:scale-95 flex items-center justify-center shadow-lg transition-all"
              title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin text-black" />
              ) : isPlaying ? (
                <Pause className="w-5 h-5 fill-current text-black" />
              ) : (
                <Play className="w-5 h-5 fill-current text-black ml-0.5" />
              )}
            </button>

            {/* Next */}
            <button
              onClick={nextTrack}
              className="p-2 text-[#aaaaaa] hover:text-white transition-colors"
              title="Next (L)"
            >
              <SkipForward className="w-5 h-5 fill-current" />
            </button>
          </div>

          <div className="text-[11px] text-[#aaaaaa] font-medium tracking-tight">
            <span>{formatTime(currentTime)}</span>
            <span className="mx-1">/</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Right: Volume, Repeat, Shuffle, Lyrics, Fullscreen */}
        <div className="flex items-center gap-2 md:gap-3 shrink-0">
          {/* Repeat */}
          <button
            onClick={cyclePlaybackMode}
            className={`p-2 rounded-full hover:bg-[#212121] transition-colors hidden sm:block ${
              playbackMode !== 'repeat-none' ? 'text-[#ff4e4e]' : 'text-[#aaaaaa] hover:text-white'
            }`}
            title={`Playback: ${playbackMode}`}
          >
            {playbackMode === 'repeat-one' ? (
              <Repeat1 className="w-4 h-4" />
            ) : (
              <Repeat className="w-4 h-4" />
            )}
          </button>

          {/* Shuffle */}
          <button
            onClick={cyclePlaybackMode}
            className={`p-2 rounded-full hover:bg-[#212121] transition-colors hidden sm:block ${
              playbackMode === 'shuffle' ? 'text-[#ff4e4e]' : 'text-[#aaaaaa] hover:text-white'
            }`}
            title="Shuffle"
          >
            <Shuffle className="w-4 h-4" />
          </button>

          {/* Volume Control */}
          <div className="hidden md:flex items-center gap-2 group">
            <button
              onClick={toggleMute}
              className="p-1.5 text-[#aaaaaa] hover:text-white transition-colors"
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-4 h-4 text-red-400" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={isMuted ? 0 : volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="w-20 h-1 bg-[#333333] accent-[#ff0000] rounded-lg cursor-pointer transition-all"
            />
          </div>

          {/* Lyrics Toggle */}
          <button
            onClick={() => setLyricsOpen(!isLyricsOpen)}
            className={`p-2 rounded-full hover:bg-[#212121] transition-colors ${
              isLyricsOpen ? 'text-[#ff4e4e] bg-[#212121]' : 'text-[#aaaaaa] hover:text-white'
            }`}
            title="Lyrics (Karaoke)"
          >
            <Mic2 className="w-4 h-4" />
          </button>

          {/* Fullscreen Player Toggle */}
          <button
            onClick={() => setFullScreenPlayerOpen(true)}
            className="p-2 rounded-full hover:bg-[#212121] text-[#aaaaaa] hover:text-white transition-colors"
            title="Open Fullscreen Player"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
