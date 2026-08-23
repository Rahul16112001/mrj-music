import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Home,
  Compass,
  Library,
  PlusCircle,
  Heart,
  Download,
  Flame,
  Radio,
  Sparkles,
  Disc3,
  PlaySquare,
  ListMusic
} from 'lucide-react';
import { useMusicPlayer } from '../context/MusicPlayerContext';

export const Sidebar: React.FC = () => {
  const navigate = useNavigate();
  const { downloadedTrackIds } = useMusicPlayer();

  const mainLinks = [
    { to: '/', label: 'Home', icon: Home },
    { to: '/search', label: 'Explore', icon: Compass },
    { to: '/library', label: 'Library', icon: Library },
  ];

  const quickPlaylists = [
    { label: 'Liked Music', icon: Heart, count: 'Auto Playlist', to: '/library' },
    { label: 'Offline Vault', icon: Download, count: `${downloadedTrackIds.size} saved`, to: '/downloads' },
  ];

  return (
    <aside className="w-64 bg-[#030303] border-r border-[#1f1f1f] h-screen flex flex-col shrink-0 select-none hidden lg:flex">
      {/* YouTube Music Logo Header */}
      <div className="h-16 px-6 flex items-center gap-2.5 cursor-pointer" onClick={() => navigate('/')}>
        <div className="w-8 h-8 rounded-full bg-[#ff0000] flex items-center justify-center shadow-lg shadow-red-600/30">
          <div className="w-0 h-0 border-t-[5px] border-t-transparent border-l-[9px] border-l-white border-b-[5px] border-b-transparent ml-0.5" />
        </div>
        <div className="flex items-center gap-1">
          <span className="font-bold text-lg tracking-tight text-white font-sans">Music</span>
          <span className="text-[9px] font-black uppercase tracking-wider bg-[#ff0000]/20 text-[#ff4e4e] px-1.5 py-0.5 rounded border border-[#ff0000]/30 ml-1">
            Free
          </span>
        </div>
      </div>

      {/* Main Navigation */}
      <div className="px-3 py-4 space-y-1">
        {mainLinks.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-5 px-4 py-3 rounded-xl text-sm font-semibold transition-colors ${
                isActive
                  ? 'bg-[#212121] text-white font-bold'
                  : 'text-[#aaaaaa] hover:text-white hover:bg-[#181818]'
              }`
            }
          >
            <Icon className="w-5 h-5" />
            <span>{label}</span>
          </NavLink>
        ))}
      </div>

      <div className="mx-4 my-2 border-t border-[#1f1f1f]" />

      {/* Library & Playlists */}
      <div className="flex-1 px-3 py-2 space-y-1 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-800">
        <div className="px-4 py-2 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-[#717171]">Playlists</span>
          <button
            onClick={() => navigate('/library')}
            className="p-1 rounded-full hover:bg-[#212121] text-[#aaaaaa] hover:text-white transition-colors"
            title="New Playlist"
          >
            <PlusCircle className="w-4 h-4" />
          </button>
        </div>

        {quickPlaylists.map(({ label, icon: Icon, count, to }) => (
          <NavLink
            key={label}
            to={to}
            className={({ isActive }) =>
              `flex items-center justify-between px-4 py-2.5 rounded-xl text-sm transition-colors group ${
                isActive
                  ? 'bg-[#212121] text-white font-bold'
                  : 'text-[#aaaaaa] hover:text-white hover:bg-[#181818]'
              }`
            }
          >
            <div className="flex items-center gap-4 truncate">
              <Icon className="w-4 h-4 text-[#ff4e4e] group-hover:scale-110 transition-transform" />
              <span className="truncate">{label}</span>
            </div>
            <span className="text-[10px] text-[#717171]">{count}</span>
          </NavLink>
        ))}

        <div className="pt-4 px-4">
          <div className="p-3.5 rounded-2xl bg-gradient-to-br from-[#181818] to-[#121212] border border-[#262626] space-y-2">
            <div className="flex items-center gap-2 text-[#ff4e4e] text-xs font-black">
              <Sparkles className="w-4 h-4" />
              <span>Unlimited High-Fi</span>
            </div>
            <p className="text-[11px] text-[#aaaaaa] leading-relaxed">
              No subscription or login needed. Stream unlimited high-quality audio with offline support.
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
};
