import React, { useEffect, useState, useRef } from 'react';
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
  Info
} from 'lucide-react';
import { AppSettings, AudioQuality } from '../types';
import { offlineStorage } from '../services/offlineStorage';
import { backupService } from '../services/backup';
import { useMusicPlayer } from '../context/MusicPlayerContext';

export const SettingsPage: React.FC = () => {
  const { audioQuality, setAudioQuality, refreshLibrary } = useMusicPlayer();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [storageInfo, setStorageInfo] = useState({ totalBytes: 0, formatted: '0 MB', count: 0 });
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);

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

      {/* 4. About & Privacy */}
      <section className="space-y-3 p-6 bg-[#0e0e0e] border border-[#1f1f1f] rounded-3xl text-center md:text-left">
        <div className="flex items-center gap-2 text-xs font-bold text-white">
          <Info className="w-4 h-4 text-[#ff0000]" />
          <span>MRJ Music v2.0 Production</span>
        </div>
        <p className="text-xs text-[#717171] leading-relaxed">
          100% Free & Open Music Platform. Zero login, zero cookies, zero tracking. All playlists and downloads are securely stored in your device's local IndexedDB.
        </p>
        <p className="text-[10px] text-[#555555]">
          Anonymous Client ID: {settings.anonymousInstallationId}
        </p>
      </section>
    </div>
  );
};
