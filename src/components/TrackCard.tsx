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

  const isCurrent = currentTrack?.id === track.id;
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
          className="p-3 rounded-2xl bg-[#141414] hover:bg-[#202020] border border-[#222222]/50 cursor-pointer transition-all hover:scale-[1.02] group select-none flex flex-col justify-between"
        >
          <div className="relative aspect-square rounded-xl overflow-hidden mb-3 bg-[#1e1e1e] shadow-md">
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
              <div className="w-10 h-10 rounded-full bg-[#ff0000] text-white flex items-center justify-center shadow-lg shadow-red-600/30">
                {isCurrent && isPlaying ? (
                  <Pause className="w-5 h-5 fill-white" />
                ) : (
                  <Play className="w-5 h-5 fill-white ml-0.5" />
                )}
              </div>
            </div>
          </div>

          <div className="min-w-0">
            <h4 className={`text-sm font-bold truncate ${isCurrent ? 'text-[#ff4e4e]' : 'text-white'}`}>
              {track.title}
            </h4>
            <p
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/artist/${encodeURIComponent(track.artist)}`);
              }}
              className="text-xs text-[#aaaaaa] hover:text-white truncate mt-0.5 transition-colors"
            >
              {track.artist}
            </p>
          </div>
        </div>

        <CreatePlaylistModal
          isOpen={playlistModalTrack !== null}
          onClose={() => setPlaylistModalTrack(null)}
          trackToAdd={playlistModalTrack}
        />
      </>
    );
  }

  // DEFAULT / ROW VARIANT
  return (
    <>
      <div
        onClick={handlePlayClick}
        className={`group relative flex items-center justify-between p-2 rounded-xl cursor-pointer transition-all border border-transparent select-none ${
          isCurrent
            ? 'bg-[#222222] border-[#333333]'
            : 'hover:bg-[#181818] hover:border-[#262626]'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {/* Optional Ranked Index */}
          {showIndex !== undefined && (
            <span
              className={`w-5 text-center font-black text-xs shrink-0 ${
                isCurrent ? 'text-[#ff0000]' : 'text-[#717171]'
              }`}
            >
              {showIndex + 1}
            </span>
          )}

          {/* Artwork with play overlay */}
          <div className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-[#1e1e1e] shadow-md">
            <ArtworkImage
              src={track.thumbnail}
              alt={track.title}
              aspectRatio="square"
              size="custom"
              className="w-full h-full group-hover:scale-105 transition-transform duration-300"
            />
            <div
              className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity ${
                isCurrent ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
              }`}
            >
              {isCurrent && isPlaying ? (
                <div className="w-7 h-7 rounded-full bg-white text-black flex items-center justify-center shadow-lg">
                  <Pause className="w-3.5 h-3.5 fill-current text-black" />
                </div>
              ) : (
                <div className="w-7 h-7 rounded-full bg-white text-black flex items-center justify-center shadow-lg">
                  <Play className="w-3.5 h-3.5 fill-current text-black ml-0.5" />
                </div>
              )}
            </div>
          </div>

          {/* Title & Artist */}
          <div className="min-w-0 flex-1 pr-2">
            <h4
              className={`text-xs md:text-sm font-bold truncate leading-tight ${
                isCurrent ? 'text-[#ff4e4e]' : 'text-white'
              }`}
            >
              {track.title}
            </h4>
            <p
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/artist/${encodeURIComponent(track.artist)}`);
              }}
              className="text-[11px] md:text-xs text-[#aaaaaa] hover:text-white truncate mt-0.5 transition-colors"
            >
              {track.artist}
              {track.album && track.album !== 'Single'
                ? ` • ${track.album}`
                : track.releaseYear
                ? ` • ${track.releaseYear}`
                : ''}
            </p>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-1 shrink-0 ml-1">
          {/* Like Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleFavorite(track);
            }}
            className={`p-1.5 rounded-full hover:bg-[#282828] transition-colors ${
              isLiked
                ? 'text-[#ff0000]'
                : 'opacity-0 group-hover:opacity-100 text-[#aaaaaa] hover:text-white'
            }`}
            title="Like"
          >
            <Heart className={`w-3.5 h-3.5 ${isLiked ? 'fill-current' : ''}`} />
          </button>

          {/* Download Button */}
          <button
            onClick={handleDownloadToggle}
            disabled={isDownloading}
            className={`p-1.5 rounded-full hover:bg-[#282828] transition-colors ${
              isDownloaded
                ? 'text-emerald-400'
                : 'opacity-0 group-hover:opacity-100 text-[#aaaaaa] hover:text-white'
            }`}
            title={isDownloaded ? 'Downloaded Offline' : 'Download'}
          >
            {isDownloading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#ff0000]" />
            ) : isDownloaded ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
          </button>

          {/* Context Menu (3-dots) */}
          <TrackContextMenu
            track={track}
            onOpenPlaylistModal={(t) => setPlaylistModalTrack(t)}
          />

          {/* Duration */}
          <span className="text-[11px] font-semibold text-[#717171] w-9 text-right hidden sm:inline">
            {formatDuration(track.duration)}
          </span>
        </div>
      </div>

      <CreatePlaylistModal
        isOpen={playlistModalTrack !== null}
        onClose={() => setPlaylistModalTrack(null)}
        trackToAdd={playlistModalTrack}
      />
    </>
  );
};
