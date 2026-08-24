import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
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
import { DownloadApp } from './pages/DownloadApp';
import { LoginPage } from './pages/Login';
import { RegisterPage } from './pages/Register';
import { ProfilePage } from './pages/Profile';
import { ForgotPasswordPage } from './pages/ForgotPassword';
import { androidLifecycleService } from './services/androidLifecycleService';

const AppContent: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Initialize native Android hardware back button and lifecycle services
    androidLifecycleService.initialize(() => navigate(-1));

    // Auto-trigger background Smart Downloads sync after initial mount
    const timer = setTimeout(() => {
      import('./services/smartDownloadEngine').then(({ smartDownloadEngine }) => {
        smartDownloadEngine.syncSmartDownloads().catch(() => {});
      });
    }, 4000);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
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
            <Route path="/download" element={<DownloadApp />} />
            <Route path="/download-app" element={<DownloadApp />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          </Routes>
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <BottomNav />

      {/* Persistent Mini Player / Desktop Player Bar */}
      <PlayerBar />

      {/* Immersive 3-Tab Fullscreen Player */}
      <FullScreenPlayer />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <MusicPlayerProvider>
          <AppContent />
        </MusicPlayerProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};
