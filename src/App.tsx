import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { MusicPlayerProvider } from './context/MusicPlayerContext';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { PlayerBar } from './components/PlayerBar';
import { FullScreenPlayer } from './components/FullScreenPlayer';
import { Home } from './pages/Home';
import { Search } from './pages/Search';
import { Downloads } from './pages/Downloads';
import { Library } from './pages/Library';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <MusicPlayerProvider>
        <div className="flex h-screen bg-dark-950 text-gray-100 font-sans overflow-hidden">
          {/* Left Navigation Sidebar (Desktop) */}
          <Sidebar />

          {/* Main App Workspace */}
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
              </Routes>
            </main>
          </div>

          {/* Floating Universal Bottom Player */}
          <PlayerBar />

          {/* Immersive Full Screen Player Modal */}
          <FullScreenPlayer />
        </div>
      </MusicPlayerProvider>
    </BrowserRouter>
  );
};
