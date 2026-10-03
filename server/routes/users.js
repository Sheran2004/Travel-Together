import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import User, { TRAVEL_STYLES } from '../models/User.js';
import Trip from '../models/Trip.js';
import { TripMember, Favorite, Connection, Review, Notification, Message, Conversation } from '../models/misc.js';
import { protect, optionalAuth } from '../middleware/auth.js';
import { AppError, wrap, escapeRegex, paginate, sameId } from '../utils/helpers.js';
import { compatibility } from '../utils/matching.js';
import { passwordRule } from './auth.js';
import { isOnline } from '../services/realtime.js';
import crypto from 'crypto';
import { sendMail } from '../services/mail.js';
import { env } from '../config/env.js';

const r = Router();
const PUBLIC = 'name username profileImage bio age city country languages travelInterests travelStyle budgetMin budgetMax favoriteDestinations createdAt privacySettings lastSeen role';

const profileSchema = z.object({
  name: z.string().trim().min(2).max(80), username: z.string().trim().toLowerCase().regex(/^[a-z0-9_.]{3,24}$/),
  bio: z.string().max(500), age: z.coerce.number().int().min(18).max(100), gender: z.enum(['male', 'female', 'non-binary', 'prefer-not-to-say', '']),
  city: z.string().trim().max(80), country: z.string().trim().max(80), profileImage: z.string().url().or(z.literal('')),
  languages: z.array(z.string().trim().max(40)).max(10), travelInterests: z.array(z.string().trim().max(40)).max(20),
  travelStyle: z.array(z.enum(TRAVEL_STYLES)).max(6), favoriteDestinations: z.array(z.string().trim().max(60)).max(15),
  budgetMin: z.coerce.number().min(0), budgetMax: z.coerce.number().min(0),
  theme: z.enum(['light', 'dark', 'system']), emergencyContact: z.object({ name: z.string().max(80).optional(), phone: z.string().max(30).optional() }),
  privacySettings: z.object({ whoCanMessage: z.enum(['everyone', 'connections', 'shared-trips', 'nobody']), profileVisibility: z.enum(['public', 'members', 'private']), showOnlineStatus: z.boolean(), showLastSeen: z.boolean() }).partial(),
  notificationSettings: z.object({ messages: z.boolean(), calls: z.boolean(), tripUpdates: z.boolean(), invitations: z.boolean(), marketing: z.boolean() }).partial()
}).partial().refine(d => d.budgetMin == null || d.budgetMax == null || d.budgetMax >= d.budgetMin, { path: ['budgetMax'], message: 'Max budget must be at least min budget' });

const completion = (u) => {
  const checks = [u.profileImage, u.bio, u.age, u.city, u.country, u.languages?.length, u.travelInterests?.length, u.travelStyle?.length, u.favoriteDestinations?.length, u.budgetMax];
  return Math.round(checks.filter(Boolean).length / checks.length * 100);
};

r.put('/profile', protect, wrap(async (req, res) => {
  const d = profileSchema.parse(req.body);
  if (d.username && d.username !== req.user.username && await User.exists({ username: d.username })) throw new AppError('That username is taken', 409);
  const { privacySettings, notificationSettings, emergencyContact, ...rest } = d;
  Object.assign(req.user, rest);
  if (privacySettings) Object.assign(req.user.privacySettings, privacySettings);
  if (notificationSettings) Object.assign(req.user.notificationSettings, notificationSettings);
  if (emergencyContact) req.user.emergencyContact = emergencyContact;
  await req.user.save();
  res.json({ success: true, user: req.user });
}));

r.put('/password', protect, wrap(async (req, res) => {
  const { currentPassword, newPassword } = z.object({ currentPassword: z.string().min(1), newPassword: passwordRule }).parse(req.body);
  const u = await User.findById(req.user._id).select('+password');
  if (!(await bcrypt.compare(currentPassword, u.password))) throw new AppError('Current password is incorrect', 400);
  u.password = await bcrypt.hash(newPassword, 12); await u.save();
  res.json({ success: true, message: 'Password changed' });
}));

