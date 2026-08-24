import { Capacitor, registerPlugin } from '@capacitor/core';
import { Track } from '../types';

export interface NativePlayerPlugin {
  isNativeAvailable(): Promise<{ available: boolean; version: string; engine: string }>;
  playTrack(options: { track: any; queue?: any[] }): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  togglePlay(): Promise<void>;
  seekTo(options: { position: number }): Promise<void>;
  playNext(): Promise<void>;
  playPrevious(): Promise<void>;
  setShuffle(options: { enabled: boolean }): Promise<void>;
  getNativeStorageBreakdown(): Promise<any>;
  getNativeDownloads(): Promise<{ tracks: any[] }>;
  deleteDownloadedTrack(options: { trackId: string }): Promise<{ success: boolean }>;
  addListener(eventName: string, listenerFunc: (data: any) => void): Promise<any>;
  removeAllListeners(): Promise<void>;
}

const NativePlayer = registerPlugin<NativePlayerPlugin>('MRJNativePlayer');

class NativePlayerBridge {
  private isNative = false;
  private isInitialized = false;

  constructor() {
    this.checkPlatform();
  }

  private checkPlatform() {
    this.isNative = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
  }

  public isNativeAndroid(): boolean {
    return this.isNative;
  }

  public async initialize(callbacks: {
    onPlaybackStateChange?: (isPlaying: boolean, isLoading: boolean) => void;
    onTrackChange?: (track: Track) => void;
    onPositionChange?: (currentTime: number, duration: number) => void;
    onQueueChange?: (queue: Track[], queueIndex: number) => void;
    onError?: (error: string) => void;
  }): Promise<boolean> {
    if (!this.isNative || this.isInitialized) return this.isNative;
    this.isInitialized = true;

    try {
      const status = await NativePlayer.isNativeAvailable();
      if (status && status.available) {
        console.log(`🚀 [MRJ Native] Initialized ${status.engine} v${status.version}`);

        NativePlayer.addListener('playbackStateChange', (data) => {
          callbacks.onPlaybackStateChange?.(data.isPlaying, data.isLoading);
        });

        NativePlayer.addListener('trackChange', (data) => {
          if (data.track) {
            callbacks.onTrackChange?.(data.track);
          }
        });

        NativePlayer.addListener('positionChange', (data) => {
          callbacks.onPositionChange?.(data.currentTime, data.duration);
        });

        NativePlayer.addListener('queueChange', (data) => {
          callbacks.onQueueChange?.(data.queue, data.queueIndex);
        });

        NativePlayer.addListener('playbackError', (data) => {
          callbacks.onError?.(data.error);
        });

        return true;
      }
    } catch (err) {
      console.warn('Native player bridge initialization notice:', err);
    }
    return false;
  }

  public async playTrack(track: Track, queue?: Track[]): Promise<boolean> {
    if (!this.isNative) return false;
    try {
      await NativePlayer.playTrack({
        track,
        queue: queue && queue.length > 0 ? queue : undefined,
      });
      return true;
    } catch (err) {
      console.error('[MRJ Native] playTrack error:', err);
      return false;
    }
  }

  public async pause(): Promise<boolean> {
    if (!this.isNative) return false;
    try {
      await NativePlayer.pause();
      return true;
    } catch {
      return false;
    }
  }

  public async resume(): Promise<boolean> {
    if (!this.isNative) return false;
    try {
      await NativePlayer.resume();
      return true;
    } catch {
      return false;
    }
  }

  public async togglePlay(): Promise<boolean> {
    if (!this.isNative) return false;
    try {
      await NativePlayer.togglePlay();
      return true;
    } catch {
      return false;
    }
  }

  public async seekTo(seconds: number): Promise<boolean> {
    if (!this.isNative) return false;
    try {
      await NativePlayer.seekTo({ position: seconds });
      return true;
    } catch {
      return false;
    }
  }

  public async playNext(): Promise<boolean> {
    if (!this.isNative) return false;
    try {
      await NativePlayer.playNext();
      return true;
    } catch {
      return false;
    }
  }

  public async playPrevious(): Promise<boolean> {
    if (!this.isNative) return false;
    try {
      await NativePlayer.playPrevious();
      return true;
    } catch {
      return false;
    }
  }

  public async setShuffle(enabled: boolean): Promise<boolean> {
    if (!this.isNative) return false;
    try {
      await NativePlayer.setShuffle({ enabled });
      return true;
    } catch {
      return false;
    }
  }

  public async getNativeDownloads(): Promise<Track[]> {
    if (!this.isNative) return [];
    try {
      const res = await NativePlayer.getNativeDownloads();
      return (res.tracks || []) as Track[];
    } catch {
      return [];
    }
  }

  public async getNativeStorageBreakdown(): Promise<any> {
    if (!this.isNative) return null;
    try {
      return await NativePlayer.getNativeStorageBreakdown();
    } catch {
      return null;
    }
  }
}

export const nativePlayerBridge = new NativePlayerBridge();
