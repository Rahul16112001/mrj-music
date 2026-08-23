import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Play, Shuffle, Download, Trash2, Share2, ListMusic, Plus, Loader2 } from 'lucide-react';
import { Playlist, Track } from '../types';
import { offlineStorage } from '../services/offlineStorage';
import { useMusicPlayer } from '../context/MusicPlayerContext';
import { TrackCard } from '../components/TrackCard';
import { shareService } from '../services/share';

export const PlaylistPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { playTrack, downloadTrack, deletePlaylist, removeTrackFromPlaylist } = useMusicPlayer();

  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const loadPlaylist = async () => {
    setIsLoading(true);
    try {
      if (id) {
        const data = await offlineStorage.getPlaylist(id);
        setPlaylist(data);
      }
    } catch (err) {
      console.error('Failed to load playlist:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPlaylist();
  }, [id]);

  const handlePlayAll = () => {
    if (playlist && playlist.tracks.length > 0) {
      playTrack(playlist.tracks[0], playlist.tracks);
    }
  };

  const handleShuffle = () => {
    if (playlist && playlist.tracks.length > 0) {
      const shuffled = [...playlist.tracks].sort(() => 0.5 - Math.random());
      playTrack(shuffled[0], shuffled);
    }
  };

  const handleDownloadAll = async () => {
    if (!playlist) return;
    setIsDownloadingAll(true);
    try {
      for (const track of playlist.tracks) {
        await downloadTrack(track);
      }
    } finally {
      setIsDownloadingAll(false);
    }
  };

  const handleDeletePlaylist = async () => {
    if (!playlist) return;
    if (window.confirm(`Are you sure you want to delete "${playlist.title}"?`)) {
      await deletePlaylist(playlist.id);
      navigate('/library');
    }
  };

  const handleRemoveTrack = async (trackId: string) => {
    if (!playlist) return;
    await removeTrackFromPlaylist(playlist.id, trackId);
    await loadPlaylist();
  };

  const handleShare = async () => {
    if (!playlist) return;
    await shareService.sharePlaylist(playlist);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 1500);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <Loader2 className="w-8 h-8 text-[#ff0000] animate-spin" />
        <p className="text-xs text-[#aaaaaa]">Loading Playlist...</p>
      </div>
    );
  }

  if (!playlist) {
    return (
      <div className="p-8 text-center space-y-4 max-w-md mx-auto">
        <h2 className="text-xl font-bold text-white">Playlist Not Found</h2>
        <button
          onClick={() => navigate('/library')}
          className="px-6 py-2 rounded-full bg-[#212121] text-white font-bold text-xs"
        >
          Back to Library
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-10 max-w-7xl mx-auto pb-40 select-none">
      {/* 1. Playlist Header */}
      <div className="flex flex-col md:flex-row items-center md:items-end gap-6 md:gap-8 bg-[#121212] border border-[#212121] p-6 md:p-8 rounded-3xl shadow-xl">
        <div className="w-48 h-48 md:w-56 md:h-56 rounded-2xl overflow-hidden shrink-0 shadow-2xl bg-[#1e1e1e] flex items-center justify-center border border-[#282828]">
          {playlist.thumbnail ? (
            <img src={playlist.thumbnail} alt={playlist.title} className="w-full h-full object-cover" />
          ) : (
            <ListMusic className="w-16 h-16 text-[#ff0000]" />
          )}
        </div>

        <div className="flex-1 text-center md:text-left space-y-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#ff4e4e]">Playlist</span>
          <h1 className="text-2xl md:text-4xl font-black text-white tracking-tight">{playlist.title}</h1>
          {playlist.description && (
            <p className="text-xs text-[#aaaaaa]">{playlist.description}</p>
          )}
          <p className="text-xs font-semibold text-[#717171]">
            {playlist.trackCount} tracks • Created {new Date(playlist.createdAt).toLocaleDateString()}
          </p>

          <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 pt-3">
            <button
              onClick={handlePlayAll}
              disabled={playlist.tracks.length === 0}
              className="px-6 py-2.5 rounded-full bg-[#ff0000] hover:bg-[#cc0000] disabled:opacity-50 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-red-600/30 transition-all hover:scale-105"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>Play</span>
            </button>

            <button
              onClick={handleShuffle}
              disabled={playlist.tracks.length === 0}
              className="px-5 py-2.5 rounded-full bg-[#212121] hover:bg-[#2e2e2e] disabled:opacity-50 border border-[#333333] text-white font-bold text-xs flex items-center gap-2 transition-colors"
            >
              <Shuffle className="w-4 h-4" />
              <span>Shuffle</span>
            </button>

            <button
              onClick={handleDownloadAll}
              disabled={playlist.tracks.length === 0 || isDownloadingAll}
              className="px-5 py-2.5 rounded-full bg-[#212121] hover:bg-[#2e2e2e] disabled:opacity-50 border border-[#333333] text-white font-bold text-xs flex items-center gap-2 transition-colors"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              <span>{isDownloadingAll ? 'Downloading...' : 'Download All'}</span>
            </button>

            <button
              onClick={handleShare}
              className="p-2.5 rounded-full bg-[#212121] hover:bg-[#2e2e2e] border border-[#333333] text-white transition-colors"
              title="Share Playlist"
            >
              <Share2 className="w-4 h-4" />
            </button>

            <button
              onClick={handleDeletePlaylist}
              className="p-2.5 rounded-full bg-[#212121] hover:bg-red-950/40 text-[#aaaaaa] hover:text-red-400 border border-[#333333] transition-colors"
              title="Delete Playlist"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 2. Track List */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-white">Tracks ({playlist.tracks.length})</h2>

        {playlist.tracks.length === 0 ? (
          <div className="text-center py-16 bg-[#121212] rounded-3xl border border-[#212121] space-y-2">
            <ListMusic className="w-10 h-10 text-[#717171] mx-auto" />
            <h3 className="text-base font-bold text-white">This Playlist is Empty</h3>
            <p className="text-xs text-[#aaaaaa]">Search for songs and click "Add to Playlist" to build your collection.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {playlist.tracks.map((track, idx) => (
              <div key={`pl-t-${track.id}-${idx}`} className="relative group">
                <TrackCard track={track} queueContext={playlist.tracks} showIndex={idx} />
                <button
                  onClick={() => handleRemoveTrack(track.id)}
                  className="absolute right-14 top-1/2 -translate-y-1/2 p-2 rounded-full hover:bg-[#282828] text-[#aaaaaa] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                  title="Remove from playlist"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
