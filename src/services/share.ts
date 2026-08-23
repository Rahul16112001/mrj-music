import { Track, Playlist, Artist } from '../types';

export const shareService = {
  async shareTrack(track: Track): Promise<boolean> {
    const url = `${window.location.origin}/search?q=${encodeURIComponent(track.title + ' ' + track.artist)}`;
    const title = `${track.title} - ${track.artist}`;
    const text = `Listen to "${track.title}" by ${track.artist} on MRJ Music!`;

    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return true;
      } catch (err) {
        // User cancelled or share failed
      }
    }

    // Fallback: Copy to clipboard
    try {
      await navigator.clipboard.writeText(url);
      return true;
    } catch {
      return false;
    }
  },

  async shareArtist(artist: Artist): Promise<boolean> {
    const url = `${window.location.origin}/artist/${encodeURIComponent(artist.name)}`;
    const title = `${artist.name} on MRJ Music`;
    const text = `Check out ${artist.name}'s top songs on MRJ Music!`;

    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return true;
      } catch {}
    }

    try {
      await navigator.clipboard.writeText(url);
      return true;
    } catch {
      return false;
    }
  },

  async sharePlaylist(playlist: Playlist): Promise<boolean> {
    const url = `${window.location.origin}/playlist/${playlist.id}`;
    const title = `${playlist.title} Playlist on MRJ Music`;
    const text = `Listen to the "${playlist.title}" playlist on MRJ Music!`;

    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return true;
      } catch {}
    }

    try {
      await navigator.clipboard.writeText(url);
      return true;
    } catch {
      return false;
    }
  },
};
