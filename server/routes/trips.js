import { Router } from 'express';
import { z } from 'zod';
import Trip, { CATEGORIES, TRANSPORT } from '../models/Trip.js';
import User, { TRAVEL_STYLES } from '../models/User.js';
import { TripMember, JoinRequest, Favorite, Expense, Review, Invitation, Conversation, TripPhoto, TripNote } from '../models/misc.js';
import { categoryActive } from '../services/categories.js';
import { env } from '../config/env.js';
import { protect, optionalAuth } from '../middleware/auth.js';
import { AppError, wrap, slugify, escapeRegex, paginate, sameId } from '../utils/helpers.js';
import { boundingBox, haversineKm } from '../utils/geo.js';
import { tripRecommendationScore } from '../utils/matching.js';
import { computeBalances } from '../utils/balances.js';
import { addMember, removeMember, createTripConversation, isMember, memberIds } from '../services/trips.js';
import { notify, notifyMany } from '../services/notify.js';
import { systemMessage } from '../services/chat.js';
import { emitToUser } from '../services/realtime.js';
import crypto from 'crypto';

const r = Router();
const CREATOR = 'name username profileImage city';
const CARD = 'title slug destination city state country latitude longitude coverImage startDate endDate budget category travelStyle difficulty maxMembers memberCount creator joinMode status avgRating reviewCount description';

const itemSchema = z.object({
  day: z.coerce.number().int().min(1), date: z.coerce.date().optional().nullable(), time: z.string().max(20).optional(),
  locationName: z.string().trim().min(1, 'Location is required').max(120), latitude: z.coerce.number().min(-90).max(90).optional(), longitude: z.coerce.number().min(-180).max(180).optional(),
  activity: z.string().trim().min(1, 'Activity is required').max(200), description: z.string().max(1000).optional(), transport: z.enum(TRANSPORT).optional(),
  departure: z.string().max(80).optional(), arrival: z.string().max(80).optional(), notes: z.string().max(500).optional()
});
const tripSchema = z.object({
  title: z.string().trim().min(4, 'Title must be at least 4 characters').max(120),
  destination: z.string().trim().min(2), city: z.string().trim().optional().default(''), state: z.string().trim().optional().default(''), country: z.string().trim().optional().default('India'),
  latitude: z.coerce.number({ invalid_type_error: 'Pick a location on the map' }).min(-90).max(90), longitude: z.coerce.number().min(-180).max(180),
  description: z.string().trim().min(20, 'Describe the trip in at least 20 characters').max(4000),
  coverImage: z.string().url().or(z.literal('')).optional().default(''),
  startDate: z.coerce.date(), endDate: z.coerce.date(),
  budget: z.coerce.number().min(0, 'Budget cannot be negative').max(10000000),
  category: z.string().trim().min(1, 'Choose a category').max(40), travelStyle: z.enum(TRAVEL_STYLES).optional(), difficulty: z.enum(['Easy', 'Moderate', 'Hard']).optional().default('Easy'),
  ageMin: z.coerce.number().min(18).optional().default(18), ageMax: z.coerce.number().max(100).optional().default(60),
  maxMembers: z.coerce.number().int().min(2, 'At least 2 members').max(100), joinMode: z.enum(['open', 'request']).optional().default('open'),
  visibility: z.enum(['public', 'private']).optional().default('public'),
  meetingPoint: z.string().max(200).optional(), activities: z.array(z.string().trim().max(60)).max(15).optional().default([]),
  itinerary: z.array(itemSchema).max(60).optional().default([])
}).refine(d => d.endDate >= d.startDate, { path: ['endDate'], message: 'End date cannot be before start date' })
  .refine(d => d.ageMax >= d.ageMin, { path: ['ageMax'], message: 'Max age must be at least min age' });

async function uniqueSlug(title) {
  const base = slugify(title) || 'trip';
  for (let i = 0; i < 5; i++) {
    const s = i ? `${base}-${crypto.randomBytes(2).toString('hex')}` : base;
    if (!(await Trip.exists({ slug: s }))) return s;
  }
  return `${base}-${Date.now()}`;
}
const findTrip = async (idOrSlug) => {
  const t = /^[a-f\d]{24}$/i.test(idOrSlug) ? await Trip.findById(idOrSlug) : await Trip.findOne({ slug: idOrSlug });
  if (!t) throw new AppError('Trip not found', 404);
  return t;
};
const needCreator = (trip, user) => { if (!sameId(trip.creator, user._id) && user.role !== 'admin') throw new AppError('Only the trip creator can do this', 403); };

