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

  const handleDelete = async (trackId: string) => {
    await deleteDownloadedTrack(trackId);
    await loadDownloads();
  };

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-7xl mx-auto pb-40 select-none">
      {/* Vault Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#121212] via-emerald-950/30 to-[#121212] border border-emerald-800/40 p-6 md:p-8 shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold w-fit">
              <WifiOff className="w-3.5 h-3.5" />
              <span>100% Zero-Data Offline Playback</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">
              Offline Music Vault
            </h1>
            <p className="text-xs md:text-sm text-[#aaaaaa] max-w-xl">
              Songs and lyrics stored directly inside your device's local offline storage. Play your music on flights, road trips, or without internet.
            </p>
          </div>

          {/* Storage Meter Card */}
          <div className="p-4 rounded-2xl bg-[#1c1c1c]/90 border border-[#2d2d2d] backdrop-blur-md min-w-[200px] shrink-0">
            <div className="flex items-center justify-between gap-2 text-xs font-bold text-[#aaaaaa] mb-1">
              <div className="flex items-center gap-1.5">
                <HardDrive className="w-4 h-4 text-emerald-400" />
                <span>Device Storage</span>
              </div>
              <button
                onClick={() => navigate('/settings')}
                className="text-[#aaaaaa] hover:text-white"
                title="Download Settings"
              >
                <Settings className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="text-2xl font-black text-white">{storageInfo.formatted}</div>
            <div className="text-xs text-emerald-400 font-semibold mt-0.5">
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
            className="px-6 py-2.5 rounded-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-black text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all hover:scale-105"
          >
            <Play className="w-4 h-4 fill-black" />
            <span>Play All Offline ({downloadedTracks.length})</span>
          </button>
        </div>

        {downloadedTracks.length === 0 ? (
          <div className="text-center py-20 bg-[#121212] rounded-3xl border border-[#212121] space-y-3">
            <Download className="w-12 h-12 text-[#717171] mx-auto opacity-50" />
            <h3 className="text-lg font-bold text-white">No Offline Tracks Yet</h3>
            <p className="text-xs text-[#aaaaaa] max-w-sm mx-auto">
              Click the download button next to any song to save it for offline listening.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {downloadedTracks.map((track, idx) => (
              <div key={track.id} className="relative group">
                <TrackCard track={track} queueContext={downloadedTracks} showIndex={idx} />
                <button
                  onClick={() => handleDelete(track.id)}
                  className="absolute right-14 top-1/2 -translate-y-1/2 p-2 rounded-full hover:bg-[#282828] text-[#aaaaaa] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                  title="Delete from offline storage"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
