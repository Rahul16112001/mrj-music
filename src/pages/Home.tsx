import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Sparkles, TrendingUp, Compass, Heart, Loader2, RefreshCw, Flame, Globe, Music2, Sun, Moon, Sunset, Coffee, Zap } from 'lucide-react';
import { Track, MoodStation } from '../types';
import { api } from '../services/api';
import { useMusicPlayer } from '../context/MusicPlayerContext';
import { useAuth } from '../context/AuthContext';
import { TrackCard } from '../components/TrackCard';
import { MixArtwork } from '../components/MixArtwork';
import { TasteOnboardingModal } from '../components/TasteOnboardingModal';
import { ArtworkImage } from '../components/ArtworkImage';

export const Home: React.FC = () => {
  const { playTrack } = useMusicPlayer();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState('IN');
  const [showTasteModal, setShowTasteModal] = useState(false);

  // Home Page Sections
  const [greeting, setGreeting] = useState('Good Day');
  const [timeOfDayMix, setTimeOfDayMix] = useState<{ sectionTitle: string; tracks: Track[] } | null>(null);
  const [quickPicks, setQuickPicks] = useState<Track[]>([]);
  const [dailyMixes, setDailyMixes] = useState<any[]>([]);
  const [listenAgain, setListenAgain] = useState<Track[]>([]);
  const [trendingRegional, setTrendingRegional] = useState<Track[]>([]);
  const [trendingWorldwide, setTrendingWorldwide] = useState<Track[]>([]);
  const [topArtists, setTopArtists] = useState<any[]>([]);
  const [moods, setMoods] = useState<MoodStation[]>([]);
  const [activeMoodFilter, setActiveMoodFilter] = useState<string | null>(null);

  const fetchHomeData = async (region = selectedRegion, isManualRefresh = false) => {
    if (isManualRefresh) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const data = await api.getPersonalizedHome(region);
      setGreeting(data.personalized?.greeting || 'Welcome');
      setTimeOfDayMix(data.personalized?.timeOfDay || null);
      setQuickPicks(data.personalized?.quickPicks || []);
      setDailyMixes(data.personalized?.dailyMixes || []);
      setListenAgain(data.personalized?.listenAgain || []);
      setTrendingRegional(data.charts?.trendingRegional || []);
      setTrendingWorldwide(data.charts?.trendingWorldwide || []);
      setTopArtists(data.discovery?.topArtists || []);
      setMoods(data.moods || []);
    } catch (err) {
      console.error('Home data fetch error:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchHomeData(selectedRegion);
    const onboardingDone = localStorage.getItem('MRJ_ONBOARDING_DONE');
    if (user && !onboardingDone) {
      setShowTasteModal(true);
    }
  }, [user, selectedRegion]);

  const handlePlayMix = (mix: any) => {
    if (mix.tracks && mix.tracks.length > 0) {
      playTrack(mix.tracks[0], mix.tracks);
    }
  };

  const handleMoodSelect = async (moodId: string) => {
    if (activeMoodFilter === moodId) {
      setActiveMoodFilter(null);
      return;
    }
    setActiveMoodFilter(moodId);
    try {
      const moodStation = await api.getMoodStation(moodId);
      if (moodStation.tracks && moodStation.tracks.length > 0) {
        playTrack(moodStation.tracks[0], moodStation.tracks);
      }
    } catch (err) {
      console.error('Mood station error:', err);
    }
  };

  const getTimeIcon = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return <Sun className="w-5 h-5 text-amber-400" />;
    if (hour >= 12 && hour < 17) return <Coffee className="w-5 h-5 text-orange-400" />;
    if (hour >= 17 && hour < 21) return <Sunset className="w-5 h-5 text-rose-400" />;
    return <Moon className="w-5 h-5 text-indigo-400" />;
  };

  if (isLoading) {
    return (
      <div className="pb-mobile-player-nav pt-4 px-4 md:px-8 max-w-7xl mx-auto space-y-8 select-none">
        {/* Skeleton Mood Filter Chips */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-8 w-24 rounded-full bg-[#18181b] animate-pulse shrink-0" />
          ))}
        </div>

        {/* Skeleton Quick Picks */}
        <div className="space-y-3">
          <div className="h-5 w-32 bg-[#18181b] rounded animate-pulse" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-14 bg-[#141417] rounded-xl animate-pulse" />
            ))}
          </div>
        </div>

        {/* Skeleton Daily Mixes */}
        <div className="space-y-3">
          <div className="h-5 w-40 bg-[#18181b] rounded animate-pulse" />
          <div className="flex gap-4 overflow-x-auto no-scrollbar">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="w-40 h-52 bg-[#141417] rounded-2xl animate-pulse shrink-0" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-mobile-player-nav pt-2 px-3 sm:px-6 md:px-8 max-w-7xl mx-auto space-y-8 select-none">
      {/* 1. DYNAMIC GREETING & TIME-OF-DAY HERO BANNER */}
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-2xl bg-[#18181b] border border-[#27272a] shadow-md">
            {getTimeIcon()}
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <span>{greeting}</span>
              {user?.name && (
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-rose-400">
                  {user.name.split(' ')[0]}
                </span>
              )}
            </h1>
            <p className="text-xs text-[#8e8e93]">Fresh music updated live for your taste profile</p>
          </div>
        </div>

        <button
          onClick={() => fetchHomeData(selectedRegion, true)}
          disabled={isRefreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#18181b] border border-[#27272a] hover:border-[#3f3f46] text-xs font-bold text-[#aaaaaa] hover:text-white transition-all active:scale-95 shadow-sm"
          title="Refresh recommendations"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-[#ff0000]' : ''}`} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      {/* 2. MOOD / ACTIVITY FILTER CHIPS */}
      {moods.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
          {moods.slice(0, 10).map((m) => {
            const isActive = activeMoodFilter === m.id;
            return (
              <button
                key={m.id}
                onClick={() => handleMoodSelect(m.id)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap border shrink-0 min-h-[36px] ${
                  isActive
                    ? 'bg-white text-black border-white shadow-lg'
                    : 'bg-[#121215] text-[#aaaaaa] border-[#222226] hover:text-white hover:border-[#333338]'
                }`}
              >
                {m.name}
              </button>
            );
          })}
        </div>
      )}

      {/* 3. TIME-OF-DAY ADAPTIVE MIX SHELF (if available) */}
      {timeOfDayMix && timeOfDayMix.tracks.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              <h2 className="text-base sm:text-lg font-black text-white tracking-tight">
                {timeOfDayMix.sectionTitle}
              </h2>
            </div>
            <button
              onClick={() => playTrack(timeOfDayMix.tracks[0], timeOfDayMix.tracks)}
              className="text-xs font-bold text-[#ff4e4e] hover:underline"
            >
              Play all
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {timeOfDayMix.tracks.slice(0, 8).map((track) => (
              <TrackCard
                key={track.id}
                track={track}
                queueContext={timeOfDayMix.tracks}
                variant="compact"
              />
            ))}
          </div>
        </section>
      )}

      {/* 4. DYNAMIC QUICK PICKS */}
      {quickPicks.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#ff0000]" />
              <h2 className="text-base sm:text-lg font-black text-white tracking-tight">
                Quick Picks
              </h2>
            </div>
            <button
              onClick={() => playTrack(quickPicks[0], quickPicks)}
              className="text-xs font-bold text-[#ff4e4e] hover:underline"
            >
              Play all
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {quickPicks.slice(0, 9).map((track) => (
              <TrackCard
                key={track.id}
                track={track}
                queueContext={quickPicks}
                variant="compact"
              />
            ))}
          </div>
        </section>
      )}

      {/* 5. DAILY MIXES (Horizontal Carousel) */}
      {dailyMixes.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base sm:text-lg font-black text-white tracking-tight">
              Mixed For You
            </h2>
          </div>

          <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
            {dailyMixes.map((mix) => (
              <div
                key={mix.id}
                onClick={() => handlePlayMix(mix)}
                className="w-36 sm:w-44 shrink-0 rounded-2xl bg-[#121215] hover:bg-[#1c1c20] p-3 border border-[#202024] cursor-pointer transition-all hover:scale-[1.02] group"
              >
                <div className="aspect-square rounded-xl overflow-hidden mb-3 bg-[#1e1e22] shadow-md relative">
                  <MixArtwork tracks={mix.tracks || []} title={mix.title} />
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <div className="w-10 h-10 rounded-full bg-[#ff0000] text-white flex items-center justify-center shadow-lg">
                      <Play className="w-5 h-5 fill-white ml-0.5" />
                    </div>
                  </div>
                </div>
                <h3 className="text-xs sm:text-sm font-bold text-white truncate">{mix.title}</h3>
                <p className="text-[11px] text-[#888888] truncate mt-0.5">{mix.description}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 6. LISTEN AGAIN / RECENTLY PLAYED */}
      {listenAgain.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base sm:text-lg font-black text-white tracking-tight">
              Listen Again
            </h2>
            <button
              onClick={() => playTrack(listenAgain[0], listenAgain)}
              className="text-xs font-bold text-[#ff4e4e] hover:underline"
            >
              Play all
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {listenAgain.slice(0, 6).map((track) => (
              <TrackCard
                key={track.id}
                track={track}
                queueContext={listenAgain}
                variant="compact"
              />
            ))}
          </div>
        </section>
      )}

      {/* 7. TOP ARTISTS (Circular Avatars) */}
      {topArtists.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-base sm:text-lg font-black text-white tracking-tight">
            Top Artists
          </h2>

          <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
            {topArtists.map((artist) => (
              <div
                key={artist.id || artist.name}
                onClick={() => navigate(`/artist/${encodeURIComponent(artist.name)}`)}
                className="w-24 sm:w-28 shrink-0 flex flex-col items-center cursor-pointer group"
              >
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden mb-2 bg-[#1e1e22] shadow-md border-2 border-transparent group-hover:border-[#ff0000] transition-colors">
                  <ArtworkImage
                    src={artist.thumbnail || artist.image}
                    alt={artist.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                </div>
                <p className="text-xs font-bold text-white text-center truncate w-full group-hover:underline">
                  {artist.name}
                </p>
                <span className="text-[10px] text-[#717171] uppercase tracking-wider">Artist</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 8. TRENDING REGIONAL */}
      {trendingRegional.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-[#ff0000]" />
              <h2 className="text-base sm:text-lg font-black text-white tracking-tight">
                Trending Hits
              </h2>
            </div>
            <button
              onClick={() => playTrack(trendingRegional[0], trendingRegional)}
              className="text-xs font-bold text-[#ff4e4e] hover:underline"
            >
              Play all
            </button>
          </div>

          <div className="space-y-1">
            {trendingRegional.slice(0, 8).map((track, idx) => (
              <TrackCard
                key={track.id}
                track={track}
                showIndex={idx + 1}
                queueContext={trendingRegional}
                variant="row"
              />
            ))}
          </div>
        </section>
      )}

      {/* Taste Onboarding Modal */}
      {showTasteModal && (
        <TasteOnboardingModal
          isOpen={showTasteModal}
          onClose={() => setShowTasteModal(false)}
          onComplete={() => {
            setShowTasteModal(false);
            fetchHomeData();
          }}
        />
      )}
    </div>
  );
};