/* ---------- list / search ---------- */
r.get('/', optionalAuth, wrap(async (req, res) => {
  const { page, limit, skip } = paginate(req.query, 12);
  const q = req.query; const f = { status: 'active', visibility: 'public' };
  if (q.status && ['completed', 'active', 'cancelled'].includes(q.status) && q.status !== 'cancelled') f.status = q.status;
  if (q.search) { const re = new RegExp(escapeRegex(q.search), 'i'); f.$or = [{ title: re }, { destination: re }, { city: re }, { state: re }, { activities: re }, { description: re }]; }
  if (q.destination) { const re = new RegExp(escapeRegex(q.destination), 'i'); f.$and = [{ $or: [{ destination: re }, { city: re }, { state: re }] }]; }
  if (q.category) f.category = { $in: String(q.category).split(',') };
  if (q.travelStyle) f.travelStyle = q.travelStyle;
  if (q.difficulty) f.difficulty = q.difficulty;
  if (q.minBudget || q.maxBudget) f.budget = { ...(q.minBudget && { $gte: +q.minBudget }), ...(q.maxBudget && { $lte: +q.maxBudget }) };
  if (q.startDate) f.startDate = { ...(f.startDate || {}), $gte: new Date(q.startDate) };
  if (q.endDate) f.endDate = { ...(f.endDate || {}), $lte: new Date(q.endDate) };
  if (q.minDuration || q.maxDuration) {
    const expr = { $add: [{ $round: [{ $divide: [{ $subtract: ['$endDate', '$startDate'] }, 86400000] }, 0] }, 1] };
    (f.$and ||= []).push({ $expr: { $and: [...(q.minDuration ? [{ $gte: [expr, +q.minDuration] }] : []), ...(q.maxDuration ? [{ $lte: [expr, +q.maxDuration] }] : [])] } });
  }
  if (q.groupSize) f.maxMembers = { $gte: +q.groupSize };
  if (q.upcoming === 'true' || q.sort === 'soonest') f.startDate = { ...(f.startDate || {}), $gte: new Date() };
  if (q.available === 'true') (f.$and ||= []).push({ $expr: { $lt: ['$memberCount', '$maxMembers'] } });
  const near = q.lat && q.lng && q.radius ? { lat: +q.lat, lng: +q.lng, km: +q.radius } : null;
  if (near) { const b = boundingBox(near.lat, near.lng, near.km); f.latitude = { $gte: b.minLat, $lte: b.maxLat }; f.longitude = { $gte: b.minLng, $lte: b.maxLng }; }
  const sorts = { newest: { createdAt: -1 }, members: { memberCount: -1 }, lowest: { budget: 1 }, highest: { budget: -1 }, soonest: { startDate: 1 } };
  const sort = sorts[q.sort] || sorts.newest;
  if (near || q.all === 'true') { // map / nearby mode: exact distance filtering, capped for performance
    let trips = await Trip.find(f).sort(sort).limit(500).populate('creator', CREATOR).select(CARD).lean({ virtuals: true });
    if (near) { trips = trips.map(t => ({ ...t, distanceKm: Math.round(haversineKm(near.lat, near.lng, t.latitude, t.longitude)) })).filter(t => t.distanceKm <= near.km).sort((a, b) => a.distanceKm - b.distanceKm); }
    return res.json({ success: true, trips: trips.slice(skip, skip + (q.all === 'true' ? 500 : limit)), total: trips.length, page, pages: Math.ceil(trips.length / limit) });
  }
  const [trips, total] = await Promise.all([Trip.find(f).sort(sort).skip(skip).limit(limit).populate('creator', CREATOR).select(CARD), Trip.countDocuments(f)]);
  res.json({ success: true, trips, total, page, pages: Math.ceil(total / limit) });
}));

