import { Router } from 'express';
import { z } from 'zod';
import User from '../models/User.js';
import Trip from '../models/Trip.js';
import { Connection, Invitation, Notification, Report, TripMember, Call, Conversation, Message } from '../models/misc.js';
import { protect } from '../middleware/auth.js';
import { AppError, wrap, sameId } from '../utils/helpers.js';
import { notify } from '../services/notify.js';
import { addMember } from '../services/trips.js';

/* ================= connections ================= */
export const connections = Router();
connections.use(protect);
connections.get('/', wrap(async (req, res) => {
  const me = req.user._id;
  const all = await Connection.find({ $or: [{ requester: me }, { recipient: me }] }).populate('requester recipient', 'name username profileImage city travelStyle').sort('-updatedAt');
  const other = (c) => (sameId(c.requester, me) ? c.recipient : c.requester);
  const accepted = all.filter(c => c.status === 'accepted').map(c => ({ connectionId: c._id, user: other(c) }));
  const incoming = all.filter(c => c.status === 'pending' && sameId(c.recipient, me)).map(c => ({ connectionId: c._id, user: c.requester }));
  const outgoing = all.filter(c => c.status === 'pending' && sameId(c.requester, me)).map(c => ({ connectionId: c._id, user: c.recipient }));
  // previous travel partners: people from ended trips I joined; upcoming partners: from upcoming trips
  const mine = await TripMember.find({ user: me }).populate('trip', 'title slug destination startDate endDate status').lean();
  const partners = { previous: new Map(), upcoming: new Map() };
  for (const m of mine) {
    if (!m.trip || m.trip.status === 'cancelled') continue;
    const bucket = new Date(m.trip.endDate) < new Date() ? partners.previous : partners.upcoming;
    const others = await TripMember.find({ trip: m.trip._id, user: { $ne: me } }).populate('user', 'name username profileImage city').lean();
    others.forEach(o => { if (o.user && !bucket.has(String(o.user._id))) bucket.set(String(o.user._id), { user: o.user, trip: m.trip }); });
  }
  res.json({ success: true, accepted, incoming, outgoing, previousPartners: [...partners.previous.values()], upcomingPartners: [...partners.upcoming.values()] });
}));
connections.post('/:id/request', wrap(async (req, res) => {
  const target = await User.findOne({ _id: req.params.id, suspended: false }).select('blocked');
  if (!target || sameId(target._id, req.user._id)) throw new AppError('Traveler not found', 404);
  if (target.blocked.some(b => sameId(b, req.user._id)) || req.user.blocked.some(b => sameId(b, target._id))) throw new AppError('You cannot connect with this user', 403);
  const existing = await Connection.findOne({ $or: [{ requester: req.user._id, recipient: target._id }, { requester: target._id, recipient: req.user._id }] });
  if (existing) throw new AppError(existing.status === 'accepted' ? 'Already connected' : 'A request already exists', 409);
  const c = await Connection.create({ requester: req.user._id, recipient: target._id });
  await notify(target._id, { type: 'connection', actor: req.user._id, title: 'Connection request', body: `${req.user.name} wants to connect`, link: '/network' });
  res.status(201).json({ success: true, connection: c });
}));
connections.post('/:id/accept', wrap(async (req, res) => {
  const c = await Connection.findOneAndUpdate({ requester: req.params.id, recipient: req.user._id, status: 'pending' }, { status: 'accepted' }, { new: true });
  if (!c) throw new AppError('Request not found', 404);
  await notify(c.requester, { type: 'connection_accepted', actor: req.user._id, title: 'Connection accepted', body: `${req.user.name} accepted your request`, link: `/travelers/${req.user.username}` });
  res.json({ success: true });
}));
connections.post('/:id/reject', wrap(async (req, res) => {
  const c = await Connection.findOneAndDelete({ requester: req.params.id, recipient: req.user._id, status: 'pending' });
  if (!c) throw new AppError('Request not found', 404);
  res.json({ success: true });
}));
connections.delete('/:id', wrap(async (req, res) => {
  await Connection.deleteOne({ $or: [{ requester: req.user._id, recipient: req.params.id }, { requester: req.params.id, recipient: req.user._id }] });
  res.json({ success: true });
}));

