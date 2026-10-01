import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import api, { TOKEN_KEY } from '../services/api';
const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children, onUser }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!localStorage.getItem(TOKEN_KEY));
  useEffect(() => { onUser?.(user); }, [user]); // eslint-disable-line
  const logout = useCallback(() => { localStorage.removeItem(TOKEN_KEY); setUser(null); }, []);
  useEffect(() => {
    if (!localStorage.getItem(TOKEN_KEY)) return;
    api.get('/auth/me').then((r) => setUser(r.data.user)).catch(() => localStorage.removeItem(TOKEN_KEY)).finally(() => setLoading(false));
  }, []);
  useEffect(() => { const h = () => logout(); window.addEventListener('tt:unauthorized', h); return () => window.removeEventListener('tt:unauthorized', h); }, [logout]);
  const finish = (data) => { localStorage.setItem(TOKEN_KEY, data.token); setUser(data.user); return data.user; };
  const login = async (email, password) => finish((await api.post('/auth/login', { email, password })).data);
  const register = async (payload) => finish((await api.post('/auth/register', payload)).data);
  const refresh = async () => { const r = await api.get('/auth/me'); setUser(r.data.user); return r.data.user; };
  const logoutAll = async () => { await api.post('/auth/logout', { allSessions: true }); logout(); };
  return <Ctx.Provider value={{ user, setUser, loading, login, register, logout, logoutAll, refresh }}>{children}</Ctx.Provider>;
}
