import webpush from 'web-push';
import { env } from '../config/env.js';
import { PushSubscription } from '../models/misc.js';
import { isOnline } from './realtime.js';

export let pushEnabled = false;
if (env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY) {
  try { webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY); pushEnabled = true; }
  catch (e) { console.error('Web push disabled, invalid VAPID configuration:', e.message); }
}
/** Sends a background push to every device the user enabled. Skipped while the user is online (their open tab already shows it live). */
export async function pushToUser(userId, { title, body, url }, { force = false } = {}) {
  if (!pushEnabled || (!force && isOnline(userId))) return 0;
  const subs = await PushSubscription.find({ user: userId });
  let sent = 0;
  await Promise.all(subs.map(async (s) => {
    try { await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, JSON.stringify({ title, body: String(body || '').slice(0, 140), url: url || '/' }), { TTL: 3600 }); sent++; }
    catch (e) { if (e.statusCode === 404 || e.statusCode === 410) await PushSubscription.deleteOne({ _id: s._id }); else console.error('push failed:', e.statusCode || e.message); }
  }));
  return sent;
}
