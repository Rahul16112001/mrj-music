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
  Sparkle,
  Layers,
  Wand2
} from 'lucide-react';
import { Track, MoodStation } from '../types';
import { api } from '../services/api';
import { useMusicPlayer } from '../context/MusicPlayerContext';
import { useAuth } from '../context/AuthContext';
import { TrackCard } from '../components/TrackCard';
import { MixArtwork } from '../components/MixArtwork';
import { AdBanner } from '../components/AdBanner';
import { TasteOnboardingModal } from '../components/TasteOnboardingModal';
import { SectionSkeleton } from '../components/SkeletonLoader';
import { offlineStorage } from '../services/offlineStorage';

export const Home: React.FC = () => {
  const navigate = useNavigate();
  const { playTrack, activeAd, isAdPlaying, dismissAd } = useMusicPlayer();
  const { user, isAuthenticated } = useAuth();

  const [trending, setTrending] = useState<Track[]>([]);
  const [quickPicks, setQuickPicks] = useState<Track[]>([]);
  const [dailyMixes, setDailyMixes] = useState<any[]>([]);
  const [moods, setMoods] = useState<MoodStation[]>([]);
  const [recentlyPlayed, setRecentlyPlayed] = useState<Track[]>([]);
  const [selectedPill, setSelectedPill] = useState<string>('All');
  const [loading, setLoading] = useState(true);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);

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

      // Trigger taste onboarding if brand new account with 0 history
      if (isAuthenticated && history.length === 0 && !localStorage.getItem('MRJ_ONBOARDED')) {
        setIsOnboardingOpen(true);
      }
    } catch (err) {
      console.error('Home load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const handlePillClick = (pill: string) => {
    setSelectedPill(pill);
    if (pill !== 'All') {
      navigate(`/search?q=${encodeURIComponent(pill + ' music hits')}`);
    }
  };

  const topArtists = [
    { name: 'Arijit Singh', img: 'https://i.ytimg.com/vi/BddP6PYo2gs/hqdefault.jpg' },
    { name: 'The Weeknd', img: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300' },
    { name: 'Taylor Swift', img: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300' },
    { name: 'Drake', img: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=300' },
    { name: 'Bad Bunny', img: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300' },
    { name: 'Billie Eilish', img: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300' },
  ];

  if (loading && trending.length === 0) {
    return (
      <div className="p-4 md:p-8 space-y-10 max-w-7xl mx-auto pb-40">
        <SectionSkeleton rows={8} />
        <SectionSkeleton rows={4} />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-10 max-w-7xl mx-auto pb-40 select-none">
      {/* Offline/Online Ad Trigger Modal */}
      {isAdPlaying && activeAd && (
        <AdBanner ad={activeAd} onDismiss={dismissAd} type="modal" />
      )}

      {/* 1. YouTube Music Horizontal Category Filter Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {filterPills.map((pill) => (
          <button
            key={pill}
            onClick={() => handlePillClick(pill)}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
              selectedPill === pill
                ? 'bg-white text-black font-bold shadow-md scale-105'
                : 'bg-[#1e1e1e] hover:bg-[#282828] text-white border border-[#2d2d2d]'
            }`}
          >
            {pill}
          </button>
        ))}
      </div>

      {/* 2. Quick Picks Section (High-Density 4-Row Multi-Column Grid) */}
      {quickPicks.length > 0 && (
        <section className="space-y-3.5">
          <div className="flex items-end justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#aaaaaa]">
                {isAuthenticated ? `Recommended for ${user?.name}` : 'Start Radio From A Song'}
              </span>
              <h2 className="text-xl md:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                <span>Quick Picks</span>
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsOnboardingOpen(true)}
                className="px-3 py-1.5 rounded-full bg-[#1a1a1a] hover:bg-[#262626] border border-[#303030] text-[11px] font-bold text-[#aaaaaa] hover:text-white flex items-center gap-1.5 transition-colors hidden sm:flex"
              >
                <Wand2 className="w-3.5 h-3.5 text-[#ff4e4e]" />
                <span>Tune Taste</span>
              </button>
              <button
                onClick={() => playTrack(quickPicks[0], quickPicks)}
                className="px-4 py-1.5 rounded-full bg-[#202020] hover:bg-[#2a2a2a] border border-[#333333] text-xs font-bold text-white transition-colors"
              >
                Play all
              </button>
            </div>
          </div>

          {/* 4-row high-density column grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {quickPicks.slice(0, 16).map((track) => (
              <TrackCard key={`quick-${track.id}`} track={track} queueContext={quickPicks} variant="row" />
            ))}
          </div>
        </section>
      )}

      {/* 3. Daily Mixes Section (2x2 Dynamic Collage Cards) */}
      {dailyMixes.length > 0 && (
        <section className="space-y-3.5">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#ff4e4e]">
              Personalized Just For You
            </span>
            <h2 className="text-xl md:text-2xl font-black text-white tracking-tight">Your Daily Mixes</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {dailyMixes.map((mix) => (
              <div
                key={mix.id}
                onClick={() => mix.tracks.length > 0 && playTrack(mix.tracks[0], mix.tracks)}
                className="p-3.5 rounded-2xl bg-[#141414] hover:bg-[#1f1f1f] border border-[#242424] cursor-pointer transition-all hover:scale-[1.02] group"
              >
                <div className="relative mb-3">
                  <MixArtwork tracks={mix.tracks} title={mix.title} />
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-2xl">
                    <div className="w-12 h-12 rounded-full bg-[#ff0000] text-white flex items-center justify-center shadow-lg shadow-red-600/30">
                      <Play className="w-6 h-6 fill-white ml-0.5" />
                    </div>
                  </div>
                </div>
                <h4 className="text-sm font-bold text-white group-hover:text-[#ff4e4e] truncate">
                  {mix.title}
                </h4>
                <p className="text-xs text-[#aaaaaa] mt-1 line-clamp-2">{mix.description}</p>
                <p className="text-[10px] text-[#717171] mt-1 font-semibold">{mix.tracks.length} songs</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 4. Global Trending Ranked Hits */}
      <section className="space-y-3.5">
        <div className="flex items-end justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#aaaaaa]">
              Global Charts & Videos
            </span>
            <h2 className="text-xl md:text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[#ff0000]" />
              <span>Trending Worldwide</span>
            </h2>
          </div>
          <button
            onClick={() => playTrack(trending[0], trending)}
            className="px-4 py-1.5 rounded-full bg-[#202020] hover:bg-[#2a2a2a] border border-[#333333] text-xs font-bold text-white transition-colors"
          >
            Play all ({trending.length})
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {trending.map((track, idx) => (
            <TrackCard key={`trend-${track.id}`} track={track} queueContext={trending} showIndex={idx} variant="row" />
          ))}
        </div>
      </section>

      {/* 5. Top Global Artists */}
      <section className="space-y-3.5">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#aaaaaa]">
            Popular Worldwide
          </span>
          <h2 className="text-xl md:text-2xl font-black text-white tracking-tight">Featured Artists</h2>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          {topArtists.map((artist) => (
            <div
              key={artist.name}
              onClick={() => navigate(`/artist/${encodeURIComponent(artist.name)}`)}
              className="flex flex-col items-center text-center p-3 rounded-2xl bg-[#141414] hover:bg-[#1f1f1f] border border-[#222222] cursor-pointer transition-all hover:scale-105 group"
            >
              <div className="w-20 h-20 md:w-24 md:h-24 rounded-full overflow-hidden mb-2.5 shadow-lg border border-[#333333] group-hover:border-[#ff0000] transition-colors">
                <img src={artist.img} alt={artist.name} className="w-full h-full object-cover" />
              </div>
              <h4 className="text-xs md:text-sm font-bold text-white group-hover:text-[#ff4e4e] truncate w-full">
                {artist.name}
              </h4>
            </div>
          ))}
        </div>
      </section>

      {/* 6. Moods & Activity Stations */}
      {moods.length > 0 && (
        <section className="space-y-3.5">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#aaaaaa]">
              Curated For Every Moment
            </span>
            <h2 className="text-xl md:text-2xl font-black text-white tracking-tight">Moods & Genres</h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {moods.map((mood) => (
              <div
                key={mood.id}
                onClick={() => navigate(`/search?q=${encodeURIComponent(mood.name + ' playlist')}`)}
                className={`p-3.5 rounded-xl bg-gradient-to-br ${mood.color} cursor-pointer hover:scale-105 transition-all shadow-lg flex flex-col justify-between h-24 border border-white/10 group`}
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
        <section className="space-y-3.5">
          <h2 className="text-xl md:text-2xl font-black text-white tracking-tight">Listen Again</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {recentlyPlayed.slice(0, 8).map((track) => (
              <TrackCard key={`rec-${track.id}`} track={track} queueContext={recentlyPlayed} variant="row" />
            ))}
          </div>
        </section>
      )}

      {/* Taste Onboarding Modal */}
      <TasteOnboardingModal
        isOpen={isOnboardingOpen}
        onClose={() => {
          localStorage.setItem('MRJ_ONBOARDED', 'true');
          setIsOnboardingOpen(false);
        }}
        onComplete={() => {
          localStorage.setItem('MRJ_ONBOARDED', 'true');
          setIsOnboardingOpen(false);
          loadData();
        }}
      />
    </div>
  );
};
