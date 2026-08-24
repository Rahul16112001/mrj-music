import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User as UserIcon,
  Mail,
  Calendar,
  Lock,
  Trash2,
  LogOut,
  ShieldCheck,
  Check,
  AlertCircle,
  Loader2,
  Heart,
  ListMusic,
  Clock
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useMusicPlayer } from '../context/MusicPlayerContext';

export const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout, changePassword, deleteAccount, updatePreferredName } = useAuth();
  const { likedTrackIds, playlists } = useMusicPlayer();

  const [preferredName, setPreferredName] = useState(user?.preferredName || user?.name || '');
  const [nameSavedMsg, setNameSavedMsg] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [deletePassword, setDeletePassword] = useState('');

  const [pwStatus, setPwStatus] = useState<{ success?: boolean; message?: string } | null>(null);
  const [deleteStatus, setDeleteStatus] = useState<string | null>(null);
  const [isChangingPw, setIsChangingPw] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  if (!user) {
    navigate('/login');
    return null;
  }

  const handleSaveName = (e: React.FormEvent) => {
    e.preventDefault();
    if (preferredName.trim()) {
      updatePreferredName(preferredName.trim());
      setNameSavedMsg(true);
      setTimeout(() => setNameSavedMsg(false), 3000);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwStatus(null);

    if (newPassword.length < 6) {
      setPwStatus({ success: false, message: 'New password must be at least 6 characters.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwStatus({ success: false, message: 'New passwords do not match.' });
      return;
    }

    setIsChangingPw(true);
    try {
      const res = await changePassword(currentPassword, newPassword);
      setPwStatus({ success: true, message: res.message });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPwStatus({ success: false, message: err.message });
    } finally {
      setIsChangingPw(false);
    }
  };

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeleteStatus(null);

    if (!deletePassword) {
      setDeleteStatus('Please enter your password to confirm deletion.');
      return;
    }

    if (window.confirm('Are you absolutely sure you want to delete your account? All your cloud likes, playlists, and history will be permanently deleted.')) {
      setIsDeleting(true);
      try {
        await deleteAccount(deletePassword);
        navigate('/');
      } catch (err: any) {
        setDeleteStatus(err.message || 'Failed to delete account.');
      } finally {
        setIsDeleting(false);
      }
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div className="p-4 md:p-8 space-y-10 max-w-4xl mx-auto pb-40 select-none">
      {/* Profile Header */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-6 bg-[#121212] border border-[#212121] p-6 md:p-8 rounded-3xl shadow-xl">
        <div className="flex items-center gap-5">
          <div className="w-20 h-20 rounded-full bg-[#ff0000] flex items-center justify-center text-white text-3xl font-black shadow-lg shadow-red-600/30">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div className="space-y-1 text-left">
            <h1 className="text-2xl font-black text-white">{user.name}</h1>
            <p className="text-xs text-[#aaaaaa] flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5" />
              <span>{user.email}</span>
            </p>
            <p className="text-[11px] text-[#717171] flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              <span>Member since {new Date(user.createdAt).toLocaleDateString()}</span>
            </p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="px-5 py-2.5 rounded-full bg-[#212121] hover:bg-[#2e2e2e] border border-[#333333] text-xs font-bold text-[#aaaaaa] hover:text-white flex items-center gap-2 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>

      {/* Cloud Library Statistics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-[#141414] border border-[#242424] flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#ff0000]/10 text-[#ff4e4e] flex items-center justify-center">
            <Heart className="w-6 h-6 fill-current" />
          </div>
          <div>
            <p className="text-2xl font-black text-white">{likedTrackIds.size}</p>
            <p className="text-xs font-semibold text-[#aaaaaa]">Cloud Liked Songs</p>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-[#141414] border border-[#242424] flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
            <ListMusic className="w-6 h-6" />
          </div>
          <div>
            <p className="text-2xl font-black text-white">{playlists.length}</p>
            <p className="text-xs font-semibold text-[#aaaaaa]">Cloud Playlists</p>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-[#141414] border border-[#242424] flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-black text-emerald-400 uppercase tracking-wider">Active</p>
            <p className="text-xs font-semibold text-[#aaaaaa]">Multi-Device Cloud Sync</p>
          </div>
        </div>
      </div>

      {/* Preferred Callout Name Section */}
      <section className="space-y-4 bg-[#121212] border border-[#212121] p-6 rounded-3xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <UserIcon className="w-5 h-5 text-[#ff4e4e]" />
            <span>Preferred Callout Name</span>
          </h2>
          {nameSavedMsg && (
            <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
              <Check className="w-3.5 h-3.5" />
              <span>Saved!</span>
            </span>
          )}
        </div>
        <p className="text-xs text-[#aaaaaa]">
          This is the name MRJ Music uses to greet and call you throughout your personal dashboard and mixes.
        </p>

        <form onSubmit={handleSaveName} className="flex flex-col sm:flex-row gap-3 max-w-md">
          <input
            type="text"
            required
            value={preferredName}
            onChange={(e) => setPreferredName(e.target.value)}
            placeholder="e.g. Shivam"
            className="flex-1 h-11 px-4 bg-[#1e1e1e] border border-[#333333] focus:border-[#ff0000] rounded-xl text-sm text-white focus:outline-none transition-all placeholder-[#555555]"
          />
          <button
            type="submit"
            className="px-5 h-11 bg-[#ff0000] hover:bg-[#cc0000] text-white text-xs font-bold rounded-xl transition-all active:scale-95 shrink-0"
          >
            Save Name
          </button>
        </form>
      </section>

      {/* Change Password Form */}
      <section className="space-y-4 bg-[#121212] border border-[#212121] p-6 rounded-3xl">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Lock className="w-5 h-5 text-[#ff4e4e]" />
          <span>Change Password</span>
        </h2>

        {pwStatus && (
          <div className={`p-3.5 rounded-xl border flex items-center gap-2.5 text-xs ${
            pwStatus.success
              ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
              : 'bg-red-950/40 border-red-800/60 text-red-300'
          }`}>
            {pwStatus.success ? <Check className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-red-400" />}
            <span>{pwStatus.message}</span>
          </div>
        )}

        <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#aaaaaa]">Current Password</label>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full h-10 px-3.5 bg-[#1e1e1e] border border-[#333333] focus:border-[#ff0000] rounded-xl text-xs text-white focus:outline-none transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#aaaaaa]">New Password (Min 6 characters)</label>
            <input
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full h-10 px-3.5 bg-[#1e1e1e] border border-[#333333] focus:border-[#ff0000] rounded-xl text-xs text-white focus:outline-none transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#aaaaaa]">Confirm New Password</label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full h-10 px-3.5 bg-[#1e1e1e] border border-[#333333] focus:border-[#ff0000] rounded-xl text-xs text-white focus:outline-none transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={isChangingPw}
            className="px-5 py-2.5 rounded-xl bg-[#212121] hover:bg-[#2e2e2e] border border-[#333333] text-white font-bold text-xs flex items-center gap-2 transition-colors disabled:opacity-50"
          >
            {isChangingPw ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
            <span>Update Password</span>
          </button>
        </form>
      </section>

      {/* Delete Account Section */}
      <section className="space-y-4 bg-red-950/20 border border-red-900/40 p-6 rounded-3xl">
        <h2 className="text-lg font-bold text-red-400 flex items-center gap-2">
          <Trash2 className="w-5 h-5" />
          <span>Delete Account</span>
        </h2>
        <p className="text-xs text-[#aaaaaa]">
          Permanently delete your account and all associated cloud data (likes, playlists, history, taste profile). This action cannot be undone.
        </p>

        {deleteStatus && (
          <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-800/60 flex items-center gap-2.5 text-xs text-red-300">
            <AlertCircle className="w-4 h-4 text-red-400" />
            <span>{deleteStatus}</span>
          </div>
        )}

        <form onSubmit={handleDeleteAccount} className="space-y-3 max-w-md">
          <input
            type="password"
            required
            value={deletePassword}
            onChange={(e) => setDeletePassword(e.target.value)}
            placeholder="Enter your password to confirm"
            className="w-full h-10 px-3.5 bg-[#1e1e1e] border border-red-900/50 focus:border-red-500 rounded-xl text-xs text-white focus:outline-none transition-all"
          />

          <button
            type="submit"
            disabled={isDeleting}
            className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-2 transition-all shadow-md shadow-red-600/20"
          >
            {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            <span>Permanently Delete Account</span>
          </button>
        </form>
      </section>
    </div>
  );
};
