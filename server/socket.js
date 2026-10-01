import { Server } from 'socket.io';
import { userFromToken } from './middleware/auth.js';
import { env } from './config/env.js';
import User from './models/User.js';
import { Call, Conversation, Message } from './models/misc.js';
import { createMessage, canMessage, assertParticipant } from './services/chat.js';
import { setIO, addPresence, removePresence, emitToUser, isOnline } from './services/realtime.js';
import { notify } from './services/notify.js';
import { sameId } from './utils/helpers.js';

const RING_TIMEOUT_MS = 45000;
const ringTimers = new Map();   // callId -> timeout
const activeCall = new Map();   // userId -> callId

export function initSocket(httpServer) {
  const io = new Server(httpServer, { cors: { origin: env.CLIENT_URL, credentials: true }, maxHttpBufferSize: 1e6 });
  setIO(io);

  // The user identity ALWAYS comes from the verified JWT, never from client-supplied ids.
  io.use(async (socket, next) => {
    try { socket.user = await userFromToken(socket.handshake.auth?.token || ''); next(); }
    catch (e) { next(new Error(e.message || 'Unauthorized')); }
  });

  io.on('connection', async (socket) => {
    const me = socket.user; const uid = String(me._id);
    socket.join(`user:${uid}`);
    if (addPresence(uid, socket.id) && me.privacySettings?.showOnlineStatus !== false) socket.broadcast.emit('user:online', { userId: uid });
    socket.emit('presence:init', { online: [...new Set([])] });

    // mark pending messages as delivered
    const convIds = await Conversation.find({ participants: me._id }).distinct('_id');
    const pending = await Message.find({ conversation: { $in: convIds }, sender: { $ne: me._id }, deliveredTo: { $ne: me._id } }).select('_id conversation sender');
    if (pending.length) {
      await Message.updateMany({ _id: { $in: pending.map(m => m._id) } }, { $addToSet: { deliveredTo: me._id } });
      [...new Set(pending.map(m => String(m.sender)))].forEach(s => emitToUser(s, 'message:delivered', { userId: uid, messageIds: pending.filter(m => String(m.sender) === s).map(m => m._id) }));
    }

    const ack = (cb, payload) => typeof cb === 'function' && cb(payload);
    const fail = (cb, e) => ack(cb, { ok: false, error: e.message || 'Something went wrong' });

    socket.on('presence:query', async (ids, cb) => {
      const list = (Array.isArray(ids) ? ids : []).slice(0, 200);
      const users = await User.find({ _id: { $in: list } }).select('privacySettings');
      ack(cb, { online: users.filter(u => u.privacySettings?.showOnlineStatus !== false && isOnline(u._id)).map(u => String(u._id)) });
    });

    socket.on('message:send', async (payload, cb) => {
      try {
        const { conversationId, type, text, mediaUrl, fileName, mimeType, duration, waveform, replyTo } = payload || {};
        const msg = await createMessage({ conversationId, senderId: me._id, type, text, mediaUrl, fileName, mimeType, duration, waveform, replyTo });
        ack(cb, { ok: true, message: msg });
      } catch (e) { fail(cb, e); }
    });

    socket.on('message:read', async ({ conversationId } = {}, cb) => {
      try {
        const conv = await assertParticipant(conversationId, me._id);
        const unread = await Message.find({ conversation: conv._id, readBy: { $ne: me._id } }).select('_id');
        if (unread.length) {
          await Message.updateMany({ _id: { $in: unread.map(m => m._id) } }, { $addToSet: { readBy: me._id, deliveredTo: me._id } });
          conv.participants.forEach(p => emitToUser(p, 'message:read', { conversationId: conv._id, userId: uid, messageIds: unread.map(m => m._id) }));
        }
        ack(cb, { ok: true });
      } catch (e) { fail(cb, e); }
    });

    socket.on('message:delete', async ({ messageId } = {}, cb) => {
      try {
        const m = await Message.findById(messageId); if (!m) throw new Error('Message not found');
        const conv = await assertParticipant(m.conversation, me._id);
        if (!sameId(m.sender, me._id)) throw new Error('You can only delete your own messages here');
        m.deleted = true; m.pinned = false; await m.save();
        conv.participants.forEach(p => emitToUser(p, 'message:delete', { id: m._id, conversationId: conv._id }));
        ack(cb, { ok: true });
      } catch (e) { fail(cb, e); }
    });

    const typing = (state) => async ({ conversationId } = {}) => {
      try {
        const conv = await assertParticipant(conversationId, me._id);
        conv.participants.filter(p => !sameId(p, me._id)).forEach(p => emitToUser(p, 'typing:update', { conversationId, userId: uid, name: me.name, typing: state }));
      } catch { /* ignore invalid typing pings */ }
    };
    socket.on('typing:start', typing(true));
    socket.on('typing:stop', typing(false));

    /* ---------------- WebRTC signaling ---------------- */
    const endCall = async (call, status, endedBy) => {
      clearTimeout(ringTimers.get(String(call._id))); ringTimers.delete(String(call._id));
      const wasAccepted = call.status === 'accepted';
      call.endedAt = new Date();
      if (wasAccepted) { call.status = 'completed'; call.duration = Math.round((call.endedAt - call.startedAt) / 1000); } else call.status = status;
      await call.save();
      activeCall.delete(String(call.caller)); activeCall.delete(String(call.receiver));
      const other = sameId(call.caller, endedBy) ? call.receiver : call.caller;
      emitToUser(other, 'call:ended', { callId: call._id, status: call.status, duration: call.duration });
      emitToUser(endedBy, 'call:ended', { callId: call._id, status: call.status, duration: call.duration });
    };

    socket.on('call:offer', async ({ to, offer, callType = 'voice' } = {}, cb) => {
      try {
        if (!to || !offer || sameId(to, me._id)) throw new Error('Invalid call');
        if (!['voice', 'video'].includes(callType)) throw new Error('Invalid call type');
        await canMessage(me._id, to);
        if (activeCall.has(uid)) throw new Error('You are already in a call');
        const call = await Call.create({ caller: me._id, receiver: to, callType, status: 'calling' });
        if (!isOnline(to)) {
          call.status = 'missed'; call.endedAt = new Date(); await call.save();
          await notify(to, { type: 'missed_call', actor: me._id, title: 'Missed call', body: `${me.name} tried to call you`, link: `/messages` });
          return ack(cb, { ok: false, error: 'This traveler is offline right now', callId: call._id, status: 'missed' });
        }
        if (activeCall.has(String(to))) { call.status = 'missed'; call.endedAt = new Date(); await call.save(); return ack(cb, { ok: false, error: 'This traveler is on another call', callId: call._id, status: 'missed' }); }
        activeCall.set(uid, String(call._id));
        emitToUser(to, 'call:incoming', { callId: call._id, from: { _id: uid, name: me.name, username: me.username, profileImage: me.profileImage }, offer, callType });
        ringTimers.set(String(call._id), setTimeout(async () => {
          const c = await Call.findById(call._id);
          if (c && c.status === 'calling') {
            c.status = 'missed'; c.endedAt = new Date(); await c.save(); activeCall.delete(uid);
            emitToUser(c.caller, 'call:ended', { callId: c._id, status: 'missed', reason: 'No answer' }); emitToUser(c.receiver, 'call:ended', { callId: c._id, status: 'missed' });
            await notify(c.receiver, { type: 'missed_call', actor: c.caller, title: 'Missed call', body: `You missed a call from ${me.name}`, link: '/messages' });
          }
        }, RING_TIMEOUT_MS));
        ack(cb, { ok: true, callId: call._id });
      } catch (e) { fail(cb, e); }
    });

    const loadCall = async (callId) => {
      const call = await Call.findById(callId);
      if (!call || !(sameId(call.caller, me._id) || sameId(call.receiver, me._id))) throw new Error('Call not found');
      return call;
    };

    socket.on('call:answer', async ({ callId, answer } = {}, cb) => {
      try {
        const call = await loadCall(callId);
        if (!sameId(call.receiver, me._id) || call.status !== 'calling') throw new Error('Call is no longer available');
        clearTimeout(ringTimers.get(String(call._id))); ringTimers.delete(String(call._id));
        call.status = 'accepted'; call.startedAt = new Date(); await call.save();
        activeCall.set(uid, String(call._id));
        emitToUser(call.caller, 'call:answered', { callId: call._id, answer });
        ack(cb, { ok: true });
      } catch (e) { fail(cb, e); }
    });
    socket.on('call:reject', async ({ callId } = {}, cb) => {
      try { const call = await loadCall(callId); if (call.status === 'calling') await endCall(call, 'rejected', me._id); ack(cb, { ok: true }); } catch (e) { fail(cb, e); }
    });
    socket.on('call:end', async ({ callId, failed } = {}, cb) => {
      try {
        const call = await loadCall(callId);
        if (['completed', 'rejected', 'missed', 'failed'].includes(call.status)) return ack(cb, { ok: true });
        const cancelledBeforeAnswer = call.status === 'calling' && sameId(call.caller, me._id);
        await endCall(call, failed ? 'failed' : cancelledBeforeAnswer ? 'missed' : 'failed', me._id);
        if (cancelledBeforeAnswer && !failed) await notify(call.receiver, { type: 'missed_call', actor: me._id, title: 'Missed call', body: `You missed a call from ${me.name}`, link: '/messages' });
        ack(cb, { ok: true });
      } catch (e) { fail(cb, e); }
    });
    socket.on('call:ice-candidate', async ({ callId, candidate } = {}) => {
      try { const call = await loadCall(callId); const other = sameId(call.caller, me._id) ? call.receiver : call.caller; emitToUser(other, 'call:ice-candidate', { callId, candidate }); } catch { /* ignore */ }
    });

    socket.on('disconnect', async () => {
      if (removePresence(uid, socket.id)) {
        const now = new Date(); await User.updateOne({ _id: me._id }, { lastSeen: now });
        if (me.privacySettings?.showOnlineStatus !== false) socket.broadcast.emit('user:offline', { userId: uid, lastSeen: now });
        const cid = activeCall.get(uid);
        if (cid) { const call = await Call.findById(cid); if (call && ['calling', 'accepted'].includes(call.status)) await endCall(call, 'failed', me._id); }
      }
    });
  });
  return io;
}
