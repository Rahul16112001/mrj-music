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
  updateMetadata?(options: { track: any; isPlaying: boolean; isLocal?: boolean }): Promise<void>;
  setPlaybackState?(options: { isPlaying: boolean; position?: number; duration?: number }): Promise<void>;
  stop?(): Promise<void>;
  requestNotificationPermission?(): Promise<{ granted: boolean }>;
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
    onRemoteCommand?: (command: string, value?: number) => void;
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

        // Lock-screen / notification transport controls relayed from native.
        // In metadata-only mode the WebView (YouTube/HTML5) is the real engine,
        // so these commands must drive the web player, not a native ExoPlayer.
        NativePlayer.addListener('remoteCommand', (data) => {
          callbacks.onRemoteCommand?.(data.command, data.value ?? data.position);
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

  public async updateMetadata(track: Track, isPlaying: boolean = true, isLocal: boolean = false): Promise<void> {
    if (!this.isNative) return;
    try {
      if (NativePlayer.updateMetadata) {
        await NativePlayer.updateMetadata({ track, isPlaying, isLocal });
      }
    } catch {}
  }

  // Lightweight play/pause + position refresh for the notification without a full metadata resend.
  public async setPlaybackState(state: { isPlaying: boolean; position?: number; duration?: number }): Promise<void> {
    if (!this.isNative) return;
    try {
      if (NativePlayer.setPlaybackState) await NativePlayer.setPlaybackState(state);
    } catch {}
  }

  // Tear down the foreground service + media notification entirely.
  public async stop(): Promise<void> {
    if (!this.isNative) return;
    try {
      if (NativePlayer.stop) await NativePlayer.stop();
    } catch {}
  }

  // Android 13+ requires runtime POST_NOTIFICATIONS or the media notification is silently suppressed.
  public async requestNotificationPermission(): Promise<boolean> {
    if (!this.isNative) return false;
    try {
      if (NativePlayer.requestNotificationPermission) {
        const res = await NativePlayer.requestNotificationPermission();
        return !!res?.granted;
      }
    } catch {}
    return false;
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