r.post('/email-change', protect, wrap(async (req, res) => {
  const { newEmail, password } = z.object({ newEmail: z.string().trim().toLowerCase().email('Enter a valid email'), password: z.string().min(1, 'Enter your password') }).parse(req.body);
  const u = await User.findById(req.user._id).select('+password');
  if (!(await bcrypt.compare(password, u.password))) throw new AppError('Password is incorrect', 400);
  if (newEmail === u.email) throw new AppError('That is already your email', 400);
  if (await User.exists({ email: newEmail })) throw new AppError('That email is already in use', 409);
  const token = crypto.randomBytes(32).toString('hex');
  u.pendingEmail = newEmail; u.emailChangeHash = crypto.createHash('sha256').update(token).digest('hex'); u.emailChangeExpires = new Date(Date.now() + 60 * 60 * 1000);
  await u.save();
  await sendMail({ to: newEmail, subject: 'Confirm your new Travel Together email', text: `Confirm this as your new email (valid 1 hour):\n${env.CLIENT_URL[0]}/confirm-email/${token}\n\nIf you did not request this, ignore this message.` });
  sendMail({ to: u.email, subject: 'Email change requested on your Travel Together account', text: `A change of your account email to ${newEmail} was requested. If this was not you, change your password immediately.` }).catch(() => {});
  res.json({ success: true, message: `Confirmation link sent to ${newEmail}`, user: u });
}));
r.delete('/email-change', protect, wrap(async (req, res) => {
  await User.updateOne({ _id: req.user._id }, { $unset: { pendingEmail: 1, emailChangeHash: 1, emailChangeExpires: 1 } });
  res.json({ success: true });
}));
r.delete('/me', protect, wrap(async (req, res) => {
  const { password } = z.object({ password: z.string().min(1) }).parse(req.body);
  const u = await User.findById(req.user._id).select('+password');
  if (!(await bcrypt.compare(password, u.password))) throw new AppError('Password is incorrect', 400);
  const created = await Trip.find({ creator: u._id, status: 'active', startDate: { $gt: new Date() } });
  if (created.length) throw new AppError('Cancel or delete your upcoming trips before deleting your account', 400);
  await Promise.all([TripMember.deleteMany({ user: u._id }), Favorite.deleteMany({ user: u._id }), Connection.deleteMany({ $or: [{ requester: u._id }, { recipient: u._id }] }), Notification.deleteMany({ user: u._id }), User.deleteOne({ _id: u._id })]);
  res.json({ success: true });
}));

// Static paths BEFORE /:id
r.get('/favorites', protect, wrap(async (req, res) => {
  const favs = await Favorite.find({ user: req.user._id }).sort('-createdAt').populate({ path: 'trip', populate: { path: 'creator', select: 'name username profileImage' } });
  res.json({ success: true, trips: favs.map(f => f.trip).filter(Boolean) });
}));

r.get('/blocked', protect, wrap(async (req, res) => {
  const u = await User.findById(req.user._id).populate('blocked', 'name username profileImage').populate('restricted', 'name username profileImage');
  res.json({ success: true, blocked: u.blocked, restricted: u.restricted });
}));

