import Trip from '../models/Trip.js';
import User from '../models/User.js';
import { TripMember, Conversation, JoinRequest } from '../models/misc.js';
import { AppError, sameId } from '../utils/helpers.js';
import { notify } from './notify.js';
import { systemMessage } from './chat.js';
import { emitToUser } from './realtime.js';

export async function createTripConversation(trip) {
  const conv = await Conversation.create({ type: 'group', trip: trip._id, participants: [trip.creator] });
  trip.conversation = conv._id; await trip.save();
  return conv;
}

/** Atomically adds a member, enforcing capacity, status and start date. Throws AppError on failure. */
export async function addMember(tripId, userId, { silent = false } = {}) {
  const existing = await TripMember.exists({ trip: tripId, user: userId });
  if (existing) throw new AppError('You have already joined this trip', 409);
  const trip = await Trip.findOneAndUpdate(
    { _id: tripId, status: 'active', startDate: { $gt: new Date() }, $expr: { $lt: ['$memberCount', '$maxMembers'] } },
    { $inc: { memberCount: 1 } }, { new: true });
  if (!trip) {
    const t = await Trip.findById(tripId);
    if (!t) throw new AppError('Trip not found', 404);
    if (t.status !== 'active') throw new AppError('This trip is no longer active', 400);
    if (t.startDate <= new Date()) throw new AppError('This trip has already started', 400);
    throw new AppError('This trip is full', 400);
  }
  try { await TripMember.create({ trip: tripId, user: userId, role: sameId(trip.creator, userId) ? 'owner' : 'member' }); }
  catch (e) { await Trip.updateOne({ _id: tripId }, { $inc: { memberCount: -1 } }); if (e.code === 11000) throw new AppError('You have already joined this trip', 409); throw e; }
  await Conversation.updateOne({ _id: trip.conversation }, { $addToSet: { participants: userId } });
  await JoinRequest.updateMany({ trip: tripId, user: userId, status: 'pending' }, { status: 'accepted' });
  if (!silent) {
    const u = await User.findById(userId).select('name');
    await systemMessage(trip.conversation, `${u.name} joined the trip`);
    await notify(trip.creator, { type: 'trip_joined', actor: userId, title: 'New member', body: `${u.name} joined ${trip.title}`, link: `/trips/${trip.slug}` });
    await notify(userId, { type: 'trip_joined', actor: trip.creator, title: 'You joined a trip', body: `Welcome to ${trip.title}!`, link: `/trips/${trip.slug}` });
  }
  return trip;
}

export async function removeMember(trip, userId, { reason = 'left' } = {}) {
  const del = await TripMember.findOneAndDelete({ trip: trip._id, user: userId });
  if (!del) throw new AppError('This traveler is not a member of the trip', 400);
  await Trip.updateOne({ _id: trip._id }, { $inc: { memberCount: -1 } });
  await Conversation.updateOne({ _id: trip.conversation }, { $pull: { participants: userId } });
  const u = await User.findById(userId).select('name');
  await systemMessage(trip.conversation, `${u.name} ${reason === 'removed' ? 'was removed from' : 'left'} the trip`);
  emitToUser(userId, 'trip:membership', { tripId: trip._id });
  if (reason === 'left') await notify(trip.creator, { type: 'trip_left', actor: userId, title: 'A member left', body: `${u.name} left ${trip.title}`, link: `/trips/${trip.slug}` });
  else await notify(userId, { type: 'trip_updated', actor: trip.creator, title: 'Removed from trip', body: `You were removed from ${trip.title}`, link: `/trips/${trip.slug}` });
}

export async function memberIds(tripId) { return TripMember.find({ trip: tripId }).distinct('user'); }
export async function isMember(tripId, userId) { return !!(await TripMember.exists({ trip: tripId, user: userId })); }
