import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search as SearchIcon, Compass, Sparkles, Loader2, Music } from 'lucide-react';
import { Track } from '../types';
import { api } from '../services/api';
import { TrackCard } from '../components/TrackCard';

export const Search: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryParam = searchParams.get('q') || '';

  const [query, setQuery] = useState(queryParam);
  const [results, setResults] = useState<Track[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const categories = [
    'Global Top 50',
    'Taylor Swift',
    'Drake',
    'The Weeknd',
    'Arijit Singh',
    'Bad Bunny',
    'BTS',
    'Billie Eilish',
    'Coldplay',
    'Lofi Hip Hop',
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
      const tracks = await api.search(term.trim());
      setResults(tracks);
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
    <div className="p-4 md:p-8 space-y-8 max-w-7xl mx-auto pb-32">
      {/* Search Input Hero */}
      <div className="max-w-2xl mx-auto text-center space-y-4">
        <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">
          Explore the Entire World of Music
        </h1>
        <p className="text-sm text-gray-400">
          Search over 100 million songs, artists, albums, and remixes in High-Fi audio
        </p>

        <form onSubmit={handleSearchSubmit} className="relative">
          <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by song name, singer, band, or lyrics..."
            className="w-full h-14 pl-12 pr-28 bg-dark-850 border border-dark-750 focus:border-mrj-500 rounded-2xl text-base text-gray-100 placeholder-gray-500 focus:outline-none shadow-xl transition-all"
            autoFocus
          />
          <button
            type="submit"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 px-4 py-2 rounded-xl bg-mrj-600 hover:bg-mrj-500 text-white font-bold text-xs shadow-md transition-all"
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
              className="px-3.5 py-1.5 rounded-full bg-dark-850 hover:bg-dark-750 border border-dark-750/80 text-xs font-semibold text-gray-300 hover:text-white transition-all hover:scale-105 active:scale-95"
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Results Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-100 flex items-center gap-2">
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 text-mrj-400 animate-spin" />
                <span>Searching Worldwide Catalog...</span>
              </>
            ) : results.length > 0 ? (
              <>
                <Compass className="w-5 h-5 text-mrj-400" />
                <span>Results for "{query}" ({results.length})</span>
              </>
            ) : (
              <span>Popular Global Trending</span>
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
          <div className="text-center py-16 text-gray-500">
            <Music className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p className="text-base font-semibold">No tracks found</p>
            <p className="text-xs text-gray-600 mt-1">Try another artist or keyword</p>
          </div>
        ) : null}
      </div>
    </div>
  );
};
