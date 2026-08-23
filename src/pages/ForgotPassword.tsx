import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { KeyRound, Mail, Lock, AlertCircle, Loader2, Check } from 'lucide-react';
import { api } from '../services/api';

export const ForgotPasswordPage: React.FC = () => {
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [step, setStep] = useState<'request' | 'reset'>('request');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setIsLoading(true);

    try {
      const res = await api.forgotPassword(email.trim());
      setMessage(res.message);
      if (res.resetToken) {
        setResetToken(res.resetToken);
        setStep('reset');
      }
    } catch (err: any) {
      setError(err.message || 'Request failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const res = await api.resetPassword(resetToken.trim(), newPassword);
      setMessage(res.message);
      setTimeout(() => {
        navigate('/login');
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Password reset failed.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center p-4 select-none">
      <div className="w-full max-w-md bg-[#121212] border border-[#242424] rounded-3xl p-8 shadow-2xl space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-full bg-[#ff0000] flex items-center justify-center mx-auto shadow-lg shadow-red-600/30">
            <KeyRound className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            {step === 'request' ? 'Reset Password' : 'Enter New Password'}
          </h1>
          <p className="text-xs text-[#aaaaaa]">
            {step === 'request'
              ? 'Enter your registered email address to receive password reset instructions'
              : 'Enter your reset token and new secure password'}
          </p>
        </div>

        {/* Message / Error alerts */}
        {message && (
          <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-800/60 flex items-center gap-2.5 text-xs text-emerald-300">
            <Check className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{message}</span>
          </div>
        )}
        {error && (
          <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-800/60 flex items-center gap-2.5 text-xs text-red-300">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Step 1: Request Reset */}
        {step === 'request' && (
          <form onSubmit={handleRequestSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#aaaaaa]">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#717171]" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full h-11 pl-10 pr-4 bg-[#1e1e1e] border border-[#333333] focus:border-[#ff0000] rounded-xl text-sm text-white focus:outline-none transition-all placeholder-[#666666]"
                  autoFocus
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-11 rounded-xl bg-[#ff0000] hover:bg-[#cc0000] disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-red-600/30 transition-all hover:scale-[1.02]"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Send Reset Instructions</span>}
            </button>
          </form>
        )}

        {/* Step 2: Set New Password */}
        {step === 'reset' && (
          <form onSubmit={handleResetSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#aaaaaa]">Reset Token</label>
              <input
                type="text"
                required
                value={resetToken}
                onChange={(e) => setResetToken(e.target.value)}
                placeholder="Reset Token"
                className="w-full h-11 px-4 bg-[#1e1e1e] border border-[#333333] focus:border-[#ff0000] rounded-xl text-xs text-white focus:outline-none transition-all font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#aaaaaa]">New Password (Min 6 characters)</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#717171]" />
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-11 pl-10 pr-4 bg-[#1e1e1e] border border-[#333333] focus:border-[#ff0000] rounded-xl text-sm text-white focus:outline-none transition-all placeholder-[#666666]"
                  autoFocus
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-11 rounded-xl bg-[#ff0000] hover:bg-[#cc0000] disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-red-600/30 transition-all hover:scale-[1.02]"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Reset Password & Login</span>}
            </button>
          </form>
        )}

        {/* Footer */}
        <div className="text-center pt-2 border-t border-[#1f1f1f]">
          <Link to="/login" className="text-xs font-bold text-[#aaaaaa] hover:text-white transition-colors">
            Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
};
