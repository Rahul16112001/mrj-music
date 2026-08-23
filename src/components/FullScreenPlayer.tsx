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
  Share2,
  Sparkles,
  Trash2,
  Plus
} from 'lucide-react';
import { useMusicPlayer } from '../context/MusicPlayerContext';
import { SyncedLyrics } from './SyncedLyrics';
import { api } from '../services/api';
import { Track } from '../types';

export const FullScreenPlayer: React.FC = () => {
  const {
    currentTrack,
    isPlaying,
    isLoading,
    currentTime,
    duration,
    volume,
    isMuted,
    shuffleEnabled,
    repeatMode,
    autoplayEnabled,
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
    toggleShuffle,
    cycleRepeatMode,
    toggleAutoplay,
    toggleFavorite,
    isFavorite,
    downloadTrack,
    deleteDownloadedTrack,
    downloadedTrackIds,
    playTrack,
    playNextInQueue,
    removeFromQueue,
    clearQueue,
  } = useMusicPlayer();

  const [activeTab, setActiveTab] = useState<'queue' | 'lyrics' | 'related'>('lyrics');
  const [isDownloading, setIsDownloading] = useState(false);
  const [relatedTracks, setRelatedTracks] = useState<Track[]>([]);
  const [isLoadingRelated, setIsLoadingRelated] = useState(false);

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

  const nowPlayingTrack = currentTrack;
  const upNextTracks = queue.slice(queueIndex + 1);

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
        {/* Left Column: Album Artwork & Track Metadata */}
        <div className="flex flex-col items-center justify-center space-y-6 max-w-md mx-auto w-full">
          <div className="relative w-72 h-72 sm:w-88 sm:h-88 rounded-2xl overflow-hidden shadow-2xl shadow-black/80 border border-white/10 group">
            <img
              src={currentTrack.thumbnail}
              alt={currentTrack.title}
              className="w-full h-full object-cover"
            />
          </div>

          <div className="flex items-center justify-between w-full px-2">
            <div className="min-w-0 flex-1 mr-4">
              <h2 className="text-xl md:text-2xl font-black text-white truncate">
                {currentTrack.title}
              </h2>
              <p className="text-sm font-medium text-[#aaaaaa] truncate mt-0.5">
                {currentTrack.artist}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => toggleFavorite(currentTrack)}
                className={`p-3 rounded-full hover:bg-white/10 transition-colors ${
                  isLiked ? 'text-[#ff0000]' : 'text-[#aaaaaa] hover:text-white'
                }`}
                title="Like track"
              >
                <Heart className={`w-6 h-6 ${isLiked ? 'fill-current' : ''}`} />
              </button>

              <button
                onClick={handleDownloadToggle}
                disabled={isDownloading}
                className={`p-3 rounded-full hover:bg-white/10 transition-colors ${
                  isDownloaded ? 'text-emerald-400' : 'text-[#aaaaaa] hover:text-white'
                }`}
                title={isDownloaded ? 'Saved Offline' : 'Download'}
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
        </div>

        {/* Right Column: Tab View (Up Next | Lyrics | Related) */}
        <div className="h-[480px] bg-[#121212]/80 backdrop-blur-md rounded-2xl border border-white/10 p-6 flex flex-col overflow-hidden">
          {/* 1. LYRICS TAB */}
          {activeTab === 'lyrics' && (
            <div className="flex-1 overflow-hidden flex flex-col">
              <div className="flex items-center justify-between pb-3 border-b border-white/5">
                <span className="text-xs font-bold uppercase tracking-wider text-[#aaaaaa] flex items-center gap-2">
                  <Mic2 className="w-4 h-4 text-[#ff0000]" />
                  <span>Synced Lyrics</span>
                </span>
              </div>
              <div className="flex-1 overflow-y-auto pt-4">
                <SyncedLyrics
                  lyricsData={activeLyrics}
                  currentTime={currentTime}
                  onLineClick={seek}
                />
              </div>
            </div>
          )}

          {/* 2. UP NEXT QUEUE TAB */}
          {activeTab === 'queue' && (
            <div className="flex-1 overflow-hidden flex flex-col">
              <div className="flex items-center justify-between pb-3 border-b border-white/5">
                <span className="text-xs font-bold uppercase tracking-wider text-[#aaaaaa]">
                  Up Next ({queue.length} Tracks)
                </span>
                {/* Autoplay Toggle Button */}
                <button
                  onClick={toggleAutoplay}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all border ${
                    autoplayEnabled
                      ? 'bg-[#ff0000]/20 text-[#ff4e4e] border-[#ff0000]/40'
                      : 'bg-[#222222] text-[#888888] border-[#333333]'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Autoplay {autoplayEnabled ? 'ON' : 'OFF'}</span>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-4 pt-3 no-scrollbar">
                {/* Now Playing */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#888888] px-1">
                    Now Playing
                  </span>
                  <div className="flex items-center gap-3 p-2.5 rounded-xl bg-[#262626] border border-[#383838]">
                    <img
                      src={nowPlayingTrack.thumbnail}
                      alt={nowPlayingTrack.title}
                      className="w-10 h-10 rounded-lg object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-[#ff4e4e] truncate">{nowPlayingTrack.title}</p>
                      <p className="text-xs text-[#aaaaaa] truncate">{nowPlayingTrack.artist}</p>
                    </div>
                  </div>
                </div>

                {/* Upcoming Queue */}
                {upNextTracks.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-[#888888]">
                        Upcoming Tracks
                      </span>
                      <button
                        onClick={clearQueue}
                        className="text-[10px] text-[#777777] hover:text-[#ff4e4e] font-semibold transition-colors"
                      >
                        Clear Upcoming
                      </button>
                    </div>
                    {upNextTracks.map((track, idx) => (
                      <div
                        key={`modal-q-${track.id}-${idx}`}
                        className="flex items-center justify-between p-2 rounded-xl hover:bg-[#1c1c1c] group transition-colors cursor-pointer"
                        onClick={() => playTrack(track)}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <img
                            src={track.thumbnail}
                            alt={track.title}
                            className="w-10 h-10 rounded-lg object-cover bg-[#222222]"
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-white group-hover:text-[#ff4e4e] truncate transition-colors">
                              {track.title}
                            </p>
                            <p className="text-xs text-[#aaaaaa] truncate">{track.artist}</p>
                          </div>
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFromQueue(queueIndex + 1 + idx);
                          }}
                          className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 text-[#777777] hover:text-[#ff4e4e] transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 3. RELATED RECOMMENDATIONS TAB */}
          {activeTab === 'related' && (
            <div className="flex-1 overflow-hidden flex flex-col">
              <div className="flex items-center justify-between pb-3 border-b border-white/5">
                <span className="text-xs font-bold uppercase tracking-wider text-[#aaaaaa] flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#ff0000]" />
                  <span>Related to {currentTrack.artist}</span>
                </span>
              </div>

              <div className="flex-1 overflow-y-auto pt-3 space-y-2 no-scrollbar">
                {isLoadingRelated ? (
                  <div className="flex items-center justify-center h-48">
                    <Loader2 className="w-6 h-6 text-[#ff0000] animate-spin" />
                  </div>
                ) : relatedTracks.length === 0 ? (
                  <div className="text-center py-16 text-[#777777]">
                    <Disc3 className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p className="text-sm font-bold">No related tracks found</p>
                  </div>
                ) : (
                  relatedTracks.map((track) => (
                    <div
                      key={`rel-${track.id}`}
                      className="flex items-center justify-between p-2 rounded-xl hover:bg-[#1c1c1c] group transition-colors cursor-pointer"
                      onClick={() => playTrack(track)}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={track.thumbnail}
                          alt={track.title}
                          className="w-10 h-10 rounded-lg object-cover bg-[#222222]"
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-white group-hover:text-[#ff4e4e] truncate transition-colors">
                            {track.title}
                          </p>
                          <p className="text-xs text-[#aaaaaa] truncate">{track.artist}</p>
                        </div>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          playNextInQueue(track);
                        }}
                        className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 text-[#aaaaaa] hover:text-white bg-[#222222] transition-all text-xs font-bold flex items-center gap-1"
                        title="Play Next"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Play Next</span>
                      </button>
                    </div>
                  ))
                )}
              </div>
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
            onClick={toggleShuffle}
            className={`p-2 rounded-full hover:bg-white/10 transition-colors ${
              shuffleEnabled ? 'text-[#ff4e4e]' : 'text-[#aaaaaa]'
            }`}
            title={`Shuffle: ${shuffleEnabled ? 'ON' : 'OFF'}`}
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
            onClick={cycleRepeatMode}
            className={`p-2 rounded-full hover:bg-white/10 transition-colors ${
              repeatMode !== 'off' ? 'text-[#ff4e4e]' : 'text-[#aaaaaa]'
            }`}
            title={`Repeat: ${repeatMode}`}
          >
            {repeatMode === 'one' ? (
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
