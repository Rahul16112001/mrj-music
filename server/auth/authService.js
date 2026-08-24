import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { db } from '../db/schema.js';

// JWT Secrets with safe fallback
const JWT_SECRET = process.env.JWT_SECRET || 'mrj_prod_secure_jwt_secret_2026_super_key_fallback_key';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'mrj_prod_secure_refresh_secret_2026_super_key_fallback_key';

const ACCESS_TOKEN_EXPIRY = '15m'; // Short-lived access token
const REFRESH_TOKEN_EXPIRY = '30d'; // Refresh token

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const otpStore = new Map();

export const authService = {
  // 0. Send Signup OTP
  async sendSignupOtp(email, name = '') {
    if (!email || !email.trim()) throw new Error('Email is required');
    const normalizedEmail = email.trim().toLowerCase();

    const existing = await db.findUserByEmail(normalizedEmail);
    if (existing) {
      throw new Error('An account with this email address already exists.');
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes
    otpStore.set(normalizedEmail, { otp, expiresAt, name });

    return {
      status: 'success',
      message: `6-digit verification code generated for ${normalizedEmail}`,
      otp, // Provided for instant verification preview
      expiresAt,
    };
  },

  // 1. Verify OTP & Register User
  async verifySignupOtp(email, otp, password, name, ageGroup = '18-24', gender = 'Prefer not to say', userAgent = '', ip = '') {
    if (!email || !email.trim()) throw new Error('Email is required');
    if (!otp || !otp.trim()) throw new Error('OTP is required');
    if (!password || password.length < 6) throw new Error('Password must be at least 6 characters');

    const normalizedEmail = email.trim().toLowerCase();
    const stored = otpStore.get(normalizedEmail);

    if (!stored || stored.otp !== otp.trim()) {
      throw new Error('Invalid verification code. Please check and try again.');
    }

    if (Date.now() > stored.expiresAt) {
      otpStore.delete(normalizedEmail);
      throw new Error('Verification code has expired. Please request a new code.');
    }

    otpStore.delete(normalizedEmail);

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

  // 2. Login User
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
      const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
      const tokenHash = hashToken(refreshToken);
      const session = await db.findSessionByTokenHash(tokenHash);

      if (!session || session.revoked_at || Number(session.expires_at) < Date.now()) {
        throw new Error('Invalid or revoked session');
      }

      const user = await db.findUserById(session.user_id);
      if (!user) throw new Error('User not found');

      // Rotate tokens
      await db.revokeSession(session.id);
      const newTokens = this.generateTokenPair(user);
      const newHash = hashToken(newTokens.refreshToken);
      await db.createSession(user.id, newHash, session.user_agent, session.ip);

      return {
        token: newTokens.accessToken,
        refreshToken: newTokens.refreshToken,
        user: { id: user.id, name: user.name, email: user.email, createdAt: Number(user.created_at) },
      };
    } catch (err) {
      throw new Error(err.message || 'Invalid or expired refresh token');
    }
  },

  // 4. Real Logout (Revoke Session)
  async logout(refreshToken) {
    if (refreshToken) {
      const tokenHash = hashToken(refreshToken);
      await db.revokeSessionByTokenHash(tokenHash);
    }
    return { success: true, message: 'Logged out and session revoked successfully' };
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

  // 7. Request Password Reset (Secure Token)
  async forgotPassword(email) {
    const normalizedEmail = (email || '').trim().toLowerCase();
    const user = await db.findUserByEmail(normalizedEmail);

    if (user) {
      const { token } = await db.createPasswordResetToken(user.id);
      if (process.env.NODE_ENV !== 'production') {
        return {
          success: true,
          message: 'Password reset instructions sent to registered email address.',
          devToken: token,
        };
      }
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

  // 9. Generate JWT Token Pair (Cryptographically unique jti)
  generateTokenPair(user) {
    const accessToken = jwt.sign(
      { userId: user.id, email: user.email, name: user.name, jti: crypto.randomUUID() },
      JWT_SECRET,
      { expiresIn: ACCESS_TOKEN_EXPIRY }
    );

    const refreshToken = jwt.sign(
      { userId: user.id, jti: crypto.randomUUID() },
      JWT_REFRESH_SECRET,
      { expiresIn: REFRESH_TOKEN_EXPIRY }
    );

    return { accessToken, refreshToken };
  },

  // 10. Verify Access Token
  verifyAccessToken(token) {
    try {
      return jwt.verify(token, JWT_SECRET);
    } catch {
      return null;
    }
  },
};
