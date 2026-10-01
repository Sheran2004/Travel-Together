import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import api, { API_URL, TOKEN_KEY } from '../services/api';
import { useAuth } from './AuthContext';
const Ctx = createContext(null);
export const useSocket = () => useContext(Ctx);

export function SocketProvider({ children }) {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const [chatUnread, setChatUnread] = useState(0);
  const [online, setOnline] = useState(() => new Set());
  const ref = useRef(null);

  const loadNotifications = useCallback(async () => {
    try { const r = await api.get('/notifications'); setNotifications(r.data.notifications); setUnread(r.data.unread); } catch { /* shown as empty */ }
  }, []);
  const loadChatUnread = useCallback(async () => {
    try { const r = await api.get('/conversations'); setChatUnread(r.data.unreadTotal); } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!user) { ref.current?.disconnect(); ref.current = null; setSocket(null); setNotifications([]); setUnread(0); setChatUnread(0); setConnected(false); return; }
    const s = io(API_URL || undefined, { auth: { token: localStorage.getItem(TOKEN_KEY) }, transports: ['websocket', 'polling'], reconnectionDelayMax: 8000 });
    ref.current = s; setSocket(s);
    s.on('connect', () => setConnected(true)); s.on('disconnect', () => setConnected(false));
    s.on('user:online', ({ userId }) => setOnline((o) => new Set(o).add(userId)));
    s.on('user:offline', ({ userId }) => setOnline((o) => { const n = new Set(o); n.delete(userId); return n; }));
    s.on('notification:new', (n) => {
      setNotifications((l) => [n, ...l.filter((x) => x._id !== n._id)]);
      setUnread((c) => c + 1);
      if (n.type === 'message' || n.type === 'group_message') setChatUnread((c) => c + 1);
      if (document.hidden && 'Notification' in window && Notification.permission === 'granted') { try { new Notification(n.title || 'Travel Together', { body: n.body, tag: n._id }); } catch { /* unsupported */ } }
    });
    loadNotifications(); loadChatUnread();
    return () => { s.disconnect(); };
  }, [user?._id]); // eslint-disable-line

  const markRead = async (id) => { setNotifications((l) => l.map((n) => (n._id === id ? { ...n, read: true } : n))); setUnread((c) => Math.max(0, c - 1)); try { await api.put(`/notifications/${id}/read`); } catch { loadNotifications(); } };
  const markAllRead = async () => { setNotifications((l) => l.map((n) => ({ ...n, read: true }))); setUnread(0); try { await api.put('/notifications/read-all'); } catch { loadNotifications(); } };
  const removeNotification = async (id) => { const was = notifications.find((n) => n._id === id); setNotifications((l) => l.filter((n) => n._id !== id)); if (was && !was.read) setUnread((c) => Math.max(0, c - 1)); try { await api.delete(`/notifications/${id}`); } catch { loadNotifications(); } };
  const isOnline = (id) => online.has(String(id));
  const seedOnline = (ids) => setOnline((o) => { const n = new Set(o); ids.forEach((i) => n.add(String(i))); return n; });

  return <Ctx.Provider value={{ socket, connected, notifications, unread, chatUnread, setChatUnread, refreshChatUnread: loadChatUnread, markRead, markAllRead, removeNotification, reload: loadNotifications, isOnline, seedOnline }}>{children}</Ctx.Provider>;
}
