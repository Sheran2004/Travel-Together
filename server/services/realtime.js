let io = null;
const presence = new Map(); // userId -> Set(socketId)
export const setIO = (i) => { io = i; };
export const getIO = () => io;
export const emitToUser = (userId, event, payload) => io?.to(`user:${userId}`).emit(event, payload);
export const isOnline = (id) => (presence.get(String(id))?.size || 0) > 0;
export const addPresence = (id, sid) => { const k = String(id); if (!presence.has(k)) presence.set(k, new Set()); presence.get(k).add(sid); return presence.get(k).size === 1; };
export const removePresence = (id, sid) => { const k = String(id); const s = presence.get(k); if (!s) return false; s.delete(sid); if (!s.size) { presence.delete(k); return true; } return false; };
export const onlineIds = () => [...presence.keys()];
