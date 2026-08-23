import React, { useState } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Repeat,
  Repeat1,
  Shuffle,
  Volume2,
  VolumeX,
  ListMusic,
  Mic2,
  Maximize2,
  Download,
  Check,
  Heart,
  WifiOff,
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
    togglePlay,
    nextTrack,
    previousTrack,
    seek,
    setVolume,
    toggleMute,
    cyclePlaybackMode,
    isFavorite,
    toggleFavorite,
    downloadTrack,
    downloadedTrackIds,
    setFullScreenPlayerOpen,
    setQueueOpen,
    isQueueOpen,
    setLyricsOpen,
    isLyricsOpen,
  } = useMusicPlayer();

  const [isDownloading, setIsDownloading] = useState(false);

  if (!currentTrack) return null;

  const isFav = isFavorite(currentTrack.id);
  const isDownloaded = downloadedTrackIds.has(currentTrack.id);

  const formatTime = (sec: number) => {
    if (!sec || isNaN(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextSec = (parseFloat(e.target.value) / 100) * duration;
    seek(nextSec);
  };

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDownloaded || isDownloading) return;
    setIsDownloading(true);
    await downloadTrack(currentTrack);
    setIsDownloading(false);
  };

  return (
    <div className="fixed bottom-0 inset-x-0 z-40 bg-dark-900/95 backdrop-blur-2xl border-t border-dark-800/80 px-4 py-2.5 flex flex-col md:flex-row items-center justify-between gap-2 md:gap-4 shadow-2xl">
      {/* 1. Track Info (Left) */}
      <div className="flex items-center gap-3 w-full md:w-1/4 min-w-0">
        <div
          onClick={() => setFullScreenPlayerOpen(true)}
          className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 cursor-pointer group shadow-md"
        >
          <img
            src={currentTrack.thumbnail}
            alt={currentTrack.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
          />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
            <Maximize2 className="w-4 h-4 text-white" />
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h4
              onClick={() => setFullScreenPlayerOpen(true)}
              className="text-sm font-bold text-gray-100 truncate cursor-pointer hover:text-mrj-400 transition-colors"
            >
              {currentTrack.title}
            </h4>
            {isDownloaded && (
              <span className="p-0.5 rounded-full bg-emerald-500/20 text-emerald-400" title="Offline Ready">
                <Check className="w-3 h-3" />
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 truncate mt-0.5">{currentTrack.artist}</p>
        </div>

        {/* Favorite & Download */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => toggleFavorite(currentTrack)}
            className={`p-1.5 rounded-full hover:bg-dark-800 transition-colors ${
              isFav ? 'text-mrj-500' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <Heart className={`w-4 h-4 ${isFav ? 'fill-mrj-500' : ''}`} />
          </button>
          <button
            onClick={handleDownload}
            disabled={isDownloading || isDownloaded}
            className={`p-1.5 rounded-full hover:bg-dark-800 transition-colors ${
              isDownloaded ? 'text-emerald-400' : 'text-gray-400 hover:text-gray-200'
            }`}
            title={isDownloaded ? 'Saved Offline' : 'Download Offline'}
          >
            {isDownloaded ? (
              <Check className="w-4 h-4" />
            ) : isDownloading ? (
              <div className="w-3.5 h-3.5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* 2. Playback Controls & Scrubber (Center) */}
      <div className="flex flex-col items-center w-full md:w-2/4 max-w-xl">
        <div className="flex items-center gap-4 mb-1">
          {/* Shuffle / Repeat */}
          <button
            onClick={cyclePlaybackMode}
            className={`p-1.5 rounded-full hover:bg-dark-800 transition-colors ${
              playbackMode !== 'repeat-none' ? 'text-mrj-400' : 'text-gray-400 hover:text-gray-200'
            }`}
            title={`Playback: ${playbackMode}`}
          >
            {playbackMode === 'repeat-one' ? (
              <Repeat1 className="w-4 h-4" />
            ) : playbackMode === 'shuffle' ? (
              <Shuffle className="w-4 h-4" />
            ) : (
              <Repeat className="w-4 h-4" />
            )}
          </button>

          {/* Previous */}
          <button
            onClick={previousTrack}
            className="p-1.5 rounded-full hover:bg-dark-800 text-gray-300 hover:text-white transition-colors"
          >
            <SkipBack className="w-5 h-5 fill-current" />
          </button>

          {/* Play / Pause Primary Button */}
          <button
            onClick={togglePlay}
            disabled={isLoading}
            className="w-10 h-10 rounded-full bg-mrj-600 hover:bg-mrj-500 text-white flex items-center justify-center shadow-lg shadow-mrj-500/25 hover:scale-105 active:scale-95 transition-all"
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : isPlaying ? (
              <Pause className="w-5 h-5 fill-white" />
            ) : (
              <Play className="w-5 h-5 fill-white ml-0.5" />
            )}
          </button>

          {/* Next */}
          <button
            onClick={nextTrack}
            className="p-1.5 rounded-full hover:bg-dark-800 text-gray-300 hover:text-white transition-colors"
          >
            <SkipForward className="w-5 h-5 fill-current" />
          </button>
        </div>

        {/* Scrubber Bar */}
        <div className="w-full flex items-center gap-2 text-[11px] font-semibold text-gray-400">
          <span className="w-9 text-right">{formatTime(currentTime)}</span>
          <div className="relative flex-1 flex items-center group cursor-pointer">
            <input
              type="range"
              min="0"
              max="100"
              value={progress || 0}
              onChange={handleSeekChange}
              className="w-full h-1.5 bg-dark-750 rounded-lg appearance-none cursor-pointer accent-mrj-500 hover:h-2 transition-all"
            />
          </div>
          <span className="w-9">{formatTime(duration)}</span>
        </div>
      </div>

      {/* 3. Right Quick Actions (Lyrics, Queue, Volume, Fullscreen) */}
      <div className="hidden md:flex items-center justify-end gap-3 w-1/4">
        {/* Lyrics */}
        <button
          onClick={() => {
            setFullScreenPlayerOpen(true);
            setLyricsOpen(true);
          }}
          className="p-2 rounded-xl hover:bg-dark-800 text-gray-400 hover:text-mrj-400 transition-colors"
          title="Karaoke Synced Lyrics"
        >
          <Mic2 className="w-4 h-4" />
        </button>

        {/* Queue */}
        <button
          onClick={() => setQueueOpen(!isQueueOpen)}
          className={`p-2 rounded-xl hover:bg-dark-800 transition-colors ${
            isQueueOpen ? 'text-mrj-400 bg-dark-800' : 'text-gray-400 hover:text-white'
          }`}
          title="Play Queue"
        >
          <ListMusic className="w-4 h-4" />
        </button>

        {/* Volume */}
        <div className="flex items-center gap-1.5">
          <button onClick={toggleMute} className="p-1.5 rounded-full hover:bg-dark-800 text-gray-400 hover:text-white">
            {isMuted || volume === 0 ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={isMuted ? 0 : volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="w-16 h-1 bg-dark-750 rounded-lg appearance-none cursor-pointer accent-mrj-500"
          />
        </div>

        {/* Expand FullScreen */}
        <button
          onClick={() => setFullScreenPlayerOpen(true)}
          className="p-2 rounded-xl hover:bg-dark-800 text-gray-400 hover:text-white transition-colors"
          title="Expand Full Screen"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
