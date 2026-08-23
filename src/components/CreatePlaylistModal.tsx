import React, { useState } from 'react';
import { X, Plus, Music, Check } from 'lucide-react';
import { Track, Playlist } from '../types';
import { useMusicPlayer } from '../context/MusicPlayerContext';

interface CreatePlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  trackToAdd?: Track | null;
}

export const CreatePlaylistModal: React.FC<CreatePlaylistModalProps> = ({
  isOpen,
  onClose,
  trackToAdd,
}) => {
  const { playlists, createPlaylist, addTrackToPlaylist } = useMusicPlayer();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [addedPlaylistId, setAddedPlaylistId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const newPl = await createPlaylist(title.trim(), description.trim());
    if (trackToAdd) {
      await addTrackToPlaylist(newPl.id, trackToAdd);
    }
    setTitle('');
    setDescription('');
    setIsCreatingNew(false);
    onClose();
  };

  const handleSelectPlaylist = async (playlist: Playlist) => {
    if (trackToAdd) {
      await addTrackToPlaylist(playlist.id, trackToAdd);
      setAddedPlaylistId(playlist.id);
      setTimeout(() => {
        setAddedPlaylistId(null);
        onClose();
      }, 700);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 select-none animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-[#181818] border border-[#2d2d2d] rounded-3xl p-6 shadow-2xl space-y-6">
        {/* Modal Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Music className="w-5 h-5 text-[#ff0000]" />
            <span>{trackToAdd ? 'Add to Playlist' : 'Create New Playlist'}</span>
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-[#282828] text-[#aaaaaa] hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* If track specified and not in create mode: show existing playlists */}
        {trackToAdd && !isCreatingNew && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-2.5 rounded-xl bg-[#212121]">
              <img
                src={trackToAdd.thumbnail}
                alt={trackToAdd.title}
                className="w-10 h-10 rounded-lg object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-white truncate">{trackToAdd.title}</p>
                <p className="text-[10px] text-[#aaaaaa] truncate">{trackToAdd.artist}</p>
              </div>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-800">
              <button
                onClick={() => setIsCreatingNew(true)}
                className="w-full p-3 rounded-2xl border border-dashed border-[#444444] hover:border-white text-white text-xs font-bold flex items-center justify-center gap-2 hover:bg-[#212121] transition-all"
              >
                <Plus className="w-4 h-4 text-[#ff0000]" />
                <span>Create New Playlist</span>
              </button>

              {playlists.map((pl) => (
                <div
                  key={pl.id}
                  onClick={() => handleSelectPlaylist(pl)}
                  className="flex items-center justify-between p-3 rounded-xl bg-[#212121] hover:bg-[#282828] cursor-pointer transition-colors"
                >
                  <div>
                    <h4 className="text-sm font-bold text-white">{pl.title}</h4>
                    <p className="text-[10px] text-[#aaaaaa]">{pl.trackCount} tracks</p>
                  </div>
                  {addedPlaylistId === pl.id && (
                    <Check className="w-4 h-4 text-emerald-400" />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Create New Playlist Form */}
        {(!trackToAdd || isCreatingNew) && (
          <form onSubmit={handleCreateSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#aaaaaa]">Playlist Title</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="My Favorite Vibes"
                className="w-full h-11 px-4 bg-[#212121] border border-[#333333] focus:border-[#ff0000] rounded-xl text-sm text-white focus:outline-none transition-all"
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#aaaaaa]">Description (Optional)</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Give your playlist a mood or description..."
                rows={3}
                className="w-full p-3 bg-[#212121] border border-[#333333] focus:border-[#ff0000] rounded-xl text-sm text-white focus:outline-none transition-all resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              {isCreatingNew && (
                <button
                  type="button"
                  onClick={() => setIsCreatingNew(false)}
                  className="px-4 py-2 text-xs font-bold text-[#aaaaaa] hover:text-white"
                >
                  Back
                </button>
              )}
              <button
                type="submit"
                className="px-6 py-2.5 rounded-full bg-[#ff0000] hover:bg-[#cc0000] text-white font-bold text-xs shadow-lg shadow-red-600/30 transition-all hover:scale-105"
              >
                Create Playlist
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
