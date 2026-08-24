import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Search as SearchIcon,
  X,
  Compass,
  Sparkles,
  Loader2,
  Music,
  User,
  Video,
  Disc,
  Mic,
  TrendingUp,
  Flame,
  Globe,
  Radio,
  Play
} from 'lucide-react';
import { Track } from '../types';
import { api, SearchSuggestionsResult } from '../services/api';
import { TrackCard } from '../components/TrackCard';
import { SearchSuggestionDropdown } from '../components/SearchSuggestionDropdown';
import { ArtworkImage } from '../components/ArtworkImage';
import { useMusicPlayer } from '../context/MusicPlayerContext';

type SearchCategoryFilter = 'all' | 'songs' | 'artists' | 'albums' | 'videos' | 'podcasts';

const FEATURED_ARTISTS = [
  { name: 'Arijit Singh', genre: 'Bollywood', img: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&h=300&fit=crop' },
  { name: 'Sidhu Moosewala', genre: 'Punjabi', img: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&h=300&fit=crop' },
  { name: 'Diljit Dosanjh', genre: 'Punjabi Pop', img: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop' },
  { name: 'Karan Aujla', genre: 'Punjabi / Desi Hip Hop', img: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&h=300&fit=crop' },
  { name: 'Shreya Ghoshal', genre: 'Bollywood Melodies', img: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=300&h=300&fit=crop' },
  { name: 'AP Dhillon', genre: 'Punjabi / Fusion', img: 'https://images.unsplash.com/photo-1526478806334-5fd488fcaabc?w=300&h=300&fit=crop' },
  { name: 'Pawan Singh', genre: 'Bhojpuri Hits', img: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=300&h=300&fit=crop' },
  { name: 'Khesari Lal Yadav', genre: 'Bhojpuri Superhits', img: 'https://images.unsplash.com/photo-1511735111819-9a3f7709049c?w=300&h=300&fit=crop' },
  { name: 'Masoom Sharma', genre: 'Haryanvi Beats', img: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=300&h=300&fit=crop' },
  { name: 'Renuka Panwar', genre: 'Haryanvi Folk & Pop', img: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&h=300&fit=crop' },
  { name: 'Taylor Swift', genre: 'Pop / Global', img: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=300&h=300&fit=crop' },
  { name: 'The Weeknd', genre: 'R&B / Synthpop', img: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=300&h=300&fit=crop' },
  { name: 'Anuv Jain', genre: 'Indie / Acoustic', img: 'https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=300&h=300&fit=crop' },
  { name: 'Badshah', genre: 'Commercial Party', img: 'https://images.unsplash.com/photo-1571266028243-3716f02d2d2e?w=300&h=300&fit=crop' },
  { name: 'Anirudh Ravichander', genre: 'Tollywood / Tamil', img: 'https://images.unsplash.com/photo-1487180144351-b8472da7d491?w=300&h=300&fit=crop' },
  { name: 'Sonu Nigam', genre: 'Evergreen Classics', img: 'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?w=300&h=300&fit=crop' },
];

const EXPLORE_CATEGORIES = [
  { name: 'Bollywood Hits', query: 'Bollywood Top Songs 2024', color: 'from-amber-600 to-rose-600', icon: '🎬' },
  { name: 'Punjabi Beats', query: 'Punjabi Top Hits', color: 'from-orange-600 to-amber-700', icon: '🌾' },
  { name: 'Bhojpuri Tadka', query: 'Bhojpuri Superhit Songs', color: 'from-red-600 to-orange-700', icon: '🌶️' },
  { name: 'Haryanvi Ragni & Pop', query: 'Haryanvi Top Beats', color: 'from-yellow-600 to-amber-800', icon: '🚜' },
  { name: 'Hollywood & Global Pop', query: 'Global Top 50 Hits', color: 'from-blue-600 to-indigo-700', icon: '🌍' },
  { name: 'Tollywood Anthems', query: 'Tollywood Telugu Hits', color: 'from-cyan-600 to-blue-700', icon: '⚡' },
  { name: 'Lo-Fi & Chill', query: 'Lofi Hindi Beats Study Relax', color: 'from-purple-600 to-indigo-800', icon: '☕' },
  { name: 'Sufi & Ghazals', query: 'Best Sufi Ghazals Romantic', color: 'from-emerald-600 to-teal-800', icon: '🕊️' },
  { name: 'Gym & Workout', query: 'Workout Punjabi Gym Motivation Beats', color: 'from-rose-600 to-red-800', icon: '🔥' },
  { name: 'Sad & Broken', query: 'Sad Hindi Songs Broken Heart', color: 'from-slate-600 to-zinc-800', icon: '💔' },
  { name: 'Bhakti & Devotional', query: 'Bhakti Devotional Bhajan', color: 'from-amber-500 to-orange-600', icon: '🪔' },
  { name: '90s Nostalgia', query: '90s Evergreen Bollywood Hits', color: 'from-pink-600 to-rose-700', icon: '📻' },
];

export const Search: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { playTrack } = useMusicPlayer();
  const queryParam = searchParams.get('q') || '';

  const [query, setQuery] = useState(queryParam);
  const [activeFilter, setActiveFilter] = useState<SearchCategoryFilter>('all');
  const [songs, setSongs] = useState<Track[]>([]);
  const [videos, setVideos] = useState<Track[]>([]);
  const [podcasts, setPodcasts] = useState<Track[]>([]);
  const [artists, setArtists] = useState<any[]>([]);
  const [albums, setAlbums] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [suggestionsData, setSuggestionsData] = useState<SearchSuggestionsResult | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<any>(null);

  const performSearch = useCallback(async (term: string) => {
    if (!term.trim()) {
      setSongs([]);
      setVideos([]);
      setArtists([]);
      setAlbums([]);
      setPodcasts([]);
      return;
    }
    setIsLoading(true);
    try {
      const searchRes = await api.search(term.trim());
      setSongs(searchRes.songs || []);
      setVideos(searchRes.videos || []);
      setArtists(searchRes.artists || []);
      setAlbums(searchRes.albums || []);
      setPodcasts(searchRes.podcasts || []);
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Sync with URL param
  useEffect(() => {
    if (queryParam && queryParam !== query) {
      setQuery(queryParam);
      performSearch(queryParam);
    }
  }, [queryParam, performSearch]);

  // Real-time live search as user types with 350ms debounce
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    if (!val.trim()) {
      setSearchParams({});
      setSongs([]);
      setVideos([]);
      setArtists([]);
      setAlbums([]);
      setPodcasts([]);
      setSuggestionsData(null);
      return;
    }

    // Fetch instant suggestions
    api.getSearchSuggestions(val.trim())
      .then((data) => setSuggestionsData(data))
      .catch(() => setSuggestionsData(null));

    // Debounced full search execution
    debounceTimerRef.current = setTimeout(() => {
      setSearchParams({ q: val.trim() });
      performSearch(val.trim());
    }, 350);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      setSearchParams({ q: query.trim() });
      performSearch(query.trim());
    }
  };

  const handleSelectQuery = (term: string) => {
    setQuery(term);
    setSearchParams({ q: term });
    performSearch(term);
  };

  const handleClear = () => {
    setQuery('');
    setSearchParams({});
    setSongs([]);
    setVideos([]);
    setArtists([]);
    setAlbums([]);
    setPodcasts([]);
    setSuggestionsData(null);
    searchInputRef.current?.focus();
  };

  const hasAnyResults = songs.length > 0 || artists.length > 0 || albums.length > 0 || videos.length > 0 || podcasts.length > 0;

  return (
    <div className="p-3 sm:p-6 md:p-8 space-y-6 max-w-7xl mx-auto pb-mobile-player-nav select-none animate-in fade-in duration-300">
      
      {/* 1. LARGE, HIGH-CONTRAST SEARCH INPUT */}
      <div className="max-w-3xl mx-auto space-y-3">
        <form onSubmit={handleSearchSubmit} className="relative">
          <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-[#ff4e4e] pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            value={query}
            onChange={handleInputChange}
            placeholder="Search songs, artists, albums, regional music..."
            className="w-full h-14 pl-14 pr-24 bg-[#141418] border-2 border-[#2b2b32] focus:border-[#ff0000] rounded-2xl text-base font-semibold text-white placeholder-[#717178] focus:outline-none shadow-2xl transition-all"
            autoFocus
          />

          {/* Action Icons */}
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
            {isLoading && (
              <Loader2 className="w-5 h-5 text-[#ff0000] animate-spin" />
            )}

            {query.length > 0 && (
              <button
                type="button"
                onClick={handleClear}
                className="p-1.5 text-[#888888] hover:text-white rounded-full bg-white/5 hover:bg-white/10 transition-colors"
                aria-label="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}

            <button
              type="submit"
              className="px-3.5 py-1.5 bg-[#ff0000] hover:bg-[#cc0000] text-white text-xs font-bold rounded-xl active:scale-95 transition-all shadow-md"
            >
              Search
            </button>
          </div>
        </form>

        {/* Live Search Echo Badge so the user clearly sees what they typed */}
        {query.trim().length > 0 && (
          <div className="flex items-center justify-between px-2 text-xs">
            <span className="text-[#aaaaaa] flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse inline-block" />
              <span>Results for: <strong className="text-white font-bold">"{query}"</strong></span>
            </span>
            {hasAnyResults && !isLoading && (
              <span className="text-[#717178] font-mono">
                {songs.length + videos.length + artists.length + albums.length} items found
              </span>
            )}
          </div>
        )}
      </div>

      {/* 2. LOADING STATE */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-16 space-y-3">
          <Loader2 className="w-8 h-8 text-[#ff0000] animate-spin" />
          <p className="text-xs font-bold text-[#aaaaaa] tracking-widest uppercase">
            Searching Live Music Catalog...
          </p>
        </div>
      )}

      {/* 3. SEARCH RESULTS DISPLAY */}
      {!isLoading && query && hasAnyResults && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Category Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
            {(
              [
                { id: 'all', label: 'All Results' },
                { id: 'songs', label: `Songs (${songs.length})` },
                { id: 'artists', label: `Artists (${artists.length})` },
                { id: 'albums', label: `Albums (${albums.length})` },
                { id: 'videos', label: `Videos (${videos.length})` },
                { id: 'podcasts', label: `Podcasts (${podcasts.length})` },
              ] as const
            ).map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveFilter(cat.id)}
                className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all border min-h-[36px] ${
                  activeFilter === cat.id
                    ? 'bg-white text-black border-white shadow-md scale-105'
                    : 'bg-[#141418] text-[#aaaaaa] border-[#26262c] hover:text-white'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* 1. SONGS SECTION */}
          {(activeFilter === 'all' || activeFilter === 'songs') && songs.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base sm:text-lg font-black text-white tracking-tight flex items-center gap-2">
                  <Music className="w-4 h-4 text-[#ff0000]" />
                  <span>Songs</span>
                </h2>
                <button
                  onClick={() => playTrack(songs[0], songs)}
                  className="text-xs font-bold text-[#ff4e4e] hover:underline flex items-center gap-1"
                >
                  <Play className="w-3 h-3 fill-current" />
                  <span>Play All</span>
                </button>
              </div>

              <div className="space-y-1">
                {songs.map((track, idx) => (
                  <TrackCard
                    key={track.id}
                    track={track}
                    showIndex={idx + 1}
                    queueContext={songs}
                    variant="row"
                  />
                ))}
              </div>
            </section>
          )}

          {/* 2. ARTISTS SECTION */}
          {(activeFilter === 'all' || activeFilter === 'artists') && artists.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-base sm:text-lg font-black text-white tracking-tight flex items-center gap-2">
                <User className="w-4 h-4 text-[#ff0000]" />
                <span>Artists</span>
              </h2>
              <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
                {artists.map((artist) => (
                  <div
                    key={artist.id || artist.name}
                    onClick={() => navigate(`/artist/${encodeURIComponent(artist.name)}`)}
                    className="w-28 shrink-0 flex flex-col items-center cursor-pointer group"
                  >
                    <div className="w-24 h-24 rounded-full overflow-hidden mb-2 bg-[#1e1e22] shadow-lg border-2 border-transparent group-hover:border-[#ff0000] transition-all group-hover:scale-105">
                      <ArtworkImage
                        src={artist.thumbnail || artist.image}
                        alt={artist.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <p className="text-xs font-bold text-white text-center truncate w-full group-hover:text-[#ff4e4e]">
                      {artist.name}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 3. ALBUMS SECTION */}
          {(activeFilter === 'all' || activeFilter === 'albums') && albums.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-base sm:text-lg font-black text-white tracking-tight flex items-center gap-2">
                <Disc className="w-4 h-4 text-[#ff0000]" />
                <span>Albums</span>
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {albums.map((album) => (
                  <div
                    key={album.id}
                    onClick={() => navigate(`/album/${album.id}`)}
                    className="p-3 rounded-2xl bg-[#141418] hover:bg-[#1e1e24] border border-[#222228] cursor-pointer transition-all hover:scale-[1.02] group"
                  >
                    <div className="aspect-square rounded-xl overflow-hidden mb-2 bg-[#1e1e22] shadow-md">
                      <ArtworkImage
                        src={album.thumbnail}
                        alt={album.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    </div>
                    <h4 className="text-xs font-bold text-white truncate">{album.title}</h4>
                    <p className="text-[11px] text-[#888888] truncate mt-0.5">{album.artist}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 4. VIDEOS SECTION */}
          {(activeFilter === 'all' || activeFilter === 'videos') && videos.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-base sm:text-lg font-black text-white tracking-tight flex items-center gap-2">
                <Video className="w-4 h-4 text-emerald-400" />
                <span>Music Videos & Live Shows</span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {videos.map((track) => (
                  <div
                    key={track.id}
                    onClick={() => playTrack(track, videos, 'search', 'video')}
                    className="p-3 rounded-2xl bg-[#141418] hover:bg-[#1e1e24] border border-[#222228] cursor-pointer transition-all hover:scale-[1.02] group"
                  >
                    <div className="aspect-video rounded-xl overflow-hidden mb-2 bg-[#1e1e22] shadow-md relative">
                      <ArtworkImage
                        src={track.thumbnail}
                        alt={track.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                      <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/80 text-[10px] font-mono text-white">
                        {Math.floor(track.duration / 60)}:{String(track.duration % 60).padStart(2, '0')}
                      </span>
                    </div>
                    <h4 className="text-xs font-bold text-white truncate">{track.title}</h4>
                    <p className="text-[11px] text-[#888888] truncate mt-0.5">{track.artist}</p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* 4. EMPTY SEARCH NOTIFICATION */}
      {!isLoading && query && !hasAnyResults && (
        <div className="flex flex-col items-center justify-center py-16 space-y-3 text-center">
          <p className="text-sm font-bold text-white">No results found for "{query}"</p>
          <p className="text-xs text-[#888888]">
            Check your spelling, or tap any of the trending artists and categories below.
          </p>
        </div>
      )}

      {/* 5. DEFAULT EXPANDED CATALOG: TRENDING ARTISTS & BROWSE CATEGORIES */}
      {(!query || (!isLoading && !hasAnyResults)) && (
        <div className="space-y-8 pt-4">
          {/* Top Artists Showcase */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Flame className="w-5 h-5 text-[#ff0000]" />
              <h2 className="text-base sm:text-lg font-black text-white tracking-tight">
                Top Trending Artists
              </h2>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3 sm:gap-4">
              {FEATURED_ARTISTS.map((artist) => (
                <div
                  key={artist.name}
                  onClick={() => handleSelectQuery(artist.name)}
                  className="flex flex-col items-center cursor-pointer group p-2 rounded-2xl bg-[#141418] hover:bg-[#1c1c22] border border-[#222228] transition-all hover:scale-105 text-center"
                >
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden mb-2 bg-[#222228] shadow-md border-2 border-transparent group-hover:border-[#ff0000] transition-colors">
                    <img src={artist.img} alt={artist.name} className="w-full h-full object-cover" />
                  </div>
                  <p className="text-xs font-bold text-white truncate w-full group-hover:text-[#ff4e4e]">
                    {artist.name}
                  </p>
                  <p className="text-[10px] text-[#717178] truncate w-full">{artist.genre}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Browse Categories & Genres */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Compass className="w-5 h-5 text-[#ff0000]" />
              <h2 className="text-base sm:text-lg font-black text-white tracking-tight">
                Explore Genres & Moods
              </h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {EXPLORE_CATEGORIES.map((cat) => (
                <div
                  key={cat.name}
                  onClick={() => handleSelectQuery(cat.query)}
                  className={`p-4 rounded-2xl bg-gradient-to-br ${cat.color} cursor-pointer shadow-lg hover:scale-105 active:scale-95 transition-all flex items-center justify-between group overflow-hidden relative`}
                >
                  <div>
                    <span className="text-xl sm:text-2xl mb-1 block">{cat.icon}</span>
                    <h3 className="text-xs sm:text-sm font-black text-white tracking-tight leading-snug">
                      {cat.name}
                    </h3>
                  </div>
                  <Play className="w-5 h-5 text-white/40 group-hover:text-white group-hover:scale-125 transition-all fill-current" />
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
};