r.get('/recommended', protect, wrap(async (req, res) => {
  const mine = await TripMember.find({ user: req.user._id }).distinct('trip');
  const pool = await Trip.find({ status: 'active', visibility: 'public', startDate: { $gt: new Date() }, _id: { $nin: mine }, $expr: { $lt: ['$memberCount', '$maxMembers'] } }).limit(200).populate('creator', CREATOR).select(CARD + ' activities').lean({ virtuals: true });
  const scored = pool.map(t => ({ ...t, ...(() => { const s = tripRecommendationScore(req.user, t); return { matchScore: s.score, matchReasons: s.why }; })() })).filter(t => t.matchScore > 0).sort((a, b) => b.matchScore - a.matchScore || a.startDate - b.startDate);
  res.json({ success: true, trips: scored.slice(0, 8), method: 'rule-based (interests, favorite destinations, travel style, budget)' });
}));

r.get('/popular', wrap(async (_req, res) => {
  const trips = await Trip.find({ status: 'active', visibility: 'public', startDate: { $gt: new Date() } }).sort({ memberCount: -1, savedCount: -1 }).limit(8).populate('creator', CREATOR).select(CARD);
  res.json({ success: true, trips });
}));

r.get('/mine', protect, wrap(async (req, res) => {
  const memberships = await TripMember.find({ user: req.user._id }).select('trip');
  const trips = await Trip.find({ _id: { $in: memberships.map(m => m.trip) } }).sort('-startDate').populate('creator', CREATOR).select(CARD);
  const now = new Date();
  const withFlags = trips.map(t => ({ ...t.toJSON(), isCreator: sameId(t.creator, req.user._id) }));
  res.json({
    success: true,
    created: withFlags.filter(t => t.isCreator),
    joined: withFlags.filter(t => !t.isCreator),
    upcoming: withFlags.filter(t => t.status === 'active' && new Date(t.endDate) >= now),
    completed: withFlags.filter(t => t.status === 'completed' || (t.status === 'active' && new Date(t.endDate) < now))
  });
}));

/* ---------- create ---------- */
r.post('/', protect, wrap(async (req, res) => {
  const d = tripSchema.parse(req.body);
  if (!(await categoryActive(d.category))) throw new AppError('Choose a valid category', 400);
  if (d.startDate <= new Date()) throw new AppError('Start date must be in the future', 400);
  const trip = await Trip.create({ ...d, slug: await uniqueSlug(d.title), creator: req.user._id, memberCount: 0, coverImage: d.coverImage || `https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=1200&q=70` });
  await createTripConversation(trip);
  await addMember(trip._id, req.user._id, { silent: true });
  await systemMessage(trip.conversation, `${req.user.name} created the group "${trip.title}"`);
  res.status(201).json({ success: true, trip: await Trip.findById(trip._id).populate('creator', CREATOR) });
}));

/* ---------- read ---------- */
r.get('/:id', optionalAuth, wrap(async (req, res) => {
  const trip = await findTrip(req.params.id);
  await trip.populate('creator', CREATOR + ' bio travelStyle');
  const me = req.user;
  const memberDocs = await TripMember.find({ trip: trip._id }).populate('user', 'name username profileImage city').sort('joinedAt');
  const isMemberFlag = !!me && memberDocs.some(m => sameId(m.user, me._id));
  const isCreator = !!me && sameId(trip.creator, me._id);
  if (trip.visibility === 'private' && !isMemberFlag && me?.role !== 'admin') {
    const inv = me && await Invitation.exists({ trip: trip._id, to: me._id });
    if (!inv) throw new AppError('Trip not found', 404);
  }
  const [favorite, request, pendingCount, reviews] = await Promise.all([
    me ? Favorite.exists({ user: me._id, trip: trip._id }) : null,
    me ? JoinRequest.findOne({ trip: trip._id, user: me._id }) : null,
    isCreator ? JoinRequest.countDocuments({ trip: trip._id, status: 'pending' }) : 0,
    Review.aggregate([{ $match: { trip: trip._id } }, { $group: { _id: null, avg: { $avg: '$rating' }, n: { $sum: 1 } } }])
  ]);
  const t = trip.toJSON();
  if (!isMemberFlag && !isCreator) t.checklist = undefined; // group-only data
  res.json({ success: true, trip: t, members: memberDocs.map(m => ({ ...m.user.toJSON(), role: m.role, joinedAt: m.joinedAt })),
    viewer: { isMember: isMemberFlag, isCreator, isFull: trip.memberCount >= trip.maxMembers, favorite: !!favorite, requestStatus: request?.status || null, pendingRequests: pendingCount, started: trip.startDate <= new Date(), ended: trip.endDate < new Date() },
    rating: { avg: Math.round((reviews[0]?.avg || 0) * 10) / 10, count: reviews[0]?.n || 0 } });
}));