r.get('/search', protect, wrap(async (req, res) => {
  const { page, limit, skip } = paginate(req.query, 12);
  const { q, city, interest, style, destination, minAge, maxAge, minBudget, maxBudget, tripType, startDate, endDate, gender } = req.query;
  const me = req.user;
  const filter = { _id: { $ne: me._id }, suspended: false, 'privacySettings.profileVisibility': { $ne: 'private' } };
  const blockedMe = await User.find({ blocked: me._id }).distinct('_id');
  filter._id = { $nin: [me._id, ...me.blocked, ...blockedMe] };
  if (q) { const re = new RegExp(escapeRegex(q), 'i'); filter.$or = [{ name: re }, { username: re }, { bio: re }]; }
  if (city) filter.city = new RegExp(escapeRegex(city), 'i');
  if (interest) filter.travelInterests = new RegExp(escapeRegex(interest), 'i');
  if (style) filter.travelStyle = style;
  if (gender && ['male', 'female', 'non-binary'].includes(gender)) filter.gender = gender;
  if (minAge || maxAge) filter.age = { ...(minAge && { $gte: +minAge }), ...(maxAge && { $lte: +maxAge }) };
  if (minBudget) filter.budgetMax = { $gte: +minBudget };
  if (maxBudget) filter.budgetMin = { $lte: +maxBudget };
  const tripFilter = {};
  if (destination) { const re = new RegExp(escapeRegex(destination), 'i'); const ids = await Trip.find({ destination: re, status: 'active' }).distinct('_id'); const members = await TripMember.find({ trip: { $in: ids } }).distinct('user'); filter.$and = [{ $or: [{ favoriteDestinations: re }, { _id: { $in: members } }] }]; }
  if (tripType) { const ids = await Trip.find({ category: tripType, status: 'active' }).distinct('_id'); const members = await TripMember.find({ trip: { $in: ids } }).distinct('user'); (filter.$and ||= []).push({ _id: { $in: members } }); }
  if (startDate || endDate) {
    const tf = { status: 'active' }; if (endDate) tf.startDate = { $lte: new Date(endDate) }; if (startDate) tf.endDate = { $gte: new Date(startDate) };
    const ids = await Trip.find(tf).distinct('_id'); const members = await TripMember.find({ trip: { $in: ids } }).distinct('user'); (filter.$and ||= []).push({ _id: { $in: members } });
  }
  const [users, total] = await Promise.all([User.find(filter).select(PUBLIC).sort('-createdAt').skip(skip).limit(limit).lean(), User.countDocuments(filter)]);
  const ids = users.map(u => u._id);
  const memberships = await TripMember.find({ user: { $in: [...ids, me._id] } }).populate('trip', 'title slug destination startDate endDate status category').lean();
  const tripsOf = (id) => memberships.filter(m => String(m.user) === String(id) && m.trip && m.trip.status === 'active' && new Date(m.trip.endDate) >= new Date()).map(m => m.trip);
  const myTrips = tripsOf(me._id);
  const conns = await Connection.find({ $or: [{ requester: me._id, recipient: { $in: ids } }, { recipient: me._id, requester: { $in: ids } }] }).lean();
  const out = users.map(u => {
    const upcoming = tripsOf(u._id);
    const c = compatibility(me, u, myTrips, upcoming);
    const conn = conns.find(x => String(x.requester) === String(u._id) || String(x.recipient) === String(u._id));
    const showOnline = u.privacySettings?.showOnlineStatus !== false;
    return { ...u, privacySettings: undefined, lastSeen: undefined, upcomingTrips: upcoming.slice(0, 3), compatibility: c, connection: conn ? { status: conn.status, direction: String(conn.requester) === String(me._id) ? 'sent' : 'received' } : null, online: showOnline && isOnline(u._id) };
  });
  if (req.query.sort !== 'newest') out.sort((a, b) => b.compatibility.score - a.compatibility.score);
  res.json({ success: true, users: out, page, total, pages: Math.ceil(total / limit) });
}));

r.post('/:id/block', protect, wrap(async (req, res) => {
  if (sameId(req.params.id, req.user._id)) throw new AppError('You cannot block yourself', 400);
  if (!(await User.exists({ _id: req.params.id }))) throw new AppError('User not found', 404);
  await User.updateOne({ _id: req.user._id }, { $addToSet: { blocked: req.params.id } });
  await Connection.deleteMany({ $or: [{ requester: req.user._id, recipient: req.params.id }, { requester: req.params.id, recipient: req.user._id }] });
  res.json({ success: true });
}));
r.delete('/:id/block', protect, wrap(async (req, res) => { await User.updateOne({ _id: req.user._id }, { $pull: { blocked: req.params.id } }); res.json({ success: true }); }));
r.post('/:id/restrict', protect, wrap(async (req, res) => { await User.updateOne({ _id: req.user._id }, { $addToSet: { restricted: req.params.id } }); res.json({ success: true }); }));
r.delete('/:id/restrict', protect, wrap(async (req, res) => { await User.updateOne({ _id: req.user._id }, { $pull: { restricted: req.params.id } }); res.json({ success: true }); }));

