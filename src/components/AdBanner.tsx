import React from 'react';
import { Sparkles, ExternalLink, X, ShieldCheck } from 'lucide-react';
import { AdCreative } from '../types';

interface AdBannerProps {
  ad?: AdCreative | null;
  onDismiss?: () => void;
  type?: 'inline' | 'modal';
}

export const AdBanner: React.FC<AdBannerProps> = ({ ad, onDismiss, type = 'inline' }) => {
  if (!ad) return null;

  if (type === 'modal') {
    return (
      <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
        <div className="bg-dark-900 border border-dark-750 rounded-3xl p-6 max-w-sm w-full shadow-2xl relative animate-in zoom-in-95 duration-200">
          <button
            onClick={onDismiss}
            className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-dark-800 text-gray-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="w-full h-40 rounded-2xl overflow-hidden mb-4 bg-dark-800">
            <img src={ad.bannerUrl} alt={ad.title} className="w-full h-full object-cover" />
          </div>

          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-mrj-400 mb-1">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Sponsored • {ad.sponsor}</span>
          </div>

          <h3 className="text-lg font-bold text-gray-100 mb-2">{ad.title}</h3>
          <p className="text-xs text-gray-400 mb-5">
            Thank you for supporting 100% free music on MRJ Music!
          </p>

          <div className="flex items-center gap-3">
            <a
              href={ad.ctaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-mrj-600 to-rose-500 hover:from-mrj-500 hover:to-rose-400 text-white text-xs font-bold text-center flex items-center justify-center gap-2 shadow-lg shadow-mrj-500/25 transition-all"
            >
              <span>{ad.ctaText}</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <button
              onClick={onDismiss}
              className="py-3 px-4 rounded-xl bg-dark-800 hover:bg-dark-750 text-gray-300 text-xs font-bold transition-colors"
            >
              Continue Music
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="my-6 p-4 rounded-2xl bg-gradient-to-r from-dark-850 via-dark-900 to-dark-850 border border-dark-750/80 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg">
      <div className="flex items-center gap-3.5">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-mrj-600/30 to-amber-500/30 border border-mrj-500/30 flex items-center justify-center shrink-0">
          <Sparkles className="w-6 h-6 text-mrj-400" />
        </div>
        <div>
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-mrj-400">
            <span>Sponsored • {ad.sponsor}</span>
          </div>
          <h4 className="text-sm font-bold text-gray-100">{ad.title}</h4>
        </div>
      </div>

      <a
        href={ad.ctaUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="px-4 py-2 rounded-xl bg-mrj-600 hover:bg-mrj-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md transition-all shrink-0"
      >
        <span>{ad.ctaText}</span>
        <ExternalLink className="w-3 h-3" />
      </a>
    </div>
  );
};
