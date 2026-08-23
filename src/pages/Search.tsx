import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Search as SearchIcon, Compass, Sparkles, Loader2, Music, User, Video, Disc, Mic, Info } from 'lucide-react';
import { Track } from '../types';
import { api } from '../services/api';
import { TrackCard } from '../components/TrackCard';

type SearchCategoryFilter = 'all' | 'songs' | 'artists' | 'albums' | 'videos' | 'podcasts';

export const Search: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryParam = searchParams.get('q') || '';

  const [query, setQuery] = useState(queryParam);
  const [activeFilter, setActiveFilter] = useState<SearchCategoryFilter>('all');
  const [songs, setSongs] = useState<Track[]>([]);
  const [videos, setVideos] = useState<Track[]>([]);
  const [podcasts, setPodcasts] = useState<Track[]>([]);
  const [artists, setArtists] = useState<any[]>([]);
  const [albums, setAlbums] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

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
      setSearchParams({ q: query.trim() });
      performSearch(query.trim());
    }
  };

  const handleChipClick = (cat: string) => {
    setQuery(cat);
    setSearchParams({ q: cat });
    performSearch(cat);
  };

  const hasAnyResults = songs.length > 0 || artists.length > 0 || albums.length > 0 || videos.length > 0 || podcasts.length > 0;
  const isVideoFallbackOnly = songs.length === 0 && videos.length > 0;

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-7xl mx-auto pb-40 select-none">
      {/* Search Input Hero */}
      <div className="max-w-2xl mx-auto text-center space-y-4">
        <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">
          Explore Music Catalog
        </h1>
        <p className="text-xs md:text-sm text-[#aaaaaa]">
          Music-first search across verified audio tracks, albums, artists, and music videos
        </p>

        <form onSubmit={handleSearchSubmit} className="relative">
          <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#aaaaaa] pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by song name, artist, lyrics, or album..."
            className="w-full h-12 pl-12 pr-28 bg-[#181818] border border-[#2d2d2d] focus:border-[#ff0000] rounded-2xl text-sm text-white placeholder-[#717171] focus:outline-none shadow-xl transition-all"
            autoFocus
          />
          <button
            type="submit"
            className="absolute right-2 top-1/2 -translate-y-1/2 px-5 py-1.5 rounded-xl bg-[#ff0000] hover:bg-[#cc0000] text-white font-bold text-xs shadow-md transition-all hover:scale-105"
          >
            Search
          </button>
        </form>

        {/* Category Type Filter Pills */}
        <div className="flex items-center justify-center gap-2 overflow-x-auto no-scrollbar py-2">
          {(['all', 'songs', 'artists', 'albums', 'videos', 'podcasts'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all border ${
                activeFilter === filter
                  ? 'bg-white text-black border-white shadow-md'
                  : 'bg-[#181818] text-[#aaaaaa] border-[#2c2c2c] hover:text-white'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>

        {/* Popular Search Seeds */}
        {!queryParam && (
          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
            {popularChips.map((cat) => (
              <button
                key={cat}
                onClick={() => handleChipClick(cat)}
                className="px-3.5 py-1.5 rounded-full bg-[#181818] hover:bg-[#212121] border border-[#282828] text-xs font-semibold text-[#aaaaaa] hover:text-white transition-all hover:scale-105"
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {isLoading && (
        <div className="flex flex-col items-center justify-center py-16 space-y-3">
          <Loader2 className="w-8 h-8 text-[#ff0000] animate-spin" />
          <p className="text-xs font-bold text-[#aaaaaa] uppercase tracking-wider">Searching Music-First Catalog...</p>
        </div>
      )}

      {/* Fallback Notice when only Video is found */}
      {!isLoading && isVideoFallbackOnly && (
        <div className="p-4 rounded-2xl bg-[#1c1c1c] border border-[#333333] flex items-center gap-3 text-sm text-[#cccccc]">
          <Info className="w-5 h-5 text-[#ff4e4e] shrink-0" />
          <span>No official music/audio version found for <strong>"{queryParam}"</strong>. Showing matching video results below.</span>
        </div>
      )}

      {!isLoading && hasAnyResults && (
        <div className="space-y-10">
          {/* 1. MUSIC-FIRST SONGS (TOP PRIORITY) */}
          {(activeFilter === 'all' || activeFilter === 'songs') && songs.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Music className="w-5 h-5 text-[#ff0000]" />
                  <span>Songs ({songs.length})</span>
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {songs.map((track) => (
                  <TrackCard key={track.id} track={{ ...track, playbackFormat: 'audio' }} queueContext={songs} />
                ))}
              </div>
            </section>
          )}

          {/* 2. ARTISTS */}
          {(activeFilter === 'all' || activeFilter === 'artists') && artists.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <User className="w-5 h-5 text-[#ff0000]" />
                <span>Artists ({artists.length})</span>
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
                    <p className="text-[10px] text-[#aaaaaa] mt-0.5">{artist.subscribers || 'Artist'}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 3. ALBUMS */}
          {(activeFilter === 'all' || activeFilter === 'albums') && albums.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Disc className="w-5 h-5 text-[#ff0000]" />
                <span>Albums ({albums.length})</span>
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {albums.map((album) => (
                  <div
                    key={album.id}
                    onClick={() => navigate(`/album/${album.id}`)}
                    className="flex flex-col p-3 rounded-2xl bg-[#181818] hover:bg-[#212121] border border-[#262626] cursor-pointer transition-all group"
                  >
                    <img src={album.thumbnail} alt={album.title} className="w-full aspect-square rounded-xl object-cover mb-2" />
                    <h4 className="text-sm font-bold text-white group-hover:text-[#ff4e4e] truncate">{album.title}</h4>
                    <p className="text-xs text-[#aaaaaa] truncate">{album.artist}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 4. MUSIC VIDEOS */}
          {(activeFilter === 'all' || activeFilter === 'videos') && videos.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Video className="w-5 h-5 text-[#ff0000]" />
                <span>Music Videos ({videos.length})</span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {videos.map((vid) => (
                  <TrackCard key={`vid-${vid.id}`} track={{ ...vid, playbackFormat: 'video' }} queueContext={videos} />
                ))}
              </div>
            </section>
          )}

          {/* 5. PODCASTS */}
          {(activeFilter === 'all' || activeFilter === 'podcasts') && podcasts.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Mic className="w-5 h-5 text-[#ff0000]" />
                <span>Podcasts ({podcasts.length})</span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {podcasts.map((pod) => (
                  <TrackCard key={`pod-${pod.id}`} track={pod} queueContext={podcasts} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {!isLoading && queryParam && !hasAnyResults && (
        <div className="text-center py-20 text-[#aaaaaa] space-y-2">
          <Music className="w-12 h-12 mx-auto text-[#444444]" />
          <p className="text-base font-bold text-white">No tracks found for "{queryParam}"</p>
          <p className="text-xs text-[#777777]">Try searching for a different song title or artist name</p>
        </div>
      )}
    </div>
  );
};
