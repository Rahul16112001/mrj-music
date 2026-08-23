import React, { useState } from 'react';
import {
  ChevronDown,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Repeat,
  Repeat1,
  Shuffle,
  Volume2,
  VolumeX,
  Download,
  Check,
  Heart,
  Mic2,
  ListMusic,
  Disc3,
  Radio,
  Sparkles,
} from 'lucide-react';
import { useMusicPlayer } from '../context/MusicPlayerContext';
import { SyncedLyrics } from './SyncedLyrics';
import { QueueDrawer } from './QueueDrawer';

export const FullScreenPlayer: React.FC = () => {
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
    isFullScreenPlayerOpen,
    setFullScreenPlayerOpen,
    activeLyrics,
    isLyricsOpen,
    setLyricsOpen,
    isQueueOpen,
    setQueueOpen,
  } = useMusicPlayer();

  const [activeTab, setActiveTab] = useState<'visuals' | 'lyrics' | 'queue'>(isLyricsOpen ? 'lyrics' : 'visuals');
  const [isDownloading, setIsDownloading] = useState(false);

  if (!isFullScreenPlayerOpen || !currentTrack) return null;

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

  const handleDownload = async () => {
    if (isDownloaded || isDownloading) return;
    setIsDownloading(true);
    await downloadTrack(currentTrack);
    setIsDownloading(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-dark-950 flex flex-col justify-between p-4 md:p-8 animate-in fade-in zoom-in-95 duration-200 overflow-hidden select-none">
      {/* Ambient glowing background blur from artwork */}
      <div
        className="absolute inset-0 bg-cover bg-center opacity-25 blur-3xl scale-125 pointer-events-none transition-all duration-1000"
        style={{ backgroundImage: `url(${currentTrack.thumbnail})` }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-dark-950/80 via-dark-950/90 to-dark-950 pointer-events-none" />

      {/* 1. Header Bar */}
      <div className="relative z-10 flex items-center justify-between">
        <button
          onClick={() => setFullScreenPlayerOpen(false)}
          className="p-2.5 rounded-full bg-dark-850/80 hover:bg-dark-800 text-gray-300 hover:text-white transition-colors border border-dark-750"
        >
          <ChevronDown className="w-6 h-6" />
        </button>

        {/* Tab Switcher (Visuals / Lyrics / Queue) */}
        <div className="flex items-center gap-1 p-1 rounded-full bg-dark-850/80 border border-dark-750 backdrop-blur-md">
          <button
            onClick={() => setActiveTab('visuals')}
            className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
              activeTab === 'visuals'
                ? 'bg-mrj-600 text-white shadow-md'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Track View
          </button>
          <button
            onClick={() => setActiveTab('lyrics')}
            className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 transition-all ${
              activeTab === 'lyrics'
                ? 'bg-mrj-600 text-white shadow-md'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <Mic2 className="w-3.5 h-3.5" />
            <span>Synced Lyrics</span>
          </button>
          <button
            onClick={() => setActiveTab('queue')}
            className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 transition-all ${
              activeTab === 'queue'
                ? 'bg-mrj-600 text-white shadow-md'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <ListMusic className="w-3.5 h-3.5" />
            <span>Queue</span>
          </button>
        </div>

        {/* High-Fi Quality Badge */}
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-mrj-600/20 border border-mrj-500/30 text-mrj-400 text-xs font-bold">
          <Sparkles className="w-3.5 h-3.5" />
          <span>{audioQuality === 'high' ? '160k Opus' : '128k AAC'}</span>
        </div>
      </div>

      {/* 2. Main Content Area */}
      <div className="relative z-10 flex-1 flex items-center justify-center my-4 overflow-hidden">
        {activeTab === 'visuals' && (
          <div className="flex flex-col items-center max-w-sm w-full text-center">
            {/* Artwork Container */}
            <div className="relative w-64 h-64 sm:w-80 sm:h-80 rounded-3xl overflow-hidden shadow-2xl border border-dark-750/80 mb-6 bg-dark-900 group">
              <img
                src={currentTrack.thumbnail}
                alt={currentTrack.title}
                className={`w-full h-full object-cover transition-transform duration-700 ${
                  isPlaying ? 'scale-105' : 'scale-100'
                }`}
              />
              <div className="absolute inset-0 bg-radial from-transparent to-black/40 pointer-events-none" />
            </div>

            {/* Title & Artist */}
            <div className="w-full flex items-center justify-between gap-4 mb-2">
              <div className="min-w-0 text-left">
                <h2 className="text-xl sm:text-2xl font-black text-gray-100 truncate">
                  {currentTrack.title}
                </h2>
                <p className="text-sm text-gray-400 truncate mt-1">{currentTrack.artist}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleFavorite(currentTrack)}
                  className={`p-2.5 rounded-full hover:bg-dark-800 transition-colors ${
                    isFav ? 'text-mrj-500 bg-mrj-500/10' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <Heart className={`w-6 h-6 ${isFav ? 'fill-mrj-500' : ''}`} />
                </button>
                <button
                  onClick={handleDownload}
                  disabled={isDownloading || isDownloaded}
                  className={`p-2.5 rounded-full hover:bg-dark-800 transition-colors ${
                    isDownloaded ? 'text-emerald-400 bg-emerald-500/10' : 'text-gray-400 hover:text-white'
                  }`}
                  title={isDownloaded ? 'Saved Offline' : 'Download for Offline Listening'}
                >
                  {isDownloaded ? (
                    <Check className="w-6 h-6" />
                  ) : isDownloading ? (
                    <div className="w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Download className="w-6 h-6" />
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'lyrics' && (
          <div className="w-full max-w-2xl">
            <SyncedLyrics
              lyricsData={activeLyrics}
              currentTime={currentTime}
              onLineClick={(time) => seek(time)}
            />
          </div>
        )}

        {activeTab === 'queue' && (
          <div className="w-full max-w-lg h-[400px]">
            <QueueDrawer isOpen={true} onClose={() => setActiveTab('visuals')} />
          </div>
        )}
      </div>

      {/* 3. Bottom Controls */}
      <div className="relative z-10 w-full max-w-xl mx-auto space-y-4">
        {/* Scrubber */}
        <div className="space-y-1.5">
          <input
            type="range"
            min="0"
            max="100"
            value={progress || 0}
            onChange={handleSeekChange}
            className="w-full h-2 bg-dark-800 rounded-lg appearance-none cursor-pointer accent-mrj-500 hover:h-2.5 transition-all"
          />
          <div className="flex justify-between text-xs font-semibold text-gray-400">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-between">
          <button
            onClick={cyclePlaybackMode}
            className={`p-3 rounded-full hover:bg-dark-850 transition-colors ${
              playbackMode !== 'repeat-none' ? 'text-mrj-400' : 'text-gray-400 hover:text-white'
            }`}
          >
            {playbackMode === 'repeat-one' ? (
              <Repeat1 className="w-5 h-5" />
            ) : playbackMode === 'shuffle' ? (
              <Shuffle className="w-5 h-5" />
            ) : (
              <Repeat className="w-5 h-5" />
            )}
          </button>

          <button
            onClick={previousTrack}
            className="p-3 rounded-full hover:bg-dark-850 text-gray-200 hover:text-white transition-colors"
          >
            <SkipBack className="w-7 h-7 fill-current" />
          </button>

          <button
            onClick={togglePlay}
            disabled={isLoading}
            className="w-16 h-16 rounded-full bg-gradient-to-tr from-mrj-600 to-rose-500 hover:from-mrj-500 hover:to-rose-400 text-white flex items-center justify-center shadow-xl shadow-mrj-500/30 hover:scale-105 active:scale-95 transition-all"
          >
            {isLoading ? (
              <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin" />
            ) : isPlaying ? (
              <Pause className="w-8 h-8 fill-white" />
            ) : (
              <Play className="w-8 h-8 fill-white ml-1" />
            )}
          </button>

          <button
            onClick={nextTrack}
            className="p-3 rounded-full hover:bg-dark-850 text-gray-200 hover:text-white transition-colors"
          >
            <SkipForward className="w-7 h-7 fill-current" />
          </button>

          <div className="flex items-center">
            <button
              onClick={toggleMute}
              className="p-3 rounded-full hover:bg-dark-850 text-gray-400 hover:text-white"
            >
              {isMuted || volume === 0 ? <VolumeX className="w-5 h-5 text-red-400" /> : <Volume2 className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
