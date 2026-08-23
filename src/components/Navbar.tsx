import React, { useState } from 'react';
import { useNavigate, NavLink } from 'react-router-dom';
import { Search, X, Wifi, WifiOff, Download, Sparkles, Cast, Menu } from 'lucide-react';
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

  const handleClear = () => {
    setQuery('');
  };

  return (
    <header className="sticky top-0 z-30 h-16 bg-[#030303]/95 backdrop-blur-md border-b border-[#1f1f1f] px-4 md:px-6 flex items-center justify-between gap-4 select-none">
      {/* Mobile Branding */}
      <div className="flex lg:hidden items-center gap-3 cursor-pointer shrink-0" onClick={() => navigate('/')}>
        <div className="w-8 h-8 rounded-full bg-[#ff0000] flex items-center justify-center shadow-lg shadow-red-600/30">
          <div className="w-0 h-0 border-t-[5px] border-t-transparent border-l-[9px] border-l-white border-b-[5px] border-b-transparent ml-0.5" />
        </div>
        <span className="font-bold text-base tracking-tight text-white">Music</span>
      </div>

      {/* YouTube Music Center Search Bar */}
      <form onSubmit={handleSearch} className="flex-1 max-w-2xl mx-auto">
        <div className="relative flex items-center group">
          <Search className="absolute left-4 w-4 h-4 text-[#aaaaaa] group-focus-within:text-white transition-colors pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search songs, albums, artists, podcasts"
            className="w-full h-11 pl-11 pr-10 bg-[#212121] border border-transparent focus:border-[#383838] hover:bg-[#282828] rounded-full text-sm text-white placeholder-[#aaaaaa] focus:outline-none focus:bg-[#1f1f1f] transition-all shadow-inner"
          />
          {query && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-3.5 p-1 rounded-full text-[#aaaaaa] hover:text-white hover:bg-[#333333] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </form>

      {/* Right Controls */}
      <div className="flex items-center gap-2.5 shrink-0">
        {/* Quality Indicator */}
        <button
          onClick={() => setAudioQuality(audioQuality === 'high' ? 'standard' : 'high')}
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-[#212121] hover:bg-[#2a2a2a] border border-[#333333] rounded-full text-xs font-semibold text-white transition-colors"
          title="Audio Quality"
        >
          <Sparkles className="w-3.5 h-3.5 text-[#ff4e4e]" />
          <span>{audioQuality === 'high' ? '160k Opus' : '128k AAC'}</span>
        </button>

        {/* Online / Offline Status */}
        <div
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
            isOfflineMode
              ? 'bg-amber-950/40 text-amber-300 border-amber-800/60'
              : 'bg-emerald-950/40 text-emerald-300 border-emerald-800/60'
          }`}
        >
          {isOfflineMode ? (
            <>
              <WifiOff className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden md:inline">Offline</span>
            </>
          ) : (
            <>
              <Wifi className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden md:inline">Online</span>
            </>
          )}
        </div>

        {/* Offline Vault Button */}
        <button
          onClick={() => navigate('/downloads')}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#212121] hover:bg-[#2a2a2a] border border-[#333333] rounded-full text-xs text-white transition-colors"
          title="Offline Vault"
        >
          <Download className="w-3.5 h-3.5 text-emerald-400" />
          <span className="font-bold">{downloadedTrackIds.size}</span>
        </button>

        {/* Free Guest Avatar */}
        <div
          onClick={() => navigate('/library')}
          className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#ff0000] to-rose-400 flex items-center justify-center text-white font-bold text-xs shadow-md cursor-pointer hover:scale-105 transition-transform"
          title="MRJ Music Free Account"
        >
          M
        </div>
      </div>
    </header>
  );
};