r.get('/by-username/:username', optionalAuth, wrap(async (req, res, next) => {
  const u = await User.findOne({ username: req.params.username.toLowerCase(), suspended: false }).select('_id');
  if (!u) throw new AppError('Traveler not found', 404);
  req.params.id = String(u._id);
  return getProfile(req, res);
}));

async function getProfile(req, res) {
  const me = req.user;
  const u = await User.findOne({ _id: req.params.id, suspended: false }).select(PUBLIC + ' blocked').lean();
  if (!u) throw new AppError('Traveler not found', 404);
  const isSelf = me && sameId(me._id, u._id);
  if (me && !isSelf && u.blocked?.some(b => sameId(b, me._id))) throw new AppError('Traveler not found', 404);
  const vis = u.privacySettings?.profileVisibility || 'public';
  let limited = false;
  if (!isSelf && vis === 'private') limited = true;
  if (!isSelf && vis === 'members' && !me) limited = true;
  delete u.blocked;
  const [created, joinedM, reviewsAgg] = await Promise.all([
    Trip.find({ creator: u._id, status: { $ne: 'cancelled' }, visibility: 'public' }).sort('-startDate').limit(12).select('title slug destination coverImage startDate endDate status budget memberCount maxMembers').lean(),
    TripMember.find({ user: u._id }).populate({ path: 'trip', match: { status: { $ne: 'cancelled' }, visibility: 'public' }, select: 'title slug destination coverImage startDate endDate status budget memberCount maxMembers' }).lean(),
    Review.aggregate([{ $lookup: { from: 'trips', localField: 'trip', foreignField: '_id', as: 't' } }, { $match: { author: u._id } }, { $group: { _id: null, n: { $sum: 1 }, avg: { $avg: '$rating' } } }])
  ]);
  const joined = joinedM.map(m => m.trip).filter(Boolean).filter(t => String(t._id) && !created.some(c => sameId(c._id, t._id)));
  const [connCount, connection] = await Promise.all([
    Connection.countDocuments({ status: 'accepted', $or: [{ requester: u._id }, { recipient: u._id }] }),
    me && !isSelf ? Connection.findOne({ $or: [{ requester: me._id, recipient: u._id }, { requester: u._id, recipient: me._id }] }).lean() : null
  ]);
  let comp = null;
  if (me && !isSelf) {
    const [mine, theirs] = await Promise.all([TripMember.find({ user: me._id }).populate('trip', 'destination startDate endDate').lean(), TripMember.find({ user: u._id }).populate('trip', 'destination startDate endDate').lean()]);
    comp = compatibility(me, u, mine.map(m => m.trip).filter(Boolean), theirs.map(m => m.trip).filter(Boolean));
  }
  const showOnline = isSelf || u.privacySettings?.showOnlineStatus !== false;
  const showSeen = isSelf || u.privacySettings?.showLastSeen !== false;
  const base = { _id: u._id, name: u.name, username: u.username, profileImage: u.profileImage };
  const profile = limited ? { ...base, limited: true } : {
    ...u, privacySettings: isSelf ? u.privacySettings : undefined, createdAt: u.createdAt,
    trips: { created, joined }, stats: { tripsCreated: created.length, tripsJoined: joined.length, connections: connCount, reviewsWritten: reviewsAgg[0]?.n || 0 },
    online: showOnline && isOnline(u._id), lastSeen: showSeen && !isOnline(u._id) ? u.lastSeen : undefined,
    connection: connection ? { status: connection.status, direction: String(connection.requester) === String(me._id) ? 'sent' : 'received' } : null,
    compatibility: comp, completion: isSelf ? completion(u) : undefined
  };
  if (!isSelf) delete profile.emergencyContact;
  res.json({ success: true, user: profile });
}

r.get('/:id', optionalAuth, wrap(getProfile));
export default r;
