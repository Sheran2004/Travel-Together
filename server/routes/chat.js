import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { Conversation, Message, TripMember } from '../models/misc.js';
import Trip from '../models/Trip.js';
import User from '../models/User.js';
import { protect } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';
import { saveUpload } from '../services/storage.js';
import { AppError, wrap, sameId, escapeRegex } from '../utils/helpers.js';
import { assertParticipant, createMessage, getOrCreatePrivate, canMessage, MSG_POPULATE, serializeMessage } from '../services/chat.js';
import { emitToUser, isOnline, getIO } from '../services/realtime.js';
import { removeMember } from '../services/trips.js';

const r = Router();
r.use(protect);

const summarize = async (conv, me) => {
  const unread = await Message.countDocuments({ conversation: conv._id, sender: { $ne: me._id }, readBy: { $ne: me._id }, deleted: false, type: { $ne: 'system' } });
  const o = conv.toObject();
  if (o.lastMessage) o.lastMessage = serializeMessage(o.lastMessage);
  o.unread = unread;
  if (conv.type === 'private') {
    const other = conv.participants.find(p => !sameId(p, me._id));
    if (other) { const vis = other.privacySettings?.showOnlineStatus !== false; o.other = { _id: other._id, name: other.name, username: other.username, profileImage: other.profileImage, online: vis && isOnline(other._id), lastSeen: other.privacySettings?.showLastSeen !== false ? other.lastSeen : undefined }; }
  } else if (conv.trip) {
    const onlineCount = conv.participants.filter(p => isOnline(p._id)).length;
    o.group = { _id: conv.trip._id, title: conv.trip.title, slug: conv.trip.slug, destination: conv.trip.destination, coverImage: conv.trip.coverImage, memberCount: conv.participants.length, onlineCount, creator: conv.trip.creator };
  }
  o.participants = conv.participants.map(p => ({ _id: p._id, name: p.name, username: p.username, profileImage: p.profileImage }));
  return o;
};

r.get('/', wrap(async (req, res) => {
  const convs = await Conversation.find({ participants: req.user._id, $or: [{ lastMessage: { $exists: true } }, { type: 'group' }] }).sort('-lastMessageAt')
    .populate('participants', 'name username profileImage privacySettings lastSeen').populate('trip', 'title slug destination coverImage creator status')
    .populate({ path: 'lastMessage', populate: { path: 'sender', select: 'name' } });
  let items = await Promise.all(convs.filter(c => c.type !== 'group' || (c.trip && c.trip.status !== 'cancelled')).map(c => summarize(c, req.user)));
  const { q } = req.query;
  if (q) { const re = new RegExp(escapeRegex(q), 'i'); items = items.filter(c => re.test(c.other?.name || '') || re.test(c.group?.title || '') || re.test(c.lastMessage?.text || '')); }
  res.json({ success: true, conversations: items, unreadTotal: items.reduce((a, c) => a + c.unread, 0) });
}));

r.post('/private/:userId', wrap(async (req, res) => {
  if (sameId(req.params.userId, req.user._id)) throw new AppError('You cannot message yourself', 400);
  await canMessage(req.user._id, req.params.userId);
  const conv = await getOrCreatePrivate(req.user._id, req.params.userId);
  res.json({ success: true, conversationId: conv._id });
}));

r.get('/:id', wrap(async (req, res) => {
  await assertParticipant(req.params.id, req.user._id);
  const conv = await Conversation.findById(req.params.id).populate('participants', 'name username profileImage privacySettings lastSeen').populate('trip', 'title slug destination coverImage creator status');
  res.json({ success: true, conversation: await summarize(conv, req.user) });
}));

r.get('/:id/messages', wrap(async (req, res) => {
  await assertParticipant(req.params.id, req.user._id);
  const limit = Math.min(60, parseInt(req.query.limit) || 40);
  const f = { conversation: req.params.id, deletedFor: { $ne: req.user._id } };
  if (req.query.before) f.createdAt = { $lt: new Date(req.query.before) };
  if (req.query.search) f.text = new RegExp(escapeRegex(req.query.search), 'i');
  if (req.query.pinned === 'true') f.pinned = true;
  const msgs = await Message.find(f).sort('-createdAt').limit(limit + 1).populate(MSG_POPULATE);
  const hasMore = msgs.length > limit; if (hasMore) msgs.pop();
  res.json({ success: true, messages: msgs.reverse().map(serializeMessage), hasMore });
}));

