import React, { useState } from 'react';
import { Play, Pause, Download, Check, Heart, Plus, Loader2, MoreVertical, Disc3 } from 'lucide-react';
import { Track } from '../types';
import { useMusicPlayer } from '../context/MusicPlayerContext';

interface TrackCardProps {
  track: Track;
  queueContext?: Track[];
  showIndex?: number;
}

export const TrackCard: React.FC<TrackCardProps> = ({ track, queueContext, showIndex }) => {
  const {
    currentTrack,
    isPlaying,
    playTrack,
    togglePlay,
    addToQueue,
    toggleFavorite,
    isFavorite,
    downloadTrack,
    deleteDownloadedTrack,
    downloadedTrackIds,
  } = useMusicPlayer();

  const [isDownloading, setIsDownloading] = useState(false);

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

  const formatDuration = (secs: number) => {
    const min = Math.floor(secs / 60);
    const sec = Math.floor(secs % 60);
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
  };

  return (
    <div
      onClick={handlePlayClick}
      className={`group relative flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all ${
        isCurrent ? 'bg-[#262626]' : 'hover:bg-[#181818]'
      }`}
    >
      <div className="flex items-center gap-3.5 min-w-0 flex-1">
        {/* Optional Ranked Index Number */}
        {showIndex !== undefined && (
          <span className={`w-5 text-center font-bold text-sm shrink-0 ${
            isCurrent ? 'text-[#ff0000]' : 'text-[#717171]'
          }`}>
            {showIndex + 1}
          </span>
        )}

        {/* Thumbnail with Circular Play Overlay */}
        <div className="relative w-12 h-12 rounded-lg overflow-hidden shrink-0 bg-[#212121] shadow-md">
          <img
            src={track.thumbnail}
            alt={track.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
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

        {/* Track Title and Artist */}
        <div className="min-w-0 flex-1">
          <h4
            className={`text-sm font-bold truncate ${
              isCurrent ? 'text-[#ff4e4e]' : 'text-white'
            }`}
          >
            {track.title}
          </h4>
          <p className="text-xs text-[#aaaaaa] truncate mt-0.5">
            {track.artist}
            {track.views && <span className="text-[#717171]"> • {track.views}</span>}
          </p>
        </div>
      </div>

      {/* Right Hover Actions */}
      <div className="flex items-center gap-1 shrink-0 ml-2">
        {/* Like */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleFavorite(track);
          }}
          className={`p-1.5 rounded-full hover:bg-[#282828] transition-colors ${
            isLiked ? 'text-[#ff0000]' : 'opacity-0 group-hover:opacity-100 text-[#aaaaaa] hover:text-white'
          }`}
          title="Like"
        >
          <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
        </button>

        {/* Download */}
        <button
          onClick={handleDownloadToggle}
          disabled={isDownloading}
          className={`p-1.5 rounded-full hover:bg-[#282828] transition-colors ${
            isDownloaded ? 'text-emerald-400' : 'opacity-0 group-hover:opacity-100 text-[#aaaaaa] hover:text-white'
          }`}
          title={isDownloaded ? 'Downloaded Offline' : 'Download'}
        >
          {isDownloading ? (
            <Loader2 className="w-4 h-4 animate-spin text-[#ff0000]" />
          ) : isDownloaded ? (
            <Check className="w-4 h-4 text-emerald-400" />
          ) : (
            <Download className="w-4 h-4" />
          )}
        </button>

        {/* Add to Queue */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            addToQueue(track);
          }}
          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-full hover:bg-[#282828] text-[#aaaaaa] hover:text-white transition-colors"
          title="Add to queue"
        >
          <Plus className="w-4 h-4" />
        </button>

        {/* Duration */}
        <span className="text-xs font-semibold text-[#717171] w-10 text-right group-hover:hidden">
          {formatDuration(track.duration)}
        </span>
      </div>
    </div>
  );
};