/* ---------- update / delete ---------- */
r.put('/:id', protect, wrap(async (req, res) => {
  const trip = await findTrip(req.params.id); needCreator(trip, req.user);
  if (trip.status === 'cancelled') throw new AppError('Cancelled trips cannot be edited', 400);
  const d = tripSchema.parse({ ...trip.toObject(), ...req.body });
  if (d.category !== trip.category && !(await categoryActive(d.category))) throw new AppError('Choose a valid category', 400);
  if (d.maxMembers < trip.memberCount) throw new AppError(`Maximum members cannot be below the current ${trip.memberCount} members`, 400);
  Object.assign(trip, { ...d, itinerary: d.itinerary });
  if (d.title !== trip.title) { /* slug intentionally stable so shared links keep working */ }
  await trip.save();
  const ids = await memberIds(trip._id);
  await notifyMany(ids, { type: 'trip_updated', actor: req.user._id, title: 'Trip updated', body: `${trip.title} was updated by the organizer`, link: `/trips/${trip.slug}` });
  res.json({ success: true, trip });
}));

r.post('/:id/cancel', protect, wrap(async (req, res) => {
  const trip = await findTrip(req.params.id); needCreator(trip, req.user);
  if (trip.status !== 'active') throw new AppError('Only active trips can be cancelled', 400);
  trip.status = 'cancelled'; await trip.save();
  await systemMessage(trip.conversation, 'The organizer cancelled this trip');
  await notifyMany(await memberIds(trip._id), { type: 'trip_cancelled', actor: req.user._id, title: 'Trip cancelled', body: `${trip.title} was cancelled`, link: `/trips/${trip.slug}` });
  res.json({ success: true, trip });
}));

r.delete('/:id', protect, wrap(async (req, res) => {
  const trip = await findTrip(req.params.id); needCreator(trip, req.user);
  const ids = await memberIds(trip._id);
  await notifyMany(ids, { type: 'trip_cancelled', actor: req.user._id, title: 'Trip deleted', body: `${trip.title} was removed by the organizer`, link: '/trips' });
  await Promise.all([TripMember.deleteMany({ trip: trip._id }), JoinRequest.deleteMany({ trip: trip._id }), Favorite.deleteMany({ trip: trip._id }), Expense.deleteMany({ trip: trip._id }), Invitation.deleteMany({ trip: trip._id }), TripPhoto.deleteMany({ trip: trip._id }), TripNote.deleteMany({ trip: trip._id }), Conversation.deleteOne({ _id: trip.conversation }), Trip.deleteOne({ _id: trip._id })]);
  res.json({ success: true, message: 'Trip deleted' });
}));

/* ---------- membership ---------- */
r.post('/:id/join', protect, wrap(async (req, res) => {
  const trip = await findTrip(req.params.id);
  if (trip.joinMode === 'request') throw new AppError('This trip needs approval. Send a join request instead.', 400);
  if (trip.visibility === 'private' && !(await Invitation.exists({ trip: trip._id, to: req.user._id }))) throw new AppError('This trip is private', 403);
  const updated = await addMember(trip._id, req.user._id);
  res.json({ success: true, message: 'You joined the trip', trip: updated });
}));

