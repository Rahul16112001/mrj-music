import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, Clock, Play, ListMusic, Plus, Download, Sparkles } from 'lucide-react';
import { Track } from '../types';
import { useMusicPlayer } from '../context/MusicPlayerContext';
import { offlineStorage } from '../services/offlineStorage';
import { TrackCard } from '../components/TrackCard';
import { CreatePlaylistModal } from '../components/CreatePlaylistModal';

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
    <div className="p-4 md:p-8 space-y-8 max-w-7xl mx-auto pb-40 select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">Your Library</h1>
          <p className="text-xs text-[#aaaaaa] mt-1">Playlists, favorite tracks, and listening history</p>
        </div>

        {/* Tab Toggle */}
        <div className="flex items-center gap-1.5 p-1 rounded-full bg-[#181818] border border-[#262626] w-fit">
          <button
            onClick={() => setActiveTab('playlists')}
            className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${
              activeTab === 'playlists'
                ? 'bg-white text-black shadow-md'
                : 'text-[#aaaaaa] hover:text-white'
            }`}
          >
            Playlists ({playlists.length})
          </button>
          <button
            onClick={() => setActiveTab('liked')}
            className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${
              activeTab === 'liked'
                ? 'bg-white text-black shadow-md'
                : 'text-[#aaaaaa] hover:text-white'
            }`}
          >
            Liked ({likedTracks.length})
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${
              activeTab === 'history'
                ? 'bg-white text-black shadow-md'
                : 'text-[#aaaaaa] hover:text-white'
            }`}
          >
            History ({historyTracks.length})
          </button>
        </div>
      </div>

      {/* 1. PLAYLISTS TAB */}
      {activeTab === 'playlists' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">Custom Playlists</h2>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="px-4 py-2 rounded-full bg-[#ff0000] hover:bg-[#cc0000] text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-red-600/30 transition-all hover:scale-105"
            >
              <Plus className="w-4 h-4" />
              <span>New Playlist</span>
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {/* Create Playlist Tile */}
            <div
              onClick={() => setIsCreateModalOpen(true)}
              className="p-4 rounded-2xl bg-[#181818] hover:bg-[#212121] border border-dashed border-[#333333] hover:border-white cursor-pointer transition-all flex flex-col items-center justify-center text-center h-52 group"
            >
              <div className="w-12 h-12 rounded-full bg-[#282828] group-hover:bg-[#ff0000] text-white flex items-center justify-center mb-3 transition-colors">
                <Plus className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-white">Create Playlist</h4>
              <p className="text-[10px] text-[#aaaaaa] mt-1">Add tracks anytime</p>
            </div>

            {/* Existing Playlists */}
            {playlists.map((pl) => (
              <div
                key={pl.id}
                onClick={() => navigate(`/playlist/${pl.id}`)}
                className="p-3.5 rounded-2xl bg-[#181818] hover:bg-[#212121] border border-[#262626] cursor-pointer transition-all hover:scale-105 group"
              >
                <div className="aspect-square rounded-xl overflow-hidden mb-3 bg-[#242424] flex items-center justify-center shadow-md">
                  {pl.thumbnail ? (
                    <img src={pl.thumbnail} alt={pl.title} className="w-full h-full object-cover" />
                  ) : (
                    <ListMusic className="w-12 h-12 text-[#ff0000]" />
                  )}
                </div>
                <h4 className="text-sm font-bold text-white group-hover:text-[#ff4e4e] truncate">
                  {pl.title}
                </h4>
                <p className="text-[10px] text-[#aaaaaa] mt-0.5">{pl.trackCount} tracks</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. LIKED SONGS TAB */}
      {activeTab === 'liked' && (
        <div className="space-y-4">
          {likedTracks.length > 0 && (
            <div className="flex items-center gap-3">
              <button
                onClick={() => playTrack(likedTracks[0], likedTracks)}
                className="px-5 py-2 rounded-full bg-[#ff0000] hover:bg-[#cc0000] text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-red-600/30 transition-all hover:scale-105"
              >
                <Play className="w-3.5 h-3.5 fill-white" />
                <span>Play All Liked</span>
              </button>
              <button
                onClick={handleDownloadAllLiked}
                className="px-4 py-2 rounded-full bg-[#212121] hover:bg-[#282828] border border-[#333333] text-xs font-bold text-white flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                <span>Download All Offline</span>
              </button>
            </div>
          )}

          {likedTracks.length === 0 ? (
            <div className="text-center py-20 bg-[#121212] rounded-3xl border border-[#212121] space-y-2">
              <Heart className="w-10 h-10 text-[#717171] mx-auto" />
              <h3 className="text-base font-bold text-white">No Liked Songs Yet</h3>
              <p className="text-xs text-[#aaaaaa]">Click the heart icon on any song to save it here</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {likedTracks.map((track, idx) => (
                <TrackCard key={`liked-${track.id}`} track={track} queueContext={likedTracks} showIndex={idx} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* 3. HISTORY TAB */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          {historyTracks.length === 0 ? (
            <div className="text-center py-20 bg-[#121212] rounded-3xl border border-[#212121] space-y-2">
              <Clock className="w-10 h-10 text-[#717171] mx-auto" />
              <h3 className="text-base font-bold text-white">No Listening History</h3>
              <p className="text-xs text-[#aaaaaa]">Songs you play will appear here automatically</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {historyTracks.map((track, idx) => (
                <TrackCard key={`hist-${track.id}-${idx}`} track={track} queueContext={historyTracks} showIndex={idx} />
              ))}
            </div>
          )}
        </div>
      )}

      <CreatePlaylistModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />
    </div>
  );
};
