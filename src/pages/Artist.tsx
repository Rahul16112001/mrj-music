import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Play,
  Shuffle,
  Heart,
  Share2,
  Radio,
  Check,
  Disc3,
  Loader2,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { Artist, Track } from '../types';
import { api } from '../services/api';
import { useMusicPlayer } from '../context/MusicPlayerContext';
import { TrackCard } from '../components/TrackCard';
import { shareService } from '../services/share';

export const ArtistPage: React.FC = () => {
  const { name } = useParams<{ name: string }>();
  const navigate = useNavigate();
  const { playTrack } = useMusicPlayer();

  const [artist, setArtist] = useState<Artist | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const artistName = decodeURIComponent(name || 'Popular Artist');

  useEffect(() => {
    const loadArtist = async () => {
      setIsLoading(true);
      try {
        const data = await api.getArtist(artistName);
        setArtist(data);
      } catch (err) {
        console.error('Failed to load artist:', err);
      } finally {
        setIsLoading(false);
      }
    };
    loadArtist();
  }, [artistName]);

  const handlePlayTop = () => {
    if (artist && artist.topSongs.length > 0) {
      playTrack(artist.topSongs[0], artist.topSongs);
    }
  };

  const handleShuffle = () => {
    if (artist && artist.topSongs.length > 0) {
      const shuffled = [...artist.topSongs].sort(() => 0.5 - Math.random());
      playTrack(shuffled[0], shuffled);
    }
  };

  const handleShare = async () => {
    if (!artist) return;
    await shareService.shareArtist(artist);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 1500);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <Loader2 className="w-8 h-8 text-[#ff0000] animate-spin" />
        <p className="text-xs text-[#aaaaaa]">Loading Artist Profile...</p>
      </div>
    );
  }

  if (!artist) {
    return (
      <div className="p-8 text-center space-y-4 max-w-md mx-auto">
        <h2 className="text-xl font-bold text-white">Artist Not Found</h2>
        <p className="text-xs text-[#aaaaaa]">Unable to load artist information right now.</p>
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
      {/* 1. Artist Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-[#121212] border border-[#212121] p-6 md:p-10 flex flex-col md:flex-row items-center md:items-end gap-6 md:gap-8 shadow-2xl">
        <div className="w-36 h-36 md:w-52 md:h-52 rounded-full overflow-hidden shrink-0 shadow-2xl border-4 border-[#282828]">
          <img
            src={artist.thumbnail}
            alt={artist.name}
            className="w-full h-full object-cover"
          />
        </div>

        <div className="flex-1 text-center md:text-left space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#ff0000]/10 text-[#ff4e4e] border border-[#ff0000]/20 text-[11px] font-bold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Official Global Artist</span>
          </div>

          <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight">
            {artist.name}
          </h1>

          <p className="text-xs md:text-sm text-[#aaaaaa] font-medium">
            {artist.monthlyListeners}
          </p>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 pt-2">
            <button
              onClick={handlePlayTop}
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
              onClick={() => setIsSubscribed(!isSubscribed)}
              className={`px-5 py-2.5 rounded-full font-bold text-xs flex items-center gap-2 transition-all ${
                isSubscribed
                  ? 'bg-white text-black'
                  : 'bg-[#212121] hover:bg-[#2e2e2e] border border-[#333333] text-white'
              }`}
            >
              {isSubscribed ? <Check className="w-4 h-4" /> : <Heart className="w-4 h-4" />}
              <span>{isSubscribed ? 'Subscribed' : 'Subscribe'}</span>
            </button>

            <button
              onClick={handleShare}
              className="p-2.5 rounded-full bg-[#212121] hover:bg-[#2e2e2e] border border-[#333333] text-white transition-colors"
              title="Share Artist"
            >
              {isCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* 2. Top Songs */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-black text-white tracking-tight">Top Songs</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {artist.topSongs.map((track, idx) => (
            <TrackCard key={`top-${track.id}`} track={track} queueContext={artist.topSongs} showIndex={idx} />
          ))}
        </div>
      </section>

      {/* 3. Albums & Singles */}
      {artist.albums.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-2xl font-black text-white tracking-tight">Albums & EPs</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
            {artist.albums.map((album) => (
              <div
                key={album.id}
                onClick={() => navigate(`/album/${album.id}`)}
                className="p-3.5 rounded-2xl bg-[#181818] hover:bg-[#212121] border border-[#282828] cursor-pointer transition-all hover:scale-105 group"
              >
                <div className="aspect-square rounded-xl overflow-hidden mb-3 bg-[#212121] shadow-md">
                  <img src={album.thumbnail} alt={album.title} className="w-full h-full object-cover" />
                </div>
                <h4 className="text-sm font-bold text-white group-hover:text-[#ff4e4e] truncate">
                  {album.title}
                </h4>
                <p className="text-[10px] text-[#aaaaaa] mt-0.5">{album.year} • {album.trackCount} tracks</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 4. Related Artists */}
      {artist.relatedArtists.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-2xl font-black text-white tracking-tight">Fans Also Like</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
            {artist.relatedArtists.map((rel) => (
              <div
                key={rel.id}
                onClick={() => navigate(`/artist/${encodeURIComponent(rel.name)}`)}
                className="flex flex-col items-center text-center p-3.5 rounded-2xl bg-[#181818] hover:bg-[#212121] border border-[#282828] cursor-pointer transition-all hover:scale-105 group"
              >
                <div className="w-20 h-20 rounded-full overflow-hidden mb-2.5 shadow-md border border-[#333333] group-hover:border-[#ff0000]">
                  <img src={rel.thumbnail} alt={rel.name} className="w-full h-full object-cover" />
                </div>
                <h4 className="text-xs font-bold text-white group-hover:text-[#ff4e4e] truncate w-full">
                  {rel.name}
                </h4>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
