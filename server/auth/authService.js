import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { db } from '../db/schema.js';
import { dbClient } from '../db/client.js';

dotenv.config({ path: '../.env' });

// In production, secrets MUST be explicitly set via environment variables.
// In development, an ephemeral random key is generated per process run (never hardcoded).
const isProd = process.env.NODE_ENV === 'production';
const JWT_SECRET = process.env.JWT_SECRET || (isProd ? null : crypto.randomBytes(32).toString('hex'));
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || (isProd ? null : crypto.randomBytes(32).toString('hex'));

const ACCESS_TOKEN_EXPIRY = '15m'; // Short-lived access token
const REFRESH_TOKEN_EXPIRY = '30d'; // Refresh token

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

// ── DB-backed OTP helpers (survive serverless cold starts) ──────────────────
async function ensureOtpTable() {
  try {
    await dbClient.query(`
      CREATE TABLE IF NOT EXISTS signup_otps (
        email VARCHAR(255) PRIMARY KEY,
        otp VARCHAR(6) NOT NULL,
        name VARCHAR(255),
        expires_at BIGINT NOT NULL,
        created_at BIGINT NOT NULL
      );
    `);
  } catch {}
}

async function storeOtp(email, otp, name, expiresAt) {
  await ensureOtpTable();
  await dbClient.query(
    `INSERT INTO signup_otps (email, otp, name, expires_at, created_at)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (email) DO UPDATE SET otp=$2, name=$3, expires_at=$4, created_at=$5;`,
    [email, otp, name, expiresAt, Date.now()]
  );
}

async function getOtp(email) {
  await ensureOtpTable();
  const res = await dbClient.query('SELECT * FROM signup_otps WHERE email=$1 LIMIT 1;', [email]);
  return res.rows[0] || null;
}

async function deleteOtp(email) {
  try { await dbClient.query('DELETE FROM signup_otps WHERE email=$1;', [email]); } catch {}
}

