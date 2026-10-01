import { Notification } from '../models/misc.js';
import User from '../models/User.js';
import { emitToUser } from './realtime.js';

const PREF = { message: 'messages', group_message: 'messages', missed_call: 'calls', call: 'calls', trip_updated: 'tripUpdates', trip_cancelled: 'tripUpdates', trip_joined: 'tripUpdates', trip_left: 'tripUpdates', invitation: 'invitations', join_request: 'invitations', request_accepted: 'invitations', request_rejected: 'invitations' };

export async function notify(userId, { type, actor, title, body, link }) {
  if (String(userId) === String(actor)) return null;
  const key = PREF[type];
  if (key) {
    const u = await User.findById(userId).select('notificationSettings');
    if (u && u.notificationSettings?.[key] === false) return null;
  }
  const n = await Notification.create({ user: userId, actor, type, title, body, link });
  const populated = await n.populate('actor', 'name username profileImage');
  emitToUser(userId, 'notification:new', populated);
  return populated;
}
export const notifyMany = (ids, payload) => Promise.all([...new Set(ids.map(String))].map(id => notify(id, payload)));
