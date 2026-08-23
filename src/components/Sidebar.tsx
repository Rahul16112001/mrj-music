import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Compass, Download, Heart, Disc, Radio, Sparkles } from 'lucide-react';
import { useMusicPlayer } from '../context/MusicPlayerContext';

export const Sidebar: React.FC = () => {
  const { downloadedTrackIds } = useMusicPlayer();

  const links = [
    { to: '/', label: 'Home', icon: Home },
    { to: '/search', label: 'Explore & Search', icon: Compass },
    { to: '/library', label: 'Liked & Playlists', icon: Heart },
    { to: '/downloads', label: 'Offline Vault', icon: Download, badge: downloadedTrackIds.size },
  ];

  const moodShortcuts = [
    { name: 'Chill Hits', color: 'bg-blue-500/20 text-blue-400' },
    { name: 'Workout Beast', color: 'bg-red-500/20 text-red-400' },
    { name: 'Deep Focus', color: 'bg-emerald-500/20 text-emerald-400' },
    { name: 'Party Anthems', color: 'bg-pink-500/20 text-pink-400' },
  ];

  return (
    <aside className="w-64 hidden lg:flex flex-col bg-dark-950/95 border-r border-dark-800/60 p-4 select-none shrink-0 h-screen sticky top-0">
      {/* Brand Header */}
      <div className="flex items-center gap-3 px-2 py-4 mb-4">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-mrj-600 to-rose-400 flex items-center justify-center shadow-lg shadow-mrj-500/20">
          <Disc className="w-6 h-6 text-white animate-spin-slow" />
        </div>
        <div>
          <h1 className="text-lg font-black tracking-tight bg-gradient-to-r from-white via-gray-200 to-mrj-400 bg-clip-text text-transparent">
            MRJ Music
          </h1>
          <p className="text-[10px] uppercase font-bold tracking-widest text-mrj-400">
            Global High-Fi
          </p>
        </div>
      </div>

      {/* Main Navigation */}
      <nav className="space-y-1">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              `flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                isActive
                  ? 'bg-mrj-600/15 text-mrj-400 border border-mrj-500/30'
                  : 'text-gray-400 hover:text-gray-100 hover:bg-dark-850'
              }`
            }
          >
            <div className="flex items-center gap-3">
              <link.icon className="w-5 h-5" />
              <span>{link.label}</span>
            </div>
            {link.badge !== undefined && link.badge > 0 && (
              <span className="px-2 py-0.5 text-[10px] font-bold bg-mrj-500 text-white rounded-full">
                {link.badge}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Quick Mood Stations */}
      <div className="mt-8 pt-6 border-t border-dark-800/60">
        <div className="flex items-center justify-between px-3 mb-3">
          <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
            Quick Stations
          </span>
          <Radio className="w-3.5 h-3.5 text-mrj-400" />
        </div>
        <div className="space-y-1.5">
          {moodShortcuts.map((mood) => (
            <NavLink
              key={mood.name}
              to={`/search?q=${encodeURIComponent(mood.name)}`}
              className="flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-gray-300 hover:bg-dark-850 transition-colors"
            >
              <span>{mood.name}</span>
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${mood.color}`}>
                Live
              </span>
            </NavLink>
          ))}
        </div>
      </div>

      {/* VIP & Offline Banner */}
      <div className="mt-auto p-4 rounded-2xl bg-gradient-to-br from-dark-850 to-dark-900 border border-dark-750/80 shadow-md">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-4 h-4 text-mrj-400" />
          <span className="text-xs font-bold text-gray-200">100% Free Listening</span>
        </div>
        <p className="text-[11px] text-gray-400 mb-3 leading-relaxed">
          Zero subscriptions. Download songs for airplane mode anytime.
        </p>
        <div className="text-[10px] font-semibold text-mrj-400 flex items-center gap-1">
          <span>● High-Definition Opus 160k</span>
        </div>
      </div>
    </aside>
  );
};
