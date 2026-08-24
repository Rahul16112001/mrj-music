import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Compass, Library, Download, Settings } from 'lucide-react';
import { useMusicPlayer } from '../context/MusicPlayerContext';

export const BottomNav: React.FC = () => {
  const { downloadedTrackIds } = useMusicPlayer();

  const navItems = [
    { to: '/', label: 'Home', icon: Home },
    { to: '/search', label: 'Explore', icon: Compass },
    { to: '/library', label: 'Library', icon: Library },
    { to: '/downloads', label: 'Downloads', icon: Download, badge: downloadedTrackIds.size },
    { to: '/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#080808]/95 backdrop-blur-xl border-t border-[#1a1a1a] px-1 select-none transition-all"
      style={{ paddingBottom: 'max(var(--sab), 6px)' }}
    >
      <div className="flex items-center justify-around h-14">
        {navItems.map(({ to, label, icon: Icon, badge }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all min-w-[52px] min-h-[44px] ${
                isActive
                  ? 'text-white font-bold'
                  : 'text-[#888888] hover:text-white'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <div className="relative flex items-center justify-center">
                  <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110 text-white' : 'text-[#888888]'}`} />
                  {badge !== undefined && badge > 0 && (
                    <span className="absolute -top-1.5 -right-2 px-1 min-w-[14px] h-[14px] rounded-full bg-emerald-500 text-[9px] font-black text-black flex items-center justify-center shadow-sm">
                      {badge > 99 ? '99+' : badge}
                    </span>
                  )}
                </div>
                <span className={`text-[10px] mt-1 tracking-tight ${isActive ? 'text-white font-semibold' : 'text-[#888888]'}`}>
                  {label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
};
