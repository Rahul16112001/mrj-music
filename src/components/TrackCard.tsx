import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Pause, Download, Check, Heart, Loader2 } from 'lucide-react';
import { Track } from '../types';
import { useMusicPlayer } from '../context/MusicPlayerContext';
import { TrackContextMenu } from './TrackContextMenu';
import { CreatePlaylistModal } from './CreatePlaylistModal';
import { ArtworkImage } from './ArtworkImage';

interface TrackCardProps {
  track: Track;
  queueContext?: Track[];
  showIndex?: number;
  variant?: 'row' | 'compact' | 'grid' | 'queue';
}

export const TrackCard: React.FC<TrackCardProps> = ({
  track,
  queueContext,
  showIndex,
  variant = 'row',
}) => {
  const {
    currentTrack,
    isPlaying,
    playTrack,
    togglePlay,
    toggleFavorite,
    isFavorite,
    downloadTrack,
    deleteDownloadedTrack,
    downloadedTrackIds,
  } = useMusicPlayer();

  const navigate = useNavigate();
  const [isDownloading, setIsDownloading] = useState(false);
  const [playlistModalTrack, setPlaylistModalTrack] = useState<Track | null>(null);

  const isCurrent = currentTrack?.id === track.id || currentTrack?.canonicalTrackId === track.canonicalTrackId;
  const isLiked = isFavorite(track.id);
  const isDownloaded = downloadedTrackIds.has(track.id);

  const handlePlayClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isCurrent) {
      togglePlay();
    } else {
      playTrack(track, queueContext);
    }
  };

  const handleDownloadToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDownloading(true);
    try {
      if (isDownloaded) {
        await deleteDownloadedTrack(track.id);
      } else {
        await downloadTrack(track);
      }
    } finally {
      setIsDownloading(false);
    }
  };

  const formatDuration = (secs?: number) => {
    if (!secs || isNaN(secs)) return '3:30';
    const min = Math.floor(secs / 60);
    const sec = Math.floor(secs % 60);
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
  };

  // GRID VARIANT
  if (variant === 'grid') {
    return (
      <>
        <div
          onClick={handlePlayClick}
          className="p-3 rounded-2xl bg-[#121215] hover:bg-[#1c1c20] border border-[#222226]/50 cursor-pointer transition-all hover:scale-[1.02] group select-none flex flex-col justify-between"
        >
          <div className="relative aspect-square rounded-xl overflow-hidden mb-3 bg-[#1e1e22] shadow-md">
            <ArtworkImage
              src={track.thumbnail}
              alt={track.title}
              aspectRatio="square"
              size="custom"
              className="w-full h-full group-hover:scale-105 transition-transform duration-300"
            />
            {/* Play Overlay */}
            <div
              className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity ${
                isCurrent ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
              }`}
            >
              <div className="w-10 h-10 rounded-full bg-[#ff0000] text-white flex items-center justify-center shadow-lg">
                {isCurrent && isPlaying ? (
                  <Pause className="w-5 h-5 fill-white" />
                ) : (
                  <Play className="w-5 h-5 fill-white ml-0.5" />
                )}
              </div>
            </div>
          </div>

          <div className="min-w-0">
            <h4
              className={`text-xs sm:text-sm font-bold truncate ${
                isCurrent ? 'text-[#ff4e4e]' : 'text-white'
              }`}
            >
              {track.title}
            </h4>
            <p className="text-[11px] text-[#888888] truncate mt-0.5 hover:underline" onClick={(e) => {
              e.stopPropagation();
              navigate(`/artist/${encodeURIComponent(track.artist)}`);
            }}>
              {track.artist}
            </p>
          </div>
        </div>

        {playlistModalTrack && (
          <CreatePlaylistModal
            isOpen={!!playlistModalTrack}
            onClose={() => setPlaylistModalTrack(null)}
            trackToAdd={playlistModalTrack}
          />
        )}
      </>
    );
  }

  // COMPACT VARIANT (Quick Picks & Mobile Rows)
  if (variant === 'compact') {
    return (
      <>
        <div
          onClick={handlePlayClick}
          className={`flex items-center justify-between p-2 rounded-xl cursor-pointer select-none transition-all group min-h-[52px] ${
            isCurrent ? 'bg-white/10' : 'hover:bg-white/5 active:bg-white/10'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="relative w-11 h-11 rounded-lg overflow-hidden shrink-0 bg-[#1e1e22] shadow-sm">
              <ArtworkImage
                src={track.thumbnail}
                alt={track.title}
                aspectRatio="square"
                size="custom"
                className="w-full h-full"
              />
              {isCurrent && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  {isPlaying ? (
                    <Pause className="w-4 h-4 text-white fill-white" />
                  ) : (
                    <Play className="w-4 h-4 text-white fill-white ml-0.5" />
                  )}
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p
                className={`text-xs font-bold truncate ${
                  isCurrent ? 'text-[#ff4e4e]' : 'text-white'
                }`}
              >
                {track.title}
              </p>
              <p className="text-[11px] text-[#888888] truncate mt-0.5">
                {track.artist}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0 ml-2">
            <TrackContextMenu
              track={track}
              onOpenPlaylistModal={(t) => setPlaylistModalTrack(t)}
            />
          </div>
        </div>

        {playlistModalTrack && (
          <CreatePlaylistModal
            isOpen={!!playlistModalTrack}
            onClose={() => setPlaylistModalTrack(null)}
            trackToAdd={playlistModalTrack}
          />
        )}
      </>
    );
  }

  // DEFAULT ROW VARIANT
  return (
    <>
      <div
        onClick={handlePlayClick}
        className={`flex items-center justify-between p-2 sm:p-2.5 rounded-xl cursor-pointer select-none transition-all group min-h-[56px] ${
          isCurrent ? 'bg-white/10' : 'hover:bg-white/5 active:bg-white/10'
        }`}
      >
        <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
          {showIndex !== undefined && (
            <span className="w-5 text-center text-xs font-mono text-[#666666] shrink-0">
              {showIndex}
            </span>
          )}

          <div className="relative w-11 h-11 sm:w-12 sm:h-12 rounded-lg overflow-hidden shrink-0 bg-[#1e1e22] shadow-sm">
            <ArtworkImage
              src={track.thumbnail}
              alt={track.title}
              aspectRatio="square"
              size="custom"
              className="w-full h-full"
            />
            <div
              className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity ${
                isCurrent ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
              }`}
            >
              {isCurrent && isPlaying ? (
                <Pause className="w-4 h-4 text-white fill-white" />
              ) : (
                <Play className="w-4 h-4 text-white fill-white ml-0.5" />
              )}
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <p
              className={`text-xs sm:text-sm font-bold truncate ${
                isCurrent ? 'text-[#ff4e4e]' : 'text-white'
              }`}
            >
              {track.title}
            </p>
            <p className="text-[11px] sm:text-xs text-[#888888] truncate mt-0.5">
              {track.artist}
            </p>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0 ml-3">
          <span className="text-[11px] font-mono text-[#666666] hidden sm:inline">
            {formatDuration(track.duration)}
          </span>

          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleFavorite(track);
            }}
            className={`p-2 rounded-full hover:bg-white/10 transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center ${
              isLiked ? 'text-[#ff0000]' : 'text-[#666666] hover:text-white'
            }`}
            aria-label="Like"
          >
            <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
          </button>

          <button
            onClick={handleDownloadToggle}
            disabled={isDownloading}
            className={`p-2 rounded-full hover:bg-white/10 transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center ${
              isDownloaded ? 'text-emerald-400' : 'text-[#666666] hover:text-white'
            }`}
            aria-label="Download"
          >
            {isDownloading ? (
              <Loader2 className="w-4 h-4 animate-spin text-[#ff0000]" />
            ) : isDownloaded ? (
              <Check className="w-4 h-4 text-emerald-400" />
            ) : (
              <Download className="w-4 h-4" />
            )}
          </button>

          <TrackContextMenu
            track={track}
            onOpenPlaylistModal={(t) => setPlaylistModalTrack(t)}
          />
        </div>
      </div>

      {playlistModalTrack && (
        <CreatePlaylistModal
          isOpen={!!playlistModalTrack}
          onClose={() => setPlaylistModalTrack(null)}
          trackToAdd={playlistModalTrack}
        />
      )}
    </>
  );
};
