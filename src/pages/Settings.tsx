import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Settings as SettingsIcon,
  Volume2,
  Download,
  HardDrive,
  Sparkles,
  Trash2,
  Upload,
  FileJson,
  ShieldCheck,
  Check,
  RefreshCw,
  Info,
  Smartphone
} from 'lucide-react';
import { AppSettings, AudioQuality } from '../types';
import { offlineStorage } from '../services/offlineStorage';
import { backupService } from '../services/backup';
import { useMusicPlayer } from '../context/MusicPlayerContext';
import { updateService, UpdateCheckResult } from '../services/updateService';
import { UpdateModal } from '../components/UpdateModal';

export const SettingsPage: React.FC = () => {
  const { audioQuality, setAudioQuality, refreshLibrary } = useMusicPlayer();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [storageInfo, setStorageInfo] = useState({ totalBytes: 0, formatted: '0 MB', count: 0 });
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateCheckResult | null>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);

  const loadData = async () => {
    const s = await offlineStorage.getSettings();
    setSettings(s);
    const storage = await offlineStorage.getStorageUsage();
    setStorageInfo(storage);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveSettings = async (updated: AppSettings) => {
    setSettings(updated);
    await offlineStorage.saveSettings(updated);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 1200);
  };

  const handleClearHistory = async () => {
    if (window.confirm('Clear all your listening history?')) {
      await offlineStorage.clearHistory();
      await refreshLibrary();
      alert('History cleared.');
    }
  };

  const handleDeleteAllDownloads = async () => {
    if (window.confirm('Delete all offline downloaded tracks?')) {
      const tracks = await offlineStorage.getAllDownloadedTracks();
      for (const t of tracks) {
        await offlineStorage.removeTrack(t.id);
      }
      await refreshLibrary();
      await loadData();
    }
  };

  const handleExportBackup = async () => {
    await backupService.exportData();
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      if (content) {
        const res = await backupService.importData(content);
        setImportStatus(res.message);
        await refreshLibrary();
        await loadData();
        setTimeout(() => setImportStatus(null), 3000);
      }
    };
    reader.readAsText(file);
  };

  if (!settings) return null;

  return (
    <div className="p-4 md:p-8 space-y-10 max-w-4xl mx-auto pb-40 select-none">
      {/* Settings Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
            <SettingsIcon className="w-7 h-7 text-[#ff0000]" />
            <span>Settings</span>
          </h1>
          <p className="text-xs text-[#aaaaaa] mt-1">Configure audio quality, smart downloads, and local library backup</p>
        </div>
        {isSaved && (
          <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
            <Check className="w-4 h-4" />
            <span>Saved</span>
          </span>
        )}
      </div>

      {/* 1. Playback Settings */}
      <section className="space-y-4 bg-[#121212] border border-[#212121] p-6 rounded-3xl">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Volume2 className="w-5 h-5 text-[#ff0000]" />
          <span>Playback & Streaming</span>
        </h2>

        <div className="space-y-4 pt-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-white">Audio Quality</p>
              <p className="text-xs text-[#aaaaaa]">Choose stream bitrate based on your connection</p>
            </div>
            <select
              value={audioQuality}
              onChange={(e) => setAudioQuality(e.target.value as AudioQuality)}
              className="bg-[#212121] border border-[#333333] rounded-xl px-4 py-2 text-xs font-bold text-white focus:outline-none cursor-pointer"
            >
              <option value="auto">Auto (Adaptive)</option>
              <option value="standard">Standard (128 kbps AAC)</option>
              <option value="high">High-Fi (160 kbps Opus)</option>
            </select>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-[#1f1f1f]">
            <div>
              <p className="text-sm font-semibold text-white">Autoplay Radio</p>
              <p className="text-xs text-[#aaaaaa]">Automatically queue similar songs when your playlist ends</p>
            </div>
            <input
              type="checkbox"
              checked={settings.autoplayRadio}
              onChange={(e) =>
                handleSaveSettings({ ...settings, autoplayRadio: e.target.checked })
              }
              className="w-5 h-5 accent-[#ff0000] cursor-pointer"
            />
          </div>
        </div>
      </section>

      {/* 2. Downloads & Smart Downloads */}
      <section className="space-y-4 bg-[#121212] border border-[#212121] p-6 rounded-3xl">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Download className="w-5 h-5 text-emerald-400" />
          <span>Downloads & Storage</span>
        </h2>

        <div className="space-y-5 pt-2">
          {/* Storage Meter */}
          <div className="flex items-center justify-between p-4 rounded-2xl bg-[#1a1a1a] border border-[#262626]">
            <div>
              <p className="text-xs font-bold text-[#aaaaaa]">Device Storage Used</p>
              <p className="text-2xl font-black text-white">{storageInfo.formatted}</p>
              <p className="text-[11px] text-emerald-400 font-semibold">{storageInfo.count} Songs Saved Offline</p>
            </div>
            <button
              onClick={handleDeleteAllDownloads}
              disabled={storageInfo.count === 0}
              className="px-4 py-2 rounded-xl bg-[#282828] hover:bg-red-950/40 text-xs font-bold text-[#aaaaaa] hover:text-red-400 border border-[#383838] transition-colors disabled:opacity-50"
            >
              Clear Downloads
            </button>
          </div>

          {/* Smart Downloads Toggle */}
          <div className="flex items-center justify-between pt-2 border-t border-[#1f1f1f]">
            <div>
              <p className="text-sm font-semibold text-white">Smart Downloads</p>
              <p className="text-xs text-[#aaaaaa]">Automatically pre-cache your top liked songs when on Wi-Fi</p>
            </div>
            <input
              type="checkbox"
              checked={settings.smartDownloads.enabled}
              onChange={(e) =>
                handleSaveSettings({
                  ...settings,
                  smartDownloads: { ...settings.smartDownloads, enabled: e.target.checked },
                })
              }
              className="w-5 h-5 accent-emerald-500 cursor-pointer"
            />
          </div>

          {/* Max Tracks Slider */}
          {settings.smartDownloads.enabled && (
            <div className="space-y-2 pt-2 border-t border-[#1f1f1f]">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-white">Smart Download Track Limit</span>
                <span className="text-emerald-400 font-bold">{settings.smartDownloads.maxTracks} Tracks</span>
              </div>
              <input
                type="range"
                min="5"
                max="50"
                step="5"
                value={settings.smartDownloads.maxTracks}
                onChange={(e) =>
                  handleSaveSettings({
                    ...settings,
                    smartDownloads: {
                      ...settings.smartDownloads,
                      maxTracks: parseInt(e.target.value, 10),
                    },
                  })
                }
                className="w-full h-1.5 bg-[#333333] accent-emerald-500 rounded-lg cursor-pointer"
              />
            </div>
          )}
        </div>
      </section>

      {/* 3. Data Backup & Local Export */}
      <section className="space-y-4 bg-[#121212] border border-[#212121] p-6 rounded-3xl">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <FileJson className="w-5 h-5 text-[#ff4e4e]" />
          <span>Library Backup & Restore</span>
        </h2>
        <p className="text-xs text-[#aaaaaa]">
          Because MRJ Music requires zero login, you can backup your entire library (playlists, liked tracks, and settings) to a `.json` file and restore it anytime.
        </p>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            onClick={handleExportBackup}
            className="px-5 py-2.5 rounded-full bg-[#212121] hover:bg-[#2e2e2e] border border-[#333333] text-white font-bold text-xs flex items-center gap-2 transition-colors"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>Export Library Backup (JSON)</span>
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-5 py-2.5 rounded-full bg-[#212121] hover:bg-[#2e2e2e] border border-[#333333] text-white font-bold text-xs flex items-center gap-2 transition-colors"
          >
            <Upload className="w-4 h-4 text-[#ff4e4e]" />
            <span>Import Backup</span>
          </button>
          <input
            type="file"
            ref={fileInputRef}
            accept=".json"
            onChange={handleImportFile}
            className="hidden"
          />

          <button
            onClick={handleClearHistory}
            className="px-4 py-2.5 rounded-full bg-[#212121] hover:bg-red-950/40 text-xs font-bold text-[#aaaaaa] hover:text-red-400 border border-[#333333] transition-colors"
          >
            Clear History
          </button>
        </div>

        {importStatus && (
          <p className="text-xs font-bold text-emerald-400 pt-2">{importStatus}</p>
        )}
      </section>

      {/* Download Android App Section */}
      <section className="space-y-4 bg-gradient-to-r from-red-950/40 via-[#161618] to-[#121212] border border-red-900/30 p-6 rounded-3xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-red-600/20 border border-red-500/30 flex items-center justify-center shrink-0">
              <Smartphone className="w-6 h-6 text-[#ff4e4e]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">MRJ Music Android App</h2>
              <p className="text-xs text-[#aaaaaa]">
                Native AndroidX Media3 Background Audio, Offline Smart Downloads & Lock Screen Controls
              </p>
            </div>
          </div>
          <Link
            to="/download"
            className="px-5 py-2.5 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-red-600/20 transition-all shrink-0 min-h-[44px]"
          >
            <Download className="w-4 h-4" />
            <span>Download Android App</span>
          </Link>
        </div>
      </section>

      {/* 4. Automatic Update & Central Release Management */}
      <section className="space-y-4 bg-gradient-to-r from-[#141417] via-[#1a1417] to-[#141417] border border-[#2c2226] p-6 rounded-3xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-[#ff0000]/10 border border-[#ff0000]/30 text-[#ff4e4e] flex items-center justify-center shrink-0">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-white">MRJ Music Engine</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  v2.1.0 (Production)
                </span>
              </div>
              <p className="text-xs text-[#888888] mt-0.5">
                Centralized update system with automated background verification and Media3 audio engine.
              </p>
            </div>
          </div>

          <button
            onClick={async () => {
              const info = await updateService.checkForUpdates(true);
              if (info) {
                if (info.isUpdateAvailable) {
                  setUpdateInfo(info);
                  setShowUpdateModal(true);
                } else {
                  alert(`🎉 You are using the latest version of MRJ Music (v${info.latestVersion}).`);
                }
              } else {
                alert('🎉 You are using the latest version of MRJ Music (v3.1.0).');
              }
            }}
            className="px-6 py-3 rounded-2xl bg-[#212126] hover:bg-[#2d2d35] active:scale-95 text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 border border-white/10 transition-all shrink-0 min-h-[44px]"
          >
            <RefreshCw className="w-4 h-4 text-emerald-400" />
            <span>Check for Updates</span>
          </button>
        </div>
      </section>

      {/* 5. About & Privacy */}
      <section className="space-y-3 p-6 bg-[#0e0e0e] border border-[#1f1f1f] rounded-3xl text-center md:text-left">
        <div className="flex items-center gap-2 text-xs font-bold text-white">
          <Info className="w-4 h-4 text-[#ff0000]" />
          <span>MRJ Music v3.1.0 High-Fi Stream Engine</span>
        </div>
        <p className="text-xs text-[#717171] leading-relaxed">
          Open-source High-Fidelity Music Streaming System. Offline Vault, Synced Lyrics, and AndroidX Media3 Background Playback.
        </p>
      </section>

      {updateInfo && (
        <UpdateModal
          isOpen={showUpdateModal}
          onClose={() => setShowUpdateModal(false)}
          updateInfo={updateInfo}
        />
      )}
    </div>
  );
};
