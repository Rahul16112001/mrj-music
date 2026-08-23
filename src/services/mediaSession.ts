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

    // Artwork resolution for lock-screen displays
    let artworkUrl = track.thumbnail;
    if (artworkUrl.includes('ytimg.com')) {
      const match = artworkUrl.match(/\/vi\/([a-zA-Z0-9_-]+)\//);
      if (match && match[1]) {
        artworkUrl = `https://i.ytimg.com/vi/${match[1]}/hqdefault.jpg`;
      }
    }

    if (typeof window.MediaMetadata !== 'undefined') {
      navigator.mediaSession.metadata = new window.MediaMetadata({
        title: track.title,
        artist: track.artist,
        album: track.album || 'MRJ Music',
        artwork: [
          { src: artworkUrl, sizes: '96x96', type: 'image/jpeg' },
          { src: artworkUrl, sizes: '128x128', type: 'image/jpeg' },
          { src: artworkUrl, sizes: '256x256', type: 'image/jpeg' },
          { src: artworkUrl, sizes: '512x512', type: 'image/jpeg' },
        ],
      });
    }

    navigator.mediaSession.playbackState = 'playing';

    navigator.mediaSession.setActionHandler('play', () => {
      navigator.mediaSession.playbackState = 'playing';
      handlers.onPlay();
    });

    navigator.mediaSession.setActionHandler('pause', () => {
      navigator.mediaSession.playbackState = 'paused';
      handlers.onPause();
    });

    navigator.mediaSession.setActionHandler('nexttrack', handlers.onNext);
    navigator.mediaSession.setActionHandler('previoustrack', handlers.onPrevious);

    try {
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime !== undefined) {
          handlers.onSeek(details.seekTime);
        }
      });
    } catch {}

    try {
      navigator.mediaSession.setActionHandler('seekbackward', (details) => {
        const skipTime = details.seekOffset || 10;
        handlers.onSeek(Math.max(0, (details.seekTime || 0) - skipTime));
      });
      navigator.mediaSession.setActionHandler('seekforward', (details) => {
        const skipTime = details.seekOffset || 10;
        handlers.onSeek((details.seekTime || 0) + skipTime);
      });
    } catch {}
  } catch (err) {
    console.warn('MediaSession setup notice:', err);
  }
};

export const updateMediaSessionPosition = (currentTime: number, duration: number) => {
  try {
    if (
      typeof window !== 'undefined' &&
      'mediaSession' in navigator &&
      'setPositionState' in navigator.mediaSession &&
      duration > 0 &&
      !isNaN(currentTime) &&
      !isNaN(duration)
    ) {
      navigator.mediaSession.setPositionState({
        duration: Math.max(0, duration),
        playbackRate: 1,
        position: Math.min(Math.max(0, currentTime), duration),
      });
    }
  } catch {}
};
