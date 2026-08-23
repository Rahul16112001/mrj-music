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
  Check
} from 'lucide-react';
import { Track } from '../types';
import { useMusicPlayer } from '../context/MusicPlayerContext';
import { shareService } from '../services/share';

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

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await shareService.shareTrack(track);
    setIsCopied(true);
    setTimeout(() => {
      setIsCopied(false);
      setIsOpen(false);
    }, 1200);
  };

  return (
    <div className="relative inline-block" ref={menuRef}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="p-2 rounded-full hover:bg-[#282828] text-[#aaaaaa] hover:text-white transition-colors"
        title="More actions"
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1.5 w-56 bg-[#1f1f1f] border border-[#333333] rounded-2xl shadow-2xl py-2 z-50 animate-in fade-in zoom-in-95 duration-150 select-none">
          {/* Track Preview Header */}
          <div className="px-3.5 py-2 border-b border-[#2d2d2d] mb-1">
            <p className="text-xs font-bold text-white truncate">{track.title}</p>
            <p className="text-[10px] text-[#aaaaaa] truncate">{track.artist}</p>
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              playNextInQueue(track);
              setIsOpen(false);
            }}
            className="w-full px-3.5 py-2.5 flex items-center gap-3 text-xs font-semibold text-white hover:bg-[#2a2a2a] transition-colors text-left"
          >
            <ListPlus className="w-4 h-4 text-[#ff4e4e]" />
            <span>Play Next</span>
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              addToQueue(track);
              setIsOpen(false);
            }}
            className="w-full px-3.5 py-2.5 flex items-center gap-3 text-xs font-semibold text-white hover:bg-[#2a2a2a] transition-colors text-left"
          >
            <Radio className="w-4 h-4 text-[#aaaaaa]" />
            <span>Add to Queue</span>
          </button>

          {onOpenPlaylistModal && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenPlaylistModal(track);
                setIsOpen(false);
              }}
              className="w-full px-3.5 py-2.5 flex items-center gap-3 text-xs font-semibold text-white hover:bg-[#2a2a2a] transition-colors text-left"
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
            className="w-full px-3.5 py-2.5 flex items-center gap-3 text-xs font-semibold text-white hover:bg-[#2a2a2a] transition-colors text-left"
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
            className="w-full px-3.5 py-2.5 flex items-center gap-3 text-xs font-semibold text-white hover:bg-[#2a2a2a] transition-colors text-left"
          >
            {isDownloaded ? (
              <>
                <Trash2 className="w-4 h-4 text-red-400" />
                <span>Remove Download</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4 text-emerald-400" />
                <span>Download Song</span>
              </>
            )}
          </button>

          <button
            onClick={handleShare}
            className="w-full px-3.5 py-2.5 flex items-center gap-3 text-xs font-semibold text-white hover:bg-[#2a2a2a] transition-colors text-left border-t border-[#2d2d2d] mt-1 pt-2"
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
        </div>
      )}
    </div>
  );
};
