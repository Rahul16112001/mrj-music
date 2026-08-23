import React from 'react';

export const TrackRowSkeleton: React.FC = () => (
  <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#141414]/60 animate-pulse">
    <div className="flex items-center gap-3.5 flex-1 min-w-0">
      <div className="w-12 h-12 rounded-xl bg-[#242424] shrink-0" />
      <div className="space-y-2 flex-1 min-w-0">
        <div className="h-3.5 bg-[#282828] rounded w-3/4" />
        <div className="h-2.5 bg-[#222222] rounded w-1/2" />
      </div>
    </div>
    <div className="w-8 h-3 bg-[#222222] rounded" />
  </div>
);

export const MixCardSkeleton: React.FC = () => (
  <div className="p-4 rounded-2xl bg-[#141414]/60 border border-[#222222]/50 animate-pulse space-y-3">
    <div className="aspect-square rounded-xl bg-[#242424]" />
    <div className="h-4 bg-[#282828] rounded w-2/3" />
    <div className="h-3 bg-[#202020] rounded w-1/2" />
  </div>
);

export const SectionSkeleton: React.FC<{ rows?: number }> = ({ rows = 4 }) => (
  <div className="space-y-4">
    <div className="h-6 bg-[#242424] rounded w-48 animate-pulse" />
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
      {Array.from({ length: rows }).map((_, i) => (
        <TrackRowSkeleton key={`skel-${i}`} />
      ))}
    </div>
  </div>
);
