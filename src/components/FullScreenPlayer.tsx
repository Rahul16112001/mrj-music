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
  Heart,
  Download,
  Check,
  Loader2,
  Mic2,
  ListMusic,
  Radio,
  Disc3,
  Share2
} from 'lucide-react';
import { useMusicPlayer } from '../context/MusicPlayerContext';
import { SyncedLyrics } from './SyncedLyrics';

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
    queue,
    queueIndex,
    isFullScreenPlayerOpen,
    setFullScreenPlayerOpen,
    activeLyrics,
    togglePlay,
    nextTrack,
    previousTrack,
    seek,
    setVolume,
    toggleMute,
    cyclePlaybackMode,
    toggleFavorite,
    isFavorite,
    downloadTrack,
    deleteDownloadedTrack,
    downloadedTrackIds,
    playTrack,
  } = useMusicPlayer();

  const [activeTab, setActiveTab] = useState<'queue' | 'lyrics' | 'related'>('lyrics');
  const [isDownloading, setIsDownloading] = useState(false);

  if (!isFullScreenPlayerOpen || !currentTrack) return null;

  const isDownloaded = downloadedTrackIds.has(currentTrack.id);
  const isLiked = isFavorite(currentTrack.id);

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '0:00';
    const minutes = Math.floor(secs / 60);
    const seconds = Math.floor(secs % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const handleDownloadToggle = async () => {
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
    <div className="fixed inset-0 z-50 bg-[#030303] flex flex-col select-none overflow-hidden animate-in fade-in duration-200">
      {/* Dynamic Ambient Glow Background */}
      <div
        className="absolute inset-0 opacity-20 pointer-events-none filter blur-[120px] scale-125"
        style={{
          backgroundImage: `url(${currentTrack.thumbnail})`,
          backgroundPosition: 'center',
          backgroundSize: 'cover',
        }}
      />

      {/* Top Header Navigation */}
      <header className="relative z-10 h-16 px-6 flex items-center justify-between border-b border-white/5">
        <button
          onClick={() => setFullScreenPlayerOpen(false)}
          className="p-2 rounded-full hover:bg-white/10 text-white transition-colors"
          title="Minimize"
        >
          <ChevronDown className="w-6 h-6" />
        </button>

        {/* 3 YouTube Music Tabs: UP NEXT | LYRICS | RELATED */}
        <div className="flex items-center gap-1 bg-[#181818] p-1 rounded-full border border-white/10">
          {(['queue', 'lyrics', 'related'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${
                activeTab === tab
                  ? 'bg-white text-black shadow-md'
                  : 'text-[#aaaaaa] hover:text-white'
              }`}
            >
              {tab === 'queue' ? 'Up Next' : tab === 'lyrics' ? 'Lyrics' : 'Related'}
            </button>
          ))}
        </div>

        <button
          onClick={() => {
            navigator.clipboard.writeText(window.location.origin);
          }}
          className="p-2 rounded-full hover:bg-white/10 text-[#aaaaaa] hover:text-white transition-colors"
          title="Share song"
        >
          <Share2 className="w-5 h-5" />
        </button>
      </header>

      {/* Main Content Area */}
      <div className="relative z-10 flex-1 grid grid-cols-1 lg:grid-cols-2 gap-8 p-6 md:p-12 items-center overflow-y-auto max-w-7xl mx-auto w-full">
        {/* Left Column: Vinyl / Album Artwork & Track Info */}
        <div className="flex flex-col items-center justify-center space-y-6 max-w-md mx-auto w-full">
          <div className="relative w-72 h-72 sm:w-88 sm:h-88 rounded-2xl overflow-hidden shadow-2xl shadow-black/80 border border-white/10 group">
            <img
              src={currentTrack.thumbnail}
              alt={currentTrack.title}
              className="w-full h-full object-cover"
            />
          </div>

          <div className="w-full text-center space-y-1.5">
            <h2 className="text-2xl sm:text-3xl font-black text-white truncate px-4">
              {currentTrack.title}
            </h2>
            <p className="text-base text-[#aaaaaa] font-medium truncate">
              {currentTrack.artist}
            </p>
          </div>

          {/* Quick Actions (Like, Download) */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => toggleFavorite(currentTrack)}
              className={`p-3 rounded-full hover:bg-white/10 transition-colors ${
                isLiked ? 'text-[#ff0000] bg-white/5' : 'text-[#aaaaaa] hover:text-white'
              }`}
              title="Like"
            >
              <Heart className={`w-6 h-6 ${isLiked ? 'fill-current' : ''}`} />
            </button>

            <button
              onClick={handleDownloadToggle}
              disabled={isDownloading}
              className={`p-3 rounded-full hover:bg-white/10 transition-colors ${
                isDownloaded ? 'text-emerald-400 bg-white/5' : 'text-[#aaaaaa] hover:text-white'
              }`}
              title={isDownloaded ? 'Saved Offline' : 'Download for Offline'}
            >
              {isDownloading ? (
                <Loader2 className="w-6 h-6 animate-spin text-[#ff0000]" />
              ) : isDownloaded ? (
                <Check className="w-6 h-6 text-emerald-400" />
              ) : (
                <Download className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>

        {/* Right Column: Tab View (Lyrics, Up Next, Related) */}
        <div className="h-full flex flex-col justify-center min-h-[380px] max-h-[550px] bg-[#121212]/80 backdrop-blur-xl border border-white/10 rounded-3xl p-6 overflow-hidden">
          {activeTab === 'lyrics' && (
            <SyncedLyrics
              lyricsData={activeLyrics}
              currentTime={currentTime}
              onLineClick={seek}
            />
          )}

          {activeTab === 'queue' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <span className="text-xs font-bold uppercase tracking-wider text-[#aaaaaa]">
                  Playing From Queue ({queue.length} Tracks)
                </span>
                <span className="text-xs text-[#ff4e4e] font-bold flex items-center gap-1">
                  <Radio className="w-3.5 h-3.5" />
                  <span>Autoplay Radio</span>
                </span>
              </div>
              <div className="flex-1 overflow-y-auto space-y-2 pt-3 scrollbar-thin scrollbar-thumb-zinc-800">
                {queue.map((track, idx) => (
                  <div
                    key={`modal-q-${track.id}-${idx}`}
                    onClick={() => playTrack(track)}
                    className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-colors ${
                      track.id === currentTrack.id ? 'bg-[#262626]' : 'hover:bg-[#181818]'
                    }`}
                  >
                    <img
                      src={track.thumbnail}
                      alt={track.title}
                      className="w-10 h-10 rounded-lg object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-bold truncate ${
                        track.id === currentTrack.id ? 'text-[#ff4e4e]' : 'text-white'
                      }`}>
                        {track.title}
                      </p>
                      <p className="text-xs text-[#aaaaaa] truncate">{track.artist}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'related' && (
            <div className="flex-1 flex flex-col justify-center text-center p-6 space-y-4">
              <Disc3 className="w-12 h-12 text-[#ff0000] mx-auto animate-spin-slow" />
              <h3 className="text-lg font-bold text-white">About {currentTrack.artist}</h3>
              <p className="text-sm text-[#aaaaaa] max-w-md mx-auto leading-relaxed">
                Stream unlimited tracks, explore albums, and play high-quality music directly with zero restrictions.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Scrubber & Controls */}
      <div className="relative z-10 p-6 md:px-12 bg-[#0a0a0a] border-t border-white/5 max-w-4xl mx-auto w-full space-y-4">
        {/* Scrubber */}
        <div className="space-y-1">
          <input
            type="range"
            min="0"
            max={duration || 100}
            step="0.1"
            value={currentTime}
            onChange={(e) => seek(parseFloat(e.target.value))}
            className="w-full h-1.5 bg-[#333333] accent-[#ff0000] rounded-lg cursor-pointer"
          />
          <div className="flex justify-between text-xs text-[#aaaaaa] font-semibold">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Playback Buttons */}
        <div className="flex items-center justify-between">
          <button
            onClick={cyclePlaybackMode}
            className={`p-2 rounded-full hover:bg-white/10 transition-colors ${
              playbackMode === 'shuffle' ? 'text-[#ff4e4e]' : 'text-[#aaaaaa]'
            }`}
          >
            <Shuffle className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-6">
            <button
              onClick={previousTrack}
              className="p-2 text-white hover:text-[#ff4e4e] transition-colors"
            >
              <SkipBack className="w-6 h-6 fill-current" />
            </button>

            <button
              onClick={togglePlay}
              className="w-14 h-14 rounded-full bg-white text-black hover:scale-105 active:scale-95 flex items-center justify-center shadow-xl transition-all"
            >
              {isLoading ? (
                <Loader2 className="w-7 h-7 animate-spin text-black" />
              ) : isPlaying ? (
                <Pause className="w-7 h-7 fill-current text-black" />
              ) : (
                <Play className="w-7 h-7 fill-current text-black ml-1" />
              )}
            </button>

            <button
              onClick={nextTrack}
              className="p-2 text-white hover:text-[#ff4e4e] transition-colors"
            >
              <SkipForward className="w-6 h-6 fill-current" />
            </button>
          </div>

          <button
            onClick={cyclePlaybackMode}
            className={`p-2 rounded-full hover:bg-white/10 transition-colors ${
              playbackMode !== 'repeat-none' ? 'text-[#ff4e4e]' : 'text-[#aaaaaa]'
            }`}
          >
            {playbackMode === 'repeat-one' ? (
              <Repeat1 className="w-5 h-5" />
            ) : (
              <Repeat className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
