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
  MoreVertical
} from 'lucide-react';
import { useMusicPlayer } from '../context/MusicPlayerContext';
import { SyncedLyrics } from './SyncedLyrics';
import { TuneMixModal } from './TuneMixModal';
import { TrackContextMenu } from './TrackContextMenu';
import { ArtworkImage } from './ArtworkImage';
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
      className="fixed inset-0 z-50 bg-[#030303] text-white flex flex-col justify-between select-none overflow-hidden animate-in fade-in slide-in-from-bottom duration-300"
      style={{
        paddingTop: 'max(var(--sat), 12px)',
        paddingBottom: 'max(var(--sab), 16px)',
      }}
    >
      {/* Dynamic Ambient Glow Background */}
      <div
        className="absolute inset-0 opacity-20 blur-3xl pointer-events-none transition-all duration-700"
        style={{
          backgroundImage: `url(${currentTrack.thumbnail})`,
          backgroundPosition: 'center',
          backgroundSize: 'cover',
        }}
      />

      {/* 1. TOP BAR */}
      <header className="relative z-10 px-4 py-2 flex items-center justify-between">
        <button
          onClick={() => setFullScreenPlayerOpen(false)}
          className="p-2.5 rounded-full hover:bg-white/10 active:scale-95 transition-all text-[#aaaaaa] hover:text-white min-w-[44px] min-h-[44px] flex items-center justify-center"
          aria-label="Collapse player"
        >
          <ChevronDown className="w-6 h-6" />
        </button>

        {/* Audio / Video Toggle Pill */}
        <div className="flex items-center bg-[#18181b] border border-[#27272a] rounded-full p-1 shadow-inner">
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
            className="p-2.5 rounded-full hover:bg-white/10 text-[#aaaaaa] hover:text-white min-w-[44px] min-h-[44px] flex items-center justify-center transition-colors"
            title="Tune Mix"
          >
            <Sliders className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* 2. MAIN CENTER: ARTWORK & DETAILS */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 max-w-lg mx-auto w-full min-h-0">
        {/* 1:1 Square Artwork */}
        <div className="w-full aspect-square max-w-[320px] sm:max-w-[360px] rounded-2xl overflow-hidden shadow-2xl bg-[#141416] border border-white/5 my-auto">
          <ArtworkImage
            src={currentTrack.thumbnail}
            alt={currentTrack.title}
            className="w-full h-full object-cover shadow-inner"
          />
        </div>

        {/* Track Title & Artist */}
        <div className="w-full mt-5 mb-2 flex items-center justify-between gap-4">
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

        {/* Progress Scrubber */}
        <div className="w-full mt-3">
          <input
            type="range"
            min={0}
            max={duration || 1}
            step={0.1}
            value={currentTime}
            onChange={(e) => seek(parseFloat(e.target.value))}
            className="w-full h-1.5 bg-[#252528] rounded-full appearance-none cursor-pointer accent-[#ff0000]"
          />
          <div className="flex justify-between text-xs text-[#717171] font-mono mt-1.5">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* 3. PLAYBACK CONTROLS */}
        <div className="w-full flex items-center justify-between mt-4 px-2">
          {/* Shuffle */}
          <button
            onClick={toggleShuffle}
            className={`p-3 rounded-full min-w-[48px] min-h-[48px] flex items-center justify-center transition-colors ${
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
            className="w-16 h-16 rounded-full bg-white text-black flex items-center justify-center shadow-xl active:scale-95 transition-transform"
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
            className={`p-3 rounded-full min-w-[48px] min-h-[48px] flex items-center justify-center transition-colors ${
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
                className={`text-xs font-black tracking-wider uppercase py-1.5 px-4 transition-all relative ${
                  isActive ? 'text-white' : 'text-[#717171] hover:text-[#aaaaaa]'
                }`}
              >
                <span>{labels[tab]}</span>
                {isActive && (
                  <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-[#ff0000] rounded-full" />
                )}
              </button>
            );
          })}
        </div>

        {/* Tab Drawer Body */}
        <div className="h-44 sm:h-52 overflow-y-auto pt-2 no-scrollbar">
          {/* TAB 1: UP NEXT QUEUE */}
          {activeTab === 'queue' && (
            <div className="space-y-1">
              <div className="flex items-center justify-between px-2 py-1 text-[11px] text-[#717171] font-semibold">
                <span>Playing next ({queue.length})</span>
                {queue.length > 1 && (
                  <button onClick={clearQueue} className="text-[#888888] hover:text-white">
                    Clear
                  </button>
                )}
              </div>

              {queue.map((track, idx) => {
                const isCurrent = idx === queueIndex;
                return (
                  <div
                    key={`${track.id}-${idx}`}
                    onClick={() => playTrack(track, queue)}
                    className={`flex items-center justify-between p-2 rounded-xl cursor-pointer transition-all ${
                      isCurrent
                        ? 'bg-white/10 text-white font-bold'
                        : 'hover:bg-white/5 text-[#aaaaaa]'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0 bg-[#222226]">
                        <ArtworkImage src={track.thumbnail} alt={track.title} className="w-full h-full object-cover" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={`text-xs truncate ${isCurrent ? 'text-[#ff4e4e]' : 'text-white'}`}>
                          {track.title}
                        </p>
                        <p className="text-[11px] text-[#777777] truncate">
                          {track.artist}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] font-mono text-[#666666]">
                        {formatTime(track.duration)}
                      </span>
                      {queue.length > 1 && !isCurrent && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFromQueue(idx);
                          }}
                          className="p-1.5 text-[#666666] hover:text-[#ff4e4e] transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB 2: SYNCED LYRICS */}
          {activeTab === 'lyrics' && (
            <div className="py-2">
              <SyncedLyrics
                lyricsData={activeLyrics}
                currentTime={currentTime}
                onLineClick={seek}
              />
            </div>
          )}

          {/* TAB 3: RELATED SONGS */}
          {activeTab === 'related' && (
            <div className="space-y-1">
              {isLoadingRelated ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-[#ff0000]" />
                </div>
              ) : relatedTracks.length > 0 ? (
                relatedTracks.map((relTrack) => (
                  <div
                    key={relTrack.id}
                    onClick={() => playTrack(relTrack)}
                    className="flex items-center justify-between p-2 rounded-xl hover:bg-white/5 cursor-pointer transition-all"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0 bg-[#222226]">
                        <ArtworkImage src={relTrack.thumbnail} alt={relTrack.title} className="w-full h-full object-cover" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-white truncate">{relTrack.title}</p>
                        <p className="text-[11px] text-[#777777] truncate">{relTrack.artist}</p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-center text-xs text-[#777777] py-6">No related tracks found</p>
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
