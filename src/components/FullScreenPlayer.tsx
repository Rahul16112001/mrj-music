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
  Trash2,
  Sliders,
  Video,
  Music,
  Mic2,
  Sparkles,
  X
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
  } = useMusicPlayer();

  const [activeSheet, setActiveSheet] = useState<'none' | 'queue' | 'lyrics' | 'related'>('none');
  const [isDownloading, setIsDownloading] = useState(false);
  const [relatedTracks, setRelatedTracks] = useState<Track[]>([]);
  const [isLoadingRelated, setIsLoadingRelated] = useState(false);

  // Android hardware back button integration
  useEffect(() => {
    if (!isFullScreenPlayerOpen) return;
    const unregister = androidLifecycleService.registerBackHandler(() => {
      if (activeSheet !== 'none') {
        setActiveSheet('none');
        return true;
      }
      setFullScreenPlayerOpen(false);
      return true;
    });
    return () => unregister();
  }, [isFullScreenPlayerOpen, activeSheet, setFullScreenPlayerOpen]);

  // Fetch related tracks when requested
  useEffect(() => {
    if (currentTrack && activeSheet === 'related' && relatedTracks.length === 0) {
      setIsLoadingRelated(true);
      api.getRelatedTracks(currentTrack.id, currentTrack.artist, currentTrack.genre, currentTrack.title)
        .then((tracks) => setRelatedTracks(tracks))
        .catch(() => setRelatedTracks([]))
        .finally(() => setIsLoadingRelated(false));
    }
  }, [currentTrack, activeSheet, relatedTracks.length]);

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
      className="fixed inset-0 z-50 bg-[#070709] text-white flex flex-col justify-between select-none overflow-hidden animate-in fade-in slide-in-from-bottom duration-300"
      style={{
        paddingTop: 'max(var(--sat), 12px)',
        paddingBottom: 'max(var(--sab), 16px)',
      }}
    >
      {/* 1. DYNAMIC MULTI-LAYER AMBIENT GLOW BACKDROP */}
      <div
        className="absolute inset-0 opacity-30 blur-[140px] scale-125 pointer-events-none transition-all duration-1000"
        style={{
          backgroundImage: `radial-gradient(circle at 50% 30%, #ff0000 0%, transparent 65%), url(${currentTrack.thumbnail})`,
          backgroundPosition: 'center',
          backgroundSize: 'cover',
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-[#070709]/95 pointer-events-none" />

      {/* 2. TOP BAR */}
      <header className="relative z-10 px-4 py-2 flex items-center justify-between shrink-0">
        <button
          onClick={() => setFullScreenPlayerOpen(false)}
          className="p-2.5 rounded-full bg-white/5 hover:bg-white/10 active:scale-95 transition-all text-[#aaaaaa] hover:text-white min-w-[44px] min-h-[44px] flex items-center justify-center backdrop-blur-md border border-white/5 shadow-sm"
          aria-label="Collapse player"
        >
          <ChevronDown className="w-6 h-6" />
        </button>

        {/* Audio / Video Toggle Pill */}
        <div className="flex items-center bg-[#141418]/90 backdrop-blur-md border border-white/10 rounded-full p-1 shadow-inner">
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

        {/* Tune Mix */}
        <button
          onClick={() => setTuneModalOpen(true)}
          className="p-2.5 rounded-full bg-white/5 hover:bg-white/10 text-[#aaaaaa] hover:text-white min-w-[44px] min-h-[44px] flex items-center justify-center transition-all active:scale-95 backdrop-blur-md border border-white/5 shadow-sm"
          title="Tune Mix"
        >
          <Sliders className="w-5 h-5" />
        </button>
      </header>

      {/* 3. MAIN CENTER: ARTWORK & TRACK INFORMATION */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 max-w-md mx-auto w-full min-h-0 py-2">
        {/* Animated Artwork or Interactive Video Container */}
        <div className="relative group my-auto flex items-center justify-center w-full">
          {playbackFormat === 'video' ? (
            <div className="w-full max-w-[360px] aspect-video rounded-3xl overflow-hidden shadow-2xl bg-black border border-white/10 relative flex items-center justify-center">
              {currentTrack.videoSource?.providerTrackId || currentTrack.providerTrackId || currentTrack.id ? (
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(
                    (currentTrack.videoSource?.providerTrackId || currentTrack.providerTrackId || currentTrack.id).replace(/\|.*/, '')
                  )}?autoplay=1&playsinline=1&controls=1&rel=0`}
                  title={currentTrack.title}
                  className="w-full h-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <ArtworkImage
                  src={currentTrack.thumbnail}
                  alt={currentTrack.title}
                  className="w-full h-full object-cover"
                />
              )}
            </div>
          ) : (
            <div
              className={`h-[30vh] max-h-[290px] aspect-square rounded-3xl overflow-hidden shadow-2xl bg-[#141416] border border-white/10 transition-all duration-500 ${
                isPlaying ? 'scale-[1.02] shadow-[0_20px_50px_rgba(255,0,0,0.35)]' : 'scale-95 shadow-black/80'
              }`}
            >
              <ArtworkImage
                src={currentTrack.thumbnail}
                alt={`${currentTrack.title} ${currentTrack.artist}`}
                className="w-full h-full object-cover shadow-inner"
              />
            </div>
          )}
        </div>

        {/* Track Title & Primary Action Controls */}
        <div className="w-full mt-3 mb-1 flex items-center justify-between gap-3 shrink-0">
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
        <div className="w-full flex justify-center py-0.5 shrink-0">
          <AudioVisualizer isPlaying={isPlaying} barCount={26} />
        </div>

        {/* Progress Scrubber */}
        <div className="w-full mt-1.5 shrink-0">
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
        <div className="w-full flex items-center justify-between mt-2 px-1 shrink-0">
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

      {/* 4. EXPANDABLE BOTTOM DRAWER BUTTONS (UP NEXT / LYRICS / RELATED) */}
      <footer className="relative z-10 max-w-md mx-auto w-full px-4 pb-2 shrink-0">
        <div className="grid grid-cols-3 gap-2 p-1 bg-[#141418]/90 backdrop-blur-xl border border-white/10 rounded-2xl">
          <button
            onClick={() => setActiveSheet(activeSheet === 'queue' ? 'none' : 'queue')}
            className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all ${
              activeSheet === 'queue'
                ? 'bg-[#ff0000] text-white shadow-md'
                : 'text-[#aaaaaa] hover:text-white hover:bg-white/5'
            }`}
          >
            <ListMusic className="w-3.5 h-3.5" />
            <span>Up Next</span>
          </button>

          <button
            onClick={() => setActiveSheet(activeSheet === 'lyrics' ? 'none' : 'lyrics')}
            className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all ${
              activeSheet === 'lyrics'
                ? 'bg-[#ff0000] text-white shadow-md'
                : 'text-[#aaaaaa] hover:text-white hover:bg-white/5'
            }`}
          >
            <Mic2 className="w-3.5 h-3.5" />
            <span>Lyrics</span>
          </button>

          <button
            onClick={() => setActiveSheet(activeSheet === 'related' ? 'none' : 'related')}
            className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all ${
              activeSheet === 'related'
                ? 'bg-[#ff0000] text-white shadow-md'
                : 'text-[#aaaaaa] hover:text-white hover:bg-white/5'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Similar</span>
          </button>
        </div>
      </footer>

      {/* 5. SLIDE-UP MODAL SHEET FOR UP NEXT / LYRICS / SIMILAR SONGS */}
      {activeSheet !== 'none' && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col justify-end animate-in fade-in duration-200">
          <div
            className="w-full max-w-lg mx-auto bg-[#14141a] border-t border-white/10 rounded-t-3xl p-5 shadow-2xl flex flex-col max-h-[75vh] animate-in slide-in-from-bottom duration-300"
            style={{ paddingBottom: 'max(var(--sab), 20px)' }}
          >
            {/* Sheet Header */}
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                {activeSheet === 'queue' && <ListMusic className="w-5 h-5 text-[#ff4e4e]" />}
                {activeSheet === 'lyrics' && <Mic2 className="w-5 h-5 text-[#ff4e4e]" />}
                {activeSheet === 'related' && <Sparkles className="w-5 h-5 text-[#ff4e4e]" />}
                <h3 className="font-bold text-base text-white">
                  {activeSheet === 'queue' && 'Up Next Queue'}
                  {activeSheet === 'lyrics' && 'Lyrics'}
                  {activeSheet === 'related' && 'Similar Songs'}
                </h3>
              </div>

              <button
                onClick={() => setActiveSheet('none')}
                className="p-1.5 rounded-full hover:bg-white/10 text-[#888888] hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Sheet Body */}
            <div className="flex-1 overflow-y-auto no-scrollbar py-3 space-y-1">
              {/* TAB 1: UP NEXT QUEUE */}
              {activeSheet === 'queue' && (
                <div className="space-y-1">
                  {queue.map((track, idx) => {
                    const isCurrent = idx === queueIndex;
                    return (
                      <div
                        key={`${track.id}-${idx}`}
                        onClick={() => {
                          playTrack(track, queue);
                          setActiveSheet('none');
                        }}
                        className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-colors ${
                          isCurrent ? 'bg-[#1e1e28] text-white' : 'hover:bg-white/5 text-[#aaaaaa]'
                        }`}
                      >
                        <span className="text-xs font-mono w-4 text-center text-[#717171]">
                          {isCurrent ? <Play className="w-3.5 h-3.5 text-[#ff0000] fill-current" /> : idx + 1}
                        </span>
                        <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-[#1e1e22]">
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
                            className="p-2 text-[#717171] hover:text-white rounded-full hover:bg-white/10"
                            title="Remove from queue"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* TAB 2: SYNCED LYRICS */}
              {activeSheet === 'lyrics' && (
                <div className="p-4 text-center">
                  {activeLyrics ? (
                    <SyncedLyrics
                      lyricsData={activeLyrics}
                      currentTime={currentTime}
                      onLineClick={seek}
                    />
                  ) : (
                    <p className="text-sm text-[#717171] italic py-8">Lyrics not available for this track.</p>
                  )}
                </div>
              )}

              {/* TAB 3: SIMILAR / RELATED SONGS */}
              {activeSheet === 'related' && (
                <div className="space-y-1">
                  {isLoadingRelated ? (
                    <div className="flex items-center justify-center py-10">
                      <Loader2 className="w-6 h-6 text-[#ff0000] animate-spin" />
                    </div>
                  ) : relatedTracks.length > 0 ? (
                    relatedTracks.map((track) => (
                      <div
                        key={track.id}
                        onClick={() => {
                          playTrack(track);
                          setActiveSheet('none');
                        }}
                        className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/5 cursor-pointer transition-colors"
                      >
                        <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-[#1e1e22]">
                          <ArtworkImage src={track.thumbnail} alt={track.title} className="w-full h-full object-cover" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-white truncate">{track.title}</p>
                          <p className="text-[11px] text-[#717171] truncate">{track.artist}</p>
                        </div>
                        <Play className="w-4 h-4 text-[#717171] hover:text-white" />
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-[#717171] text-center py-8">No similar songs found.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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
