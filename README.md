# MRJ Music — High-Quality Global Music Streaming & Android APK

> **Ad-Supported High-Fidelity Worldwide Music Streaming Platform with Zero-Data Offline Vault & Synced Karaoke Lyrics**

MRJ Music is a full-featured streaming client and Android APK designed to deliver the entire global music catalog with zero subscription fees, crystal-clear 160 kbps Opus audio, real-time synchronized karaoke lyrics, personalized taste recommendations & radio, and a YouTube Music-style **Offline Vault** that allows zero-data playback with offline ad monetization.

---

## ✨ Key Features

1. **Worldwide Music Catalog**: Instant search across 100+ million global songs, artists, albums, and discographies.
2. **High-Fidelity Audio Engine**: High-bitrate 160 kbps Opus / Format 251 audio streaming with dynamic album color theming.
3. **Full Zero-Data Offline Vault (`/downloads`)**: 1-click download of any song or album to device storage for offline playback on flights or road trips.
4. **Offline Ad Pre-Caching Engine**: Pre-downloads sponsor audio/visual ads during online sessions and triggers them during offline playback every 4 tracks, ensuring continuous monetization.
5. **Real-Time Synced Karaoke Lyrics**: Active word & line highlighting synchronized to music timestamps via LRCLIB.
6. **Lock-Screen & Background Playback**: Native `navigator.mediaSession` integration with native play/pause/skip and high-res cover art.
7. **Personalized Taste & Radio**: Auto-generates Quick Picks, mood stations (Chill, Workout, Focus, Party, etc.), and infinite radio queues.

---

## 🚀 Quick Start (Local Run)

```bash
# 1. Navigate to the project directory
cd /Users/mrj/Desktop/mrj-music

# 2. Start both the Backend API and Frontend UI concurrently
npm run start
```

* **Frontend App**: `http://localhost:3000`
* **Backend API**: `http://localhost:5005`

---

## 📱 How to Build the Android APK

The project is pre-scaffolded with **Capacitor 6 Android**:

```bash
# 1. Build the production web bundle and sync assets to Android
npm run build
npm run cap:sync

# 2. Open the project in Android Studio
npm run cap:open
```

In Android Studio:
1. Click **Build ➔ Build Bundle(s) / APK(s) ➔ Build APK(s)**.
2. Android Studio will generate the debug/release `.apk` file ready to install on any Android phone!

---

## ☁️ 100% Free Cloud Deployment

### 1. Deploy Frontend on Vercel
* Import the repository on [Vercel](https://vercel.com).
* Framework Preset: **Vite**.
* Build Command: `npm run build` | Output Directory: `dist`.

### 2. Deploy Backend on Render.com
* Import the `server` directory as a free Node.js Web Service on [Render.com](https://render.com).
* Start Command: `npm start`.