r.post('/:id/request', protect, wrap(async (req, res) => {
  const { message } = z.object({ message: z.string().max(500).optional().default('') }).parse(req.body);
  const trip = await findTrip(req.params.id);
  if (trip.joinMode !== 'request') throw new AppError('This trip is open to join', 400);
  if (trip.status !== 'active' || trip.startDate <= new Date()) throw new AppError('This trip is not accepting requests', 400);
  if (await isMember(trip._id, req.user._id)) throw new AppError('You are already a member', 409);
  if (trip.memberCount >= trip.maxMembers) throw new AppError('This trip is full', 400);
  const existing = await JoinRequest.findOne({ trip: trip._id, user: req.user._id });
  if (existing?.status === 'pending') throw new AppError('Your request is already pending', 409);
  if (existing?.status === 'rejected') throw new AppError('The organizer declined your earlier request', 403);
  await JoinRequest.findOneAndUpdate({ trip: trip._id, user: req.user._id }, { message, status: 'pending' }, { upsert: true, new: true, setDefaultsOnInsert: true });
  await notify(trip.creator, { type: 'join_request', actor: req.user._id, title: 'New join request', body: `${req.user.name} wants to join ${trip.title}`, link: `/trips/${trip.slug}/manage` });
  res.status(201).json({ success: true, message: 'Request sent' });
}));

r.delete('/:id/request', protect, wrap(async (req, res) => {
  const trip = await findTrip(req.params.id);
  await JoinRequest.deleteOne({ trip: trip._id, user: req.user._id, status: 'pending' });
  res.json({ success: true });
}));

r.get('/:id/requests', protect, wrap(async (req, res) => {
  const trip = await findTrip(req.params.id); needCreator(trip, req.user);
  const reqs = await JoinRequest.find({ trip: trip._id, status: 'pending' }).sort('createdAt').populate('user', 'name username profileImage city bio travelInterests travelStyle').lean();
  const { Connection } = await import('../models/misc.js');
  const myConns = await Connection.find({ status: 'accepted', $or: [{ requester: req.user._id }, { recipient: req.user._id }] }).lean();
  const myFriendIds = new Set(myConns.map(c => String(c.requester) === String(req.user._id) ? String(c.recipient) : String(c.requester)));
  const out = [];
  for (const rq of reqs) {
    const theirConns = await Connection.find({ status: 'accepted', $or: [{ requester: rq.user._id }, { recipient: rq.user._id }] }).lean();
    const mutual = theirConns.filter(c => myFriendIds.has(String(c.requester) === String(rq.user._id) ? String(c.recipient) : String(c.requester))).length;
    const rv = await Review.aggregate([{ $match: { author: rq.user._id } }, { $group: { _id: null, n: { $sum: 1 } } }]);
    out.push({ ...rq, mutualConnections: mutual, reviewsWritten: rv[0]?.n || 0 });
  }
  res.json({ success: true, requests: out });
}));

r.post('/:id/requests/:reqId/:action', protect, wrap(async (req, res) => {
  const { action } = req.params;
  if (!['accept', 'reject'].includes(action)) throw new AppError('Invalid action', 400);
  const trip = await findTrip(req.params.id); needCreator(trip, req.user);
  const rq = await JoinRequest.findOne({ _id: req.params.reqId, trip: trip._id, status: 'pending' });
  if (!rq) throw new AppError('Request not found', 404);
  if (action === 'accept') {
    await addMember(trip._id, rq.user);
    await notify(rq.user, { type: 'request_accepted', actor: req.user._id, title: 'Request accepted', body: `You're in! ${trip.title}`, link: `/trips/${trip.slug}` });
  } else {
    rq.status = 'rejected'; await rq.save();
    await notify(rq.user, { type: 'request_rejected', actor: req.user._id, title: 'Request declined', body: `Your request for ${trip.title} was declined`, link: `/trips/${trip.slug}` });
  }
  res.json({ success: true });
}));

r.post('/:id/leave', protect, wrap(async (req, res) => {
  const trip = await findTrip(req.params.id);
  if (sameId(trip.creator, req.user._id)) throw new AppError('Organizers cannot leave their own trip. Cancel or delete it instead.', 400);
  if (trip.endDate < new Date()) throw new AppError('This trip has ended', 400);
  await removeMember(trip, req.user._id);
  res.json({ success: true, message: 'You left the trip' });
}));

r.get('/:id/members', protect, wrap(async (req, res) => {
  const trip = await findTrip(req.params.id);
  const members = await TripMember.find({ trip: trip._id }).populate('user', 'name username profileImage city').sort('joinedAt');
  res.json({ success: true, members: members.map(m => ({ ...m.user.toJSON(), role: m.role, joinedAt: m.joinedAt })) });
}));

