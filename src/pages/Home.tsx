import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  TrendingUp,
  Compass,
  Download,
  Radio,
  Play,
  Heart,
  Flame,
  Coffee,
  Brain,
  PartyPopper,
  Moon,
  Disc,
} from 'lucide-react';
import { Track, MoodStation } from '../types';
import { api } from '../services/api';
import { useMusicPlayer } from '../context/MusicPlayerContext';
import { TrackCard } from '../components/TrackCard';
import { AdBanner } from '../components/AdBanner';
import { recommendationEngine } from '../services/recommendationEngine';

export const Home: React.FC = () => {
  const navigate = useNavigate();
  const { playTrack, downloadedTrackIds, activeAd, isAdPlaying, dismissAd } = useMusicPlayer();

  const [trending, setTrending] = useState<Track[]>([]);
  const [quickPicks, setQuickPicks] = useState<Track[]>([]);
  const [moods, setMoods] = useState<MoodStation[]>([]);
  const [recentlyPlayed, setRecentlyPlayed] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const data = await api.getCharts();
        setTrending(data.trending);
        setQuickPicks(data.quickPicks);
        setMoods(data.moods);
        setRecentlyPlayed(recommendationEngine.getRecentlyPlayed());
      } catch (err) {
        console.error('Home load error:', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const moodIconMap: { [key: string]: any } = {
    Coffee: Coffee,
    Flame: Flame,
    Brain: Brain,
    Sparkles: PartyPopper,
    Heart: Heart,
    Moon: Moon,
  };

  return (
    <div className="p-4 md:p-8 space-y-10 max-w-7xl mx-auto pb-32">
      {/* Offline/Online Ad Trigger Modal */}
      {isAdPlaying && activeAd && (
        <AdBanner ad={activeAd} onDismiss={dismissAd} type="modal" />
      )}

      {/* Hero Welcome & Taste Banner */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-mrj-950 via-dark-900 to-dark-950 border border-mrj-900/40 p-6 md:p-10 shadow-2xl">
        <div className="relative z-10 max-w-2xl">
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-mrj-500/20 border border-mrj-500/30 text-mrj-400 text-xs font-bold w-fit mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            <span>MRJ Music • High-Fi 160k Opus</span>
          </div>
          <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight leading-tight mb-3">
            Stream Any Music on Earth. <br />
            <span className="bg-gradient-to-r from-mrj-400 to-rose-300 bg-clip-text text-transparent">
              100% Free & Offline Ready.
            </span>
          </h1>
          <p className="text-sm md:text-base text-gray-300 mb-6 leading-relaxed">
            Zero subscription fees. Download full albums for airplane mode and enjoy crystal-clear sound with real-time synchronized karaoke lyrics.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            {trending.length > 0 && (
              <button
                onClick={() => playTrack(trending[0], trending)}
                className="px-6 py-3 rounded-full bg-gradient-to-r from-mrj-600 to-rose-500 hover:from-mrj-500 hover:to-rose-400 text-white font-bold text-sm flex items-center gap-2 shadow-lg shadow-mrj-500/30 hover:scale-105 transition-all"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>Play Global Hits</span>
              </button>
            )}
            <button
              onClick={() => navigate('/downloads')}
              className="px-6 py-3 rounded-full bg-dark-800 hover:bg-dark-750 text-gray-200 border border-dark-700 font-bold text-sm flex items-center gap-2 transition-colors"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              <span>Offline Vault ({downloadedTrackIds.size})</span>
            </button>
          </div>
        </div>

        {/* Ambient background decoration */}
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-mrj-600/10 to-transparent pointer-events-none" />
      </section>

      {/* 1. Quick Picks / Personalized Taste */}
      {quickPicks.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl md:text-2xl font-black text-gray-100 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-mrj-400" />
                <span>Quick Picks for You</span>
              </h2>
              <p className="text-xs text-gray-400">Personalized recommendations based on your listening taste</p>
            </div>
            <button
              onClick={() => playTrack(quickPicks[0], quickPicks)}
              className="text-xs font-bold text-mrj-400 hover:underline"
            >
              Play All
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {quickPicks.slice(0, 8).map((track) => (
              <TrackCard key={track.id} track={track} queueContext={quickPicks} />
            ))}
          </div>
        </section>
      )}

      {/* Inline Sponsor Ad */}
      <AdBanner
        ad={{
          id: 'ad_home_sponsor',
          title: 'High-Fidelity Wireless Studio Earbuds (50% Off)',
          sponsor: 'MRJ Audio Gear',
          audioUrl: '',
          bannerUrl: 'https://images.unsplash.com/photo-1546776310-eef45dd6d63c?w=600',
          ctaText: 'Check Price on Amazon',
          ctaUrl: 'https://amazon.com'
        }}
      />

      {/* 2. Mood & Activity Radio Stations */}
      <section className="space-y-4">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-gray-100 flex items-center gap-2">
            <Radio className="w-5 h-5 text-mrj-400" />
            <span>Moods & Activity Stations</span>
          </h2>
          <p className="text-xs text-gray-400">Continuous radio streams crafted for your daily vibe</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
          {moods.map((mood) => {
            const Icon = moodIconMap[mood.icon] || Disc;
            return (
              <div
                key={mood.id}
                onClick={() => navigate(`/search?q=${encodeURIComponent(mood.name)}`)}
                className={`p-4 rounded-2xl bg-gradient-to-br ${mood.color} cursor-pointer hover:scale-105 active:scale-95 transition-all shadow-lg select-none`}
              >
                <Icon className="w-6 h-6 text-white mb-4 drop-shadow" />
                <h3 className="text-sm font-bold text-white drop-shadow">{mood.name}</h3>
                <span className="text-[10px] text-white/80 font-medium">{mood.count}</span>
              </div>
            );
          })}
        </div>
      </section>

      {/* 3. Global Top 100 Charts */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl md:text-2xl font-black text-gray-100 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-rose-400" />
              <span>Global Top 100 Charts</span>
            </h2>
            <p className="text-xs text-gray-400">The most streamed songs worldwide today</p>
          </div>
          <button
            onClick={() => playTrack(trending[0], trending)}
            className="px-4 py-1.5 rounded-full bg-dark-800 hover:bg-dark-750 border border-dark-700 text-xs font-bold text-gray-200"
          >
            Play All ({trending.length})
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {trending.map((track, idx) => (
            <TrackCard key={track.id} track={track} queueContext={trending} showIndex={idx} />
          ))}
        </div>
      </section>

      {/* 4. Recently Played History */}
      {recentlyPlayed.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xl md:text-2xl font-black text-gray-100">Recently Played</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {recentlyPlayed.slice(0, 8).map((track) => (
              <TrackCard key={`recent-${track.id}`} track={track} queueContext={recentlyPlayed} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
