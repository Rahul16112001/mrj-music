import { authService } from './authService.js';
import { db } from '../db/schema.js';

export const requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. Please sign in.' });
  }

  const token = authHeader.split(' ')[1];
  const decoded = authService.verifyAccessToken(token);

  if (!decoded || !decoded.userId) {
    return res.status(401).json({ error: 'Invalid or expired access token. Please re-authenticate.' });
  }

  const user = db.findUserById(decoded.userId);
  if (!user) {
    return res.status(401).json({ error: 'User account not found or deactivated.' });
  }

  req.user = user;
  next();
};

export const optionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    const decoded = authService.verifyAccessToken(token);
    if (decoded && decoded.userId) {
      req.user = db.findUserById(decoded.userId) || null;
    }
  }
  next();
};