r.delete('/:id/members/:userId', protect, wrap(async (req, res) => {
  const trip = await findTrip(req.params.id); needCreator(trip, req.user);
  if (sameId(trip.creator, req.params.userId)) throw new AppError('You cannot remove the organizer', 400);
  await removeMember(trip, req.params.userId, { reason: 'removed' });
  res.json({ success: true });
}));

/* ---------- favorites ---------- */
r.post('/:id/favorite', protect, wrap(async (req, res) => {
  const trip = await findTrip(req.params.id);
  try { await Favorite.create({ user: req.user._id, trip: trip._id }); await Trip.updateOne({ _id: trip._id }, { $inc: { savedCount: 1 } }); } catch (e) { if (e.code !== 11000) throw e; }
  res.status(201).json({ success: true });
}));
r.delete('/:id/favorite', protect, wrap(async (req, res) => {
  const trip = await findTrip(req.params.id);
  const d = await Favorite.findOneAndDelete({ user: req.user._id, trip: trip._id });
  if (d) await Trip.updateOne({ _id: trip._id }, { $inc: { savedCount: -1 } });
  res.json({ success: true });
}));

/* ---------- reviews ---------- */
r.get('/:id/reviews', wrap(async (req, res) => {
  const trip = await findTrip(req.params.id);
  const reviews = await Review.find({ trip: trip._id }).sort('-createdAt').populate('author', 'name username profileImage');
  const n = reviews.length; res.json({ success: true, reviews, average: n ? Math.round(reviews.reduce((a, x) => a + x.rating, 0) / n * 10) / 10 : 0, count: n });
}));
r.post('/:id/reviews', protect, wrap(async (req, res) => {
  const { rating, comment } = z.object({ rating: z.coerce.number().int().min(1).max(5), comment: z.string().max(1000).optional().default('') }).parse(req.body);
  const trip = await findTrip(req.params.id);
  if (trip.status === 'cancelled') throw new AppError('Cancelled trips cannot be reviewed', 400);
  if (trip.endDate >= new Date() && trip.status !== 'completed') throw new AppError('You can review a trip after it ends', 400);
  if (!(await isMember(trip._id, req.user._id))) throw new AppError('Only trip members can leave a review', 403);
  if (await Review.exists({ trip: trip._id, author: req.user._id })) throw new AppError('You already reviewed this trip', 409);
  const review = await Review.create({ trip: trip._id, author: req.user._id, rating, comment });
  const agg = await Review.aggregate([{ $match: { trip: trip._id } }, { $group: { _id: null, avg: { $avg: '$rating' }, n: { $sum: 1 } } }]);
  await Trip.updateOne({ _id: trip._id }, { avgRating: Math.round(agg[0].avg * 10) / 10, reviewCount: agg[0].n });
  await notify(trip.creator, { type: 'review', actor: req.user._id, title: 'New review', body: `${req.user.name} rated ${trip.title} ${rating}★`, link: `/trips/${trip.slug}` });
  res.status(201).json({ success: true, review: await review.populate('author', 'name username profileImage') });
}));

/* ---------- checklist (group-only) ---------- */
const memberOnly = async (req) => { const trip = await findTrip(req.params.id); if (!(await isMember(trip._id, req.user._id))) throw new AppError('Only trip members can access this', 403); return trip; };
r.get('/:id/checklist', protect, wrap(async (req, res) => { const t = await memberOnly(req); res.json({ success: true, checklist: t.checklist }); }));
r.post('/:id/checklist', protect, wrap(async (req, res) => {
  const { text } = z.object({ text: z.string().trim().min(1).max(120) }).parse(req.body);
  const t = await memberOnly(req); needCreator(t, req.user);
  if (t.checklist.length >= 60) throw new AppError('Checklist is full', 400);
  t.checklist.push({ text, addedBy: req.user._id }); await t.save();
  res.status(201).json({ success: true, checklist: t.checklist });
}));
r.patch('/:id/checklist/:itemId', protect, wrap(async (req, res) => {
  const { done } = z.object({ done: z.boolean() }).parse(req.body);
  const t = await memberOnly(req); const it = t.checklist.id(req.params.itemId);
  if (!it) throw new AppError('Item not found', 404);
  it.done = done; it.doneBy = done ? req.user._id : undefined; await t.save();
  res.json({ success: true, checklist: t.checklist });
}));
r.delete('/:id/checklist/:itemId', protect, wrap(async (req, res) => {
  const t = await memberOnly(req); needCreator(t, req.user);
  t.checklist.pull({ _id: req.params.itemId }); await t.save();
  res.json({ success: true, checklist: t.checklist });
}));

