import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Search as SearchIcon, X, Compass, Sparkles, Loader2, Music, User, Video, Disc, Mic, Info } from 'lucide-react';
import { Track } from '../types';
import { api, SearchSuggestionsResult } from '../services/api';
import { TrackCard } from '../components/TrackCard';
import { SearchSuggestionDropdown } from '../components/SearchSuggestionDropdown';
import { ArtworkImage } from '../components/ArtworkImage';
import { useMusicPlayer } from '../context/MusicPlayerContext';

type SearchCategoryFilter = 'all' | 'songs' | 'artists' | 'albums' | 'videos' | 'podcasts';

export const Search: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { playTrack } = useMusicPlayer();
  const queryParam = searchParams.get('q') || '';

  const [query, setQuery] = useState(queryParam);
  const [isFocused, setIsFocused] = useState(false);
  const [activeFilter, setActiveFilter] = useState<SearchCategoryFilter>('all');
  const [songs, setSongs] = useState<Track[]>([]);
  const [videos, setVideos] = useState<Track[]>([]);
  const [podcasts, setPodcasts] = useState<Track[]>([]);
  const [artists, setArtists] = useState<any[]>([]);
  const [albums, setAlbums] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [suggestionsData, setSuggestionsData] = useState<SearchSuggestionsResult | null>(null);

  const popularChips = [
    'Arijit Singh',
    'Taylor Swift',
    'The Weeknd',
    'Diljit Dosanjh',
    'Shreya Ghoshal',
    'Coldplay',
    'Ed Sheeran',
    'Lofi Beats',
    'Bollywood Hits',
    'Punjabi Hits',
  ];

  useEffect(() => {
    if (queryParam) {
      setQuery(queryParam);
      performSearch(queryParam);
    }
  }, [queryParam]);

  // Debounced search suggestions fetch
  useEffect(() => {
    if (!query || query.trim().length < 2) {
      setSuggestionsData(null);
      return;
    }
    const timer = setTimeout(() => {
      api.getSearchSuggestions(query.trim())
        .then((data) => setSuggestionsData(data))
        .catch(() => setSuggestionsData(null));
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  const performSearch = async (term: string) => {
    if (!term.trim()) return;
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
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      setIsFocused(false);
      setSearchParams({ q: query.trim() });
      performSearch(query.trim());
    }
  };

  const handleSelectQuery = (suggestionText: string) => {
    setQuery(suggestionText);
    setIsFocused(false);
    setSearchParams({ q: suggestionText });
    performSearch(suggestionText);
  };

  const handleSelectTrack = (track: Track) => {
    setIsFocused(false);
    playTrack(track);
  };

  const handleChipClick = (cat: string) => {
    setQuery(cat);
    setIsFocused(false);
    setSearchParams({ q: cat });
    performSearch(cat);
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
  };

  const hasAnyResults = songs.length > 0 || artists.length > 0 || albums.length > 0 || videos.length > 0 || podcasts.length > 0;

  return (
    <div className="p-3 sm:p-6 md:p-8 space-y-6 max-w-7xl mx-auto pb-mobile-player-nav select-none">
      {/* Mobile Search Input Header */}
      <div className="max-w-2xl mx-auto space-y-3">
        <form onSubmit={handleSearchSubmit} className="relative">
          <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#888888] pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setIsFocused(true)}
            placeholder="Search songs, artists, albums, or lyrics..."
            className="w-full h-12 pl-12 pr-20 bg-[#141417] border border-[#26262a] focus:border-[#ff0000] rounded-2xl text-sm text-white placeholder-[#717171] focus:outline-none shadow-lg transition-all"
          />
          {query.length > 0 && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-12 top-1/2 -translate-y-1/2 p-1 text-[#888888] hover:text-white rounded-full min-w-[32px] min-h-[32px] flex items-center justify-center"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            type="submit"
            className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-[#ff0000] text-white text-xs font-bold rounded-xl active:scale-95 transition-transform"
          >
            Go
          </button>
        </form>

        {/* Live Search Suggestions Dropdown */}
        {isFocused && query.length >= 2 && suggestionsData && (
          <div className="relative z-40">
            <SearchSuggestionDropdown
              isOpen={isFocused}
              onClose={() => setIsFocused(false)}
              data={suggestionsData}
              onSelectQuery={handleSelectQuery}
              onSelectTrack={handleSelectTrack}
              onSelectArtist={(name) => {
                setIsFocused(false);
                navigate(`/artist/${encodeURIComponent(name)}`);
              }}
              onSelectAlbum={(id) => {
                setIsFocused(false);
                navigate(`/album/${id}`);
              }}
            />
          </div>
        )}

        {/* Popular Exploration Chips */}
        {!query && (
          <div className="space-y-2 pt-2">
            <div className="flex items-center gap-1.5 text-xs text-[#888888] font-bold">
              <Compass className="w-3.5 h-3.5 text-[#ff0000]" />
              <span>Trending Searches</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {popularChips.map((chip) => (
                <button
                  key={chip}
                  onClick={() => handleChipClick(chip)}
                  className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-[#141417] hover:bg-[#202024] text-[#aaaaaa] hover:text-white border border-[#222226] transition-all min-h-[36px]"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Loading Indicator */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-16 space-y-3">
          <Loader2 className="w-7 h-7 text-[#ff0000] animate-spin" />
          <p className="text-xs font-semibold text-[#888888] tracking-wider uppercase">
            Searching verified catalog...
          </p>
        </div>
      )}

      {/* Search Results Display */}
      {!isLoading && query && hasAnyResults && (
        <div className="space-y-6">
          {/* Category Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
            {(
              [
                { id: 'all', label: 'All Results' },
                { id: 'songs', label: `Songs (${songs.length})` },
                { id: 'artists', label: `Artists (${artists.length})` },
                { id: 'albums', label: `Albums (${albums.length})` },
                { id: 'videos', label: `Videos (${videos.length})` },
              ] as const
            ).map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveFilter(cat.id)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all border min-h-[36px] ${
                  activeFilter === cat.id
                    ? 'bg-white text-black border-white shadow-md'
                    : 'bg-[#121215] text-[#888888] border-[#222226] hover:text-white'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* 1. SONGS SECTION */}
          {(activeFilter === 'all' || activeFilter === 'songs') && songs.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm sm:text-base font-black text-white tracking-tight flex items-center gap-2">
                <Music className="w-4 h-4 text-[#ff0000]" />
                <span>Songs</span>
              </h2>
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
              <h2 className="text-sm sm:text-base font-black text-white tracking-tight flex items-center gap-2">
                <User className="w-4 h-4 text-[#ff0000]" />
                <span>Artists</span>
              </h2>
              <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
                {artists.map((artist) => (
                  <div
                    key={artist.id || artist.name}
                    onClick={() => navigate(`/artist/${encodeURIComponent(artist.name)}`)}
                    className="w-24 sm:w-28 shrink-0 flex flex-col items-center cursor-pointer group"
                  >
                    <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden mb-2 bg-[#1e1e22] shadow-md border-2 border-transparent group-hover:border-[#ff0000] transition-colors">
                      <ArtworkImage
                        src={artist.thumbnail || artist.image}
                        alt={artist.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <p className="text-xs font-bold text-white text-center truncate w-full group-hover:underline">
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
              <h2 className="text-sm sm:text-base font-black text-white tracking-tight flex items-center gap-2">
                <Disc className="w-4 h-4 text-[#ff0000]" />
                <span>Albums</span>
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {albums.map((album) => (
                  <div
                    key={album.id}
                    onClick={() => navigate(`/album/${album.id}`)}
                    className="p-3 rounded-2xl bg-[#121215] hover:bg-[#1c1c20] border border-[#202024] cursor-pointer transition-all hover:scale-[1.02] group"
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
        </div>
      )}

      {/* Empty Search Result */}
      {!isLoading && query && !hasAnyResults && (
        <div className="flex flex-col items-center justify-center py-16 space-y-3 text-center">
          <p className="text-sm font-bold text-white">No results found for "{query}"</p>
          <p className="text-xs text-[#888888]">
            Check your spelling, or try searching for another artist or song title.
          </p>
        </div>
      )}
    </div>
  );
};
