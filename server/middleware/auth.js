import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { env } from '../config/env.js';
import { AppError, wrap } from '../utils/helpers.js';

export const signToken = (user) => jwt.sign({ id: user._id, v: user.tokenVersion || 0 }, env.JWT_SECRET, { expiresIn: '7d' });

export async function userFromToken(token) {
  let payload;
  try { payload = jwt.verify(token, env.JWT_SECRET); } catch { throw new AppError('Session expired. Please log in again.', 401); }
  const user = await User.findById(payload.id);
  if (!user || (user.tokenVersion || 0) !== (payload.v || 0)) throw new AppError('Session expired. Please log in again.', 401);
  if (user.suspended) throw new AppError('This account has been suspended.', 403);
  return user;
}

export const protect = wrap(async (req, _res, next) => {
  const h = req.headers.authorization || '';
  if (!h.startsWith('Bearer ')) throw new AppError('Authentication required', 401);
  req.user = await userFromToken(h.slice(7));
  next();
});

export const optionalAuth = wrap(async (req, _res, next) => {
  const h = req.headers.authorization || '';
  if (h.startsWith('Bearer ')) { try { req.user = await userFromToken(h.slice(7)); } catch { /* treat as guest */ } }
  next();
});

export const adminOnly = (req, _res, next) => (req.user?.role === 'admin' ? next() : next(new AppError('Admin access required', 403)));
