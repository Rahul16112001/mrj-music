import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, Clock, Play, ListMusic, Plus, Download, Sparkles } from 'lucide-react';
import { Track } from '../types';
import { useMusicPlayer } from '../context/MusicPlayerContext';
import { offlineStorage } from '../services/offlineStorage';
import { TrackCard } from '../components/TrackCard';
import { CreatePlaylistModal } from '../components/CreatePlaylistModal';
import { ArtworkImage } from '../components/ArtworkImage';

export const Library: React.FC = () => {
  const navigate = useNavigate();
  const { playTrack, downloadTrack, playlists, likedTrackIds } = useMusicPlayer();
  const [activeTab, setActiveTab] = useState<'playlists' | 'liked' | 'history'>('playlists');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [likedTracks, setLikedTracks] = useState<Track[]>([]);
  const [historyTracks, setHistoryTracks] = useState<Track[]>([]);

  useEffect(() => {
    offlineStorage.getLikedTracks().then(setLikedTracks);
    offlineStorage.getHistory().then(setHistoryTracks);
  }, [activeTab, likedTrackIds]);

  const handleDownloadAllLiked = async () => {
    for (const t of likedTracks) {
      await downloadTrack(t);
    }
  };

  return (
    <div className="p-3 sm:p-6 md:p-8 space-y-6 max-w-7xl mx-auto pb-mobile-player-nav select-none">
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Your Library</h1>
          <p className="text-xs text-[#888888] mt-0.5">Playlists, favorite tracks, and listening history</p>
        </div>

        {/* Tab Toggle */}
        <div className="flex items-center gap-1 p-1 rounded-full bg-[#141417] border border-[#26262a] w-full sm:w-fit overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('playlists')}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-full text-xs font-bold transition-all min-h-[38px] ${
              activeTab === 'playlists'
                ? 'bg-white text-black shadow-md'
                : 'text-[#888888] hover:text-white'
            }`}
          >
            Playlists ({playlists.length})
          </button>
          <button
            onClick={() => setActiveTab('liked')}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-full text-xs font-bold transition-all min-h-[38px] ${
              activeTab === 'liked'
                ? 'bg-white text-black shadow-md'
                : 'text-[#888888] hover:text-white'
            }`}
          >
            Liked ({likedTracks.length})
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-full text-xs font-bold transition-all min-h-[38px] ${
              activeTab === 'history'
                ? 'bg-white text-black shadow-md'
                : 'text-[#888888] hover:text-white'
            }`}
          >
            History ({historyTracks.length})
          </button>
        </div>
      </div>

      {/* 1. PLAYLISTS TAB */}
      {activeTab === 'playlists' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base sm:text-lg font-bold text-white">Custom Playlists</h2>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="px-4 py-2 rounded-full bg-[#ff0000] hover:bg-[#cc0000] text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-red-600/30 transition-all active:scale-95 min-h-[36px]"
            >
              <Plus className="w-4 h-4" />
              <span>New Playlist</span>
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {/* Create Playlist Tile */}
            <div
              onClick={() => setIsCreateModalOpen(true)}
              className="p-4 rounded-2xl bg-[#141417] hover:bg-[#1e1e22] border border-dashed border-[#333338] hover:border-white cursor-pointer transition-all flex flex-col items-center justify-center text-center h-48 group"
            >
              <div className="w-10 h-10 rounded-full bg-[#222226] group-hover:bg-[#ff0000] text-white flex items-center justify-center mb-2 transition-colors">
                <Plus className="w-5 h-5" />
              </div>
              <h4 className="text-xs font-bold text-white">Create Playlist</h4>
              <p className="text-[10px] text-[#888888] mt-0.5">Add songs anytime</p>
            </div>

            {/* Existing Playlists */}
            {playlists.map((pl) => (
              <div
                key={pl.id}
                onClick={() => navigate(`/playlist/${pl.id}`)}
                className="p-3 rounded-2xl bg-[#141417] hover:bg-[#1e1e22] border border-[#222226] cursor-pointer transition-all hover:scale-[1.02] group flex flex-col justify-between"
              >
                <div className="aspect-square rounded-xl overflow-hidden mb-2 bg-[#222226] shadow-md relative">
                  {pl.tracks && pl.tracks[0]?.thumbnail ? (
                    <ArtworkImage src={pl.tracks[0].thumbnail} alt={pl.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[#555555]">
                      <ListMusic className="w-8 h-8" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <div className="w-9 h-9 rounded-full bg-[#ff0000] text-white flex items-center justify-center shadow-lg">
                      <Play className="w-4 h-4 fill-white ml-0.5" />
                    </div>
                  </div>
                </div>
                <h4 className="text-xs font-bold text-white truncate">{pl.title}</h4>
                <p className="text-[10px] text-[#888888] mt-0.5">{pl.tracks?.length || 0} tracks</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. LIKED TRACKS TAB */}
      {activeTab === 'liked' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base sm:text-lg font-bold text-white">Favorite Songs</h2>
            {likedTracks.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => playTrack(likedTracks[0], likedTracks)}
                  className="px-4 py-2 rounded-full bg-[#ff0000] hover:bg-[#cc0000] text-white font-bold text-xs flex items-center gap-1.5 shadow-lg active:scale-95 transition-transform min-h-[36px]"
                >
                  <Play className="w-3.5 h-3.5 fill-white" />
                  <span>Play All</span>
                </button>
              </div>
            )}
          </div>

          {likedTracks.length > 0 ? (
            <div className="space-y-1">
              {likedTracks.map((track, idx) => (
                <TrackCard
                  key={track.id}
                  track={track}
                  showIndex={idx + 1}
                  queueContext={likedTracks}
                  variant="row"
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-3 bg-[#141417] border border-[#222226] rounded-3xl p-8">
              <Heart className="w-10 h-10 text-[#444444]" />
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white">No Liked Songs Yet</h3>
                <p className="text-xs text-[#888888] max-w-sm">
                  Tap the heart on any song to save it to your Favorites library.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. HISTORY TAB */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          <h2 className="text-base sm:text-lg font-bold text-white">Listening History</h2>
          {historyTracks.length > 0 ? (
            <div className="space-y-1">
              {historyTracks.map((track, idx) => (
                <TrackCard
                  key={`${track.id}-${idx}`}
                  track={track}
                  showIndex={idx + 1}
                  queueContext={historyTracks}
                  variant="row"
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-3 bg-[#141417] border border-[#222226] rounded-3xl p-8">
              <Clock className="w-10 h-10 text-[#444444]" />
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white">No Listening History</h3>
                <p className="text-xs text-[#888888] max-w-sm">
                  Songs you play will appear here so you can easily replay them.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {isCreateModalOpen && (
        <CreatePlaylistModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
        />
      )}
    </div>
  );
};
