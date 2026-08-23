import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  TrendingUp,
  Play,
  Download,
  Disc3,
  Heart,
  Radio,
  Flame,
  Coffee,
  Brain,
  PartyPopper,
  Moon,
  ChevronRight,
  Music2,
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
  const [selectedPill, setSelectedPill] = useState<string>('All');
  const [loading, setLoading] = useState(true);

  const filterPills = ['All', 'Energize', 'Workout', 'Relax', 'Commute', 'Focus', 'Party', 'Romance'];

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const data = await api.getCharts();
        setTrending(data.trending || []);
        setQuickPicks(data.quickPicks || []);
        setMoods(data.moods || []);
        setRecentlyPlayed(recommendationEngine.getRecentlyPlayed());
      } catch (err) {
        console.error('Home load error:', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const handlePillClick = (pill: string) => {
    setSelectedPill(pill);
    if (pill !== 'All') {
      navigate(`/search?q=${encodeURIComponent(pill + ' music hits')}`);
    }
  };

  const topArtists = [
    { name: 'Arijit Singh', listeners: '42M Monthly', img: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=300' },
    { name: 'The Weeknd', listeners: '108M Monthly', img: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300' },
    { name: 'Taylor Swift', listeners: '105M Monthly', img: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300' },
    { name: 'Drake', listeners: '84M Monthly', img: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=300' },
    { name: 'Bad Bunny', listeners: '72M Monthly', img: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300' },
    { name: 'Billie Eilish', listeners: '68M Monthly', img: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300' },
  ];

  return (
    <div className="p-4 md:p-8 space-y-10 max-w-7xl mx-auto pb-36">
      {/* Offline/Online Ad Trigger Modal */}
      {isAdPlaying && activeAd && (
        <AdBanner ad={activeAd} onDismiss={dismissAd} type="modal" />
      )}

      {/* 1. YouTube Music Horizontal Category Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none select-none">
        {filterPills.map((pill) => (
          <button
            key={pill}
            onClick={() => handlePillClick(pill)}
            className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
              selectedPill === pill
                ? 'bg-white text-dark-950 shadow-md'
                : 'bg-dark-850 hover:bg-dark-750 text-gray-300 border border-dark-750'
            }`}
          >
            {pill}
          </button>
        ))}
      </div>

      {/* 2. Quick Picks Section (YouTube Music 4-row Column Grid) */}
      {quickPicks.length > 0 && (
        <section className="space-y-3.5">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Start Radio From A Song</span>
              <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
                <span>Quick Picks</span>
              </h2>
            </div>
            <button
              onClick={() => playTrack(quickPicks[0], quickPicks)}
              className="px-4 py-1.5 rounded-full bg-dark-850 hover:bg-dark-750 border border-dark-750 text-xs font-bold text-gray-200 transition-colors"
            >
              Play all
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {quickPicks.map((track) => (
              <TrackCard key={`quick-${track.id}`} track={track} queueContext={quickPicks} />
            ))}
          </div>
        </section>
      )}

      {/* 3. Global Trending Hits */}
      <section className="space-y-3.5">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Global Hits & Videos</span>
            <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-mrj-500" />
              <span>Trending Worldwide</span>
            </h2>
          </div>
          <button
            onClick={() => playTrack(trending[0], trending)}
            className="px-4 py-1.5 rounded-full bg-dark-850 hover:bg-dark-750 border border-dark-750 text-xs font-bold text-gray-200 transition-colors"
          >
            Play all ({trending.length})
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {trending.map((track, idx) => (
            <TrackCard key={`trend-${track.id}`} track={track} queueContext={trending} showIndex={idx} />
          ))}
        </div>
      </section>

      {/* 4. Top Global Artists */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Popular Worldwide</span>
            <h2 className="text-2xl font-black text-white tracking-tight">Featured Artists</h2>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
          {topArtists.map((artist) => (
            <div
              key={artist.name}
              onClick={() => navigate(`/search?q=${encodeURIComponent(artist.name)}`)}
              className="flex flex-col items-center text-center p-3 rounded-2xl bg-dark-850/60 hover:bg-dark-850 border border-dark-800/80 cursor-pointer transition-all hover:scale-105 group"
            >
              <div className="w-24 h-24 rounded-full overflow-hidden mb-3 shadow-lg border-2 border-dark-700 group-hover:border-mrj-500 transition-colors">
                <img src={artist.img} alt={artist.name} className="w-full h-full object-cover" />
              </div>
              <h4 className="text-sm font-bold text-gray-100 group-hover:text-mrj-400 truncate w-full">
                {artist.name}
              </h4>
              <p className="text-[10px] text-gray-400 mt-0.5">{artist.listeners}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 5. Recently Played & History */}
      {recentlyPlayed.length > 0 && (
        <section className="space-y-3.5">
          <h2 className="text-2xl font-black text-white tracking-tight">Listen Again</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {recentlyPlayed.slice(0, 8).map((track) => (
              <TrackCard key={`rec-${track.id}`} track={track} queueContext={recentlyPlayed} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