/* ---------- expenses (group-only) ---------- */
r.get('/:id/expenses', protect, wrap(async (req, res) => {
  const t = await memberOnly(req);
  const expenses = await Expense.find({ trip: t._id }).sort('-date').populate('paidBy', 'name username profileImage').populate('participants', 'name username');
  const bal = computeBalances(expenses.map(e => ({ amount: e.amount, paidBy: e.paidBy._id, participants: e.participants.map(p => p._id) })));
  const members = await TripMember.find({ trip: t._id }).populate('user', 'name username profileImage');
  const users = Object.fromEntries(members.map(m => [String(m.user._id), m.user]));
  res.json({ success: true, expenses, total: bal.total, net: bal.net, settlements: bal.settlements.map(s => ({ ...s, fromUser: users[s.from], toUser: users[s.to] })), me: String(req.user._id) });
}));
r.post('/:id/expenses', protect, wrap(async (req, res) => {
  const d = z.object({ description: z.string().trim().min(1).max(140), amount: z.coerce.number().positive().max(10000000), paidBy: z.string().optional(), participants: z.array(z.string()).min(1, 'Choose at least one participant'), date: z.coerce.date().optional() }).parse(req.body);
  const t = await memberOnly(req);
  const ids = (await memberIds(t._id)).map(String);
  const paidBy = d.paidBy || String(req.user._id);
  if (!ids.includes(paidBy) || !d.participants.every(p => ids.includes(p))) throw new AppError('Payer and participants must be trip members', 400);
  const e = await Expense.create({ trip: t._id, description: d.description, amount: d.amount, paidBy, participants: [...new Set(d.participants)], date: d.date || new Date() });
  res.status(201).json({ success: true, expense: e });
}));
r.delete('/:id/expenses/:expenseId', protect, wrap(async (req, res) => {
  const t = await memberOnly(req); const e = await Expense.findOne({ _id: req.params.expenseId, trip: t._id });
  if (!e) throw new AppError('Expense not found', 404);
  if (!sameId(e.paidBy, req.user._id) && !sameId(t.creator, req.user._id)) throw new AppError('Only the payer or organizer can delete this', 403);
  await e.deleteOne(); res.json({ success: true });
}));

