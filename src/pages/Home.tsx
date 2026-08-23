import React, { useState, useEffect } from 'react';
import { Play, Sparkles, TrendingUp, Compass, Heart, Loader2, RefreshCw, Flame, Globe } from 'lucide-react';
import { Track, MoodStation } from '../types';
import { api } from '../services/api';
import { useMusicPlayer } from '../context/MusicPlayerContext';
import { useAuth } from '../context/AuthContext';
import { TrackCard } from '../components/TrackCard';
import { MixArtwork } from '../components/MixArtwork';
import { TasteOnboardingModal } from '../components/TasteOnboardingModal';

export const Home: React.FC = () => {
  const { playTrack } = useMusicPlayer();
  const { user } = useAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [selectedRegion, setSelectedRegion] = useState('IN');
  const [showTasteModal, setShowTasteModal] = useState(false);

  // Home Page Contract Sections
  const [quickPicks, setQuickPicks] = useState<Track[]>([]);
  const [dailyMixes, setDailyMixes] = useState<any[]>([]);
  const [listenAgain, setListenAgain] = useState<Track[]>([]);
  const [trendingRegional, setTrendingRegional] = useState<Track[]>([]);
  const [trendingWorldwide, setTrendingWorldwide] = useState<Track[]>([]);
  const [topArtists, setTopArtists] = useState<any[]>([]);
  const [moods, setMoods] = useState<MoodStation[]>([]);
  const [activeMoodFilter, setActiveMoodFilter] = useState<string | null>(null);

  const fetchHomeData = async (region = selectedRegion) => {
    setIsLoading(true);
    try {
      const data = await api.getPersonalizedHome(region);
      setQuickPicks(data.personalized.quickPicks || []);
      setDailyMixes(data.personalized.dailyMixes || []);
      setListenAgain(data.personalized.listenAgain || []);
      setTrendingRegional(data.charts.trendingRegional || []);
      setTrendingWorldwide(data.charts.trendingWorldwide || []);
      setTopArtists(data.discovery.topArtists || []);
      setMoods(data.moods || []);
    } catch (err) {
      console.error('Home data fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHomeData(selectedRegion);
    // Check if user has completed taste onboarding
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
      if (moodStation.tracks.length > 0) {
        playTrack(moodStation.tracks[0], moodStation.tracks);
      }
    } catch (err) {
      console.error('Mood station error:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <Loader2 className="w-8 h-8 text-[#ff0000] animate-spin" />
        <p className="text-xs font-semibold text-[#aaaaaa] tracking-wider uppercase">Loading Personalized Feed...</p>
      </div>
    );
  }

  return (
    <div className="pb-36 pt-2 px-4 md:px-8 max-w-[1700px] mx-auto space-y-10 select-none">
      {/* 1. TOP HEADER & FILTER CHIPS */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#1f1f1f] pb-4">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
          {moods.slice(0, 8).map((m) => {
            const isActive = activeMoodFilter === m.id;
            return (
              <button
                key={m.id}
                onClick={() => handleMoodSelect(m.id)}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap border ${
                  isActive
                    ? 'bg-white text-black border-white shadow-lg'
                    : 'bg-[#181818] hover:bg-[#282828] text-white border-[#2c2c2c]'
                }`}
              >
                {m.name}
              </button>
            );
          })}
        </div>

        {/* Region Selector */}
        <div className="flex items-center gap-2">
          <Globe className="w-3.5 h-3.5 text-[#aaaaaa]" />
          <select
            value={selectedRegion}
            onChange={(e) => setSelectedRegion(e.target.value)}
            className="bg-[#181818] text-xs font-bold text-white border border-[#2c2c2c] rounded-lg px-2.5 py-1 focus:outline-none cursor-pointer"
          >
            <option value="IN">India (IN)</option>
            <option value="GLOBAL">Global</option>
            <option value="US">United States (US)</option>
            <option value="UK">United Kingdom (UK)</option>
          </select>
        </div>
      </div>

      {/* 2. PERSONALIZED QUICK PICKS */}
      {quickPicks.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-[#aaaaaa]">
                {user ? `Personalized for ${user.name}` : 'Start Radio From A Song'}
              </p>
              <h2 className="text-xl md:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                <span>Quick Picks</span>
                <Sparkles className="w-5 h-5 text-[#ff0000]" />
              </h2>
            </div>
          </div>

          <div className="grid grid-flow-col grid-rows-4 auto-cols-[85vw] sm:auto-cols-[380px] md:auto-cols-[400px] lg:auto-cols-[420px] gap-2 overflow-x-auto no-scrollbar pb-2">
            {quickPicks.map((track) => (
              <TrackCard key={track.id} track={track} variant="row" />
            ))}
          </div>
        </section>
      )}

      {/* 3. YOUR DAILY MIXES */}
      {dailyMixes.length > 0 && (
        <section className="space-y-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#aaaaaa]">Tailored Soundtracks</p>
            <h2 className="text-xl md:text-2xl font-black text-white tracking-tight">Your Daily Mixes</h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {dailyMixes.map((mix) => (
              <div
                key={mix.id}
                onClick={() => handlePlayMix(mix)}
                className="group relative bg-[#181818] hover:bg-[#222222] border border-[#242424] rounded-2xl p-3 flex flex-col gap-3 cursor-pointer transition-all duration-300 hover:scale-[1.02] shadow-lg"
              >
                <div className="relative aspect-square rounded-xl overflow-hidden shadow-md">
                  <MixArtwork tracks={mix.tracks} />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePlayMix(mix);
                    }}
                    className="absolute bottom-2.5 right-2.5 w-10 h-10 rounded-full bg-[#ff0000] text-white flex items-center justify-center shadow-xl opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300"
                  >
                    <Play className="w-4 h-4 fill-current ml-0.5" />
                  </button>
                </div>

                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-white line-clamp-1 group-hover:text-[#ff4e4e] transition-colors">
                    {mix.title}
                  </h3>
                  <p className="text-xs text-[#aaaaaa] line-clamp-2 leading-relaxed">
                    {mix.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 4. LISTEN AGAIN / HISTORY */}
      {listenAgain.length > 0 && (
        <section className="space-y-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#aaaaaa]">Your Listening History</p>
            <h2 className="text-xl md:text-2xl font-black text-white tracking-tight">Listen Again</h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {listenAgain.map((track) => (
              <TrackCard key={track.id} track={track} variant="grid" />
            ))}
          </div>
        </section>
      )}

      {/* 5. OFFICIAL REGIONAL TRENDING CHARTS */}
      {trendingRegional.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-[#aaaaaa]">Official Chart Rankings</p>
              <h2 className="text-xl md:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                <span>Trending in {selectedRegion === 'IN' ? 'India' : selectedRegion}</span>
                <Flame className="w-5 h-5 text-amber-500" />
              </h2>
            </div>
          </div>

          <div className="grid grid-flow-col grid-rows-4 auto-cols-[85vw] sm:auto-cols-[380px] md:auto-cols-[400px] lg:auto-cols-[420px] gap-2 overflow-x-auto no-scrollbar pb-2">
            {trendingRegional.map((track) => (
              <TrackCard key={track.id} track={track} variant="row" />
            ))}
          </div>
        </section>
      )}

      {/* 6. OFFICIAL WORLDWIDE CHARTS */}
      {trendingWorldwide.length > 0 && (
        <section className="space-y-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#aaaaaa]">Global Hitmakers</p>
            <h2 className="text-xl md:text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <span>Trending Worldwide</span>
              <Globe className="w-5 h-5 text-blue-500" />
            </h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {trendingWorldwide.slice(0, 12).map((track) => (
              <TrackCard key={track.id} track={track} variant="grid" />
            ))}
          </div>
        </section>
      )}

      {/* 7. TOP ARTISTS */}
      {topArtists.length > 0 && (
        <section className="space-y-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#aaaaaa]">Most Streamed Creators</p>
            <h2 className="text-xl md:text-2xl font-black text-white tracking-tight">Top Artists</h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
            {topArtists.map((artist) => (
              <div
                key={artist.name}
                className="bg-[#181818] border border-[#242424] rounded-2xl p-4 flex flex-col items-center text-center gap-3 hover:bg-[#222222] transition-all cursor-pointer group"
              >
                <div className="w-24 h-24 rounded-full overflow-hidden shadow-lg border border-[#333333] group-hover:border-[#ff0000] transition-colors">
                  <img src={artist.thumbnail} alt={artist.name} className="w-full h-full object-cover" />
                </div>
                <div className="space-y-0.5">
                  <h3 className="text-sm font-bold text-white group-hover:text-[#ff4e4e] transition-colors">{artist.name}</h3>
                  <p className="text-[11px] text-[#aaaaaa]">{artist.monthlyListeners} Listeners</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 8. MOOD STATIONS */}
      {moods.length > 0 && (
        <section className="space-y-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#aaaaaa]">Find Your Vibe</p>
            <h2 className="text-xl md:text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <span>Moods & Genres</span>
              <Compass className="w-5 h-5 text-indigo-400" />
            </h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
            {moods.map((mood) => (
              <div
                key={mood.id}
                onClick={() => handleMoodSelect(mood.id)}
                className={`group relative overflow-hidden rounded-2xl p-4 h-28 flex flex-col justify-between bg-gradient-to-br ${mood.color} cursor-pointer transition-all duration-300 hover:scale-[1.03] shadow-lg border border-white/10`}
              >
                <div className="space-y-1">
                  <h3 className="text-base font-black text-white drop-shadow-md leading-tight">{mood.name}</h3>
                  <p className="text-[11px] font-medium text-white/80">{mood.count}</p>
                </div>
                <button className="self-end w-8 h-8 rounded-full bg-white text-black flex items-center justify-center shadow-lg opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300">
                  <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                </button>
              </div>
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
            localStorage.setItem('MRJ_ONBOARDING_DONE', 'true');
            fetchHomeData(selectedRegion);
          }}
        />
      )}
    </div>
  );
};

export const HomePage = Home;
