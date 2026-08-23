import React, { useEffect, useState } from 'react';
import { Search, Clock, X, Music, User, Disc, Play, Sparkles } from 'lucide-react';
import { Track } from '../types';
import { SearchSuggestionsResult } from '../services/api';
import { ArtworkImage } from './ArtworkImage';

interface SearchSuggestionDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  data: SearchSuggestionsResult | null;
  onSelectQuery: (query: string) => void;
  onSelectTrack: (track: Track) => void;
  onSelectArtist?: (artistName: string) => void;
  onSelectAlbum?: (albumId: string) => void;
  onDeleteHistoryQuery?: (query: string) => void;
  onClearHistory?: () => void;
  isLoading?: boolean;
}

export const SearchSuggestionDropdown: React.FC<SearchSuggestionDropdownProps> = ({
  isOpen,
  onClose,
  data,
  onSelectQuery,
  onSelectTrack,
  onSelectArtist,
  onSelectAlbum,
  onDeleteHistoryQuery,
  onClearHistory,
  isLoading = false,
}) => {
  if (!isOpen || !data) return null;

  const hasRecent = data.recent && data.recent.length > 0;
  const hasSuggestions = data.suggestions && data.suggestions.length > 0;
  const hasSongs = data.songs && data.songs.length > 0;
  const hasArtists = data.artists && data.artists.length > 0;
  const hasAlbums = data.albums && data.albums.length > 0;

  if (!hasRecent && !hasSuggestions && !hasSongs && !hasArtists && !hasAlbums && !isLoading) {
    return null;
  }

  return (
    <div
      className="absolute left-0 right-0 top-full mt-2 bg-[#121212]/95 backdrop-blur-xl border border-[#282828] rounded-2xl shadow-2xl overflow-hidden z-50 max-h-[75vh] overflow-y-auto no-scrollbar select-none divide-y divide-[#1f1f1f] transition-all duration-200 animate-in fade-in zoom-in-95"
      onMouseDown={(e) => e.preventDefault()}
    >
      {/* 1. RECENT SEARCHES */}
      {hasRecent && (
        <div className="p-3 space-y-1">
          <div className="flex items-center justify-between px-2 py-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#888888] flex items-center gap-1.5">
              <Clock className="w-3 h-3 text-[#ff0000]" />
              <span>Recent Searches</span>
            </span>
            {onClearHistory && (
              <button
                onClick={onClearHistory}
                className="text-[10px] text-[#888888] hover:text-[#ff4e4e] font-semibold transition-colors"
              >
                Clear all
              </button>
            )}
          </div>
          <div className="space-y-0.5">
            {data.recent!.slice(0, 5).map((q) => (
              <div
                key={q}
                className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-[#1e1e1e] cursor-pointer group transition-colors"
              >
                <div
                  onClick={() => onSelectQuery(q)}
                  className="flex items-center gap-3 flex-1 overflow-hidden"
                >
                  <Clock className="w-3.5 h-3.5 text-[#777777] shrink-0 group-hover:text-white transition-colors" />
                  <span className="text-xs font-medium text-[#cccccc] group-hover:text-white truncate">
                    {q}
                  </span>
                </div>
                {onDeleteHistoryQuery && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteHistoryQuery(q);
                    }}
                    className="p-1 rounded-full text-[#666666] hover:text-white hover:bg-[#2c2c2c] transition-colors"
                    title="Remove from history"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. MATCHING QUERY SUGGESTIONS */}
      {hasSuggestions && (
        <div className="p-3 space-y-1">
          <div className="px-2 py-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#888888] flex items-center gap-1.5">
              <Search className="w-3 h-3 text-[#ff0000]" />
              <span>Suggestions</span>
            </span>
          </div>
          <div className="space-y-0.5">
            {data.suggestions.slice(0, 6).map((q) => (
              <div
                key={q}
                onClick={() => onSelectQuery(q)}
                className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-[#1e1e1e] cursor-pointer group transition-colors"
              >
                <Search className="w-3.5 h-3.5 text-[#777777] shrink-0 group-hover:text-[#ff0000] transition-colors" />
                <span className="text-xs font-semibold text-white truncate">
                  {q}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. MATCHING SONGS */}
      {hasSongs && (
        <div className="p-3 space-y-1">
          <div className="px-2 py-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#888888] flex items-center gap-1.5">
              <Music className="w-3 h-3 text-[#ff0000]" />
              <span>Songs</span>
            </span>
          </div>
          <div className="space-y-1">
            {data.songs.slice(0, 4).map((track) => (
              <div
                key={track.id}
                onClick={() => onSelectTrack(track)}
                className="flex items-center justify-between p-2 rounded-xl hover:bg-[#1e1e1e] cursor-pointer group transition-all"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-[#222222]">
                    <ArtworkImage src={track.thumbnail} alt={track.title} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <Play className="w-3.5 h-3.5 text-white fill-current ml-0.5" />
                    </div>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white group-hover:text-[#ff4e4e] truncate transition-colors">
                      {track.title}
                    </p>
                    <p className="text-[11px] text-[#aaaaaa] truncate">
                      {track.artist}
                    </p>
                  </div>
                </div>
                <div className="text-[11px] text-[#777777] shrink-0 ml-2 font-mono">
                  {Math.floor(track.duration / 60)}:{(track.duration % 60).toString().padStart(2, '0')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. MATCHING ARTISTS & ALBUMS */}
      {(hasArtists || hasAlbums) && (
        <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {hasArtists && (
            <div className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#888888] px-2 block">
                Artists
              </span>
              {data.artists.slice(0, 2).map((artist) => (
                <div
                  key={artist.name}
                  onClick={() => onSelectArtist?.(artist.name)}
                  className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-[#1e1e1e] cursor-pointer group transition-colors"
                >
                  <img
                    src={artist.thumbnail || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=100'}
                    alt={artist.name}
                    className="w-8 h-8 rounded-full object-cover shrink-0 border border-[#333333]"
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white group-hover:text-[#ff4e4e] truncate transition-colors">
                      {artist.name}
                    </p>
                    <span className="text-[10px] text-[#888888]">Artist</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {hasAlbums && (
            <div className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#888888] px-2 block">
                Albums
              </span>
              {data.albums.slice(0, 2).map((album) => (
                <div
                  key={album.id}
                  onClick={() => onSelectAlbum?.(album.id)}
                  className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-[#1e1e1e] cursor-pointer group transition-colors"
                >
                  <img
                    src={album.thumbnail || 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=100'}
                    alt={album.title}
                    className="w-8 h-8 rounded-lg object-cover shrink-0 border border-[#333333]"
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white group-hover:text-[#ff4e4e] truncate transition-colors">
                      {album.title}
                    </p>
                    <span className="text-[10px] text-[#888888]">Album • {album.artist}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
