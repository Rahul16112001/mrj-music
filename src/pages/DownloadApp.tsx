import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  Download,
  CheckCircle2,
  ShieldCheck,
  QrCode,
  Copy,
  Check,
  ExternalLink,
  Sparkles,
  Zap,
  HardDrive,
  Headphones,
  Radio,
  FileCheck
} from 'lucide-react';
import { APP_RELEASE } from '../config/appRelease';
import { syncService } from '../services/syncService';

export const DownloadApp: React.FC = () => {
  const [isCopiedSha, setIsCopiedSha] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState(APP_RELEASE.apkDownloadUrl);
  const [pageUrl, setPageUrl] = useState('https://mrj-music.vercel.app/download');

  useEffect(() => {
    // Detect if client is Android
    if (typeof navigator !== 'undefined') {
      const ua = navigator.userAgent.toLowerCase();
      setIsAndroid(/android/i.test(ua));
    }
    if (typeof window !== 'undefined') {
      setPageUrl(window.location.href);
    }
    // Track anonymous analytics
    syncService.queueEvent({
      eventType: 'APP_DOWNLOAD_PAGE_OPENED',
      title: 'MRJ Music Android App',
    });
  }, []);

  const handleDownloadClick = () => {
    syncService.queueEvent({
      eventType: 'APP_DOWNLOAD_CLICKED',
      title: 'MRJ Music Android APK',
    });
  };

  const handleCopySha = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(APP_RELEASE.sha256);
      setIsCopiedSha(true);
      setTimeout(() => setIsCopiedSha(false), 2000);
    }
  };

  // QR Code URL for phone scanning
  const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
    'https://mrj-music.vercel.app/download'
  )}&bgcolor=141417&color=ffffff&margin=10`;

  return (
    <div className="p-3 sm:p-6 md:p-10 max-w-5xl mx-auto space-y-10 pb-mobile-player-nav select-none">
      {/* 1. HERO BANNER */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#18181c] via-[#121215] to-[#0a0a0c] border border-[#26262a] p-6 sm:p-10 shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#ff0000]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="space-y-4 max-w-xl text-center md:text-left">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#ff0000]/10 text-[#ff4e4e] text-xs font-black border border-[#ff0000]/20">
              <Smartphone className="w-3.5 h-3.5" />
              <span>Official Android Release • v{APP_RELEASE.version}</span>
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight leading-tight">
              MRJ Music for Android
            </h1>

            <p className="text-sm sm:text-base text-[#aaaaaa] leading-relaxed">
              Experience music-first streaming, lossless audio, background lock screen controls, and the intelligent Smart Downloads 2.0 offline vault natively on Android.
            </p>

            {/* Main Action Buttons */}
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 pt-2">
              <a
                href={downloadUrl}
                download={APP_RELEASE.apkFileName}
                onClick={handleDownloadClick}
                className="px-8 py-4 rounded-2xl bg-[#ff0000] hover:bg-[#cc0000] active:scale-95 text-white font-extrabold text-sm sm:text-base flex items-center gap-3 shadow-xl shadow-red-600/30 transition-all min-h-[48px]"
              >
                <Download className="w-5 h-5 stroke-[2.5]" />
                <span>{isAndroid ? 'Download Android App' : 'Download APK'}</span>
                <span className="text-xs opacity-80 font-mono">({APP_RELEASE.fileSizeFormatted})</span>
              </a>

              <div className="flex items-center gap-2 text-xs text-emerald-400 font-bold bg-emerald-500/10 px-4 py-3 rounded-2xl border border-emerald-500/20">
                <ShieldCheck className="w-4 h-4" />
                <span>Verified Safe & Signed</span>
              </div>
            </div>
          </div>

          {/* Desktop QR Code Card */}
          <div className="flex flex-col items-center bg-[#141417] border border-[#2a2a30] p-5 rounded-2xl shadow-xl space-y-3 shrink-0">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#aaaaaa]">
              <QrCode className="w-4 h-4 text-[#ff4e4e]" />
              <span>Scan to Install on Phone</span>
            </div>

            <div className="w-40 h-40 bg-[#141417] rounded-xl overflow-hidden border border-[#26262a] flex items-center justify-center p-1">
              <img
                src={qrApiUrl}
                alt="Scan to download MRJ Music Android APK"
                className="w-full h-full object-contain rounded-lg"
              />
            </div>

            <p className="text-[10px] text-[#717171] text-center max-w-[160px]">
              Point your Android camera at the QR code to download directly.
            </p>
          </div>
        </div>
      </div>

      {/* 2. SPECIFICATIONS & SECURITY VERIFICATION */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-5 rounded-2xl bg-[#121215] border border-[#222226] space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#888888]">
            <FileCheck className="w-4 h-4 text-[#ff0000]" />
            <span>Package Specifications</span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-[#717171]">Version:</span>
              <p className="font-bold text-white font-mono">v{APP_RELEASE.version} (Build {APP_RELEASE.buildNumber})</p>
            </div>
            <div>
              <span className="text-[#717171]">File Size:</span>
              <p className="font-bold text-white font-mono">{APP_RELEASE.fileSizeFormatted}</p>
            </div>
            <div>
              <span className="text-[#717171]">Requirements:</span>
              <p className="font-bold text-white">{APP_RELEASE.minAndroidVersion}</p>
            </div>
            <div>
              <span className="text-[#717171]">Target:</span>
              <p className="font-bold text-white">{APP_RELEASE.targetAndroidVersion}</p>
            </div>
          </div>
        </div>

        {/* SHA-256 Checksum Card */}
        <div className="p-5 rounded-2xl bg-[#121215] border border-[#222226] space-y-3 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#888888]">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>SHA-256 Integrity Checksum</span>
            </div>
            <button
              onClick={handleCopySha}
              className="flex items-center gap-1 text-[11px] font-bold text-white bg-white/10 hover:bg-white/20 px-2.5 py-1 rounded-lg transition-all"
            >
              {isCopiedSha ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{isCopiedSha ? 'Copied' : 'Copy'}</span>
            </button>
          </div>

          <p className="text-[11px] font-mono text-[#888888] bg-[#0c0c0e] p-2.5 rounded-xl border border-[#1e1e22] break-all select-all">
            {APP_RELEASE.sha256}
          </p>

          <p className="text-[10px] text-[#717171]">
            Use this checksum to verify the authenticity of the downloaded APK.
          </p>
        </div>
      </div>

      {/* 3. STEP-BY-STEP INSTALLATION GUIDE */}
      <div className="p-6 rounded-3xl bg-[#121215] border border-[#222226] space-y-6">
        <div className="space-y-1">
          <h3 className="text-lg font-black text-white tracking-tight">How to Install MRJ Music on Android</h3>
          <p className="text-xs text-[#888888]">Follow these simple steps to install the APK directly on your device:</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="p-4 rounded-2xl bg-[#161619] border border-[#252529] space-y-2">
            <div className="w-7 h-7 rounded-full bg-[#ff0000]/20 text-[#ff4e4e] font-black text-xs flex items-center justify-center">
              1
            </div>
            <h4 className="text-xs font-bold text-white">Download APK</h4>
            <p className="text-[11px] text-[#888888]">Tap the Download APK button above to save the file.</p>
          </div>

          <div className="p-4 rounded-2xl bg-[#161619] border border-[#252529] space-y-2">
            <div className="w-7 h-7 rounded-full bg-[#ff0000]/20 text-[#ff4e4e] font-black text-xs flex items-center justify-center">
              2
            </div>
            <h4 className="text-xs font-bold text-white">Open File</h4>
            <p className="text-[11px] text-[#888888]">Tap the download completed notification in your status bar.</p>
          </div>

          <div className="p-4 rounded-2xl bg-[#161619] border border-[#252529] space-y-2">
            <div className="w-7 h-7 rounded-full bg-[#ff0000]/20 text-[#ff4e4e] font-black text-xs flex items-center justify-center">
              3
            </div>
            <h4 className="text-xs font-bold text-white">Allow Source</h4>
            <p className="text-[11px] text-[#888888]">If prompted by Android, toggle "Allow from this source".</p>
          </div>

          <div className="p-4 rounded-2xl bg-[#161619] border border-[#252529] space-y-2">
            <div className="w-7 h-7 rounded-full bg-[#ff0000]/20 text-[#ff4e4e] font-black text-xs flex items-center justify-center">
              4
            </div>
            <h4 className="text-xs font-bold text-white">Install</h4>
            <p className="text-[11px] text-[#888888]">Tap Install to complete package setup on your device.</p>
          </div>

          <div className="p-4 rounded-2xl bg-[#161619] border border-[#252529] space-y-2">
            <div className="w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-400 font-black text-xs flex items-center justify-center">
              5
            </div>
            <h4 className="text-xs font-bold text-white">Enjoy Music</h4>
            <p className="text-[11px] text-[#888888]">Open MRJ Music and log in to sync your playlists and vault.</p>
          </div>
        </div>
      </div>

      {/* 4. KEY ANDROID FEATURES */}
      <div className="space-y-4">
        <h3 className="text-lg font-black text-white tracking-tight">Built Specifically for Android</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-[#121215] border border-[#202024] space-y-2">
            <Headphones className="w-5 h-5 text-[#ff0000]" />
            <h4 className="text-xs font-bold text-white">Background Playback</h4>
            <p className="text-[11px] text-[#888888]">Continuous streaming with lock screen & notification controls.</p>
          </div>

          <div className="p-4 rounded-2xl bg-[#121215] border border-[#202024] space-y-2">
            <HardDrive className="w-5 h-5 text-emerald-400" />
            <h4 className="text-xs font-bold text-white">Smart Downloads 2.0</h4>
            <p className="text-[11px] text-[#888888]">Automated personalized offline music caching with zero data usage.</p>
          </div>

          <div className="p-4 rounded-2xl bg-[#121215] border border-[#202024] space-y-2">
            <Zap className="w-5 h-5 text-amber-400" />
            <h4 className="text-xs font-bold text-white">Hardware Back Button</h4>
            <p className="text-[11px] text-[#888888]">Smooth intuitive navigation respecting Android system back gestures.</p>
          </div>

          <div className="p-4 rounded-2xl bg-[#121215] border border-[#202024] space-y-2">
            <Radio className="w-5 h-5 text-sky-400" />
            <h4 className="text-xs font-bold text-white">Offline Recommendations</h4>
            <p className="text-[11px] text-[#888888]">Taste-based local autoplay without requiring an internet connection.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