// ── Resend email sender ─────────────────────────────────────────────────────
async function sendOtpEmail(email, otp, name) {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    console.log(`[DEV OTP] ${email} → ${otp}`);
    return;
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'MRJ Music <onboarding@resend.dev>',
        to: [email],
        subject: `${otp} — Your MRJ Music Verification Code`,
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;background:#0a0a0a;color:#fff;border-radius:16px;">
            <h1 style="color:#e53e3e;margin:0 0 8px">MRJ Music 🎵</h1>
            <p style="color:#aaa;margin:0 0 32px">Email verification</p>
            <p>Hi <strong>${name || 'there'}</strong>,</p>
            <p>Your 6-digit verification code is:</p>
            <div style="font-size:40px;font-weight:bold;letter-spacing:12px;text-align:center;padding:24px;background:#1a1a1a;border-radius:12px;margin:24px 0;">${otp}</div>
            <p style="color:#aaa;font-size:13px;">This code expires in 10 minutes. Do not share it with anyone.</p>
          </div>`,
      }),
    });

    const body = await res.text();
    if (!res.ok) {
      console.error('Resend email failed:', res.status, body);
    } else {
      console.log('Resend email sent:', email, res.status);
    }
  } catch (e) {
    console.error('Resend email error:', e.message);
  }
}

export const authService = {
  validateEnv() {
    if (process.env.NODE_ENV === 'production') {
      if (!process.env.JWT_SECRET || !process.env.JWT_REFRESH_SECRET) {
        throw new Error('FATAL: JWT_SECRET and JWT_REFRESH_SECRET must be configured in environment variables for production.');
      }
      if (process.env.JWT_SECRET.length < 32 || process.env.JWT_REFRESH_SECRET.length < 32) {
        throw new Error('FATAL: JWT_SECRET and JWT_REFRESH_SECRET must be at least 32 characters in production.');
      }
    }
  },

  // 0. Send Signup OTP — DB-backed + Resend email
  async sendSignupOtp(email, name = '') {
    if (!email || !email.trim()) throw new Error('Email is required');
    const normalizedEmail = email.trim().toLowerCase();

    const existing = await db.findUserByEmail(normalizedEmail);
    if (existing) {
      throw new Error('An account with this email address already exists.');
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    await storeOtp(normalizedEmail, otp, name, expiresAt);
    await sendOtpEmail(normalizedEmail, otp, name);

    return {
      status: 'success',
      message: `6-digit verification code sent to ${normalizedEmail}`,
      expiresAt,
    };
  },

  // 1. Verify OTP & Register User
  async verifySignupOtp(email, otp, password, name, ageGroup = '18-24', gender = 'Prefer not to say', userAgent = '', ip = '') {
    if (!email || !email.trim()) throw new Error('Email is required');
    if (!otp || !otp.trim()) throw new Error('OTP is required');
    if (!password || password.length < 6) throw new Error('Password must be at least 6 characters');

    const normalizedEmail = email.trim().toLowerCase();
    const stored = await getOtp(normalizedEmail);

    if (!stored || stored.otp !== otp.trim()) {
      throw new Error('Invalid verification code. Please check and try again.');
    }

    if (Date.now() > Number(stored.expires_at)) {
      await deleteOtp(normalizedEmail);
      throw new Error('Verification code has expired. Please request a new code.');
    }

    await deleteOtp(normalizedEmail);

    return this.register(name || stored.name || 'User', normalizedEmail, password, ageGroup, gender, userAgent, ip);
  },

  // 2. Register User
  async register(name, email, password, ageGroup = '18-24', gender = 'Prefer not to say', userAgent = '', ip = '') {
    if (!name || !name.trim()) throw new Error('Name is required');
    if (!email || !email.trim()) throw new Error('Email is required');
    if (!password || password.length < 6) throw new Error('Password must be at least 6 characters');

    const normalizedEmail = email.trim().toLowerCase();
    const existing = await db.findUserByEmail(normalizedEmail);
    if (existing) {
      throw new Error('An account with this email address already exists.');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = await db.createUser({
      name: name.trim(),
      email: normalizedEmail,
      password_hash: passwordHash,
      age_group: ageGroup,
      gender: gender,
    });

    const tokens = this.generateTokenPair(user);
    const tokenHash = hashToken(tokens.refreshToken);
    await db.createSession(user.id, tokenHash, userAgent, ip);

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        ageGroup: user.age_group || ageGroup,
        gender: user.gender || gender,
        createdAt: Number(user.created_at),
      },
      token: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  },

  // 2. Login User (Strict auth, never creates account silently on failure)
  async login(email, password, userAgent = '', ip = '') {
    if (!email || !password) throw new Error('Email and password are required');

    const normalizedEmail = email.trim().toLowerCase();
    const user = await db.findUserByEmail(normalizedEmail);
    if (!user) throw new Error('Invalid email or password');

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) throw new Error('Invalid email or password');

    await db.updateUser(user.id, { last_login_at: Date.now() });

    const tokens = this.generateTokenPair(user);
    const tokenHash = hashToken(tokens.refreshToken);
    await db.createSession(user.id, tokenHash, userAgent, ip);

    return {
      user: { id: user.id, name: user.name, email: user.email, createdAt: Number(user.created_at) },
      token: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  },

  // 3. Refresh Access Token
  async refreshAccessToken(refreshToken) {
    if (!refreshToken) throw new Error('Refresh token is required');

    try {
      const activeSecret = process.env.JWT_REFRESH_SECRET || JWT_REFRESH_SECRET;
      const decoded = jwt.verify(refreshToken, activeSecret);
      const tokenHash = hashToken(refreshToken);
      const session = await db.findSessionByTokenHash(tokenHash);

      if (!session) {
        throw new Error('Session revoked or expired');
      }

      const user = await db.findUserById(decoded.userId);
      if (!user) {
        throw new Error('User no longer exists');
      }

      // Rotate Refresh Token for security
      await db.revokeSession(session.id);

      const tokens = this.generateTokenPair(user);
      const newTokenHash = hashToken(tokens.refreshToken);
      await db.createSession(user.id, newTokenHash, session.user_agent, session.ip);

      return {
        token: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      };
    } catch (err) {
      throw new Error(`Token refresh failed: ${err.message}`);
    }
  },

  // 4. Logout / Revoke Session
  async logout(refreshToken) {
    if (!refreshToken) return { success: true };
    try {
      const tokenHash = hashToken(refreshToken);
      await db.revokeSessionByTokenHash(tokenHash);
      return { success: true, message: 'Logged out successfully' };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  // 5. Change Password
  async changePassword(userId, currentPassword, newPassword) {
    const user = await db.findUserById(userId);
    if (!user) throw new Error('User not found');

    const isValid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isValid) throw new Error('Incorrect current password');

    if (!newPassword || newPassword.length < 6) {
      throw new Error('New password must be at least 6 characters');
    }

    const salt = await bcrypt.genSalt(10);
    const newHash = await bcrypt.hash(newPassword, salt);

    await db.updateUser(userId, { password_hash: newHash });
    await db.revokeAllUserSessions(userId);

    return { success: true, message: 'Password updated successfully. All other sessions logged out.' };
  },

  // 6. Delete Account
  async deleteAccount(userId, password) {
    const user = await db.findUserById(userId);
    if (!user) throw new Error('User not found');

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) throw new Error('Incorrect password');

    await db.deleteUser(userId);
    return { success: true, message: 'Account and associated cloud data permanently deleted.' };
  },

  // 7. Request Password Reset (Secure Token, never returned in response)
  async forgotPassword(email) {
    const normalizedEmail = (email || '').trim().toLowerCase();
    const user = await db.findUserByEmail(normalizedEmail);

    if (user) {
      await db.createPasswordResetToken(user.id);
    }

    return {
      success: true,
      message: 'If an account exists with that email, password reset instructions have been sent.',
    };
  },

  // 8. Reset Password with Token
  async resetPassword(token, newPassword) {
    if (!token || !newPassword || newPassword.length < 6) {
      throw new Error('Valid token and new password (min 6 characters) are required');
    }

    const userId = await db.validateAndUseResetToken(token);
    if (!userId) throw new Error('Invalid or expired reset token');

    const salt = await bcrypt.genSalt(10);
    const newHash = await bcrypt.hash(newPassword, salt);

    await db.updateUser(userId, { password_hash: newHash });
    await db.revokeAllUserSessions(userId);

    return { success: true, message: 'Password reset successfully. You may now log in with your new password.' };
  },

  // 9. Generate JWT Token Pair
  generateTokenPair(user) {
    const activeSecret = process.env.JWT_SECRET || JWT_SECRET;
    const activeRefreshSecret = process.env.JWT_REFRESH_SECRET || JWT_REFRESH_SECRET;

    const accessToken = jwt.sign(
      { userId: user.id, email: user.email, name: user.name, jti: crypto.randomUUID() },
      activeSecret,
      { expiresIn: ACCESS_TOKEN_EXPIRY }
    );

    const refreshToken = jwt.sign(
      { userId: user.id, jti: crypto.randomUUID() },
      activeRefreshSecret,
      { expiresIn: REFRESH_TOKEN_EXPIRY }
    );

    return { accessToken, refreshToken };
  },

  // 10. Verify Access Token
  verifyAccessToken(token) {
    try {
      const activeSecret = process.env.JWT_SECRET || JWT_SECRET;
      return jwt.verify(token, activeSecret);
    } catch {
      return null;
    }
  },
};
