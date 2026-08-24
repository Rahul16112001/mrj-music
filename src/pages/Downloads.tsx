import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, HardDrive, Play, Trash2, WifiOff, Sparkles, Settings } from 'lucide-react';
import { Track } from '../types';
import { offlineStorage } from '../services/offlineStorage';
import { useMusicPlayer } from '../context/MusicPlayerContext';
import { TrackCard } from '../components/TrackCard';

export const Downloads: React.FC = () => {
  const navigate = useNavigate();
  const { playTrack, deleteDownloadedTrack, downloadedTrackIds } = useMusicPlayer();

  const [downloadedTracks, setDownloadedTracks] = useState<Track[]>([]);
  const [storageInfo, setStorageInfo] = useState<{ totalBytes: number; formatted: string; count: number }>({
    totalBytes: 0,
    formatted: '0 MB',
    count: 0,
  });
  const [loading, setLoading] = useState(true);

  const loadDownloads = async () => {
    setLoading(true);
    try {
      const tracks = await offlineStorage.getAllDownloadedTracks();
      setDownloadedTracks(tracks);
      const usage = await offlineStorage.getStorageUsage();
      setStorageInfo(usage);
    } catch (err) {
      console.error('Failed to load offline tracks:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDownloads();
  }, [downloadedTrackIds]);

  const handlePlayAll = () => {
    if (downloadedTracks.length > 0) {
      playTrack(downloadedTracks[0], downloadedTracks);
    }
  };

  return (
    <div className="p-3 sm:p-6 md:p-8 space-y-6 max-w-7xl mx-auto pb-mobile-player-nav select-none">
      {/* Vault Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#121215] via-emerald-950/20 to-[#121215] border border-emerald-800/30 p-5 sm:p-6 shadow-xl">
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold w-fit">
              <WifiOff className="w-3.5 h-3.5" />
              <span>100% Zero-Data Offline Playback</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Offline Music Vault
            </h1>
            <p className="text-xs text-[#888888] max-w-xl">
              Songs and high-resolution lyrics stored directly on your device.
            </p>
          </div>

          {/* Storage Meter Card */}
          <div className="p-3.5 rounded-2xl bg-[#18181c] border border-[#26262a] min-w-[170px] shrink-0">
            <div className="flex items-center justify-between gap-2 text-xs font-bold text-[#888888] mb-1">
              <div className="flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
                <span>Device Storage</span>
              </div>
              <button
                onClick={() => navigate('/settings')}
                className="text-[#888888] hover:text-white"
                title="Download Settings"
              >
                <Settings className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="text-xl font-black text-white">{storageInfo.formatted}</div>
            <div className="text-[11px] text-emerald-400 font-semibold mt-0.5">
              {storageInfo.count} Tracks Saved
            </div>
          </div>
        </div>
      </div>

      {/* Actions & List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <button
            onClick={handlePlayAll}
            disabled={downloadedTracks.length === 0}
            className="px-5 py-2.5 rounded-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-black font-black text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all active:scale-95 min-h-[44px]"
          >
            <Play className="w-4 h-4 fill-black" />
            <span>Play All Offline ({downloadedTracks.length})</span>
          </button>
        </div>

        {downloadedTracks.length > 0 ? (
          <div className="space-y-1">
            {downloadedTracks.map((track, idx) => (
              <TrackCard
                key={track.id}
                track={track}
                showIndex={idx + 1}
                queueContext={downloadedTracks}
                variant="row"
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center space-y-3 bg-[#121215] border border-[#202024] rounded-3xl p-8">
            <Download className="w-10 h-10 text-[#444444]" />
            <div className="space-y-1">
              <h3 className="text-base font-bold text-white">No Offline Downloads</h3>
              <p className="text-xs text-[#888888] max-w-sm">
                Tap the download icon on any song to save it for zero-data offline playback anywhere.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
