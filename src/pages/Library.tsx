import React, { useState } from 'react';
import { Heart, Clock, Play, ListMusic, Plus, Download } from 'lucide-react';
import { Track } from '../types';
import { recommendationEngine } from '../services/recommendationEngine';
import { useMusicPlayer } from '../context/MusicPlayerContext';
import { TrackCard } from '../components/TrackCard';

export const Library: React.FC = () => {
  const { playTrack, downloadTrack } = useMusicPlayer();
  const [activeTab, setActiveTab] = useState<'liked' | 'history'>('liked');

  const likedTracks = recommendationEngine.getLikedTracks();
  const historyTracks = recommendationEngine.getRecentlyPlayed();

  const handleDownloadAllLiked = async () => {
    for (const t of likedTracks) {
      await downloadTrack(t);
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-7xl mx-auto pb-32">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">Your Music Library</h1>
          <p className="text-sm text-gray-400">Manage your favorite tracks and listening history</p>
        </div>

        {/* Tab Toggle */}
        <div className="flex items-center gap-2 p-1 rounded-full bg-dark-850 border border-dark-750 w-fit">
          <button
            onClick={() => setActiveTab('liked')}
            className={`px-4 py-2 rounded-full text-xs font-bold flex items-center gap-1.5 transition-all ${
              activeTab === 'liked'
                ? 'bg-mrj-600 text-white shadow-md'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <Heart className="w-3.5 h-3.5 fill-current" />
            <span>Liked Songs ({likedTracks.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-full text-xs font-bold flex items-center gap-1.5 transition-all ${
              activeTab === 'history'
                ? 'bg-mrj-600 text-white shadow-md'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>History ({historyTracks.length})</span>
          </button>
        </div>
      </div>

      {/* Content */}
      {activeTab === 'liked' && (
        <div className="space-y-4">
          {likedTracks.length > 0 && (
            <div className="flex items-center gap-3">
              <button
                onClick={() => playTrack(likedTracks[0], likedTracks)}
                className="px-5 py-2 rounded-full bg-mrj-600 hover:bg-mrj-500 text-white font-bold text-xs flex items-center gap-2 shadow-md"
              >
                <Play className="w-3.5 h-3.5 fill-white" />
                <span>Play All Liked</span>
              </button>
              <button
                onClick={handleDownloadAllLiked}
                className="px-4 py-2 rounded-full bg-dark-800 hover:bg-dark-750 border border-dark-700 text-xs font-bold text-gray-300 flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                <span>Download All for Offline</span>
              </button>
            </div>
          )}

          {likedTracks.length === 0 ? (
            <div className="text-center py-20 bg-dark-900/40 rounded-3xl border border-dark-800 space-y-2">
              <Heart className="w-10 h-10 text-gray-600 mx-auto" />
              <h3 className="text-base font-bold text-gray-300">No Liked Songs Yet</h3>
              <p className="text-xs text-gray-500">Click the heart icon on any track to save it here</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {likedTracks.map((track, idx) => (
                <TrackCard key={track.id} track={track} queueContext={likedTracks} showIndex={idx} />
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'history' && (
        <div className="space-y-4">
          {historyTracks.length === 0 ? (
            <div className="text-center py-20 bg-dark-900/40 rounded-3xl border border-dark-800 space-y-2">
              <Clock className="w-10 h-10 text-gray-600 mx-auto" />
              <h3 className="text-base font-bold text-gray-300">No History Yet</h3>
              <p className="text-xs text-gray-500">Your recently played tracks will appear here</p>
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
    </div>
  );
};
