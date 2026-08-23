import React from 'react';
import { Track } from '../types';
import { ArtworkImage } from './ArtworkImage';
import { Sparkles, Disc3 } from 'lucide-react';

interface MixArtworkProps {
  tracks: Track[];
  title?: string;
  className?: string;
}

export const MixArtwork: React.FC<MixArtworkProps> = ({ tracks, title, className = '' }) => {
  const covers = tracks.slice(0, 4);

  // If we have 4 distinct covers, render a 2x2 collage
  if (covers.length >= 4) {
    return (
      <div className={`relative aspect-square rounded-2xl overflow-hidden shadow-xl bg-[#181818] grid grid-cols-2 grid-rows-2 gap-[1px] p-[1px] ${className}`}>
        {covers.map((track, i) => (
          <div key={`mix-c-${track.id}-${i}`} className="w-full h-full overflow-hidden relative">
            <ArtworkImage
              src={track.thumbnail}
              alt={track.title}
              aspectRatio="square"
              size="custom"
              className="w-full h-full rounded-none"
            />
          </div>
        ))}
        {/* Subtle glass gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
      </div>
    );
  }

  // Fallback if 1 to 3 covers exist
  if (covers.length > 0) {
    return (
      <div className={`relative aspect-square rounded-2xl overflow-hidden shadow-xl bg-[#181818] ${className}`}>
        <ArtworkImage
          src={covers[0].thumbnail}
          alt={title || 'Mix'}
          aspectRatio="square"
          size="custom"
          className="w-full h-full"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
      </div>
    );
  }

  // Default stylized placeholder
  return (
    <div className={`relative aspect-square rounded-2xl overflow-hidden shadow-xl bg-gradient-to-br from-[#242424] to-[#121212] flex items-center justify-center ${className}`}>
      <Disc3 className="w-16 h-16 text-[#ff0000]/50 animate-spin-slow" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
    </div>
  );
};
