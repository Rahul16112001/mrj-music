import React, { useState, useEffect } from 'react';
import { Music } from 'lucide-react';

interface ArtworkImageProps {
  src?: string;
  alt: string;
  className?: string;
  aspectRatio?: 'square' | 'video' | 'circle';
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'custom';
}

const studioArtworkCache = new Map<string, string>();

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

    let optimizedSrc = src;

    // 1. Google / YouTube Music UserContent (Upgrade tiny 60px/120px to 800x800 Studio Master Artwork)
    if (optimizedSrc.includes('googleusercontent.com')) {
      optimizedSrc = optimizedSrc
        .replace(/=w\d+-h\d+[^&]*/g, '=w800-h800-l90-rj')
        .replace(/=s\d+[^&]*/g, '=s800');
    }
    // 2. Apple Music / iTunes (Upgrade to 800x800)
    else if (optimizedSrc.includes('mzstatic.com')) {
      optimizedSrc = optimizedSrc.replace(/\/\d+x\d+bb\.jpg/, '/800x800bb.jpg');
    }
    // 3. YouTube i.ytimg.com (Upgrade to 1080p maxresdefault + Auto-fetch Studio Album Master)
    else if (optimizedSrc.includes('ytimg.com') || optimizedSrc.includes('youtube.com')) {
      const match = optimizedSrc.match(/\/vi\/([a-zA-Z0-9_-]+)\//);
      if (match && match[1]) {
        const videoId = match[1];
        optimizedSrc = `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
      }

      // If alt text contains song info, resolve official square studio cover art
      const cleanAlt = alt ? alt.replace(/\(Official.*?\)/gi, '').replace(/\(Video.*?\)/gi, '').replace(/\[.*?\]/g, '').trim() : '';
      if (cleanAlt && cleanAlt.length > 2 && cleanAlt !== 'Artwork' && cleanAlt !== 'Track') {
        if (studioArtworkCache.has(cleanAlt)) {
          optimizedSrc = studioArtworkCache.get(cleanAlt)!;
        } else {
          fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(cleanAlt)}&entity=song&limit=1`)
            .then((r) => (r.ok ? r.json() : null))
            .then((data) => {
              if (data?.results?.[0]?.artworkUrl100) {
                const studioArt = data.results[0].artworkUrl100.replace('100x100bb', '800x800bb');
                studioArtworkCache.set(cleanAlt, studioArt);
                setCurrentSrc(studioArt);
              }
            })
            .catch(() => {});
        }
      }
    }

    setCurrentSrc(optimizedSrc);
  }, [src, alt]);

  const handleError = () => {
    if (currentSrc && currentSrc.includes('maxresdefault.jpg')) {
      setCurrentSrc(currentSrc.replace('maxresdefault.jpg', 'sddefault.jpg'));
    } else if (currentSrc && currentSrc.includes('sddefault.jpg')) {
      setCurrentSrc(currentSrc.replace('sddefault.jpg', 'hqdefault.jpg'));
    } else if (currentSrc && currentSrc.includes('hqdefault.jpg')) {
      setCurrentSrc(currentSrc.replace('hqdefault.jpg', 'mqdefault.jpg'));
    } else if (currentSrc && currentSrc.includes('=w800-h800-l90-rj')) {
      setCurrentSrc(currentSrc.replace('=w800-h800-l90-rj', '=w400-h400-l90-rj'));
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
