import { Router } from 'express';
import { z } from 'zod';
import User from '../models/User.js';
import Trip from '../models/Trip.js';
import { Report, Message, TripMember, Favorite, JoinRequest, Expense, Conversation, Call, TripPhoto, TripNote, Category } from '../models/misc.js';
import { protect, adminOnly } from '../middleware/auth.js';
import { AppError, wrap, escapeRegex, paginate } from '../utils/helpers.js';
import { notifyMany } from '../services/notify.js';
import { onlineIds } from '../services/realtime.js';

const r = Router();
r.use(protect, adminOnly); // server-side authorization for every admin endpoint

r.get('/stats', wrap(async (_req, res) => {
  const now = new Date(), day = new Date(Date.now() - 864e5);
  const [users, trips, active, completed, cancelled, openReports, reportedUsers, reportedTrips, messages24h, calls24h, newUsers7d] = await Promise.all([
    User.countDocuments(), Trip.countDocuments(), Trip.countDocuments({ status: 'active', endDate: { $gte: now } }),
    Trip.countDocuments({ $or: [{ status: 'completed' }, { status: 'active', endDate: { $lt: now } }] }), Trip.countDocuments({ status: 'cancelled' }),
    Report.countDocuments({ status: 'open' }), Report.distinct('targetUser', { status: 'open', targetType: 'user' }), Report.distinct('targetTrip', { status: 'open', targetType: 'trip' }),
    Message.countDocuments({ createdAt: { $gte: day }, type: { $ne: 'system' } }), Call.countDocuments({ createdAt: { $gte: day } }), User.countDocuments({ createdAt: { $gte: new Date(Date.now() - 7 * 864e5) } })
  ]);
  const byCategory = await Trip.aggregate([{ $group: { _id: '$category', n: { $sum: 1 } } }, { $sort: { n: -1 } }]);
  res.json({ success: true, stats: { users, trips, activeTrips: active, completedTrips: completed, cancelledTrips: cancelled, openReports, reportedUsers: reportedUsers.length, reportedTrips: reportedTrips.length, messagesLast24h: messages24h, callsLast24h: calls24h, newUsersLast7d: newUsers7d, onlineNow: onlineIds().length, byCategory } });
}));
r.get('/users', wrap(async (req, res) => {
  const { page, limit, skip } = paginate(req.query, 20); const f = {};
  if (req.query.q) { const re = new RegExp(escapeRegex(req.query.q), 'i'); f.$or = [{ name: re }, { email: re }, { username: re }]; }
  if (req.query.suspended === 'true') f.suspended = true;
  const [users, total] = await Promise.all([User.find(f).sort('-createdAt').skip(skip).limit(limit), User.countDocuments(f)]);
  res.json({ success: true, users, total, pages: Math.ceil(total / limit) });
}));
r.put('/users/:id/suspend', wrap(async (req, res) => {
  const { suspended } = z.object({ suspended: z.boolean().optional().default(true) }).parse(req.body);
  const u = await User.findById(req.params.id); if (!u) throw new AppError('User not found', 404);
  if (u.role === 'admin') throw new AppError('Admins cannot be suspended', 400);
  u.suspended = suspended; if (suspended) u.tokenVersion = (u.tokenVersion || 0) + 1; await u.save();
  res.json({ success: true, user: u });
}));
r.get('/trips', wrap(async (req, res) => {
  const { page, limit, skip } = paginate(req.query, 20); const f = {};
  if (req.query.status) f.status = req.query.status;
  if (req.query.q) { const re = new RegExp(escapeRegex(req.query.q), 'i'); f.$or = [{ title: re }, { destination: re }]; }
  const [trips, total] = await Promise.all([Trip.find(f).sort('-createdAt').skip(skip).limit(limit).populate('creator', 'name username email'), Trip.countDocuments(f)]);
  res.json({ success: true, trips, total, pages: Math.ceil(total / limit) });
}));
r.delete('/trips/:id', wrap(async (req, res) => {
  const t = await Trip.findById(req.params.id); if (!t) throw new AppError('Trip not found', 404);
  const ids = await TripMember.find({ trip: t._id }).distinct('user');
  await notifyMany(ids, { type: 'trip_cancelled', actor: req.user._id, title: 'Trip removed', body: `${t.title} was removed by moderators`, link: '/trips' });
  await Promise.all([TripMember.deleteMany({ trip: t._id }), Favorite.deleteMany({ trip: t._id }), JoinRequest.deleteMany({ trip: t._id }), Expense.deleteMany({ trip: t._id }), TripPhoto.deleteMany({ trip: t._id }), TripNote.deleteMany({ trip: t._id }), Conversation.deleteOne({ _id: t.conversation }), Report.updateMany({ targetTrip: t._id, status: 'open' }, { status: 'resolved', resolutionNote: 'Trip removed' }), Trip.deleteOne({ _id: t._id })]);
  res.json({ success: true });
}));
r.get('/reports', wrap(async (req, res) => {
  const f = { status: req.query.status || 'open' };
  const reports = await Report.find(f).sort('-createdAt').limit(100).populate('reporter', 'name username').populate('targetUser', 'name username suspended').populate('targetTrip', 'title slug');
  res.json({ success: true, reports });
}));
r.put('/reports/:id', wrap(async (req, res) => {
  const d = z.object({ status: z.enum(['resolved', 'dismissed']), resolutionNote: z.string().max(500).optional() }).parse(req.body);
  const rep = await Report.findByIdAndUpdate(req.params.id, d, { new: true }); if (!rep) throw new AppError('Report not found', 404);
  res.json({ success: true, report: rep });
}));
r.get('/categories', wrap(async (_req, res) => {
  const [cats, counts] = await Promise.all([Category.find().sort('name').lean(), Trip.aggregate([{ $group: { _id: '$category', n: { $sum: 1 } } }])]);
  const m = Object.fromEntries(counts.map((c) => [c._id, c.n]));
  res.json({ success: true, categories: cats.map((c) => ({ ...c, trips: m[c.name] || 0 })) });
}));
r.post('/categories', wrap(async (req, res) => {
  const { name } = z.object({ name: z.string().trim().min(2).max(40) }).parse(req.body);
  res.status(201).json({ success: true, category: await Category.create({ name }) });
}));
r.put('/categories/:id', wrap(async (req, res) => {
  const d = z.object({ name: z.string().trim().min(2).max(40).optional(), active: z.boolean().optional() }).parse(req.body);
  const c = await Category.findById(req.params.id); if (!c) throw new AppError('Category not found', 404);
  const old = c.name;
  if (d.name !== undefined && d.name !== old) {
    if (await Category.exists({ name: d.name })) throw new AppError('A category with that name already exists', 409);
    c.name = d.name; await Trip.updateMany({ category: old }, { category: d.name }); // keep existing trips consistent
  }
  if (d.active !== undefined) c.active = d.active;
  await c.save(); res.json({ success: true, category: c });
}));
r.delete('/categories/:id', wrap(async (req, res) => {
  const c = await Category.findById(req.params.id); if (!c) throw new AppError('Category not found', 404);
  if (await Trip.exists({ category: c.name })) throw new AppError('Trips still use this category. Deactivate it instead.', 400);
  await c.deleteOne(); res.json({ success: true });
}));
r.get('/activity', wrap(async (_req, res) => {
  const [trips, users, reports] = await Promise.all([Trip.find().sort('-createdAt').limit(8).populate('creator', 'name'), User.find().sort('-createdAt').limit(8), Report.find().sort('-createdAt').limit(8).populate('reporter', 'name')]);
  const feed = [...trips.map(t => ({ at: t.createdAt, text: `${t.creator?.name} created "${t.title}"` })), ...users.map(u => ({ at: u.createdAt, text: `${u.name} joined` })), ...reports.map(r => ({ at: r.createdAt, text: `${r.reporter?.name} reported a ${r.targetType} (${r.category})` }))].sort((a, b) => b.at - a.at).slice(0, 15);
  res.json({ success: true, activity: feed });
}));
export default r;
