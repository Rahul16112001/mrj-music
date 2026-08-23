import React, { useState } from 'react';
import { useNavigate, NavLink } from 'react-router-dom';
import { Search, Wifi, WifiOff, Download, Sparkles, Disc3, Cast, User } from 'lucide-react';
import { useMusicPlayer } from '../context/MusicPlayerContext';

export const Navbar: React.FC = () => {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const { isOfflineMode, audioQuality, setAudioQuality, downloadedTrackIds } = useMusicPlayer();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      navigate(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  };

  return (
    <header className="sticky top-0 z-30 h-16 bg-dark-950/95 backdrop-blur-xl border-b border-dark-800/80 px-4 md:px-8 flex items-center justify-between gap-4 select-none">
      {/* Brand (Mobile view) */}
      <div className="flex lg:hidden items-center gap-2.5 shrink-0" onClick={() => navigate('/')}>
        <div className="w-8 h-8 rounded-full bg-mrj-600 flex items-center justify-center shadow-md shadow-mrj-600/30">
          <Disc3 className="w-5 h-5 text-white animate-spin-slow" />
        </div>
        <span className="font-black text-base tracking-tight text-white">MRJ Music</span>
      </div>

      {/* Search Input Bar (YouTube Music style center pill) */}
      <form onSubmit={handleSearch} className="flex-1 max-w-xl mx-auto">
        <div className="relative flex items-center group">
          <Search className="absolute left-4 w-4 h-4 text-gray-400 group-focus-within:text-mrj-400 transition-colors pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search songs, albums, artists, podcasts..."
            className="w-full h-11 pl-11 pr-4 bg-dark-850 border border-dark-750 focus:border-mrj-500 hover:border-dark-700 rounded-full text-sm text-gray-100 placeholder-gray-400 focus:outline-none focus:bg-dark-900 transition-all shadow-inner"
          />
        </div>
      </form>

      {/* Right status pills & quality toggles */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Audio Quality Switcher */}
        <button
          onClick={() => setAudioQuality(audioQuality === 'high' ? 'standard' : 'high')}
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-dark-850 hover:bg-dark-800 border border-dark-750 rounded-full text-xs font-bold text-mrj-400 transition-colors"
          title="Audio Quality Stream"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>{audioQuality === 'high' ? 'High-Fi 160k' : 'Standard 128k'}</span>
        </button>

        {/* Online / Offline Indicator */}
        <div
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
            isOfflineMode
              ? 'bg-amber-950/40 text-amber-300 border-amber-800/60'
              : 'bg-emerald-950/40 text-emerald-300 border-emerald-800/60'
          }`}
        >
          {isOfflineMode ? (
            <>
              <WifiOff className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              <span className="hidden md:inline">Offline</span>
            </>
          ) : (
            <>
              <Wifi className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden md:inline">Online</span>
            </>
          )}
        </div>

        {/* Offline Vault */}
        <button
          onClick={() => navigate('/downloads')}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-dark-850 hover:bg-dark-800 border border-dark-750 rounded-full text-xs text-gray-200 transition-colors"
          title="Offline Downloaded Tracks"
        >
          <Download className="w-3.5 h-3.5 text-emerald-400" />
          <span className="font-bold text-gray-100">{downloadedTrackIds.size}</span>
        </button>

        {/* Profile Avatar */}
        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-mrj-600 to-rose-400 flex items-center justify-center text-white font-black text-xs shadow-md">
          M
        </div>
      </div>
    </header>
  );
};
