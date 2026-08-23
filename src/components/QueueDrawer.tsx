import React from 'react';
import { Play, Trash2, Music2, Download, Radio, X } from 'lucide-react';
import { useMusicPlayer } from '../context/MusicPlayerContext';

interface QueueDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const QueueDrawer: React.FC<QueueDrawerProps> = ({ isOpen, onClose }) => {
  const { queue, queueIndex, playTrack, removeFromQueue, downloadedTrackIds } = useMusicPlayer();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-full max-w-md bg-dark-900/95 backdrop-blur-2xl border-l border-dark-800 z-50 flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
      {/* Header */}
      <div className="p-4 border-b border-dark-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Music2 className="w-5 h-5 text-mrj-400" />
          <h2 className="text-base font-bold text-gray-100">Playing Queue ({queue.length})</h2>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-full hover:bg-dark-800 text-gray-400 hover:text-gray-200 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Queue List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {queue.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <Radio className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm font-semibold">Queue is empty</p>
            <p className="text-xs text-gray-600">Play any track or start radio</p>
          </div>
        ) : (
          queue.map((track, idx) => {
            const isCurrent = idx === queueIndex;
            const isDownloaded = downloadedTrackIds.has(track.id);

            return (
              <div
                key={`${track.id}-${idx}`}
                className={`group flex items-center gap-3 p-2.5 rounded-xl transition-all ${
                  isCurrent
                    ? 'bg-mrj-600/20 border border-mrj-500/40 text-white'
                    : 'hover:bg-dark-850 text-gray-300'
                }`}
              >
                {/* Thumbnail / Play Button */}
                <div
                  onClick={() => playTrack(track)}
                  className="relative w-11 h-11 rounded-lg overflow-hidden shrink-0 cursor-pointer"
                >
                  <img
                    src={track.thumbnail}
                    alt={track.title}
                    className="w-full h-full object-cover"
                  />
                  {isCurrent && (
                    <div className="absolute inset-0 bg-mrj-600/60 flex items-center justify-center">
                      <div className="w-2.5 h-2.5 rounded-full bg-white animate-ping" />
                    </div>
                  )}
                </div>

                {/* Track Details */}
                <div
                  onClick={() => playTrack(track)}
                  className="flex-1 min-w-0 cursor-pointer"
                >
                  <p className={`text-sm font-semibold truncate ${isCurrent ? 'text-mrj-400' : 'text-gray-200'}`}>
                    {track.title}
                  </p>
                  <p className="text-xs text-gray-400 truncate">{track.artist}</p>
                </div>

                {/* Badges & Actions */}
                <div className="flex items-center gap-2">
                  {isDownloaded && (
                    <span title="Available Offline">
                      <Download className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    </span>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFromQueue(idx);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-dark-750 text-gray-400 hover:text-red-400 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
