import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Search as SearchIcon, Compass, Sparkles, Loader2, Music, User } from 'lucide-react';
import { Track } from '../types';
import { api } from '../services/api';
import { TrackCard } from '../components/TrackCard';

export const Search: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryParam = searchParams.get('q') || '';

  const [query, setQuery] = useState(queryParam);
  const [results, setResults] = useState<Track[]>([]);
  const [artists, setArtists] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const categories = [
    'Global Top 50',
    'Arijit Singh',
    'Taylor Swift',
    'Drake',
    'The Weeknd',
    'Bad Bunny',
    'Billie Eilish',
    'Coldplay',
    'Lofi Beats',
    'Bollywood Hits',
    'Punjabi Hits',
    'K-Pop'
  ];

  useEffect(() => {
    if (queryParam) {
      setQuery(queryParam);
      performSearch(queryParam);
    }
  }, [queryParam]);

  const performSearch = async (term: string) => {
    if (!term.trim()) return;
    setIsLoading(true);
    try {
      const data = await api.search(term.trim());
      setResults(data.results || []);
      setArtists(data.artists || []);
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      setSearchParams({ q: query.trim() });
      performSearch(query.trim());
    }
  };

  const handleChipClick = (cat: string) => {
    setQuery(cat);
    setSearchParams({ q: cat });
    performSearch(cat);
  };

  return (
    <div className="p-4 md:p-8 space-y-10 max-w-7xl mx-auto pb-40 select-none">
      {/* Search Input Hero */}
      <div className="max-w-2xl mx-auto text-center space-y-4">
        <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">
          Explore Worldwide Music
        </h1>
        <p className="text-xs md:text-sm text-[#aaaaaa]">
          Search over 100 million songs, artists, albums, and remixes in High-Fi audio
        </p>

        <form onSubmit={handleSearchSubmit} className="relative">
          <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#aaaaaa] pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by song name, singer, band, or lyrics..."
            className="w-full h-13 pl-12 pr-28 bg-[#212121] border border-[#333333] focus:border-[#ff0000] rounded-2xl text-sm text-white placeholder-[#717171] focus:outline-none shadow-xl transition-all"
            autoFocus
          />
          <button
            type="submit"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 px-5 py-2 rounded-xl bg-[#ff0000] hover:bg-[#cc0000] text-white font-bold text-xs shadow-md transition-all hover:scale-105"
          >
            Search
          </button>
        </form>

        {/* Quick Genre & Artist Chips */}
        <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => handleChipClick(cat)}
              className="px-3.5 py-1.5 rounded-full bg-[#181818] hover:bg-[#212121] border border-[#282828] text-xs font-semibold text-[#aaaaaa] hover:text-white transition-all hover:scale-105 active:scale-95"
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Artists Result Section */}
      {artists.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <User className="w-5 h-5 text-[#ff0000]" />
            <span>Artists</span>
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
            {artists.map((artist) => (
              <div
                key={artist.id || artist.name}
                onClick={() => navigate(`/artist/${encodeURIComponent(artist.name)}`)}
                className="flex flex-col items-center text-center p-4 rounded-2xl bg-[#181818] hover:bg-[#212121] border border-[#262626] cursor-pointer transition-all hover:scale-105 group"
              >
                <div className="w-24 h-24 rounded-full overflow-hidden mb-3 shadow-lg border border-[#333333] group-hover:border-[#ff0000]">
                  <img src={artist.thumbnail} alt={artist.name} className="w-full h-full object-cover" />
                </div>
                <h4 className="text-sm font-bold text-white group-hover:text-[#ff4e4e] truncate w-full">
                  {artist.name}
                </h4>
                <p className="text-[10px] text-[#aaaaaa] mt-0.5">{artist.subscribers}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Songs Results Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 text-[#ff0000] animate-spin" />
                <span>Searching Worldwide Catalog...</span>
              </>
            ) : results.length > 0 ? (
              <>
                <Compass className="w-5 h-5 text-[#ff0000]" />
                <span>Songs for "{query}" ({results.length})</span>
              </>
            ) : (
              <span>Popular Global Songs</span>
            )}
          </h2>
        </div>

        {results.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {results.map((track) => (
              <TrackCard key={track.id} track={track} queueContext={results} />
            ))}
          </div>
        ) : !isLoading && query ? (
          <div className="text-center py-16 text-[#aaaaaa]">
            <Music className="w-10 h-10 mx-auto mb-2 opacity-40 text-[#717171]" />
            <p className="text-base font-semibold text-white">No tracks found</p>
            <p className="text-xs text-[#aaaaaa] mt-1">Try another artist or keyword</p>
          </div>
        ) : null}
      </section>
    </div>
  );
};
