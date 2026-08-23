import React from 'react';
import { Play, Trash2, Music2, Download, Radio, X, Sparkles, Plus } from 'lucide-react';
import { useMusicPlayer } from '../context/MusicPlayerContext';

interface QueueDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const QueueDrawer: React.FC<QueueDrawerProps> = ({ isOpen, onClose }) => {
  const {
    currentTrack,
    queue,
    queueIndex,
    autoplayEnabled,
    toggleAutoplay,
    playTrack,
    removeFromQueue,
    clearQueue,
    downloadedTrackIds,
  } = useMusicPlayer();

  if (!isOpen) return null;

  const nowPlaying = currentTrack || (queue.length > 0 ? queue[queueIndex] : null);
  const upNextTracks = queue.slice(queueIndex + 1);

  return (
    <div className="fixed inset-y-0 right-0 w-full max-w-md bg-[#121212]/95 backdrop-blur-2xl border-l border-[#242424] z-50 flex flex-col shadow-2xl animate-in slide-in-from-right duration-300 select-none">
      {/* Header */}
      <div className="p-4 border-b border-[#242424] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Music2 className="w-5 h-5 text-[#ff0000]" />
          <h2 className="text-base font-black text-white tracking-tight">
            Up Next Queue ({queue.length})
          </h2>
        </div>

        <div className="flex items-center gap-2">
          {/* Autoplay Toggle */}
          <button
            onClick={toggleAutoplay}
            className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold transition-all border ${
              autoplayEnabled
                ? 'bg-[#ff0000]/20 text-[#ff4e4e] border-[#ff0000]/40'
                : 'bg-[#222222] text-[#888888] border-[#333333]'
            }`}
          >
            <Sparkles className="w-3 h-3" />
            <span>Autoplay {autoplayEnabled ? 'ON' : 'OFF'}</span>
          </button>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-[#222222] text-[#aaaaaa] hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Queue Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 no-scrollbar">
        {/* 1. NOW PLAYING */}
        {nowPlaying && (
          <div className="space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#888888]">
              Now Playing
            </span>
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-[#1c1c1c] border border-[#2e2e2e] shadow-md">
              <img
                src={nowPlaying.thumbnail}
                alt={nowPlaying.title}
                className="w-12 h-12 rounded-xl object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-[#ff4e4e] truncate">{nowPlaying.title}</p>
                <p className="text-xs text-[#aaaaaa] truncate mt-0.5">{nowPlaying.artist}</p>
              </div>
            </div>
          </div>
        )}

        {/* 2. UP NEXT */}
        {upNextTracks.length > 0 ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#888888]">
                Up Next ({upNextTracks.length})
              </span>
              <button
                onClick={clearQueue}
                className="text-[10px] text-[#777777] hover:text-[#ff4e4e] font-semibold transition-colors"
              >
                Clear Upcoming
              </button>
            </div>

            <div className="space-y-1">
              {upNextTracks.map((track, idx) => {
                const isDownloaded = downloadedTrackIds.has(track.id);

                return (
                  <div
                    key={`drawer-q-${track.id}-${idx}`}
                    className="group flex items-center justify-between p-2 rounded-xl hover:bg-[#1a1a1a] transition-all cursor-pointer"
                    onClick={() => playTrack(track)}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={track.thumbnail}
                        alt={track.title}
                        className="w-10 h-10 rounded-lg object-cover bg-[#222222]"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white group-hover:text-[#ff4e4e] truncate transition-colors">
                          {track.title}
                        </p>
                        <p className="text-xs text-[#aaaaaa] truncate">{track.artist}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {isDownloaded && (
                        <span title="Available Offline">
                          <Download className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        </span>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFromQueue(queueIndex + 1 + idx);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-[#282828] text-[#777777] hover:text-[#ff4e4e] transition-all"
                        title="Remove from queue"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="text-center py-12 text-[#777777] space-y-2">
            <Radio className="w-8 h-8 mx-auto opacity-50 text-[#ff0000]" />
            <p className="text-xs font-bold">No upcoming tracks</p>
            <p className="text-[11px] text-[#555555]">
              {autoplayEnabled ? 'Autoplay will generate similar music when this song ends' : 'Turn on Autoplay to continue listening'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
