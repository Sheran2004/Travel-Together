import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import api from '../services/api';
const Ctx = createContext(null);
export const useTheme = () => useContext(Ctx);
const resolve = (t) => (t === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : t);

export function ThemeProvider({ children, user }) {
  const [theme, setThemeState] = useState(() => localStorage.getItem('tt_theme') || 'system');
  const apply = useCallback((t) => { document.documentElement.dataset.theme = resolve(t); }, []);
  useEffect(() => { apply(theme); }, [theme, apply]);
  useEffect(() => { if (user?.theme && user.theme !== theme) { setThemeState(user.theme); localStorage.setItem('tt_theme', user.theme); } /* eslint-disable-next-line */ }, [user?._id]);
  useEffect(() => {
    if (theme !== 'system') return;
    const mq = matchMedia('(prefers-color-scheme: dark)'); const h = () => apply('system');
    mq.addEventListener('change', h); return () => mq.removeEventListener('change', h);
  }, [theme, apply]);
  const setTheme = async (t) => {
    setThemeState(t); localStorage.setItem('tt_theme', t);
    if (user) { try { await api.put('/users/profile', { theme: t }); } catch { /* local preference still applied */ } }
  };
  return <Ctx.Provider value={{ theme, resolved: resolve(theme), setTheme }}>{children}</Ctx.Provider>;
}