/* ================= invitations ================= */
export const invitations = Router();
invitations.use(protect);
invitations.post('/:id/:action', wrap(async (req, res) => {
  if (!['accept', 'decline'].includes(req.params.action)) throw new AppError('Invalid action', 400);
  const inv = await Invitation.findOne({ _id: req.params.id, to: req.user._id, status: 'pending' }).populate('trip');
  if (!inv) throw new AppError('Invitation not found or already answered', 404);
  if (req.params.action === 'accept') {
    await addMember(inv.trip._id, req.user._id); // enforces capacity / started / status
    inv.status = 'accepted';
    await notify(inv.trip.creator, { type: 'invitation', actor: req.user._id, title: 'Invitation accepted', body: `${req.user.name} accepted an invitation to ${inv.trip.title}`, link: `/trips/${inv.trip.slug}` });
  } else inv.status = 'declined';
  await inv.save();
  res.json({ success: true, status: inv.status, tripSlug: inv.trip.slug });
}));

/* ================= notifications ================= */
export const notifications = Router();
notifications.use(protect);
notifications.get('/', wrap(async (req, res) => {
  const [items, unread] = await Promise.all([Notification.find({ user: req.user._id }).sort('-createdAt').limit(100).populate('actor', 'name username profileImage'), Notification.countDocuments({ user: req.user._id, read: false })]);
  res.json({ success: true, notifications: items, unread });
}));
notifications.put('/read-all', wrap(async (req, res) => { await Notification.updateMany({ user: req.user._id, read: false }, { read: true }); res.json({ success: true }); }));
notifications.put('/:id/read', wrap(async (req, res) => {
  const n = await Notification.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, { read: true }, { new: true });
  if (!n) throw new AppError('Notification not found', 404); res.json({ success: true, notification: n });
}));
notifications.delete('/:id', wrap(async (req, res) => { await Notification.deleteOne({ _id: req.params.id, user: req.user._id }); res.json({ success: true }); }));

/* ================= reports ================= */
export const reports = Router();
reports.use(protect);
reports.post('/', wrap(async (req, res) => {
  const d = z.object({ targetType: z.enum(['user', 'trip', 'message']), targetId: z.string().min(1), category: z.enum(['Spam', 'Harassment', 'Fake profile', 'Scam', 'Inappropriate content', 'Other']), details: z.string().max(1000).optional().default('') }).parse(req.body);
  const doc = { reporter: req.user._id, targetType: d.targetType, category: d.category, details: d.details };
  if (d.targetType === 'user') { if (sameId(d.targetId, req.user._id)) throw new AppError('You cannot report yourself', 400); if (!(await User.exists({ _id: d.targetId }))) throw new AppError('User not found', 404); doc.targetUser = d.targetId; }
  if (d.targetType === 'trip') { const t = await Trip.findById(d.targetId); if (!t) throw new AppError('Trip not found', 404); doc.targetTrip = t._id; doc.targetUser = t.creator; }
  if (d.targetType === 'message') { const m = await Message.findById(d.targetId); if (!m) throw new AppError('Message not found', 404); const conv = await Conversation.findById(m.conversation); if (!conv?.participants.some(p => sameId(p, req.user._id))) throw new AppError('Message not found', 404); doc.targetUser = m.sender; }
  const dup = await Report.exists({ reporter: req.user._id, status: 'open', targetType: d.targetType, targetUser: doc.targetUser, targetTrip: doc.targetTrip });
  if (dup) throw new AppError('You already have an open report for this', 409);
  const report = await Report.create(doc);
  res.status(201).json({ success: true, message: 'Report received. Our team will review it.', reportId: report._id });
}));
reports.get('/mine', wrap(async (req, res) => {
  const items = await Report.find({ reporter: req.user._id }).sort('-createdAt').populate('targetUser', 'name username').populate('targetTrip', 'title slug');
  res.json({ success: true, reports: items });
}));

/* ================= calls (history) ================= */
export const calls = Router();
calls.use(protect);
calls.get('/', wrap(async (req, res) => {
  const items = await Call.find({ $or: [{ caller: req.user._id }, { receiver: req.user._id }] }).sort('-createdAt').limit(50).populate('caller receiver', 'name username profileImage');
  res.json({ success: true, calls: items });
}));
