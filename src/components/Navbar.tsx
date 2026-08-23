import React, { useState, useRef, useEffect } from 'react';
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
  WifiOff
} from 'lucide-react';
import { useMusicPlayer } from '../context/MusicPlayerContext';
import { useAuth } from '../context/AuthContext';

export const Navbar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isOfflineMode } = useMusicPlayer();
  const { user, isAuthenticated, logout } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    };
    if (isProfileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isProfileMenuOpen]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleLogout = async () => {
    setIsProfileMenuOpen(false);
    await logout();
    navigate('/');
  };

  return (
    <header className="h-16 px-4 md:px-8 bg-[#030303]/95 backdrop-blur-md border-b border-[#181818] flex items-center justify-between sticky top-0 z-40 select-none">
      {/* Left: Navigation & History controls */}
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
          <div className="w-7 h-7 rounded-full bg-[#ff0000] flex items-center justify-center shadow-lg shadow-red-600/30">
            <div className="w-0 h-0 border-t-[4px] border-t-transparent border-l-[7px] border-l-white border-b-[4px] border-b-transparent ml-0.5" />
          </div>
          <span className="font-black text-base text-white tracking-tight">Music</span>
        </div>
      </div>

      {/* Middle: Worldwide Search Bar */}
      <form onSubmit={handleSearchSubmit} className="flex-1 max-w-xl mx-4">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#717171]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search songs, albums, artists, podcasts..."
            className="w-full h-10 pl-10 pr-4 bg-[#181818] border border-[#2d2d2d] focus:border-[#ff0000] rounded-full text-xs text-white placeholder-[#717171] focus:outline-none transition-all shadow-inner"
          />
        </div>
      </form>

      {/* Right: Offline Indicator, Settings & User Auth Profile */}
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

        {/* User Account / Profile Menu */}
        {isAuthenticated && user ? (
          <div className="relative" ref={profileMenuRef}>
            <button
              onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
              className="w-8 h-8 rounded-full bg-[#ff0000] text-white font-bold text-xs flex items-center justify-center shadow-lg shadow-red-600/30 hover:scale-105 transition-transform"
              title={user.name}
            >
              {user.name.charAt(0).toUpperCase()}
            </button>

            {isProfileMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-[#181818] border border-[#2d2d2d] rounded-2xl shadow-2xl py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-4 py-2 border-b border-[#282828] mb-1">
                  <p className="text-xs font-bold text-white truncate">{user.name}</p>
                  <p className="text-[10px] text-[#aaaaaa] truncate">{user.email}</p>
                </div>

                <Link
                  to="/profile"
                  onClick={() => setIsProfileMenuOpen(false)}
                  className="w-full px-4 py-2 flex items-center gap-2.5 text-xs font-semibold text-white hover:bg-[#242424] transition-colors"
                >
                  <UserIcon className="w-4 h-4 text-[#ff4e4e]" />
                  <span>My Profile</span>
                </Link>

                <Link
                  to="/settings"
                  onClick={() => setIsProfileMenuOpen(false)}
                  className="w-full px-4 py-2 flex items-center gap-2.5 text-xs font-semibold text-white hover:bg-[#242424] transition-colors"
                >
                  <Settings className="w-4 h-4 text-[#aaaaaa]" />
                  <span>Settings</span>
                </Link>

                <button
                  onClick={handleLogout}
                  className="w-full px-4 py-2 flex items-center gap-2.5 text-xs font-semibold text-red-400 hover:bg-red-950/30 transition-colors border-t border-[#282828] mt-1 pt-2 text-left"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Link
              to="/login"
              className="px-4 py-1.5 rounded-full bg-[#212121] hover:bg-[#2c2c2c] border border-[#333333] text-white font-bold text-xs transition-colors"
            >
              Sign In
            </Link>
            <Link
              to="/register"
              className="px-4 py-1.5 rounded-full bg-[#ff0000] hover:bg-[#cc0000] text-white font-bold text-xs shadow-md shadow-red-600/30 transition-all hover:scale-105 hidden sm:inline-block"
            >
              Sign Up
            </Link>
          </div>
        )}
      </div>
    </header>
  );
};
