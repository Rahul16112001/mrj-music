import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Download,
  HardDrive,
  Play,
  Shuffle,
  Trash2,
  WifiOff,
  Sparkles,
  Settings,
  RefreshCw,
  Check,
  Loader2,
  Info,
  ShieldCheck,
  Zap
} from 'lucide-react';
import { Track, AppSettings } from '../types';
import { offlineStorage } from '../services/offlineStorage';
import { smartDownloadEngine, SmartDownloadStatus } from '../services/smartDownloadEngine';
import { offlineRecommendationEngine } from '../services/offlineRecommendationEngine';
import { useMusicPlayer } from '../context/MusicPlayerContext';
import { TrackCard } from '../components/TrackCard';

export const Downloads: React.FC = () => {
  const navigate = useNavigate();
  const { playTrack, deleteDownloadedTrack, downloadedTrackIds } = useMusicPlayer();

  const [activeTab, setActiveTab] = useState<'all' | 'manual' | 'smart'>('all');
  const [allTracks, setAllTracks] = useState<Track[]>([]);
  const [manualTracks, setManualTracks] = useState<Track[]>([]);
  const [smartTracks, setSmartTracks] = useState<Track[]>([]);
  const [storageBreakdown, setStorageBreakdown] = useState({
    manualBytes: 0,
    smartBytes: 0,
    totalBytes: 0,
    manualCount: 0,
    smartCount: 0,
    formatted: '0 MB',
  });

  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [smartStatus, setSmartStatus] = useState<SmartDownloadStatus>(smartDownloadEngine.getStatus());
  const [isClearingSmart, setIsClearingSmart] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const all = await offlineStorage.getAllDownloadedTracks();
      const manual = await offlineStorage.getManualDownloads();
      const smart = await offlineStorage.getSmartDownloads();
      const breakdown = await offlineStorage.getStorageBreakdown();
      const appSettings = await offlineStorage.getSettings();

      setAllTracks(all);
      setManualTracks(manual);
      setSmartTracks(smart);
      setStorageBreakdown(breakdown);
      setSettings(appSettings);
    } catch (err) {
      console.error('Failed to load offline data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const unsubscribe = smartDownloadEngine.subscribe((status) => {
      setSmartStatus(status);
      if (!status.isUpdating && status.progressPercent === 100) {
        loadData();
      }
    });
    return () => unsubscribe();
  }, [downloadedTrackIds]);

  const handlePlayAll = () => {
    const list = activeTab === 'manual' ? manualTracks : activeTab === 'smart' ? smartTracks : allTracks;
    if (list.length > 0) {
      playTrack(list[0], list);
    }
  };

  const handleShuffleAll = async () => {
    const mode = activeTab === 'manual' ? 'manual' : activeTab === 'smart' ? 'smart' : 'all';
    const shuffled = await offlineRecommendationEngine.getOfflineShuffleQueue(mode);
    if (shuffled.length > 0) {
      playTrack(shuffled[0], shuffled);
    }
  };

  const handleToggleSmartDownloads = async () => {
    if (!settings) return;
    const willEnable = !settings.smartDownloads.enabled;
    const updated = {
      ...settings,
      smartDownloads: {
        ...settings.smartDownloads,
        enabled: willEnable,
      },
    };
    await offlineStorage.saveSettings(updated);
    setSettings(updated);

    // Task 6B: Trigger smart downloads sync when enabling toggle
    if (willEnable) {
      smartDownloadEngine.syncSmartDownloads().catch(() => {});
    }
  };

  const handleUpdateSmartDownloads = async () => {
    await smartDownloadEngine.syncSmartDownloads(true);
    await loadData();
  };

  const handleClearSmartDownloads = async () => {
    setIsClearingSmart(true);
    try {
      await offlineStorage.deleteSmartDownloads();
      await loadData();
    } finally {
      setIsClearingSmart(false);
    }
  };

  const displayedTracks =
    activeTab === 'manual' ? manualTracks : activeTab === 'smart' ? smartTracks : allTracks;

  const storageLimitBytes = (settings?.smartDownloads.storageLimitMB || 500) * 1024 * 1024;
  const storagePercent = Math.min(100, Math.round((storageBreakdown.totalBytes / storageLimitBytes) * 100));

  return (
    <div className="p-3 sm:p-6 md:p-8 space-y-6 max-w-7xl mx-auto pb-mobile-player-nav select-none">
      {/* 1. VAULT HEADER BANNER & STORAGE METER */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#121215] via-emerald-950/20 to-[#121215] border border-emerald-800/30 p-5 sm:p-6 shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-1.5 flex-1">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold w-fit">
              <WifiOff className="w-3.5 h-3.5" />
              <span>Smart Offline Vault 2.0</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Offline Music Vault
            </h1>
            <p className="text-xs text-[#888888] max-w-xl">
              Automatic personalized offline downloads and protected manual library storage.
            </p>
          </div>

          {/* Storage Meter Card */}
          <div className="p-4 rounded-2xl bg-[#18181c] border border-[#26262a] w-full md:w-80 shrink-0 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-[#888888]">
              <div className="flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
                <span>Device Storage</span>
              </div>
              <span className="font-mono text-white">
                {storageBreakdown.formatted} / {settings?.smartDownloads.storageLimitMB || 500} MB
              </span>
            </div>

            {/* Visual Storage Bar */}
            <div className="w-full h-2 bg-[#26262a] rounded-full overflow-hidden flex">
              <div
                className="bg-emerald-500 h-full transition-all"
                style={{
                  width: `${Math.min(100, (storageBreakdown.manualBytes / storageLimitBytes) * 100)}%`,
                }}
                title={`Manual: ${(storageBreakdown.manualBytes / 1024 / 1024).toFixed(1)} MB`}
              />
              <div
                className="bg-[#ff0000] h-full transition-all"
                style={{
                  width: `${Math.min(100, (storageBreakdown.smartBytes / storageLimitBytes) * 100)}%`,
                }}
                title={`Smart: ${(storageBreakdown.smartBytes / 1024 / 1024).toFixed(1)} MB`}
              />
            </div>

            <div className="flex justify-between text-[10px] text-[#717171] pt-1">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                Manual ({storageBreakdown.manualCount})
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#ff0000] inline-block" />
                Smart ({storageBreakdown.smartCount})
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. SMART DOWNLOADS CONTROL PANEL */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#141417] border border-white/10 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#ff0000]/10 border border-[#ff0000]/30 text-[#ff0000] flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-white">Auto Smart Downloads</h3>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${settings?.smartDownloads.enabled ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-zinc-800 text-zinc-400 border border-zinc-700'}`}>
                  {settings?.smartDownloads.enabled ? 'ON' : 'OFF'}
                </span>
              </div>
              <p className="text-xs text-[#888888] mt-0.5">
                {settings?.smartDownloads.enabled
                  ? 'Active: Automatically keeps your favorite tracks available for offline listening.'
                  : 'Turned Off: Only tracks you explicitly click Download on will be saved.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            {/* Direct Switch Toggle */}
            <button
              onClick={handleToggleSmartDownloads}
              className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                settings?.smartDownloads.enabled ? 'bg-[#ff0000]' : 'bg-[#2a2a30]'
              }`}
              role="switch"
              aria-checked={settings?.smartDownloads.enabled}
            >
              <span
                className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  settings?.smartDownloads.enabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>

            {settings?.smartDownloads.enabled && (
              <button
                onClick={handleUpdateSmartDownloads}
                disabled={smartStatus.isUpdating}
                className="px-3.5 py-1.5 rounded-xl bg-[#ff0000] hover:bg-[#cc0000] disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 shadow-md active:scale-95 transition-all"
              >
                {smartStatus.isUpdating ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Syncing...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Sync Now</span>
                  </>
                )}
              </button>
            )}

            {smartTracks.length > 0 && (
              <button
                onClick={handleClearSmartDownloads}
                disabled={isClearingSmart}
                className="p-2 text-[#717171] hover:text-rose-400 hover:bg-white/5 rounded-xl transition-colors min-w-[38px] min-h-[38px] flex items-center justify-center"
                title="Clear Smart Downloads (Keeps manual downloads)"
              >
                {isClearingSmart ? <Loader2 className="w-4 h-4 animate-spin text-rose-400" /> : <Trash2 className="w-4 h-4" />}
              </button>
            )}
          </div>
        </div>

        {/* Live Updating Progress Line */}
        {smartStatus.isUpdating && (
          <div className="space-y-1.5 pt-2 border-t border-[#222226]">
            <div className="flex justify-between text-xs text-[#888888]">
              <span>Downloading: <strong className="text-white">{smartStatus.currentTrackTitle || 'Analyzing taste profile...'}</strong></span>
              <span>{smartStatus.downloadedTracks} / {smartStatus.totalTracks}</span>
            </div>
            <div className="w-full h-1.5 bg-[#222226] rounded-full overflow-hidden">
              <div
                className="bg-[#ff0000] h-full transition-all duration-200"
                style={{ width: `${smartStatus.progressPercent}%` }}
              />
            </div>
          </div>
        )}

        {/* Protection Notice */}
        <div className="flex items-center gap-2 text-[11px] text-emerald-400/90 pt-1">
          <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
          <span>Manual Download Protection Active: Your manually saved tracks are strictly protected and never deleted.</span>
        </div>
      </div>

      {/* 3. TABS & ACTIONS */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Tab Filter */}
          <div className="flex items-center gap-1 p-1 rounded-full bg-[#141417] border border-[#26262a] w-full sm:w-fit">
            <button
              onClick={() => setActiveTab('all')}
              className={`flex-1 sm:flex-none px-4 py-1.5 rounded-full text-xs font-bold transition-all min-h-[34px] ${
                activeTab === 'all' ? 'bg-white text-black shadow-md' : 'text-[#888888] hover:text-white'
              }`}
            >
              All ({allTracks.length})
            </button>
            <button
              onClick={() => setActiveTab('manual')}
              className={`flex-1 sm:flex-none px-4 py-1.5 rounded-full text-xs font-bold transition-all min-h-[34px] ${
                activeTab === 'manual' ? 'bg-white text-black shadow-md' : 'text-[#888888] hover:text-white'
              }`}
            >
              Manual ({manualTracks.length})
            </button>
            <button
              onClick={() => setActiveTab('smart')}
              className={`flex-1 sm:flex-none px-4 py-1.5 rounded-full text-xs font-bold transition-all min-h-[34px] ${
                activeTab === 'smart' ? 'bg-white text-black shadow-md' : 'text-[#888888] hover:text-white'
              }`}
            >
              Smart ({smartTracks.length})
            </button>
          </div>

          {/* Action Buttons */}
          {displayedTracks.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={handlePlayAll}
                className="px-4 py-2 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs flex items-center gap-1.5 shadow-md active:scale-95 transition-all min-h-[36px]"
              >
                <Play className="w-3.5 h-3.5 fill-black" />
                <span>Play All</span>
              </button>
              <button
                onClick={handleShuffleAll}
                className="px-4 py-2 rounded-full bg-[#1c1c20] hover:bg-[#28282e] text-white font-bold text-xs flex items-center gap-1.5 border border-[#2e2e34] active:scale-95 transition-all min-h-[36px]"
              >
                <Shuffle className="w-3.5 h-3.5" />
                <span>Shuffle</span>
              </button>
            </div>
          )}
        </div>

        {/* 4. TRACKS LIST */}
        {displayedTracks.length > 0 ? (
          <div className="space-y-1">
            {displayedTracks.map((track, idx) => (
              <div key={track.id} className="relative group">
                <TrackCard
                  track={track}
                  showIndex={idx + 1}
                  queueContext={displayedTracks}
                  variant="row"
                />
                {track.downloadReason && (
                  <p className="text-[10px] text-[#717171] ml-16 -mt-1 mb-1 pl-1 truncate">
                    ✨ {track.downloadReason}
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center space-y-3 bg-[#121215] border border-[#202024] rounded-3xl p-8">
            <Download className="w-10 h-10 text-[#444444]" />
            <div className="space-y-1">
              <h3 className="text-base font-bold text-white">
                {activeTab === 'smart' ? 'No Smart Downloads Yet' : 'No Downloaded Songs'}
              </h3>
              <p className="text-xs text-[#888888] max-w-sm">
                {activeTab === 'smart'
                  ? 'Enable Smart Downloads and tap "Update Now" to automatically cache your favorite music.'
                  : 'Tap the download icon on any song to store it for zero-data offline playback.'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
