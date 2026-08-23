import React, { useEffect, useMemo, useRef } from 'react';
import { LyricData, SyncedLyricLine } from '../types';

interface SyncedLyricsProps {
  lyricsData: LyricData | null;
  currentTime: number;
  onLineClick?: (time: number) => void;
}

export const SyncedLyrics: React.FC<SyncedLyricsProps> = ({ lyricsData, currentTime, onLineClick }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeLineRef = useRef<HTMLParagraphElement>(null);

  // Parse LRC formatted string: [00:15.30] Lyric text
  const parsedLines = useMemo<SyncedLyricLine[]>(() => {
    if (!lyricsData || !lyricsData.syncedLyrics) return [];

    const lines = lyricsData.syncedLyrics.split('\n');
    const result: SyncedLyricLine[] = [];
    const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/;

    for (const line of lines) {
      const match = line.match(timeRegex);
      if (match) {
        const minutes = parseInt(match[1], 10);
        const seconds = parseInt(match[2], 10);
        const millis = parseInt(match[3].padEnd(3, '0').slice(0, 3), 10);
        const time = minutes * 60 + seconds + millis / 1000;
        const text = match[4].trim();
        if (text) {
          result.push({ time, text });
        }
      }
    }

    return result.sort((a, b) => a.time - b.time);
  }, [lyricsData]);

  // Find active line index
  const activeIndex = useMemo(() => {
    if (parsedLines.length === 0) return -1;
    for (let i = parsedLines.length - 1; i >= 0; i--) {
      if (currentTime >= parsedLines[i].time - 0.2) {
        return i;
      }
    }
    return 0;
  }, [parsedLines, currentTime]);

  // Auto-scroll active line to center
  useEffect(() => {
    if (activeLineRef.current && containerRef.current) {
      activeLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [activeIndex]);

  if (!lyricsData || (!lyricsData.syncedLyrics && !lyricsData.plainLyrics)) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500">
        <p className="text-sm font-semibold">Lyrics not available for this track</p>
        <p className="text-xs text-gray-600 mt-1">Enjoy the High-Fi audio stream</p>
      </div>
    );
  }

  // Fallback to plain lyrics if synced unavailable
  if (parsedLines.length === 0 && lyricsData.plainLyrics) {
    return (
      <div className="p-6 text-center space-y-4 text-gray-300 font-medium text-lg leading-relaxed whitespace-pre-line max-w-lg mx-auto">
        {lyricsData.plainLyrics}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="h-[420px] overflow-y-auto px-4 py-8 space-y-6 text-center scrollbar-thin scrollbar-thumb-dark-700 select-none"
    >
      {parsedLines.map((line, idx) => {
        const isActive = idx === activeIndex;
        const isPast = idx < activeIndex;

        return (
          <p
            key={idx}
            ref={isActive ? activeLineRef : null}
            onClick={() => onLineClick && onLineClick(line.time)}
            className={`transition-all duration-300 cursor-pointer font-bold leading-tight ${
              isActive
                ? 'text-white text-2xl md:text-3xl scale-105 drop-shadow-[0_0_20px_rgba(244,63,94,0.6)] text-mrj-400'
                : isPast
                ? 'text-gray-500 text-lg md:text-xl hover:text-gray-300'
                : 'text-gray-600 text-lg md:text-xl hover:text-gray-400 opacity-60'
            }`}
          >
            {line.text}
          </p>
        );
      })}
    </div>
  );
};
