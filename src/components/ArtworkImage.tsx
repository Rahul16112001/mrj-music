import React, { useState, useEffect } from 'react';
import { Music } from 'lucide-react';

interface ArtworkImageProps {
  src?: string;
  alt: string;
  className?: string;
  aspectRatio?: 'square' | 'video' | 'circle';
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'custom';
}

export const ArtworkImage: React.FC<ArtworkImageProps> = ({
  src,
  alt,
  className = '',
  aspectRatio = 'square',
  size = 'md',
}) => {
  const [currentSrc, setCurrentSrc] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
    if (!src) {
      setHasError(true);
      return;
    }

    // Direct clean image URL
    if (src.includes('ytimg.com') || src.includes('youtube.com')) {
      const match = src.match(/\/vi\/([a-zA-Z0-9_-]+)\//);
      if (match && match[1]) {
        const videoId = match[1];
        setCurrentSrc(`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`);
        return;
      }
    }

    setCurrentSrc(src);
  }, [src]);

  const handleError = () => {
    if (currentSrc && currentSrc.includes('hqdefault.jpg')) {
      setCurrentSrc(currentSrc.replace('hqdefault.jpg', 'mqdefault.jpg'));
    } else if (currentSrc && currentSrc.includes('mqdefault.jpg')) {
      setCurrentSrc(currentSrc.replace('mqdefault.jpg', 'default.jpg'));
    } else {
      setHasError(true);
    }
  };

  const sizeClasses = {
    sm: 'w-10 h-10',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
    xl: 'w-48 h-48',
    custom: '',
  }[size];

  const aspectClasses = {
    square: 'aspect-square rounded-xl',
    circle: 'aspect-square rounded-full',
    video: 'aspect-video rounded-xl',
  }[aspectRatio];

  return (
    <div
      className={`relative overflow-hidden bg-[#18181b] shrink-0 select-none ${sizeClasses} ${aspectClasses} ${className}`}
    >
      {hasError || !currentSrc ? (
        <div className="w-full h-full bg-gradient-to-br from-zinc-800 via-zinc-900 to-black flex items-center justify-center text-white/50 border border-white/5">
          <Music className="w-1/2 h-1/2 opacity-60 text-red-500" />
        </div>
      ) : (
        <img
          src={currentSrc}
          alt={alt}
          onError={handleError}
          className="w-full h-full object-cover transition-all"
        />
      )}
    </div>
  );
};
