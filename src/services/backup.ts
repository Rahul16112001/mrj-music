import { offlineStorage } from './offlineStorage';
import { BackupData } from '../types';

export const backupService = {
  async exportData(): Promise<void> {
    const playlists = await offlineStorage.getAllPlaylists();
    const likedTracks = await offlineStorage.getLikedTracks();
    const history = await offlineStorage.getHistory();
    const settings = await offlineStorage.getSettings();

    const backup: BackupData = {
      version: '2.0',
      exportedAt: Date.now(),
      playlists,
      likedTracks,
      history,
      settings,
    };

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(backup, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `mrj_music_backup_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  },

  async importData(jsonContent: string): Promise<{ success: boolean; message: string }> {
    try {
      const data = JSON.parse(jsonContent) as BackupData;
      if (!data || !data.version) {
        return { success: false, message: 'Invalid backup file format' };
      }

      if (Array.isArray(data.playlists)) {
        for (const p of data.playlists) {
          await offlineStorage.savePlaylist(p);
        }
      }

      if (Array.isArray(data.likedTracks)) {
        for (const t of data.likedTracks) {
          const isAlreadyLiked = await offlineStorage.isLiked(t.id);
          if (!isAlreadyLiked) {
            await offlineStorage.toggleLike(t);
          }
        }
      }

      if (data.settings) {
        await offlineStorage.saveSettings(data.settings);
      }

      return { success: true, message: 'Library and settings restored successfully!' };
    } catch (err: any) {
      return { success: false, message: 'Failed to parse JSON file: ' + err.message };
    }
  },
};
