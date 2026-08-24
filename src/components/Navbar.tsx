import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import {
  Search,
  Cast,
  Settings,
  User as UserIcon,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  WifiOff,
  X,
  Loader2
} from 'lucide-react';
import { useMusicPlayer } from '../context/MusicPlayerContext';
import { useAuth } from '../context/AuthContext';
import { api, SearchSuggestionsResult } from '../services/api';
import { SearchSuggestionDropdown } from './SearchSuggestionDropdown';
import { Track } from '../types';

export const Navbar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isOfflineMode, playTrack } = useMusicPlayer();
  const { user, isAuthenticated, logout } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [suggestionsData, setSuggestionsData] = useState<SearchSuggestionsResult | null>(null);
  const [isSuggestionsLoading, setIsSuggestionsLoading] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

  const searchContainerRef = useRef<HTMLDivElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceTimerRef = useRef<any>(null);

  // 1. Fetch suggestions with 200ms debounce and AbortController
  const fetchSuggestions = useCallback((query: string) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsSuggestionsLoading(true);
    api.getSearchSuggestions(query, controller.signal)
      .then((res) => {
        setSuggestionsData(res);
      })
      .catch(() => {})
      .finally(() => {
        setIsSuggestionsLoading(false);
      });
  }, []);

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      fetchSuggestions(val);
    }, 200);
  };

  const handleSearchFocus = () => {
    setIsSearchFocused(true);
    fetchSuggestions(searchQuery);
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsSearchFocused(false);
      }
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const executeSearch = (q: string) => {
    const clean = q.trim();
    if (!clean) return;
    setIsSearchFocused(false);
    if (isAuthenticated) {
      api.addSearchHistory(clean);
    }
    navigate(`/search?q=${encodeURIComponent(clean)}`);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeSearch(searchQuery);
  };

  const handleSelectTrack = (track: Track) => {
    setIsSearchFocused(false);
    if (isAuthenticated) {
      api.addSearchHistory(track.title);
    }
    playTrack(track);
  };

  const handleDeleteHistoryQuery = async (q: string) => {
    const updated = await api.removeSearchHistory(q);
    if (suggestionsData) {
      setSuggestionsData({ ...suggestionsData, recent: updated });
    }
  };

  const handleClearHistory = async () => {
    await api.clearSearchHistory();
    if (suggestionsData) {
      setSuggestionsData({ ...suggestionsData, recent: [] });
    }
  };

  const handleLogout = async () => {
    setIsProfileMenuOpen(false);
    await logout();
    navigate('/');
  };

  return (
    <header className="h-16 px-4 md:px-8 bg-[#030303]/95 backdrop-blur-md border-b border-[#181818] flex items-center justify-between sticky top-0 z-40 select-none">
      {/* Left: Navigation Controls */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1 hidden sm:flex">
          <button
            onClick={() => navigate(-1)}
            className="w-8 h-8 rounded-full bg-[#181818] hover:bg-[#262626] text-[#aaaaaa] hover:text-white flex items-center justify-center transition-colors"
            title="Go Back"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => navigate(1)}
            className="w-8 h-8 rounded-full bg-[#181818] hover:bg-[#262626] text-[#aaaaaa] hover:text-white flex items-center justify-center transition-colors"
            title="Go Forward"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Brand Mobile Logo */}
        <div
          onClick={() => navigate('/')}
          className="flex items-center gap-2 cursor-pointer lg:hidden"
        >
          <img
            src="/logo.png"
            alt="MRJ Music"
            className="w-8 h-8 rounded-full object-cover shadow-lg shadow-red-600/30"
          />
          <span className="font-black text-base text-white tracking-tight">MRJ Music</span>
        </div>
      </div>

      {/* Middle: Live Search Bar with Instant Suggestions */}
      <div ref={searchContainerRef} className="flex-1 max-w-xl mx-4 relative">
        <form onSubmit={handleSearchSubmit} className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#717171]" />
          <input
            type="text"
            value={searchQuery}
            onChange={handleQueryChange}
            onFocus={handleSearchFocus}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setIsSearchFocused(false);
            }}
            placeholder="Search songs, albums, artists, podcasts..."
            className="w-full h-10 pl-10 pr-10 bg-[#181818] border border-[#2d2d2d] focus:border-[#ff0000] rounded-full text-xs text-white placeholder-[#717171] focus:outline-none transition-all shadow-inner"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                fetchSuggestions('');
              }}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#717171] hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          {isSuggestionsLoading && (
            <Loader2 className="absolute right-9 top-1/2 -translate-y-1/2 w-3 h-3 text-[#ff0000] animate-spin" />
          )}
        </form>

        {/* Suggestion Dropdown */}
        <SearchSuggestionDropdown
          isOpen={isSearchFocused}
          onClose={() => setIsSearchFocused(false)}
          data={suggestionsData}
          onSelectQuery={(q) => {
            setSearchQuery(q);
            executeSearch(q);
          }}
          onSelectTrack={handleSelectTrack}
          onSelectArtist={(artistName) => {
            setIsSearchFocused(false);
            navigate(`/artist/${encodeURIComponent(artistName)}`);
          }}
          onSelectAlbum={(albumId) => {
            setIsSearchFocused(false);
            navigate(`/album/${albumId}`);
          }}
          onDeleteHistoryQuery={handleDeleteHistoryQuery}
          onClearHistory={handleClearHistory}
          isLoading={isSuggestionsLoading}
        />
      </div>

      {/* Right: Offline Indicator, Settings & Profile */}
      <div className="flex items-center gap-3 shrink-0">
        {isOfflineMode && (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-[11px] font-bold">
            <WifiOff className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Offline Mode</span>
          </div>
        )}

        <button
          onClick={() => navigate('/settings')}
          className="p-2 rounded-full hover:bg-[#212121] text-[#aaaaaa] hover:text-white transition-colors"
          title="Settings"
        >
          <Settings className="w-4 h-4" />
        </button>

        {/* User Profile */}
        {isAuthenticated && user ? (
          <div className="relative" ref={profileMenuRef}>
            <button
              onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
              className="flex items-center gap-2 p-1.5 pr-3 rounded-full bg-[#181818] border border-[#2d2d2d] hover:border-[#444444] transition-all"
            >
              <div className="w-7 h-7 rounded-full bg-[#ff0000] text-white font-black text-xs flex items-center justify-center shadow-md">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <span className="text-xs font-bold text-white max-w-[90px] truncate hidden md:inline">
                {user.name}
              </span>
            </button>

            {isProfileMenuOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-[#161616] border border-[#2c2c2c] rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in zoom-in-95">
                <div className="p-4 border-b border-[#242424]">
                  <p className="text-xs font-bold text-white truncate">{user.name}</p>
                  <p className="text-[11px] text-[#aaaaaa] truncate">{user.email}</p>
                </div>
                <div className="p-1.5 space-y-1">
                  <Link
                    to="/profile"
                    onClick={() => setIsProfileMenuOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 text-xs text-white hover:bg-[#222222] rounded-xl transition-colors font-medium"
                  >
                    <UserIcon className="w-4 h-4 text-[#aaaaaa]" />
                    <span>Your Profile & Taste</span>
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-[#ff4e4e] hover:bg-[#222222] rounded-xl transition-colors font-medium text-left"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Log Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/login')}
              className="px-4 py-1.5 rounded-full text-xs font-bold text-white hover:bg-[#1f1f1f] transition-colors"
            >
              Sign In
            </button>
            <button
              onClick={() => navigate('/register')}
              className="px-4 py-1.5 rounded-full text-xs font-bold bg-[#ff0000] text-white hover:bg-[#cc0000] transition-colors shadow-md shadow-red-600/30"
            >
              Sign Up
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
