import React, { useState } from 'react';
import {
  Sparkles,
  Download,
  CheckCircle2,
  X,
  ShieldCheck,
  Zap,
  Loader2,
  ExternalLink
} from 'lucide-react';
import { UpdateInfo, updateService } from '../services/updateService';

interface UpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  updateInfo: UpdateInfo;
}

export const UpdateModal: React.FC<UpdateModalProps> = ({ isOpen, onClose, updateInfo }) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleUpdate = async () => {
    setIsUpdating(true);
    setStatusMessage('Downloading update...');
    try {
      const result = await updateService.performUpdate(updateInfo.apkDownloadUrl, (pct) => {
        setProgress(pct);
      });
      if (result.success) {
        setStatusMessage('Update package triggered. Follow system prompt to install.');
      } else {
        setStatusMessage(result.message);
        setIsUpdating(false);
      }
    } catch (err: any) {
      setStatusMessage('Update failed. Please try again.');
      setIsUpdating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 select-none">
      <div className="w-full max-w-md bg-[#121216] border border-[#2a2a30] rounded-3xl p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
        {/* Header with MRJ Logo & Badge */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl overflow-hidden shadow-lg border border-red-500/30 p-1 bg-black">
              <img src="/logo.png" alt="MRJ Logo" className="w-full h-full object-cover rounded-xl" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-[10px] font-black uppercase tracking-wider">
                  Update Available
                </span>
                <span className="text-xs text-[#888888] font-mono">v{updateInfo.latestVersion}</span>
              </div>
              <h2 className="text-lg font-black text-white tracking-tight mt-0.5">
                {updateInfo.title}
              </h2>
            </div>
          </div>

          {!updateInfo.isMandatory && (
            <button
              onClick={onClose}
              className="p-2 text-[#717171] hover:text-white rounded-full hover:bg-white/5 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Current vs Latest Version Card */}
        <div className="grid grid-cols-2 gap-2 p-3 bg-[#18181f] rounded-2xl border border-white/5 text-center">
          <div>
            <p className="text-[10px] uppercase font-bold text-[#717171]">Current Version</p>
            <p className="text-xs font-mono font-bold text-white mt-0.5">{updateInfo.currentVersion}</p>
          </div>
          <div className="border-l border-white/10">
            <p className="text-[10px] uppercase font-bold text-emerald-400">Latest Version</p>
            <p className="text-xs font-mono font-bold text-emerald-400 mt-0.5">{updateInfo.latestVersion} ({updateInfo.fileSize})</p>
          </div>
        </div>

        {/* Changelog Highlights */}
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-[#aaaaaa] uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>What's New in this Release</span>
          </h3>
          <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1 no-scrollbar text-xs text-[#cccccc]">
            {updateInfo.changelog.map((item, idx) => (
              <div key={idx} className="flex items-start gap-2 bg-[#18181e] p-2.5 rounded-xl border border-white/5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span className="leading-snug">{item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Progress or Status */}
        {statusMessage && (
          <p className="text-xs text-center font-medium text-emerald-400 bg-emerald-950/30 p-2.5 rounded-xl border border-emerald-800/30">
            {statusMessage}
          </p>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-3 pt-1">
          {!updateInfo.isMandatory && (
            <button
              onClick={onClose}
              disabled={isUpdating}
              className="flex-1 py-3 rounded-2xl bg-[#1e1e24] hover:bg-[#282830] text-white font-bold text-xs transition-all active:scale-95"
            >
              Later
            </button>
          )}

          <button
            onClick={handleUpdate}
            disabled={isUpdating}
            className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-[#ff0000] to-rose-600 hover:from-[#e60000] hover:to-rose-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-red-950/40 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
          >
            {isUpdating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>Updating...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4 text-white" />
                <span>Update Now</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
