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
  Sparkles,
  Ban,
  X
} from 'lucide-react';
import { Track } from '../types';
import { useMusicPlayer } from '../context/MusicPlayerContext';
import { shareService } from '../services/share';
import { syncService } from '../services/syncService';

interface TrackContextMenuProps {
  track: Track;
  onOpenPlaylistModal?: (track: Track) => void;
}

export const TrackContextMenu: React.FC<TrackContextMenuProps> = ({ track, onOpenPlaylistModal }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const {
    playTrack,
    playNextInQueue,
    addToQueue,
    downloadTrack,
    deleteDownloadedTrack,
    downloadedTrackIds,
  } = useMusicPlayer();

  const isDownloaded = downloadedTrackIds.has(track.id);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
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

  return (
    <div className="relative inline-block" ref={menuRef}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="p-1.5 rounded-full hover:bg-[#282828] text-[#aaaaaa] hover:text-white transition-colors"
        title="More actions"
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {isOpen && (
        <>
          {/* Mobile Backdrop & Bottom Sheet */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 lg:hidden"
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(false);
            }}
          />

          <div
            className={`
              fixed lg:absolute bottom-0 lg:bottom-auto right-0 lg:right-0 lg:top-full lg:mt-1.5 
              w-full lg:w-60 bg-[#161616] border-t lg:border border-[#2d2d2d] 
              rounded-t-3xl lg:rounded-2xl shadow-2xl py-3 lg:py-2 z-50 
              animate-in fade-in slide-in-from-bottom-6 lg:slide-in-from-top-2 duration-150 select-none
            `}
          >
            {/* Header with Close on Mobile */}
            <div className="px-4 py-2 border-b border-[#242424] mb-1 flex items-center justify-between">
              <div className="min-w-0 flex-1 pr-2">
                <p className="text-xs font-bold text-white truncate">{track.title}</p>
                <p className="text-[10px] text-[#aaaaaa] truncate">{track.artist}</p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsOpen(false);
                }}
                className="lg:hidden p-1 rounded-full text-[#aaaaaa] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Menu Items */}
            <button
              onClick={handleStartRadio}
              className="w-full px-4 py-2.5 flex items-center gap-3 text-xs font-semibold text-white hover:bg-[#242424] transition-colors text-left"
            >
              <Radio className="w-4 h-4 text-[#ff4e4e]" />
              <span>Start Radio</span>
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                playNextInQueue(track);
                setIsOpen(false);
              }}
              className="w-full px-4 py-2.5 flex items-center gap-3 text-xs font-semibold text-white hover:bg-[#242424] transition-colors text-left"
            >
              <ListPlus className="w-4 h-4 text-[#aaaaaa]" />
              <span>Play Next</span>
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                addToQueue(track);
                setIsOpen(false);
              }}
              className="w-full px-4 py-2.5 flex items-center gap-3 text-xs font-semibold text-white hover:bg-[#242424] transition-colors text-left"
            >
              <Sparkles className="w-4 h-4 text-[#aaaaaa]" />
              <span>Add to Queue</span>
            </button>

            {onOpenPlaylistModal && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenPlaylistModal(track);
                  setIsOpen(false);
                }}
                className="w-full px-4 py-2.5 flex items-center gap-3 text-xs font-semibold text-white hover:bg-[#242424] transition-colors text-left"
              >
                <PlusCircle className="w-4 h-4 text-[#aaaaaa]" />
                <span>Add to Playlist</span>
              </button>
            )}

            <button
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/artist/${encodeURIComponent(track.artist)}`);
                setIsOpen(false);
              }}
              className="w-full px-4 py-2.5 flex items-center gap-3 text-xs font-semibold text-white hover:bg-[#242424] transition-colors text-left"
            >
              <User className="w-4 h-4 text-[#aaaaaa]" />
              <span>Go to Artist</span>
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                if (isDownloaded) {
                  deleteDownloadedTrack(track.id);
                } else {
                  downloadTrack(track);
                }
                setIsOpen(false);
              }}
              className="w-full px-4 py-2.5 flex items-center gap-3 text-xs font-semibold text-white hover:bg-[#242424] transition-colors text-left"
            >
              {isDownloaded ? (
                <>
                  <Trash2 className="w-4 h-4 text-red-400" />
                  <span>Remove Download</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 text-emerald-400" />
                  <span>Download Offline</span>
                </>
              )}
            </button>

            <button
              onClick={handleShare}
              className="w-full px-4 py-2.5 flex items-center gap-3 text-xs font-semibold text-white hover:bg-[#242424] transition-colors text-left"
            >
              {isCopied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-400 font-bold">Link Copied!</span>
                </>
              ) : (
                <>
                  <Share2 className="w-4 h-4 text-[#aaaaaa]" />
                  <span>Share Song</span>
                </>
              )}
            </button>

            <button
              onClick={handleNotInterested}
              className="w-full px-4 py-2.5 flex items-center gap-3 text-xs font-semibold text-[#888888] hover:text-red-400 hover:bg-[#242424] transition-colors text-left border-t border-[#242424] mt-1 pt-2"
            >
              <Ban className="w-4 h-4" />
              <span>Not Interested</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
};
