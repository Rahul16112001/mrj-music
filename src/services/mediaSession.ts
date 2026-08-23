import { Track } from '../types';

export const setupMediaSession = (
  track: Track,
  handlers: {
    onPlay: () => void;
    onPause: () => void;
    onNext: () => void;
    onPrevious: () => void;
    onSeek: (seconds: number) => void;
  }
) => {
  try {
    if (typeof window === 'undefined' || !('mediaSession' in navigator)) return;

    if (typeof window.MediaMetadata !== 'undefined') {
      navigator.mediaSession.metadata = new window.MediaMetadata({
        title: track.title,
        artist: track.artist,
        album: track.album || 'MRJ Music',
        artwork: [
          { src: track.thumbnail, sizes: '96x96', type: 'image/jpeg' },
          { src: track.thumbnail, sizes: '128x128', type: 'image/jpeg' },
          { src: track.thumbnail, sizes: '256x256', type: 'image/jpeg' },
          { src: track.thumbnail, sizes: '512x512', type: 'image/jpeg' },
        ],
      });
    }

    navigator.mediaSession.setActionHandler('play', handlers.onPlay);
    navigator.mediaSession.setActionHandler('pause', handlers.onPause);
    navigator.mediaSession.setActionHandler('nexttrack', handlers.onNext);
    navigator.mediaSession.setActionHandler('previoustrack', handlers.onPrevious);

    try {
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime !== undefined) {
          handlers.onSeek(details.seekTime);
        }
      });
    } catch {}
  } catch (err) {
    console.warn('MediaSession setup ignored:', err);
  }
};
