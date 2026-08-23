import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { db } from '../db/schema.js';

const JWT_SECRET = process.env.JWT_SECRET || 'mrj_super_secure_jwt_secret_key_2026';
const TOKEN_EXPIRY = '30d';

export const authService = {
  async register(name, email, password) {
    if (!name || !name.trim()) {
      throw new Error('Name is required');
    }
    if (!email || !email.includes('@')) {
      throw new Error('Valid email address is required');
    }
    if (!password || password.length < 6) {
      throw new Error('Password must be at least 6 characters');
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existing = db.findUserByEmail(normalizedEmail);
    if (existing) {
      throw new Error('An account with this email already exists');
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);
    const id = 'usr_' + crypto.randomUUID();

    const user = db.createUser({
      id,
      name: name.trim(),
      email: normalizedEmail,
      password_hash,
    });

    const token = jwt.sign(
      { userId: user.id, email: user.email, name: user.name },
      JWT_SECRET,
      { expiresIn: TOKEN_EXPIRY }
    );

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.created_at,
      },
      token,
    };
  },

  async login(email, password) {
    if (!email || !password) {
      throw new Error('Email and password are required');
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = db.findUserByEmail(normalizedEmail);
    if (!user) {
      throw new Error('Invalid email or password');
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      throw new Error('Invalid email or password');
    }

    db.updateUser(user.id, { last_login_at: Date.now() });

    const token = jwt.sign(
      { userId: user.id, email: user.email, name: user.name },
      JWT_SECRET,
      { expiresIn: TOKEN_EXPIRY }
    );

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.created_at,
      },
      token,
    };
  },

  async changePassword(userId, currentPassword, newPassword) {
    if (!newPassword || newPassword.length < 6) {
      throw new Error('New password must be at least 6 characters');
    }

    const user = db.findUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isMatch) {
      throw new Error('Incorrect current password');
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(newPassword, salt);
    db.updateUser(userId, { password_hash });

    return { success: true, message: 'Password updated successfully' };
  },

  async deleteAccount(userId, password) {
    const user = db.findUserById(userId);
    if (!user) throw new Error('User not found');

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) throw new Error('Incorrect password');

    db.deleteUser(userId);
    return { success: true, message: 'Account and cloud data deleted successfully' };
  },

  forgotPassword(email) {
    const normalizedEmail = email.trim().toLowerCase();
    const user = db.findUserByEmail(normalizedEmail);
    if (!user) {
      // Don't reveal whether user exists for security
      return { success: true, message: 'If that email is registered, password reset instructions have been sent.' };
    }

    const token = db.createPasswordResetToken(user.id);
    return {
      success: true,
      message: 'Password reset link generated',
      resetToken: token, // In dev environment returned for testing
    };
  },

  async resetPassword(token, newPassword) {
    if (!newPassword || newPassword.length < 6) {
      throw new Error('New password must be at least 6 characters');
    }

    const userId = db.validateResetToken(token);
    if (!userId) {
      throw new Error('Invalid or expired password reset token');
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(newPassword, salt);
    db.updateUser(userId, { password_hash });
    db.markResetTokenUsed(token);

    return { success: true, message: 'Password reset successfully. You can now login.' };
  },

  verifyToken(token) {
    try {
      return jwt.verify(token, JWT_SECRET);
    } catch {
      return null;
    }
  },
};
