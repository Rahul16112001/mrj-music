import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Play,
  ListPlus,
  Radio,
  User,
  Download,
  Trash2,
  Share2,
  PlusCircle,
  MoreVertical,
  Check,
  Ban,
  X,
  Heart
} from 'lucide-react';
import { Track } from '../types';
import { useMusicPlayer } from '../context/MusicPlayerContext';
import { shareService } from '../services/share';
import { syncService } from '../services/syncService';
import { androidLifecycleService } from '../services/androidLifecycleService';
import { ArtworkImage } from './ArtworkImage';

interface TrackContextMenuProps {
  track: Track;
  onOpenPlaylistModal?: (track: Track) => void;
}

export const TrackContextMenu: React.FC<TrackContextMenuProps> = ({ track, onOpenPlaylistModal }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const navigate = useNavigate();

  const {
    playTrack,
    playNextInQueue,
    addToQueue,
    downloadTrack,
    deleteDownloadedTrack,
    downloadedTrackIds,
    toggleFavorite,
    isFavorite,
  } = useMusicPlayer();

  const isDownloaded = downloadedTrackIds.has(track.id);
  const isLiked = isFavorite(track.id);

  // Register with Android back button
  useEffect(() => {
    if (!isOpen) return;
    const unregister = androidLifecycleService.registerBackHandler(() => {
      setIsOpen(false);
      return true;
    });
    return () => unregister();
  }, [isOpen]);

  const handleStartRadio = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(false);
    syncService.queueEvent({
      eventType: 'PLAY_STARTED',
      trackId: track.id,
      title: track.title,
      artist: track.artist,
      source: 'start_radio',
    });
    await playTrack(track);
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await shareService.shareTrack(track);
    setIsCopied(true);
    setTimeout(() => {
      setIsCopied(false);
      setIsOpen(false);
    }, 1200);
  };

  const handleNotInterested = (e: React.MouseEvent) => {
    e.stopPropagation();
    syncService.queueEvent({
      eventType: 'DISLIKE',
      trackId: track.id,
      title: track.title,
      artist: track.artist,
    });
    setIsOpen(false);
  };

  const handleViewArtist = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(false);
    navigate(`/artist/${encodeURIComponent(track.artist)}`);
  };

  return (
    <>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(true);
        }}
        className="p-2 rounded-full hover:bg-white/10 text-[#888888] hover:text-white min-w-[40px] min-h-[40px] flex items-center justify-center transition-colors"
        aria-label="More actions"
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {/* MOBILE BOTTOM SHEET MODAL */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="w-full max-w-lg bg-[#141417] border-t border-[#26262a] rounded-t-3xl p-4 shadow-2xl animate-in slide-in-from-bottom duration-300 select-none overflow-hidden"
            style={{ paddingBottom: 'max(var(--sab), 16px)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag Handle Indicator */}
            <div className="w-10 h-1 bg-[#333338] rounded-full mx-auto mb-4" />

            {/* Track Header Preview */}
            <div className="flex items-center gap-3.5 pb-4 border-b border-[#222226] mb-2">
              <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-[#202024]">
                <ArtworkImage src={track.thumbnail} alt={track.title} className="w-full h-full object-cover" />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-sm font-bold text-white truncate">{track.title}</h4>
                <p className="text-xs text-[#aaaaaa] truncate mt-0.5">{track.artist}</p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 text-[#777777] hover:text-white rounded-full min-w-[40px] min-h-[40px] flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Action Items List (48dp height per row) */}
            <div className="space-y-0.5 max-h-[60vh] overflow-y-auto no-scrollbar">
              {/* Play Next */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  playNextInQueue(track);
                  setIsOpen(false);
                }}
                className="w-full flex items-center gap-3.5 px-3 py-3 rounded-xl hover:bg-white/5 text-white text-xs font-semibold active:bg-white/10 min-h-[48px] transition-colors"
              >
                <Play className="w-4 h-4 text-[#ff0000]" />
                <span>Play next</span>
              </button>

              {/* Add to Queue */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  addToQueue(track);
                  setIsOpen(false);
                }}
                className="w-full flex items-center gap-3.5 px-3 py-3 rounded-xl hover:bg-white/5 text-white text-xs font-semibold active:bg-white/10 min-h-[48px] transition-colors"
              >
                <ListPlus className="w-4 h-4 text-[#ff0000]" />
                <span>Add to queue</span>
              </button>

              {/* Start Radio */}
              <button
                onClick={handleStartRadio}
                className="w-full flex items-center gap-3.5 px-3 py-3 rounded-xl hover:bg-white/5 text-white text-xs font-semibold active:bg-white/10 min-h-[48px] transition-colors"
              >
                <Radio className="w-4 h-4 text-[#ff0000]" />
                <span>Start radio station</span>
              </button>

              {/* Like / Unlike */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFavorite(track);
                }}
                className="w-full flex items-center gap-3.5 px-3 py-3 rounded-xl hover:bg-white/5 text-white text-xs font-semibold active:bg-white/10 min-h-[48px] transition-colors"
              >
                <Heart className={`w-4 h-4 ${isLiked ? 'text-[#ff0000] fill-current' : 'text-[#888888]'}`} />
                <span>{isLiked ? 'Remove from Liked Songs' : 'Save to Liked Songs'}</span>
              </button>

              {/* Download for Offline */}
              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  if (isDownloaded) await deleteDownloadedTrack(track.id);
                  else await downloadTrack(track);
                  setIsOpen(false);
                }}
                className="w-full flex items-center gap-3.5 px-3 py-3 rounded-xl hover:bg-white/5 text-white text-xs font-semibold active:bg-white/10 min-h-[48px] transition-colors"
              >
                {isDownloaded ? (
                  <>
                    <Trash2 className="w-4 h-4 text-rose-400" />
                    <span>Remove download</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 text-emerald-400" />
                    <span>Download for offline</span>
                  </>
                )}
              </button>

              {/* Add to Playlist */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsOpen(false);
                  onOpenPlaylistModal?.(track);
                }}
                className="w-full flex items-center gap-3.5 px-3 py-3 rounded-xl hover:bg-white/5 text-white text-xs font-semibold active:bg-white/10 min-h-[48px] transition-colors"
              >
                <PlusCircle className="w-4 h-4 text-[#aaaaaa]" />
                <span>Add to playlist</span>
              </button>

              {/* View Artist */}
              <button
                onClick={handleViewArtist}
                className="w-full flex items-center gap-3.5 px-3 py-3 rounded-xl hover:bg-white/5 text-white text-xs font-semibold active:bg-white/10 min-h-[48px] transition-colors"
              >
                <User className="w-4 h-4 text-[#aaaaaa]" />
                <span>View artist</span>
              </button>

              {/* Share */}
              <button
                onClick={handleShare}
                className="w-full flex items-center gap-3.5 px-3 py-3 rounded-xl hover:bg-white/5 text-white text-xs font-semibold active:bg-white/10 min-h-[48px] transition-colors"
              >
                {isCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4 text-[#aaaaaa]" />}
                <span>{isCopied ? 'Link copied!' : 'Share'}</span>
              </button>

              {/* Not Interested / Dislike */}
              <button
                onClick={handleNotInterested}
                className="w-full flex items-center gap-3.5 px-3 py-3 rounded-xl hover:bg-white/5 text-rose-400 text-xs font-semibold active:bg-white/10 min-h-[48px] transition-colors"
              >
                <Ban className="w-4 h-4 text-rose-400" />
                <span>Not interested in this song</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
