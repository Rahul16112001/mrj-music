import React, { useState } from 'react';
import { Sliders, Sparkles, X, Flame, Compass, Users, Check, RefreshCw } from 'lucide-react';
import { useMusicPlayer } from '../context/MusicPlayerContext';
import { api } from '../services/api';
import { TuneConfig } from '../types';

interface TuneMixModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TuneMixModal: React.FC<TuneMixModalProps> = ({ isOpen, onClose }) => {
  const { currentTrack, queue, playTrack } = useMusicPlayer();
  const [artistVariety, setArtistVariety] = useState(50);
  const [discoveryLevel, setDiscoveryLevel] = useState(40);
  const [energy, setEnergy] = useState(50);
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [isApplying, setIsApplying] = useState(false);

  if (!isOpen) return null;

  const moods = [
    { id: 'relaxed', label: 'Relaxed', emoji: '☕' },
    { id: 'romantic', label: 'Romantic', emoji: '💖' },
    { id: 'workout', label: 'Workout', emoji: '⚡' },
    { id: 'focus', label: 'Focus', emoji: '🧠' },
    { id: 'party', label: 'Party', emoji: '🎉' },
  ];

  const handleApply = async () => {
    setIsApplying(true);
    try {
      const tuneConfig: TuneConfig = {
        artistVariety,
        discoveryLevel,
        energy,
        mood: selectedMood,
      };

      const result = await api.tuneRecommendations(
        tuneConfig,
        currentTrack,
        queue.map(t => t.id)
      );

      if (result.tracks.length > 0) {
        // Start playing tuned queue
        playTrack(result.tracks[0], result.tracks, 'recommendation');
      }
      onClose();
    } catch (e) {
      console.warn('Tune error:', e);
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in select-none">
      <div className="bg-[#141414] border border-[#2a2a2a] rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#222222] pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#ff0000]/10 flex items-center justify-center text-[#ff0000]">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-black text-white">Tune Your Mix</h3>
              <p className="text-xs text-[#888888]">Customize your listening recommendation algorithm</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-[#242424] text-[#aaaaaa] hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 1. Artist Variety Slider */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-white flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-[#ff4e4e]" />
              <span>Artist Variety</span>
            </span>
            <span className="text-[#888888] font-medium">
              {artistVariety < 35 ? 'Focused' : artistVariety > 65 ? 'Wide Mix' : 'Balanced'}
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={artistVariety}
            onChange={(e) => setArtistVariety(Number(e.target.value))}
            className="w-full h-1.5 bg-[#292929] accent-[#ff0000] rounded-lg cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-[#666666] font-semibold">
            <span>Core Artists</span>
            <span>Diverse Artists</span>
          </div>
        </div>

        {/* 2. Discovery Level Slider */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-white flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-[#ff4e4e]" />
              <span>Discovery Level</span>
            </span>
            <span className="text-[#888888] font-medium">
              {discoveryLevel < 35 ? 'Familiar' : discoveryLevel > 65 ? 'Discover' : 'Mixed'}
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={discoveryLevel}
            onChange={(e) => setDiscoveryLevel(Number(e.target.value))}
            className="w-full h-1.5 bg-[#292929] accent-[#ff0000] rounded-lg cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-[#666666] font-semibold">
            <span>Familiar Songs</span>
            <span>New Discoveries</span>
          </div>
        </div>

        {/* 3. Energy / BPM Slider */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-white flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-[#ff4e4e]" />
              <span>Energy Level</span>
            </span>
            <span className="text-[#888888] font-medium">
              {energy < 35 ? 'Chill' : energy > 65 ? 'High Energy' : 'Medium'}
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={energy}
            onChange={(e) => setEnergy(Number(e.target.value))}
            className="w-full h-1.5 bg-[#292929] accent-[#ff0000] rounded-lg cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-[#666666] font-semibold">
            <span>Mellow</span>
            <span>Upbeat / Workout</span>
          </div>
        </div>

        {/* 4. Mood Preset Pills */}
        <div className="space-y-2">
          <span className="text-xs font-bold text-white block">Mood / Activity</span>
          <div className="flex flex-wrap gap-2">
            {moods.map((m) => (
              <button
                key={m.id}
                onClick={() => setSelectedMood(selectedMood === m.id ? null : m.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 border ${
                  selectedMood === m.id
                    ? 'bg-[#ff0000] text-white border-[#ff0000] shadow-md shadow-red-600/30'
                    : 'bg-[#1c1c1c] text-[#aaaaaa] border-[#2c2c2c] hover:text-white'
                }`}
              >
                <span>{m.emoji}</span>
                <span>{m.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-full text-xs font-bold text-[#aaaaaa] hover:text-white hover:bg-[#222222] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            disabled={isApplying}
            className="px-6 py-2 rounded-full text-xs font-bold bg-[#ff0000] text-white hover:bg-[#cc0000] shadow-lg shadow-red-600/30 flex items-center gap-2 transition-all"
          >
            {isApplying ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            <span>Apply Tune</span>
          </button>
        </div>
      </div>
    </div>
  );
};
