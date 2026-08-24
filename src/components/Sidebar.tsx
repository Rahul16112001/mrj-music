import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Home,
  Compass,
  Library,
  PlusCircle,
  Heart,
  Download,
  Settings,
  Disc3,
  ListMusic,
  Sparkles,
  Smartphone
} from 'lucide-react';
import { useMusicPlayer } from '../context/MusicPlayerContext';
import { CreatePlaylistModal } from './CreatePlaylistModal';

export const Sidebar: React.FC = () => {
  const navigate = useNavigate();
  const { downloadedTrackIds, likedTrackIds, playlists } = useMusicPlayer();
  const [isPlaylistModalOpen, setIsPlaylistModalOpen] = useState(false);

  const mainLinks = [
    { to: '/', label: 'Home', icon: Home },
    { to: '/explore', label: 'Explore', icon: Compass },
    { to: '/library', label: 'Library', icon: Library },
    { to: '/downloads', label: 'Downloads', icon: Download },
    { to: '/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <aside className="w-64 bg-[#030303] border-r border-[#1f1f1f] h-screen flex flex-col shrink-0 select-none hidden lg:flex">
      {/* MRJ Music Logo Header */}
      <div className="h-16 px-5 flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
        <img
          src="/logo.png"
          alt="MRJ Music"
          className="w-9 h-9 rounded-full object-cover shadow-lg shadow-red-600/30 shrink-0"
        />
        <div className="flex items-center gap-1.5">
          <span className="font-black text-base tracking-tight text-white">MRJ Music</span>
        </div>
      </div>

      {/* Main Navigation Links */}
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

      {/* Playlists & Vault Header */}
      <div className="flex-1 px-3 py-2 space-y-1 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-800">
        <div className="px-4 py-2 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-[#717171]">Library & Mixes</span>
          <button
            onClick={() => setIsPlaylistModalOpen(true)}
            className="p-1 rounded-full hover:bg-[#212121] text-[#aaaaaa] hover:text-white transition-colors"
            title="New Playlist"
          >
            <PlusCircle className="w-4 h-4" />
          </button>
        </div>

        {/* Liked Songs */}
        <NavLink
          to="/library"
          className={({ isActive }) =>
            `flex items-center justify-between px-4 py-2.5 rounded-xl text-sm transition-colors group ${
              isActive
                ? 'bg-[#212121] text-white font-bold'
                : 'text-[#aaaaaa] hover:text-white hover:bg-[#181818]'
            }`
          }
        >
          <div className="flex items-center gap-4 truncate">
            <Heart className="w-4 h-4 text-[#ff4e4e] group-hover:scale-110 transition-transform" />
            <span className="truncate">Liked Songs</span>
          </div>
          <span className="text-[10px] text-[#717171]">{likedTrackIds.size}</span>
        </NavLink>

        {/* Offline Vault */}
        <NavLink
          to="/downloads"
          className={({ isActive }) =>
            `flex items-center justify-between px-4 py-2.5 rounded-xl text-sm transition-colors group ${
              isActive
                ? 'bg-[#212121] text-white font-bold'
                : 'text-[#aaaaaa] hover:text-white hover:bg-[#181818]'
            }`
          }
        >
          <div className="flex items-center gap-4 truncate">
            <Download className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
            <span className="truncate">Offline Vault</span>
          </div>
          <span className="text-[10px] text-emerald-400 font-bold">{downloadedTrackIds.size}</span>
        </NavLink>

        {/* User Custom Playlists */}
        {playlists.map((pl) => (
          <NavLink
            key={pl.id}
            to={`/playlist/${pl.id}`}
            className={({ isActive }) =>
              `flex items-center justify-between px-4 py-2.5 rounded-xl text-sm transition-colors group ${
                isActive
                  ? 'bg-[#212121] text-white font-bold'
                  : 'text-[#aaaaaa] hover:text-white hover:bg-[#181818]'
              }`
            }
          >
            <div className="flex items-center gap-4 truncate">
              <ListMusic className="w-4 h-4 text-[#aaaaaa] group-hover:text-white transition-colors" />
              <span className="truncate">{pl.title}</span>
            </div>
            <span className="text-[10px] text-[#717171]">{pl.trackCount}</span>
          </NavLink>
        ))}

        <div className="pt-4 px-2">
          <button
            onClick={() => setIsPlaylistModalOpen(true)}
            className="w-full p-2.5 rounded-xl border border-dashed border-[#333333] hover:border-white text-[#aaaaaa] hover:text-white text-xs font-semibold flex items-center justify-center gap-2 hover:bg-[#181818] transition-all"
          >
            <PlusCircle className="w-4 h-4 text-[#ff0000]" />
            <span>New Playlist</span>
          </button>
        </div>
      </div>

      {/* Download Android App Card */}
      <div className="p-3 border-t border-[#1f1f1f]">
        <NavLink
          to="/download"
          className={({ isActive }) =>
            `flex items-center gap-3 p-3 rounded-2xl border transition-all group ${
              isActive
                ? 'bg-[#18181c] border-[#ff0000]/50 text-white shadow-lg shadow-red-950/20'
                : 'bg-[#111114] hover:bg-[#18181c] border-[#222226] text-[#cccccc] hover:text-white hover:border-[#333338]'
            }`
          }
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#ff0000]/20 to-emerald-500/10 border border-[#ff0000]/30 text-[#ff4e4e] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <Smartphone className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-black tracking-tight text-white group-hover:text-[#ff4e4e] transition-colors">
                Download App
              </span>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-emerald-500/20 text-emerald-400">
                APK
              </span>
            </div>
            <p className="text-[10px] text-[#717171] truncate mt-0.5">
              Get MRJ Music for Android
            </p>
          </div>
        </NavLink>
      </div>

      <CreatePlaylistModal
        isOpen={isPlaylistModalOpen}
        onClose={() => setIsPlaylistModalOpen(false)}
      />
    </aside>
  );
};
