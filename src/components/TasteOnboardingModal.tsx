import React, { useState } from 'react';
import { Sparkles, Check, Music, X } from 'lucide-react';
import { syncService } from '../services/syncService';

interface TasteOnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

const ARTIST_OPTIONS = [
  'Arijit Singh', 'The Weeknd', 'Taylor Swift', 'Drake', 'Bad Bunny',
  'Diljit Dosanjh', 'Coldplay', 'Billie Eilish', 'Ed Sheeran', 'Shreya Ghoshal',
  'Sidhu Moosewala', 'Karan Aujla', 'Bruno Mars', 'Pritam', 'Anirudh Ravichander'
];

const GENRE_OPTIONS = [
  'Bollywood', 'Pop', 'Punjabi', 'Hip-Hop / Rap', 'Lo-Fi',
  'EDM / Dance', 'Romantic', 'Rock', 'Acoustic', 'K-Pop', 'R&B / Soul'
];

export const TasteOnboardingModal: React.FC<TasteOnboardingModalProps> = ({
  isOpen,
  onClose,
  onComplete,
}) => {
  const [selectedArtists, setSelectedArtists] = useState<string[]>([]);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);

  if (!isOpen) return null;

  const toggleArtist = (artist: string) => {
    setSelectedArtists(prev =>
      prev.includes(artist) ? prev.filter(a => a !== artist) : [...prev, artist]
    );
  };

  const toggleGenre = (genre: string) => {
    setSelectedGenres(prev =>
      prev.includes(genre) ? prev.filter(g => g !== genre) : [...prev, genre]
    );
  };

  const handleSave = () => {
    // Commit initial seed preferences as LIKE events
    for (const artist of selectedArtists) {
      syncService.queueEvent({
        eventType: 'LIKE',
        trackId: 'onboard_' + artist,
        title: artist,
        artist,
      });
    }
    for (const genre of selectedGenres) {
      syncService.queueEvent({
        eventType: 'LIKE',
        trackId: 'onboard_' + genre,
        title: genre,
        artist: genre,
      });
    }
    syncService.flushEvents();
    onComplete();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 select-none animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-[#141414] border border-[#282828] rounded-3xl p-6 md:p-8 shadow-2xl space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#ff0000]/10 text-[#ff4e4e] text-xs font-bold border border-[#ff0000]/20">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Personalize Your Experience</span>
            </div>
            <h2 className="text-2xl font-black text-white tracking-tight">What do you listen to?</h2>
            <p className="text-xs text-[#aaaaaa]">Select 3 or more to build your personalized mixes and radio</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-[#222222] text-[#888888] hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Artists Selection */}
        <div className="space-y-2.5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#717171]">Favorite Artists</h4>
          <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto scrollbar-thin">
            {ARTIST_OPTIONS.map((artist) => {
              const isSelected = selectedArtists.includes(artist);
              return (
                <button
                  key={artist}
                  onClick={() => toggleArtist(artist)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all ${
                    isSelected
                      ? 'bg-white text-black font-bold shadow-md scale-105'
                      : 'bg-[#202020] hover:bg-[#282828] text-white border border-[#303030]'
                  }`}
                >
                  {isSelected && <Check className="w-3.5 h-3.5 text-black" />}
                  <span>{artist}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Genres Selection */}
        <div className="space-y-2.5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#717171]">Favorite Genres & Moods</h4>
          <div className="flex flex-wrap gap-2">
            {GENRE_OPTIONS.map((genre) => {
              const isSelected = selectedGenres.includes(genre);
              return (
                <button
                  key={genre}
                  onClick={() => toggleGenre(genre)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all ${
                    isSelected
                      ? 'bg-[#ff0000] text-white font-bold shadow-lg shadow-red-600/30 scale-105'
                      : 'bg-[#202020] hover:bg-[#282828] text-white border border-[#303030]'
                  }`}
                >
                  {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                  <span>{genre}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-[#202020]">
          <button
            onClick={onClose}
            className="text-xs font-semibold text-[#888888] hover:text-white transition-colors"
          >
            Skip for now
          </button>

          <button
            onClick={handleSave}
            disabled={selectedArtists.length === 0 && selectedGenres.length === 0}
            className="px-6 py-2.5 rounded-full bg-[#ff0000] hover:bg-[#cc0000] disabled:opacity-40 text-white font-bold text-xs shadow-lg shadow-red-600/30 transition-all hover:scale-105"
          >
            Start Listening ({selectedArtists.length + selectedGenres.length})
          </button>
        </div>
      </div>
    </div>
  );
};
