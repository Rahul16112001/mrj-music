import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
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
  Sparkles,
  ChevronRight,
  Music2,
  Headphones,
  Sparkle
} from 'lucide-react';
import { Track, MoodStation } from '../types';
import { api } from '../services/api';
import { useMusicPlayer } from '../context/MusicPlayerContext';
import { useAuth } from '../context/AuthContext';
import { TrackCard } from '../components/TrackCard';
import { AdBanner } from '../components/AdBanner';
import { offlineStorage } from '../services/offlineStorage';

export const Home: React.FC = () => {
  const navigate = useNavigate();
  const { playTrack, downloadedTrackIds, activeAd, isAdPlaying, dismissAd } = useMusicPlayer();
  const { user, isAuthenticated } = useAuth();

  const [trending, setTrending] = useState<Track[]>([]);
  const [quickPicks, setQuickPicks] = useState<Track[]>([]);
  const [dailyMixes, setDailyMixes] = useState<any[]>([]);
  const [moods, setMoods] = useState<MoodStation[]>([]);
  const [recentlyPlayed, setRecentlyPlayed] = useState<Track[]>([]);
  const [selectedPill, setSelectedPill] = useState<string>('All');
  const [loading, setLoading] = useState(true);

  const filterPills = [
    'All',
    'Relax',
    'Energize',
    'Workout',
    'Commute',
    'Focus',
    'Party',
    'Romance',
    'Feel Good',
    'Podcasts'
  ];

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const data = await api.getPersonalizedHome();
        setTrending(data.trending || []);
        setQuickPicks(data.quickPicks || []);
        setDailyMixes(data.dailyMixes || []);
        setMoods(data.moods || []);

        const history = await offlineStorage.getHistory();
        setRecentlyPlayed(history);
      } catch (err) {
        console.error('Home load error:', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [user]);

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
    <div className="p-4 md:p-8 space-y-12 max-w-7xl mx-auto pb-40 select-none">
      {/* Offline/Online Ad Trigger Modal */}
      {isAdPlaying && activeAd && (
        <AdBanner ad={activeAd} onDismiss={dismissAd} type="modal" />
      )}

      {/* 1. YouTube Music Horizontal Category Filter Chips */}
      <div className="flex items-center gap-2.5 overflow-x-auto pb-2 scrollbar-none">
        {filterPills.map((pill) => (
          <button
            key={pill}
            onClick={() => handlePillClick(pill)}
            className={`px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
              selectedPill === pill
                ? 'bg-white text-black font-bold shadow-md'
                : 'bg-[#212121] hover:bg-[#2e2e2e] text-white border border-transparent hover:border-[#383838]'
            }`}
          >
            {pill}
          </button>
        ))}
      </div>

      {/* 2. Quick Picks Section (YouTube Music 4-row Column Grid) */}
      {quickPicks.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-end justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#aaaaaa]">
                {isAuthenticated ? `Recommended for ${user?.name}` : 'Start Radio From A Song'}
              </span>
              <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
                <span>Quick Picks</span>
              </h2>
            </div>
            <button
              onClick={() => playTrack(quickPicks[0], quickPicks)}
              className="px-4 py-1.5 rounded-full bg-[#212121] hover:bg-[#2e2e2e] border border-[#333333] text-xs font-bold text-white transition-colors"
            >
              Play all
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {quickPicks.map((track) => (
              <TrackCard key={`quick-${track.id}`} track={track} queueContext={quickPicks} />
            ))}
          </div>
        </section>
      )}

      {/* 3. Personalized Daily Mixes */}
      {dailyMixes.length > 0 && (
        <section className="space-y-4">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#ff4e4e]">
              Personalized Just For You
            </span>
            <h2 className="text-2xl font-black text-white tracking-tight">Your Daily Mixes</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {dailyMixes.map((mix) => (
              <div
                key={mix.id}
                onClick={() => playTrack(mix.tracks[0], mix.tracks)}
                className="p-4 rounded-2xl bg-[#141414] hover:bg-[#202020] border border-[#262626] cursor-pointer transition-all hover:scale-105 group"
              >
                <div className="aspect-square rounded-xl overflow-hidden mb-3 bg-[#242424] shadow-md relative">
                  <img src={mix.thumbnail} alt={mix.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <div className="w-12 h-12 rounded-full bg-[#ff0000] text-white flex items-center justify-center shadow-lg">
                      <Play className="w-6 h-6 fill-white ml-0.5" />
                    </div>
                  </div>
                </div>
                <h4 className="text-sm font-bold text-white group-hover:text-[#ff4e4e] truncate">
                  {mix.title}
                </h4>
                <p className="text-xs text-[#aaaaaa] mt-1 line-clamp-2">{mix.description}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 4. Global Trending Ranked Hits */}
      <section className="space-y-4">
        <div className="flex items-end justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#aaaaaa]">
              Global Charts & Videos
            </span>
            <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[#ff0000]" />
              <span>Trending Worldwide</span>
            </h2>
          </div>
          <button
            onClick={() => playTrack(trending[0], trending)}
            className="px-4 py-1.5 rounded-full bg-[#212121] hover:bg-[#2e2e2e] border border-[#333333] text-xs font-bold text-white transition-colors"
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

      {/* 5. Top Global Artists */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#aaaaaa]">
              Popular Worldwide
            </span>
            <h2 className="text-2xl font-black text-white tracking-tight">Featured Artists</h2>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
          {topArtists.map((artist) => (
            <div
              key={artist.name}
              onClick={() => navigate(`/search?q=${encodeURIComponent(artist.name)}`)}
              className="flex flex-col items-center text-center p-3.5 rounded-2xl bg-[#181818] hover:bg-[#212121] border border-[#262626] cursor-pointer transition-all hover:scale-105 group"
            >
              <div className="w-24 h-24 rounded-full overflow-hidden mb-3 shadow-lg border-2 border-[#333333] group-hover:border-[#ff0000] transition-colors">
                <img src={artist.img} alt={artist.name} className="w-full h-full object-cover" />
              </div>
              <h4 className="text-sm font-bold text-white group-hover:text-[#ff4e4e] truncate w-full">
                {artist.name}
              </h4>
              <p className="text-[10px] text-[#aaaaaa] mt-0.5">{artist.listeners}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 6. Moods & Activity Stations */}
      {moods.length > 0 && (
        <section className="space-y-4">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#aaaaaa]">
              Curated For Every Moment
            </span>
            <h2 className="text-2xl font-black text-white tracking-tight">Moods & Genres</h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3.5">
            {moods.map((mood) => (
              <div
                key={mood.id}
                onClick={() => navigate(`/search?q=${encodeURIComponent(mood.name + ' playlist')}`)}
                className={`p-4 rounded-xl bg-gradient-to-br ${mood.color} cursor-pointer hover:scale-105 transition-all shadow-lg flex flex-col justify-between h-28 border border-white/10 group`}
              >
                <span className="text-xs font-black text-white group-hover:underline">
                  {mood.name}
                </span>
                <span className="text-[10px] text-white/80 font-bold">{mood.count}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 7. Recently Played & History */}
      {recentlyPlayed.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-2xl font-black text-white tracking-tight">Listen Again</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {recentlyPlayed.slice(0, 8).map((track) => (
              <TrackCard key={`rec-${track.id}`} track={track} queueContext={recentlyPlayed} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
