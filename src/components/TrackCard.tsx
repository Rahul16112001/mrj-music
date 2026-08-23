import React, { useState } from 'react';
import { Play, Pause, Download, Check, Heart, MoreVertical, Plus } from 'lucide-react';
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
    toggleFavorite,
    isFavorite,
    downloadTrack,
    downloadedTrackIds,
    addToQueue,
  } = useMusicPlayer();

  const [isDownloading, setIsDownloading] = useState(false);
  const isCurrent = currentTrack?.id === track.id;
  const isFav = isFavorite(track.id);
  const isDownloaded = downloadedTrackIds.has(track.id);

  const handlePlayClick = () => {
    if (isCurrent) {
      togglePlay();
    } else {
      playTrack(track, queueContext);
    }
  };

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDownloaded || isDownloading) return;
    setIsDownloading(true);
    await downloadTrack(track);
    setIsDownloading(false);
  };

  const formatDuration = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const remainingSec = sec % 60;
    return `${mins}:${remainingSec < 10 ? '0' : ''}${remainingSec}`;
  };

  return (
    <div
      onClick={handlePlayClick}
      className={`group relative flex items-center justify-between p-2.5 rounded-2xl transition-all cursor-pointer select-none ${
        isCurrent
          ? 'bg-mrj-600/15 border border-mrj-500/40 shadow-lg shadow-mrj-500/10'
          : 'hover:bg-dark-850 border border-transparent hover:border-dark-750'
      }`}
    >
      <div className="flex items-center gap-3.5 min-w-0">
        {/* Optional Index */}
        {showIndex !== undefined && (
          <span className="w-5 text-center text-xs font-bold text-gray-500 group-hover:hidden">
            {showIndex + 1}
          </span>
        )}

        {/* Thumbnail & Hover Play Overlay */}
        <div className="relative w-14 h-14 rounded-xl overflow-hidden shrink-0 bg-dark-800 shadow-md">
          <img
            src={track.thumbnail}
            alt={track.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
          <div
            className={`absolute inset-0 bg-dark-950/60 backdrop-blur-xs flex items-center justify-center transition-opacity ${
              isCurrent ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
            }`}
          >
            {isCurrent && isPlaying ? (
              <Pause className="w-6 h-6 text-white drop-shadow" />
            ) : (
              <Play className="w-6 h-6 text-white fill-white drop-shadow ml-0.5" />
            )}
          </div>
        </div>

        {/* Title & Artist */}
        <div className="min-w-0">
          <h3
            className={`text-sm font-bold truncate leading-snug ${
              isCurrent ? 'text-mrj-400' : 'text-gray-100 group-hover:text-white'
            }`}
          >
            {track.title}
          </h3>
          <p className="text-xs text-gray-400 truncate mt-0.5">{track.artist}</p>
          {track.views && (
            <span className="text-[10px] text-gray-500 mt-0.5 block">{track.views} views</span>
          )}
        </div>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Duration */}
        <span className="text-xs text-gray-400 font-medium hidden sm:block">
          {formatDuration(track.duration || 210)}
        </span>

        {/* Favorite */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleFavorite(track);
          }}
          className={`p-2 rounded-full hover:bg-dark-750 transition-colors ${
            isFav ? 'text-mrj-500' : 'text-gray-400 hover:text-gray-200'
          }`}
          title={isFav ? 'Remove from favorites' : 'Add to favorites'}
        >
          <Heart className={`w-4 h-4 ${isFav ? 'fill-mrj-500' : ''}`} />
        </button>

        {/* Offline Download Button */}
        <button
          onClick={handleDownload}
          disabled={isDownloading}
          className={`p-2 rounded-full hover:bg-dark-750 transition-colors ${
            isDownloaded
              ? 'text-emerald-400'
              : isDownloading
              ? 'text-amber-400 animate-spin'
              : 'text-gray-400 hover:text-gray-200 opacity-0 group-hover:opacity-100'
          }`}
          title={isDownloaded ? 'Downloaded Offline' : 'Download for Zero-Data Offline Playback'}
        >
          {isDownloaded ? (
            <Check className="w-4 h-4" />
          ) : isDownloading ? (
            <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
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
          className="p-2 rounded-full hover:bg-dark-750 text-gray-400 hover:text-gray-200 opacity-0 group-hover:opacity-100 transition-all"
          title="Add to queue"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
