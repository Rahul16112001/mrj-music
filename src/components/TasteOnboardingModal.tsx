import React, { useState } from 'react';
import { Sparkles, Check, Music, X } from 'lucide-react';
import { syncService } from '../services/syncService';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

interface TasteOnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

const ARTIST_OPTIONS = [
  'Arijit Singh', 'The Weeknd', 'Taylor Swift', 'Diljit Dosanjh', 'Karan Aujla',
  'Shreya Ghoshal', 'Anirudh Ravichander', 'Pritam', 'Sidhu Moosewala', 'Ed Sheeran',
  'Dua Lipa', 'Pawan Singh', 'Masoom Sharma', 'Anuv Jain', 'The Local Train'
];

const GENRE_OPTIONS = [
  'Bollywood', 'Punjabi', 'Hollywood', 'Tollywood', 'Haryanvi',
  'Bhojpuri', 'Indie', 'Lo-Fi', 'Pop', 'Hip-Hop / Rap', 'Acoustic'
];

export const TasteOnboardingModal: React.FC<TasteOnboardingModalProps> = ({
  isOpen,
  onClose,
  onComplete,
}) => {
  const { user } = useAuth();
  const [selectedArtists, setSelectedArtists] = useState<string[]>([]);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);

  if (!isOpen) return null;

  const markOnboardingDone = () => {
    try {
      localStorage.setItem('MRJ_ONBOARDING_DONE', 'true');
      if (user?.id) {
        localStorage.setItem(`MRJ_ONBOARDING_DONE_${user.id}`, 'true');
      }
    } catch {}
  };

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

  const handleSkip = () => {
    markOnboardingDone();
    if (selectedArtists.length > 0 || selectedGenres.length > 0) {
      api.saveUserPreferences({
        preferred_artists: selectedArtists,
        preferred_genres: selectedGenres,
      }).catch(() => {});
    }
    onClose();
  };

  const handleSave = async () => {
    markOnboardingDone();

    // 1. Direct API persistence to User Taste Profile DB
    try {
      await api.saveUserPreferences({
        preferred_artists: selectedArtists,
        preferred_genres: selectedGenres,
      });
    } catch (err) {
      console.warn('Preferences save warning:', err);
    }

    // 2. Commit initial seed preferences as LIKE events to user taste profile dataset
    for (const artist of selectedArtists) {
      syncService.queueEvent({
        eventType: 'LIKE',
        trackId: 'onboard_artist_' + encodeURIComponent(artist),
        title: artist,
        artist,
      });
    }
    for (const genre of selectedGenres) {
      syncService.queueEvent({
        eventType: 'LIKE',
        trackId: 'onboard_genre_' + encodeURIComponent(genre),
        title: genre,
        artist: genre,
        genre,
      });
    }
    syncService.flushEvents();
    onComplete();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 select-none animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-[#141418] border border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#ff0000]/10 text-[#ff4e4e] text-xs font-bold border border-[#ff0000]/20">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Personalize Your Experience</span>
            </div>
            <h2 className="text-2xl font-black text-white tracking-tight">What do you listen to?</h2>
            <p className="text-xs text-[#aaaaaa]">Select your favorite artists & genres to tune your daily mixes</p>
          </div>
          <button
            onClick={handleSkip}
            className="p-1.5 rounded-full hover:bg-white/10 text-[#888888] hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Artists Selection */}
        <div className="space-y-2.5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#717171]">Favorite Artists</h4>
          <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto no-scrollbar">
            {ARTIST_OPTIONS.map((artist) => {
              const isSelected = selectedArtists.includes(artist);
              return (
                <button
                  key={artist}
                  onClick={() => toggleArtist(artist)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all ${
                    isSelected
                      ? 'bg-white text-black font-bold shadow-md scale-105'
                      : 'bg-[#202024] hover:bg-[#28282c] text-white border border-[#303036]'
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
                      : 'bg-[#202024] hover:bg-[#28282c] text-white border border-[#303036]'
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
        <div className="flex items-center justify-between pt-2 border-t border-white/10">
          <button
            onClick={handleSkip}
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
