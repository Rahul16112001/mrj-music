import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Compass, Library, Download, Settings } from 'lucide-react';
import { useMusicPlayer } from '../context/MusicPlayerContext';

export const BottomNav: React.FC = () => {
  const { downloadedTrackIds, currentTrack } = useMusicPlayer();

  const navItems = [
    { to: '/', label: 'Home', icon: Home },
    { to: '/search', label: 'Explore', icon: Compass },
    { to: '/library', label: 'Library', icon: Library },
    { to: '/downloads', label: 'Downloads', icon: Download, badge: downloadedTrackIds.size },
    { to: '/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <nav
      className={`lg:hidden fixed left-0 right-0 z-30 bg-[#030303]/95 backdrop-blur-lg border-t border-[#1f1f1f] px-2 py-1.5 flex items-center justify-around select-none transition-all ${
        currentTrack ? 'bottom-[72px]' : 'bottom-0'
      }`}
    >
      {navItems.map(({ to, label, icon: Icon, badge }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all min-w-[56px] min-h-[44px] ${
              isActive
                ? 'text-white font-bold'
                : 'text-[#aaaaaa] hover:text-white'
            }`
          }
        >
          <div className="relative">
            <Icon className="w-5 h-5" />
            {badge !== undefined && badge > 0 && (
              <span className="absolute -top-1.5 -right-2.5 px-1 min-w-[14px] h-[14px] rounded-full bg-emerald-500 text-[9px] font-black text-black flex items-center justify-center">
                {badge}
              </span>
            )}
          </div>
          <span className="text-[10px] mt-1 tracking-tight">{label}</span>
        </NavLink>
      ))}
    </nav>
  );
};
