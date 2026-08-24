import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mrj.music',
  appName: 'MRJ Music',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1000,
      backgroundColor: '#030303',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#030303',
      overlaysWebView: false,
    },
  },
};

export default config;
