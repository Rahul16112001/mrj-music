import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  UserPlus,
  Mail,
  Lock,
  User,
  AlertCircle,
  Loader2,
  Check,
  ShieldCheck,
  ArrowRight,
  RotateCcw,
  Sparkles,
  Heart
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const AGE_BRACKETS = ['< 18', '18 - 24', '25 - 34', '35 - 44', '45+'];
const GENDER_OPTIONS = ['Male', 'Female', 'Non-Binary', 'Prefer not to say'];

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const { sendSignupOtp, verifySignupOtp } = useAuth();

  const [step, setStep] = useState<'details' | 'otp'>('details');

  // Form Fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [ageGroup, setAgeGroup] = useState('18 - 24');
  const [gender, setGender] = useState('Prefer not to say');

  // OTP Verification
  const [otp, setOtp] = useState('');
  const [generatedOtpHint, setGeneratedOtpHint] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Countdown timer for OTP resend
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => setResendCooldown(prev => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Please enter your full name.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await sendSignupOtp(email.trim(), name.trim());
      if (res.otp) {
        setGeneratedOtpHint(res.otp);
      }
      setResendCooldown(60);
      setStep('otp');
    } catch (err: any) {
      setError(err.message || 'Failed to send verification code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!otp || otp.trim().length !== 6) {
      setError('Please enter the 6-digit verification code.');
      return;
    }

    setIsLoading(true);
    try {
      localStorage.setItem('MRJ_JUST_SIGNED_UP', 'true');
      await verifySignupOtp(
        email.trim(),
        otp.trim(),
        password,
        name.trim(),
        ageGroup,
        gender
      );
      navigate('/');
    } catch (err: any) {
      localStorage.removeItem('MRJ_JUST_SIGNED_UP');
      setError(err.message || 'Verification failed. Please check your code and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0 || isLoading) return;
    setError(null);
    setIsLoading(true);
    try {
      const res = await sendSignupOtp(email.trim(), name.trim());
      if (res.otp) setGeneratedOtpHint(res.otp);
      setResendCooldown(60);
    } catch (err: any) {
      setError(err.message || 'Failed to resend code.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center p-4 select-none animate-in fade-in duration-300">
      <div className="w-full max-w-lg bg-[#121216] border border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl space-y-6">
        
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#ff0000] to-[#ff4e4e] flex items-center justify-center mx-auto shadow-lg shadow-red-600/30">
            {step === 'details' ? (
              <UserPlus className="w-6 h-6 text-white" />
            ) : (
              <ShieldCheck className="w-6 h-6 text-white" />
            )}
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            {step === 'details' ? 'Create Free Account' : 'Verify Your Email'}
          </h1>
          <p className="text-xs text-[#aaaaaa]">
            {step === 'details'
              ? 'Personalize your music taste and sync across all your devices'
              : `We sent a 6-digit verification code to ${email}`}
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-3.5 rounded-xl bg-red-950/50 border border-red-800/60 flex items-center gap-2.5 text-xs text-red-300 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {/* STEP 1: REGISTRATION DETAILS */}
        {step === 'details' ? (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#aaaaaa]">Full Name</label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#717171]" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your full name"
                  className="w-full h-11 pl-10 pr-4 bg-[#1a1a20] border border-white/10 focus:border-[#ff0000] rounded-xl text-sm text-white focus:outline-none transition-all placeholder-[#555555]"
                  autoFocus
                />
              </div>
            </div>

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
                  className="w-full h-11 pl-10 pr-4 bg-[#1a1a20] border border-white/10 focus:border-[#ff0000] rounded-xl text-sm text-white focus:outline-none transition-all placeholder-[#555555]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#aaaaaa]">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#717171]" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min 6 chars"
                    className="w-full h-11 pl-10 pr-4 bg-[#1a1a20] border border-white/10 focus:border-[#ff0000] rounded-xl text-sm text-white focus:outline-none transition-all placeholder-[#555555]"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#aaaaaa]">Confirm Password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#717171]" />
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat password"
                    className="w-full h-11 pl-10 pr-4 bg-[#1a1a20] border border-white/10 focus:border-[#ff0000] rounded-xl text-sm text-white focus:outline-none transition-all placeholder-[#555555]"
                  />
                </div>
              </div>
            </div>

            {/* Age Group Preference */}
            <div className="space-y-1.5 pt-1">
              <label className="text-xs font-bold text-[#aaaaaa] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#ff4e4e]" />
                <span>Age Group (For Tailored Music Picks)</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {AGE_BRACKETS.map((bracket) => (
                  <button
                    key={bracket}
                    type="button"
                    onClick={() => setAgeGroup(bracket)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      ageGroup === bracket
                        ? 'bg-white text-black font-bold shadow-md scale-105'
                        : 'bg-[#1a1a20] hover:bg-[#25252c] text-[#aaaaaa] border border-white/5'
                    }`}
                  >
                    {bracket}
                  </button>
                ))}
              </div>
            </div>

            {/* Gender Preference */}
            <div className="space-y-1.5 pt-1">
              <label className="text-xs font-bold text-[#aaaaaa] flex items-center gap-1.5">
                <Heart className="w-3.5 h-3.5 text-[#ff4e4e]" />
                <span>Gender (For Curated Recommendations)</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {GENDER_OPTIONS.map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGender(g)}
                    className={`py-1.5 px-2 rounded-lg text-xs font-semibold text-center truncate transition-all ${
                      gender === g
                        ? 'bg-[#ff0000] text-white font-bold shadow-md scale-105'
                        : 'bg-[#1a1a20] hover:bg-[#25252c] text-[#aaaaaa] border border-white/5'
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 rounded-xl bg-gradient-to-r from-[#ff0000] to-[#cc0000] hover:brightness-110 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-red-600/30 transition-all hover:scale-[1.01] active:scale-95 mt-2"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span>Continue to Verification</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        ) : (
          /* STEP 2: OTP VERIFICATION */
          <form onSubmit={handleVerifyOtp} className="space-y-5">
            {/* Instant Verification Code Card */}
            {generatedOtpHint && (
              <div className="p-4 rounded-2xl bg-gradient-to-r from-red-950/40 via-[#1e1e24] to-zinc-900 border border-[#ff0000]/30 text-center space-y-1 shadow-inner">
                <p className="text-[11px] font-semibold text-[#aaaaaa] uppercase tracking-wider">
                  Verification Code
                </p>
                <div className="text-2xl font-mono font-black text-white tracking-[0.35em] pl-2">
                  {generatedOtpHint}
                </div>
                <p className="text-[10px] text-zinc-400">Enter this 6-digit code below to confirm your email</p>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-bold text-[#aaaaaa] block text-center">
                Enter 6-Digit Code
              </label>
              <input
                type="text"
                required
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="123456"
                className="w-full h-14 bg-[#1a1a20] border-2 border-white/15 focus:border-[#ff0000] rounded-2xl text-2xl text-center font-mono font-black text-white tracking-[0.5em] focus:outline-none transition-all placeholder-[#444444]"
                autoFocus
              />
            </div>

            <div className="flex items-center justify-between text-xs pt-1">
              <button
                type="button"
                onClick={() => setStep('details')}
                className="text-[#888888] hover:text-white transition-colors"
              >
                ← Edit details
              </button>

              <button
                type="button"
                onClick={handleResendOtp}
                disabled={resendCooldown > 0 || isLoading}
                className="flex items-center gap-1.5 text-[#ff4e4e] hover:text-[#ff7878] disabled:opacity-40 font-semibold transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}</span>
              </button>
            </div>

            <button
              type="submit"
              disabled={isLoading || otp.length !== 6}
              className="w-full h-12 rounded-xl bg-[#ff0000] hover:bg-[#cc0000] disabled:opacity-40 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-red-600/30 transition-all hover:scale-[1.01] active:scale-95"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Verify & Create Account</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* Footer Link */}
        <div className="text-center pt-2 border-t border-white/10">
          <p className="text-xs text-[#aaaaaa]">
            Already have an account?{' '}
            <Link to="/login" className="font-bold text-white hover:text-[#ff4e4e] transition-colors underline">
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};
