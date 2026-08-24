import { App } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Network } from '@capacitor/network';
import { Capacitor } from '@capacitor/core';

type DismissHandler = () => boolean;

class AndroidLifecycleService {
  private backHandlers: DismissHandler[] = [];
  private isInitialized = false;
  private isOnline = true;
  private rootPaths = new Set(['/', '/search', '/library', '/downloads', '/settings']);

  public async initialize(navigateBack?: () => void) {
    if (this.isInitialized) return;
    this.isInitialized = true;

    // 1. Android Platform Specific Setup
    if (Capacitor.isNativePlatform() || Capacitor.getPlatform() === 'android') {
      try {
        await StatusBar.setStyle({ style: Style.Dark });
        await StatusBar.setBackgroundColor({ color: '#030303' });
        await StatusBar.setOverlaysWebView({ overlay: false });
      } catch (err) {
        console.warn('StatusBar initialization notice:', err);
      }

      // 2. Hardware Back Button Handling Stack
      App.addListener('backButton', ({ canGoBack }) => {
        // Run registered dismiss handlers in reverse order (LIFO)
        for (let i = this.backHandlers.length - 1; i >= 0; i--) {
          const handled = this.backHandlers[i]();
          if (handled) return;
        }

        // Check if on root path
        const currentPath = window.location.pathname;
        if (this.rootPaths.has(currentPath)) {
          // On root tab, exit/minimize the app
          App.exitApp();
        } else if (canGoBack && navigateBack) {
          navigateBack();
        } else if (window.history.length > 1) {
          window.history.back();
        } else {
          App.exitApp();
        }
      });

      // 3. App State Changes (Foreground / Background)
      App.addListener('appStateChange', ({ isActive }) => {
        const event = new CustomEvent('mrj-app-state-change', { detail: { isActive } });
        window.dispatchEvent(event);
      });
    }

    // 4. Network Status Monitoring (PWA + Android)
    try {
      const status = await Network.getStatus();
      this.isOnline = status.connected;

      Network.addListener('networkStatusChange', (newStatus) => {
        this.isOnline = newStatus.connected;
        const event = new CustomEvent('mrj-network-change', { detail: { isOnline: newStatus.connected } });
        window.dispatchEvent(event);
      });
    } catch (err) {
      console.warn('Network listener initialization notice:', err);
    }
  }

  /**
   * Registers a back-button dismiss handler.
   * Handler should return `true` if it consumed the back event, `false` otherwise.
   */
  public registerBackHandler(handler: DismissHandler): () => void {
    this.backHandlers.push(handler);
    return () => {
      this.backHandlers = this.backHandlers.filter((h) => h !== handler);
    };
  }

  public getNetworkStatus(): boolean {
    return this.isOnline;
  }
}

export const androidLifecycleService = new AndroidLifecycleService();
