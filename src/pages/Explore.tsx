import React, { useState, useEffect } from 'react';
import { Play, Sparkles, Compass, Flame, Music2, ArrowLeft, Shuffle, Loader2, Radio } from 'lucide-react';
import { Track } from '../types';
import { api } from '../services/api';
import { useMusicPlayer } from '../context/MusicPlayerContext';
import { TrackCard } from '../components/TrackCard';
import { ArtworkImage } from '../components/ArtworkImage';

interface CategoryItem {
  id: string;
  name: string;
  color: string;
  icon: string;
  description: string;
}

export const Explore: React.FC = () => {
  const { playTrack } = useMusicPlayer();
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<CategoryItem | null>(null);
  const [categoryTracks, setCategoryTracks] = useState<Track[]>([]);
  const [isLoadingTracks, setIsLoadingTracks] = useState(false);
  const [trendingTracks, setTrendingTracks] = useState<Track[]>([]);

  useEffect(() => {
    // Load categories
    api.getCategories().then((cats) => {
      if (cats && cats.length > 0) {
        setCategories(cats);
      }
    });

    // Load trending preview
    api.getTrending('IN').then((data) => {
      setTrendingTracks(data.tracks || []);
    });
  }, []);

  const handleSelectCategory = async (cat: CategoryItem) => {
    setSelectedCategory(cat);
    setIsLoadingTracks(true);
    try {
      const tracks = await api.getCategoryTracks(cat.id);
      setCategoryTracks(tracks);
    } catch {
      setCategoryTracks([]);
    } finally {
      setIsLoadingTracks(false);
    }
  };

  const handleBack = () => {
    setSelectedCategory(null);
    setCategoryTracks([]);
  };

  return (
    <div className="pb-mobile-player-nav pt-2 px-3 sm:px-6 md:px-8 max-w-7xl mx-auto space-y-8 select-none">
      {/* 1. CATEGORY DETAILS VIEW (When a category is clicked) */}
      {selectedCategory ? (
        <div className="space-y-6 animate-in fade-in duration-200">
          <button
            onClick={handleBack}
            className="flex items-center gap-2 text-xs font-bold text-[#aaaaaa] hover:text-white transition-colors pt-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to All Categories</span>
          </button>

          {/* Category Banner */}
          <div
            className={`p-6 sm:p-8 rounded-3xl bg-gradient-to-br ${selectedCategory.color} text-white shadow-2xl relative overflow-hidden`}
          >
            <div className="relative z-10 space-y-2">
              <span className="text-4xl sm:text-5xl">{selectedCategory.icon}</span>
              <h1 className="text-2xl sm:text-4xl font-black tracking-tight">{selectedCategory.name}</h1>
              <p className="text-xs sm:text-sm text-white/80 max-w-lg">{selectedCategory.description}</p>

              {categoryTracks.length > 0 && (
                <div className="flex items-center gap-3 pt-3">
                  <button
                    onClick={() => playTrack(categoryTracks[0], categoryTracks)}
                    className="flex items-center gap-2 px-6 py-3 rounded-full bg-white text-black font-bold text-xs hover:scale-105 active:scale-95 transition-all shadow-lg"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>Play All</span>
                  </button>
                  <button
                    onClick={() => {
                      const shuffled = [...categoryTracks].sort(() => Math.random() - 0.5);
                      playTrack(shuffled[0], shuffled);
                    }}
                    className="flex items-center gap-2 px-5 py-3 rounded-full bg-black/40 hover:bg-black/60 border border-white/20 text-white font-bold text-xs backdrop-blur-md transition-all active:scale-95"
                  >
                    <Shuffle className="w-4 h-4" />
                    <span>Shuffle</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Category Tracks List */}
          {isLoadingTracks ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-[#ff0000]" />
            </div>
          ) : (
            <div className="space-y-1">
              {categoryTracks.map((track, idx) => (
                <TrackCard
                  key={track.id}
                  track={track}
                  showIndex={idx + 1}
                  queueContext={categoryTracks}
                  variant="row"
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        /* 2. EXPLORE HUB & CATEGORY TILES (Spotify / YT Music Style) */
        <div className="space-y-8">
          {/* Header */}
          <div className="pt-2">
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2.5">
              <Compass className="w-7 h-7 text-[#ff0000]" />
              <span>Explore Categories</span>
            </h1>
            <p className="text-xs text-[#8e8e93] mt-1">
              Browse top music across Punjabi, Bollywood, Hollywood, Tollywood, Haryanvi, Bhojpuri, and Indie.
            </p>
          </div>

          {/* Regional & Genre Cards Grid */}
          <section className="space-y-4">
            <h2 className="text-base sm:text-lg font-black text-white tracking-tight">
              Music Genres & Languages
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {categories.map((cat) => (
                <div
                  key={cat.id}
                  onClick={() => handleSelectCategory(cat)}
                  className={`p-4 sm:p-5 rounded-2xl bg-gradient-to-br ${cat.color} text-white cursor-pointer shadow-lg hover:scale-[1.03] active:scale-[0.98] transition-all relative overflow-hidden group min-h-[120px] sm:min-h-[140px] flex flex-col justify-between border border-white/10`}
                >
                  <div className="space-y-1">
                    <span className="text-2xl sm:text-3xl">{cat.icon}</span>
                    <h3 className="text-sm sm:text-base font-black tracking-tight drop-shadow">
                      {cat.name}
                    </h3>
                  </div>
                  <p className="text-[11px] text-white/80 line-clamp-2 leading-tight">
                    {cat.description}
                  </p>

                  <div className="absolute right-3 bottom-3 w-9 h-9 rounded-full bg-white text-black opacity-0 group-hover:opacity-100 flex items-center justify-center shadow-xl transition-all scale-75 group-hover:scale-100">
                    <Play className="w-4 h-4 fill-current ml-0.5" />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Trending Today Highlights */}
          {trendingTracks.length > 0 && (
            <section className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Flame className="w-4 h-4 text-[#ff0000]" />
                  <h2 className="text-base sm:text-lg font-black text-white tracking-tight">
                    Trending Highlights
                  </h2>
                </div>
                <button
                  onClick={() => playTrack(trendingTracks[0], trendingTracks)}
                  className="text-xs font-bold text-[#ff4e4e] hover:underline"
                >
                  Play all
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {trendingTracks.slice(0, 6).map((track) => (
                  <TrackCard
                    key={track.id}
                    track={track}
                    queueContext={trendingTracks}
                    variant="compact"
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
};
