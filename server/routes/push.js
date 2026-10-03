import { Router } from 'express';
import { z } from 'zod';
import { PushSubscription } from '../models/misc.js';
import { protect } from '../middleware/auth.js';
import { AppError, wrap } from '../utils/helpers.js';
import { env } from '../config/env.js';
import { pushEnabled, pushToUser } from '../services/push.js';

const r = Router();
r.get('/key', (_req, res) => res.json({ success: true, enabled: pushEnabled, publicKey: pushEnabled ? env.VAPID_PUBLIC_KEY : null }));
r.post('/subscribe', protect, wrap(async (req, res) => {
  if (!pushEnabled) throw new AppError('Push notifications are not configured on this server', 503);
  const d = z.object({ endpoint: z.string().url().refine((u) => u.startsWith('https://'), 'Push endpoint must be https'), keys: z.object({ p256dh: z.string().min(10), auth: z.string().min(10) }) }).parse(req.body);
  await PushSubscription.findOneAndUpdate({ endpoint: d.endpoint }, { user: req.user._id, keys: d.keys, userAgent: String(req.headers['user-agent'] || '').slice(0, 200) }, { upsert: true, new: true, setDefaultsOnInsert: true });
  res.status(201).json({ success: true });
}));
r.post('/unsubscribe', protect, wrap(async (req, res) => {
  const { endpoint } = z.object({ endpoint: z.string().url() }).parse(req.body);
  await PushSubscription.deleteOne({ endpoint, user: req.user._id }); res.json({ success: true });
}));
r.post('/test', protect, wrap(async (req, res) => {
  if (!pushEnabled) throw new AppError('Push notifications are not configured on this server', 503);
  const n = await pushToUser(req.user._id, { title: 'Travel Together', body: 'Push notifications are working 🎉', url: '/settings' }, { force: true });
  if (!n) throw new AppError('No active push subscription found for your account. Enable push on this device first.', 400);
  res.json({ success: true, sent: n });
}));
export default r;
