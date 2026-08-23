import { authService } from './authService.js';
import { db } from '../db/schema.js';

export const requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = authHeader.split(' ')[1];
  const payload = authService.verifyToken(token);

  if (!payload || !payload.userId) {
    return res.status(401).json({ error: 'Invalid or expired session token' });
  }

  const user = db.findUserById(payload.userId);
  if (!user || !user.is_active) {
    return res.status(401).json({ error: 'User account not found or inactive' });
  }

  req.user = {
    id: user.id,
    email: user.email,
    name: user.name,
  };

  next();
};

export const optionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    const payload = authService.verifyToken(token);
    if (payload && payload.userId) {
      const user = db.findUserById(payload.userId);
      if (user && user.is_active) {
        req.user = {
          id: user.id,
          email: user.email,
          name: user.name,
        };
      }
    }
  }
  next();
};