/* ---------- invitations ---------- */
r.post('/:id/invite', protect, wrap(async (req, res) => {
  const { userId } = z.object({ userId: z.string() }).parse(req.body);
  const trip = await findTrip(req.params.id);
  if (!(await isMember(trip._id, req.user._id))) throw new AppError('Only members can invite others', 403);
  if (trip.status !== 'active' || trip.startDate <= new Date()) throw new AppError('This trip is not open for invitations', 400);
  if (await isMember(trip._id, userId)) throw new AppError('That traveler is already a member', 409);
  const { canMessage, getOrCreatePrivate, createMessage } = await import('../services/chat.js');
  await canMessage(req.user._id, userId);
  let inv = await Invitation.findOne({ trip: trip._id, to: userId });
  if (inv?.status === 'pending') throw new AppError('Invitation already sent', 409);
  inv = inv ? Object.assign(inv, { status: 'pending', from: req.user._id }) : new Invitation({ trip: trip._id, from: req.user._id, to: userId });
  await inv.save();
  const conv = await getOrCreatePrivate(req.user._id, userId);
  await createMessage({ conversationId: conv._id, senderId: req.user._id, type: 'invite', text: `${req.user.name} invited you to join ${trip.title}`, invitation: inv._id });
  await notify(userId, { type: 'invitation', actor: req.user._id, title: 'Trip invitation', body: `${req.user.name} invited you to join ${trip.title}`, link: `/messages/${conv._id}` });
  res.status(201).json({ success: true, invitation: inv, conversationId: conv._id });
}));
/* ---------- ownership transfer ---------- */
r.post('/:id/transfer', protect, wrap(async (req, res) => {
  const { userId } = z.object({ userId: z.string() }).parse(req.body);
  const trip = await findTrip(req.params.id);
  if (!sameId(trip.creator, req.user._id)) throw new AppError('Only the organizer can transfer ownership', 403);
  if (sameId(userId, req.user._id)) throw new AppError('You are already the organizer', 400);
  if (trip.status !== 'active') throw new AppError('Only active trips can be transferred', 400);
  const target = await TripMember.findOne({ trip: trip._id, user: userId });
  if (!target) throw new AppError('Choose a current member of this trip', 400);
  await TripMember.updateOne({ trip: trip._id, user: req.user._id }, { role: 'member' });
  target.role = 'owner'; await target.save();
  trip.creator = userId; await trip.save();
  const u = await User.findById(userId).select('name');
  await systemMessage(trip.conversation, `${req.user.name} made ${u.name} the organizer`);
  await notify(userId, { type: 'trip_updated', actor: req.user._id, title: 'You are now the organizer', body: `You now organize ${trip.title}`, link: `/trips/${trip.slug}/manage` });
  res.json({ success: true });
}));

/* ---------- photo gallery (members only) ---------- */
const ownUpload = (u) => u.startsWith(`${env.SERVER_URL}/uploads/`) || /^https:\/\/res\.cloudinary\.com\//.test(u);
r.get('/:id/photos', protect, wrap(async (req, res) => {
  const t = await memberOnly(req);
  res.json({ success: true, photos: await TripPhoto.find({ trip: t._id }).sort('-createdAt').limit(200).populate('user', 'name username profileImage') });
}));
r.post('/:id/photos', protect, wrap(async (req, res) => {
  const d = z.object({ url: z.string().url().refine(ownUpload, 'Upload the photo through Travel Together'), caption: z.string().max(200).optional().default('') }).parse(req.body);
  const t = await memberOnly(req);
  if ((await TripPhoto.countDocuments({ trip: t._id })) >= 200) throw new AppError('The gallery is full', 400);
  const p = await TripPhoto.create({ trip: t._id, user: req.user._id, ...d });
  res.status(201).json({ success: true, photo: await p.populate('user', 'name username profileImage') });
}));
r.delete('/:id/photos/:photoId', protect, wrap(async (req, res) => {
  const t = await memberOnly(req); const p = await TripPhoto.findOne({ _id: req.params.photoId, trip: t._id });
  if (!p) throw new AppError('Photo not found', 404);
  if (!sameId(p.user, req.user._id) && !sameId(t.creator, req.user._id)) throw new AppError('Only the uploader or organizer can delete this', 403);
  await p.deleteOne(); res.json({ success: true });
}));

/* ---------- private trip info: visible ONLY to its author ---------- */
r.get('/:id/notes', protect, wrap(async (req, res) => {
  const t = await memberOnly(req);
  res.json({ success: true, notes: await TripNote.find({ trip: t._id, user: req.user._id }).sort('-createdAt') });
}));
r.post('/:id/notes', protect, wrap(async (req, res) => {
  const d = z.object({ kind: z.enum(['hotel', 'transport', 'emergency', 'note']).default('note'), title: z.string().trim().min(1, 'Add a title').max(100), content: z.string().max(2000).optional().default('') }).parse(req.body);
  const t = await memberOnly(req);
  if ((await TripNote.countDocuments({ trip: t._id, user: req.user._id })) >= 50) throw new AppError('You have reached the limit of 50 notes for this trip', 400);
  res.status(201).json({ success: true, note: await TripNote.create({ trip: t._id, user: req.user._id, ...d }) });
}));
r.delete('/:id/notes/:noteId', protect, wrap(async (req, res) => {
  const t = await memberOnly(req);
  await TripNote.deleteOne({ _id: req.params.noteId, trip: t._id, user: req.user._id }); res.json({ success: true });
}));
export { findTrip };
export default r;
