import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Play, Shuffle, Download, Share2, Loader2, Music, Check } from 'lucide-react';
import { Album, Track } from '../types';
import { api } from '../services/api';
import { useMusicPlayer } from '../context/MusicPlayerContext';
import { TrackCard } from '../components/TrackCard';

export const AlbumPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { playTrack, downloadTrack } = useMusicPlayer();

  const [album, setAlbum] = useState<Album | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);

  useEffect(() => {
    const loadAlbum = async () => {
      setIsLoading(true);
      try {
        const data = await api.getAlbum(id || 'alb_1');
        setAlbum(data);
      } catch (err) {
        console.error('Failed to load album:', err);
      } finally {
        setIsLoading(false);
      }
    };
    loadAlbum();
  }, [id]);

  const handlePlayAll = () => {
    if (album && album.tracks.length > 0) {
      playTrack(album.tracks[0], album.tracks);
    }
  };

  const handleShuffle = () => {
    if (album && album.tracks.length > 0) {
      const shuffled = [...album.tracks].sort(() => 0.5 - Math.random());
      playTrack(shuffled[0], shuffled);
    }
  };

  const handleDownloadAll = async () => {
    if (!album) return;
    setIsDownloadingAll(true);
    try {
      for (const track of album.tracks) {
        await downloadTrack(track);
      }
    } finally {
      setIsDownloadingAll(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <Loader2 className="w-8 h-8 text-[#ff0000] animate-spin" />
        <p className="text-xs text-[#aaaaaa]">Loading Album...</p>
      </div>
    );
  }

  if (!album) {
    return (
      <div className="p-8 text-center space-y-4 max-w-md mx-auto">
        <h2 className="text-xl font-bold text-white">Album Not Found</h2>
        <button
          onClick={() => navigate('/search')}
          className="px-6 py-2 rounded-full bg-[#212121] text-white font-bold text-xs"
        >
          Back to Explore
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-10 max-w-7xl mx-auto pb-40 select-none">
      {/* 1. Album Header */}
      <div className="flex flex-col md:flex-row items-center md:items-end gap-6 md:gap-8 bg-[#121212] border border-[#212121] p-6 md:p-8 rounded-3xl shadow-xl">
        <div className="w-48 h-48 md:w-56 md:h-56 rounded-2xl overflow-hidden shrink-0 shadow-2xl bg-[#212121] border border-[#282828]">
          <img src={album.thumbnail} alt={album.title} className="w-full h-full object-cover" />
        </div>

        <div className="flex-1 text-center md:text-left space-y-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#ff4e4e]">Album</span>
          <h1 className="text-2xl md:text-4xl font-black text-white tracking-tight">{album.title}</h1>
          <p
            onClick={() => navigate(`/artist/${encodeURIComponent(album.artist)}`)}
            className="text-sm font-semibold text-[#aaaaaa] hover:text-white cursor-pointer transition-colors"
          >
            {album.artist} • {album.year || '2024'} • {album.trackCount} songs
          </p>

          <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 pt-3">
            <button
              onClick={handlePlayAll}
              className="px-6 py-2.5 rounded-full bg-[#ff0000] hover:bg-[#cc0000] text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-red-600/30 transition-all hover:scale-105"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>Play</span>
            </button>

            <button
              onClick={handleShuffle}
              className="px-5 py-2.5 rounded-full bg-[#212121] hover:bg-[#2e2e2e] border border-[#333333] text-white font-bold text-xs flex items-center gap-2 transition-colors"
            >
              <Shuffle className="w-4 h-4" />
              <span>Shuffle</span>
            </button>

            <button
              onClick={handleDownloadAll}
              disabled={isDownloadingAll}
              className="px-5 py-2.5 rounded-full bg-[#212121] hover:bg-[#2e2e2e] border border-[#333333] text-white font-bold text-xs flex items-center gap-2 transition-colors"
            >
              {isDownloadingAll ? (
                <Loader2 className="w-4 h-4 animate-spin text-[#ff0000]" />
              ) : (
                <Download className="w-4 h-4 text-emerald-400" />
              )}
              <span>{isDownloadingAll ? 'Downloading...' : 'Download Album'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Track List */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-white">Tracks ({album.tracks.length})</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {album.tracks.map((track, idx) => (
            <TrackCard key={`alb-t-${track.id}`} track={track} queueContext={album.tracks} showIndex={idx} />
          ))}
        </div>
      </section>
    </div>
  );
};
