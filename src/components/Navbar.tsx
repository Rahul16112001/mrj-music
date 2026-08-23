import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Wifi, WifiOff, Download, Sparkles, SlidersHorizontal } from 'lucide-react';
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
    <header className="sticky top-0 z-30 h-16 bg-dark-950/85 backdrop-blur-xl border-b border-dark-800/60 px-4 md:px-8 flex items-center justify-between gap-4">
      {/* Brand Mobile view / Search */}
      <form onSubmit={handleSearch} className="flex-1 max-w-xl relative">
        <div className="relative flex items-center">
          <Search className="absolute left-3.5 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search any song, artist, album, or playlist..."
            className="w-full h-10 pl-10 pr-4 bg-dark-850 border border-dark-750 hover:border-dark-600 focus:border-mrj-500 rounded-full text-sm text-gray-100 placeholder-gray-400 focus:outline-none transition-all"
          />
        </div>
      </form>

      {/* Right status pills & quality toggles */}
      <div className="flex items-center gap-2.5">
        {/* Online / Offline Indicator */}
        <div
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
            isOfflineMode
              ? 'bg-amber-950/40 text-amber-300 border-amber-800/60'
              : 'bg-emerald-950/40 text-emerald-300 border-emerald-800/60'
          }`}
        >
          {isOfflineMode ? (
            <>
              <WifiOff className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              <span className="hidden sm:inline">Offline Mode</span>
            </>
          ) : (
            <>
              <Wifi className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Online</span>
            </>
          )}
        </div>

        {/* Audio Quality Switcher */}
        <button
          onClick={() => setAudioQuality(audioQuality === 'high' ? 'standard' : 'high')}
          className="hidden md:flex items-center gap-1.5 px-3 py-1 bg-dark-850 hover:bg-dark-750 border border-dark-750 rounded-full text-xs text-gray-300 transition-colors"
          title="Toggle Audio Bitrate Quality"
        >
          <Sparkles className="w-3 h-3 text-mrj-400" />
          <span className="font-semibold text-mrj-400">{audioQuality === 'high' ? '160k Opus' : '128k AAC'}</span>
        </button>

        {/* Offline Vault Shortcut */}
        <button
          onClick={() => navigate('/downloads')}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-dark-850 hover:bg-dark-800 border border-dark-750 rounded-full text-xs text-gray-200 transition-colors"
          title="Offline Downloaded Vault"
        >
          <Download className="w-3.5 h-3.5 text-mrj-400" />
          <span className="font-bold text-gray-100">{downloadedTrackIds.size}</span>
        </button>
      </div>
    </header>
  );
};
