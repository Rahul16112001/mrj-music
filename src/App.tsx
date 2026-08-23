import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { MusicPlayerProvider } from './context/MusicPlayerContext';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { BottomNav } from './components/BottomNav';
import { PlayerBar } from './components/PlayerBar';
import { FullScreenPlayer } from './components/FullScreenPlayer';
import { Home } from './pages/Home';
import { Search } from './pages/Search';
import { Downloads } from './pages/Downloads';
import { Library } from './pages/Library';
import { ArtistPage } from './pages/Artist';
import { AlbumPage } from './pages/Album';
import { PlaylistPage } from './pages/Playlist';
import { SettingsPage } from './pages/Settings';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <MusicPlayerProvider>
        <div className="flex h-screen bg-[#030303] text-white font-sans overflow-hidden">
          {/* Left Navigation Sidebar (Desktop View) */}
          <Sidebar />

          {/* Main App Container */}
          <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
            {/* Top Navigation & Status Bar */}
            <Navbar />

            {/* Routed Viewpages */}
            <main className="flex-1">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/search" element={<Search />} />
                <Route path="/downloads" element={<Downloads />} />
                <Route path="/library" element={<Library />} />
                <Route path="/artist/:name" element={<ArtistPage />} />
                <Route path="/album/:id" element={<AlbumPage />} />
                <Route path="/playlist/:id" element={<PlaylistPage />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Routes>
            </main>
          </div>

          {/* Mobile Bottom Navigation Bar */}
          <BottomNav />

          {/* Persistent Player Bar */}
          <PlayerBar />

          {/* Immersive 3-Tab Fullscreen Player */}
          <FullScreenPlayer />
        </div>
      </MusicPlayerProvider>
    </BrowserRouter>
  );
};