r.post('/:id/messages', wrap(async (req, res) => {
  const d = z.object({ text: z.string().max(4000).optional().default(''), type: z.enum(['text', 'image', 'file', 'voice']).optional().default('text'), mediaUrl: z.string().url().optional(), fileName: z.string().max(200).optional(), mimeType: z.string().max(100).optional(), duration: z.number().min(0).max(600).optional(), waveform: z.array(z.number()).max(64).optional(), replyTo: z.string().optional() }).parse(req.body);
  const msg = await createMessage({ conversationId: req.params.id, senderId: req.user._id, ...d });
  res.status(201).json({ success: true, message: msg });
}));

r.post('/:id/read', wrap(async (req, res) => {
  const conv = await assertParticipant(req.params.id, req.user._id);
  const unread = await Message.find({ conversation: conv._id, readBy: { $ne: req.user._id } }).select('_id sender');
  if (unread.length) {
    await Message.updateMany({ _id: { $in: unread.map(m => m._id) } }, { $addToSet: { readBy: req.user._id, deliveredTo: req.user._id } });
    conv.participants.forEach(p => emitToUser(p, 'message:read', { conversationId: conv._id, userId: req.user._id, messageIds: unread.map(m => m._id) }));
  }
  res.json({ success: true, count: unread.length });
}));

r.delete('/:id', wrap(async (req, res) => { // "delete conversation" hides history for this user only
  const conv = await assertParticipant(req.params.id, req.user._id);
  if (conv.type === 'group') throw new AppError('Leave the trip to leave its group chat', 400);
  await Message.updateMany({ conversation: conv._id }, { $addToSet: { deletedFor: req.user._id } });
  res.json({ success: true });
}));

/* ---- message-level actions ---- */
export const messageRouter = Router();
messageRouter.use(protect);
const getMsg = async (id, userId) => { const m = await Message.findById(id); if (!m) throw new AppError('Message not found', 404); const conv = await assertParticipant(m.conversation, userId); return { m, conv }; };
const broadcast = async (m, conv, event = 'message:update') => { await m.populate(MSG_POPULATE); const out = serializeMessage(m); conv.participants.forEach(p => emitToUser(p, event, out)); return out; };

messageRouter.delete('/:id', wrap(async (req, res) => {
  const { m, conv } = await getMsg(req.params.id, req.user._id);
  let allowed = sameId(m.sender, req.user._id);
  if (!allowed && conv.type === 'group') { const trip = await Trip.findById(conv.trip); allowed = trip && sameId(trip.creator, req.user._id); } // organizer moderation
  if (!allowed) throw new AppError('You cannot delete this message', 403);
  m.deleted = true; m.pinned = false; await m.save();
  conv.participants.forEach(p => emitToUser(p, 'message:delete', { id: m._id, conversationId: conv._id }));
  res.json({ success: true });
}));
messageRouter.post('/:id/react', wrap(async (req, res) => {
  const { emoji } = z.object({ emoji: z.string().min(1).max(8) }).parse(req.body);
  const { m, conv } = await getMsg(req.params.id, req.user._id);
  const i = m.reactions.findIndex(x => sameId(x.user, req.user._id));
  if (i >= 0 && m.reactions[i].emoji === emoji) m.reactions.splice(i, 1);
  else if (i >= 0) m.reactions[i].emoji = emoji; else m.reactions.push({ user: req.user._id, emoji });
  await m.save(); res.json({ success: true, message: await broadcast(m, conv) });
}));
messageRouter.post('/:id/pin', wrap(async (req, res) => {
  const { m, conv } = await getMsg(req.params.id, req.user._id);
  if (conv.type === 'group') { const trip = await Trip.findById(conv.trip); if (!sameId(trip.creator, req.user._id)) throw new AppError('Only the organizer can pin messages in group chats', 403); }
  m.pinned = !m.pinned; await m.save(); res.json({ success: true, message: await broadcast(m, conv) });
}));

/* ---- uploads ---- */
export const uploads = Router();
uploads.post('/:kind', protect, upload.single('file'), wrap(async (req, res) => {
  const kind = req.params.kind;
  if (!['image', 'voice', 'file'].includes(kind)) throw new AppError('Invalid upload type', 400);
  if (!req.file) throw new AppError('No file received', 400);
  const saved = await saveUpload(req.file, kind);
  res.status(201).json({ success: true, url: saved.url, fileName: req.file.originalname, mimeType: req.file.mimetype, size: req.file.size, provider: saved.provider });
}));
export default r;
