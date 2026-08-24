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
import { Explore } from './pages/Explore';
import { Search } from './pages/Search';
import { Downloads } from './pages/Downloads';
import { Library } from './pages/Library';
import { ArtistPage } from './pages/Artist';
import { AlbumPage } from './pages/Album';
import { PlaylistPage } from './pages/Playlist';
import { SettingsPage } from './pages/Settings';
import { LoginPage } from './pages/Login';
import { RegisterPage } from './pages/Register';
import { ProfilePage } from './pages/Profile';
import { ForgotPasswordPage } from './pages/ForgotPassword';
import { DownloadApp } from './pages/DownloadApp';
import { androidLifecycleService } from './services/androidLifecycleService';
import { updateService, UpdateCheckResult } from './services/updateService';
import { UpdateModal } from './components/UpdateModal';
import { ErrorBoundary } from './components/ErrorBoundary';

const AppContent: React.FC = () => {
  const navigate = useNavigate();
  const [updateInfo, setUpdateInfo] = React.useState<UpdateCheckResult | null>(null);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = React.useState(false);

  useEffect(() => {
    // Initialize native Android hardware back button and lifecycle services
    androidLifecycleService.initialize(() => navigate(-1));

    // Check for web updates on launch
    updateService.checkForUpdates().then((info) => {
      if (info && info.isUpdateAvailable) {
        setUpdateInfo(info);
        setIsUpdateModalOpen(true);
      }
    }).catch(() => {});
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
          <ErrorBoundary>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/explore" element={<Explore />} />
              <Route path="/search" element={<Search />} />
              <Route path="/downloads" element={<Downloads />} />
              <Route path="/library" element={<Library />} />
              <Route path="/artist/:name" element={<ArtistPage />} />
              <Route path="/album/:id" element={<AlbumPage />} />
              <Route path="/playlist/:id" element={<PlaylistPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/download" element={<DownloadApp />} />
              <Route path="/download-app" element={<DownloadApp />} />
            </Routes>
          </ErrorBoundary>
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <BottomNav />

      {/* Persistent Mini Player / Desktop Player Bar */}
      <PlayerBar />

      {/* Immersive 3-Tab Fullscreen Player */}
      <FullScreenPlayer />

      {/* Automatic In-App Update Prompt Modal */}
      {updateInfo && (
        <UpdateModal
          isOpen={isUpdateModalOpen}
          onClose={() => setIsUpdateModalOpen(false)}
          updateInfo={updateInfo}
        />
      )}
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
