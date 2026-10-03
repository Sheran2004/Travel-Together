import { Conversation, Message, Connection, TripMember } from '../models/misc.js';
import User from '../models/User.js';
import { AppError, sameId } from '../utils/helpers.js';
import { emitToUser, isOnline } from './realtime.js';
import { Notification } from '../models/misc.js';
import { pushToUser } from './push.js';
import { emitToUser as emit } from './realtime.js';

export const MSG_POPULATE = [
  { path: 'sender', select: 'name username profileImage' },
  { path: 'replyTo', select: 'text type sender deleted', populate: { path: 'sender', select: 'name' } },
  { path: 'invitation', populate: { path: 'trip', select: 'title slug destination coverImage startDate' } }
];

export function serializeMessage(m) {
  const o = m.toObject ? m.toObject() : m;
  if (o.deleted) { o.text = ''; o.mediaUrl = undefined; o.waveform = []; o.fileName = undefined; }
  return o;
}

export async function canMessage(senderId, recipientId) {
  const [sender, recipient] = await Promise.all([User.findById(senderId).select('blocked'), User.findById(recipientId).select('blocked suspended privacySettings')]);
  if (!recipient || recipient.suspended) throw new AppError('This traveler is unavailable', 404);
  if (sender.blocked.some(b => sameId(b, recipientId)) || recipient.blocked.some(b => sameId(b, senderId))) throw new AppError('You cannot message this user', 403);
  const who = recipient.privacySettings?.whoCanMessage || 'everyone';
  if (who === 'nobody') throw new AppError('This traveler is not accepting messages', 403);
  if (who === 'connections') {
    const c = await Connection.findOne({ status: 'accepted', $or: [{ requester: senderId, recipient: recipientId }, { requester: recipientId, recipient: senderId }] });
    if (!c) throw new AppError('This traveler only accepts messages from connections', 403);
  }
  if (who === 'shared-trips') {
    const mine = await TripMember.find({ user: senderId }).distinct('trip');
    const shared = await TripMember.exists({ user: recipientId, trip: { $in: mine } });
    if (!shared) throw new AppError('This traveler only accepts messages from people on shared trips', 403);
  }
  return true;
}

export async function getOrCreatePrivate(a, b) {
  const [x, y] = [String(a), String(b)].sort();
  const pairKey = `${x}:${y}`;
  let conv = await Conversation.findOne({ pairKey });
  if (!conv) {
    try { conv = await Conversation.create({ type: 'private', participants: [x, y], pairKey }); }
    catch (e) { if (e.code === 11000) conv = await Conversation.findOne({ pairKey }); else throw e; }
  }
  return conv;
}

export async function assertParticipant(convId, userId) {
  const conv = await Conversation.findById(convId);
  if (!conv || !conv.participants.some(p => sameId(p, userId))) throw new AppError('Conversation not found', 404);
  return conv;
}

export async function createMessage({ conversationId, senderId, type = 'text', text = '', mediaUrl, fileName, mimeType, duration, waveform, replyTo, invitation }) {
  const conv = await assertParticipant(conversationId, senderId);
  if (conv.type === 'private') {
    const other = conv.participants.find(p => !sameId(p, senderId));
    await canMessage(senderId, other);
  }
  if (type === 'text' && !String(text).trim()) throw new AppError('Message cannot be empty', 400);
  if (['image', 'file', 'voice'].includes(type) && !mediaUrl) throw new AppError('Media is required', 400);
  if (replyTo) { const r = await Message.findOne({ _id: replyTo, conversation: conv._id }); if (!r) replyTo = undefined; }
  const msg = await Message.create({ conversation: conv._id, sender: senderId, type, text: String(text).trim(), mediaUrl, fileName, mimeType, duration, waveform: (waveform || []).slice(0, 64), replyTo, invitation, readBy: [senderId] });
  const others = conv.participants.filter(p => !sameId(p, senderId));
  const online = others.filter(p => isOnline(p));
  if (online.length) { msg.deliveredTo = online; await msg.save(); }
  conv.lastMessage = msg._id; conv.lastMessageAt = msg.createdAt; await conv.save();
  await msg.populate(MSG_POPULATE);
  const out = serializeMessage(msg);
  conv.participants.forEach(p => emitToUser(p, 'message:receive', out));

  // notifications (collapsed: one unread notification per conversation & sender)
  const sender = out.sender;
  const recipients = await User.find({ _id: { $in: others } }).select('restricted notificationSettings blocked');
  for (const r of recipients) {
    if (r.notificationSettings?.messages === false) continue;
    if (r.restricted.some(x => sameId(x, senderId))) continue;
    if (r.blocked.some(x => sameId(x, senderId))) continue;
    const link = `/messages/${conv._id}`;
    const pushTitle = conv.type === 'group' ? 'New group message' : `New message from ${sender.name}`;
    const preview = type === 'text' ? out.text.slice(0, 80) : type === 'voice' ? '🎤 Voice message' : type === 'image' ? '📷 Photo' : type === 'invite' ? 'Sent a trip invitation' : '📎 File';
    const existing = await Notification.findOneAndUpdate({ user: r._id, type: conv.type === 'group' ? 'group_message' : 'message', actor: senderId, link, read: false }, { body: preview, updatedAt: new Date() }, { new: true });
    pushToUser(r._id, { title: pushTitle, body: preview, url: link }).catch(() => {});
    if (existing) { await existing.populate('actor', 'name username profileImage'); emit(r._id, 'notification:new', existing); }
    else {
      const n = await Notification.create({ user: r._id, actor: senderId, type: conv.type === 'group' ? 'group_message' : 'message', title: conv.type === 'group' ? 'New group message' : `New message from ${sender.name}`, body: preview, link });
      await n.populate('actor', 'name username profileImage'); emit(r._id, 'notification:new', n);
    }
  }
  return out;
}

export async function systemMessage(conversationId, text) {
  const conv = await Conversation.findById(conversationId);
  if (!conv) return;
  const msg = await Message.create({ conversation: conv._id, sender: conv.participants[0], type: 'system', text });
  conv.lastMessage = msg._id; conv.lastMessageAt = msg.createdAt; await conv.save();
  await msg.populate(MSG_POPULATE);
  conv.participants.forEach(p => emitToUser(p, 'message:receive', serializeMessage(msg)));
}
