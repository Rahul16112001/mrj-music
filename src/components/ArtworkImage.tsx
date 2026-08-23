import React, { useState, useEffect } from 'react';
import { Music, Disc3 } from 'lucide-react';

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
  const [isLoading, setIsLoading] = useState(true);

  // Extract YouTube Video ID and resolve best thumbnail resolution
  useEffect(() => {
    setHasError(false);
    setIsLoading(true);

    if (!src) {
      setHasError(true);
      setIsLoading(false);
      return;
    }

    // If it's a YouTube thumbnail URL, upgrade to highest resolution
    if (src.includes('ytimg.com') || src.includes('youtube.com')) {
      const match = src.match(/\/vi\/([a-zA-Z0-9_-]+)\//);
      if (match && match[1]) {
        const videoId = match[1];
        // Prefer maxresdefault for crystal-clear sharp artwork
        setCurrentSrc(`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`);
        return;
      }
    }

    setCurrentSrc(src);
  }, [src]);

  const handleError = () => {
    if (currentSrc && currentSrc.includes('maxresdefault.jpg')) {
      // Fallback from maxresdefault to hqdefault
      const fallback = currentSrc.replace('maxresdefault.jpg', 'hqdefault.jpg');
      setCurrentSrc(fallback);
    } else if (currentSrc && currentSrc.includes('hqdefault.jpg')) {
      // Fallback to mqdefault
      const fallback = currentSrc.replace('hqdefault.jpg', 'mqdefault.jpg');
      setCurrentSrc(fallback);
    } else {
      setHasError(true);
      setIsLoading(false);
    }
  };

  const handleLoad = () => {
    setIsLoading(false);
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
      className={`relative overflow-hidden bg-[#181818] shrink-0 select-none ${sizeClasses} ${aspectClasses} ${className}`}
    >
      {/* Skeleton Loading Placeholder */}
      {isLoading && (
        <div className="absolute inset-0 bg-[#242424] animate-pulse flex items-center justify-center">
          <Disc3 className="w-5 h-5 text-[#444444] animate-spin" />
        </div>
      )}

      {/* Fallback Artwork when image fails */}
      {hasError || !currentSrc ? (
        <div className="w-full h-full bg-[#202020] flex items-center justify-center text-[#ff0000]/60">
          <Music className="w-1/2 h-1/2 opacity-70" />
        </div>
      ) : (
        <img
          src={currentSrc}
          alt={alt}
          loading="lazy"
          onLoad={handleLoad}
          onError={handleError}
          className={`w-full h-full object-cover transition-opacity duration-200 ${
            isLoading ? 'opacity-0' : 'opacity-100'
          }`}
        />
      )}
    </div>
  );
};
