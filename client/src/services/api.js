import axios from 'axios';
export const API_URL = import.meta.env.VITE_API_URL || '';
export const TOKEN_KEY = 'tt_token';
const api = axios.create({ baseURL: `${API_URL}/api`, timeout: 20000 });
api.interceptors.request.use((cfg) => { const t = localStorage.getItem(TOKEN_KEY); if (t) cfg.headers.Authorization = `Bearer ${t}`; return cfg; });
api.interceptors.response.use((r) => r, (err) => {
  if (err.response?.status === 401 && localStorage.getItem(TOKEN_KEY)) window.dispatchEvent(new Event('tt:unauthorized'));
  return Promise.reject(err);
});
/** Human-friendly message from any axios error. */
export const errMsg = (e, fallback = 'Something went wrong. Please try again.') => {
  if (e?.response?.data?.errors) { const first = Object.values(e.response.data.errors)[0]; if (first) return String(first); }
  if (e?.response?.data?.message) return e.response.data.message;
  if (e?.code === 'ECONNABORTED') return 'The request timed out. Check your connection.';
  if (e?.message === 'Network Error') return 'Cannot reach the server. Is the backend running?';
  return fallback;
};
export const fieldErrors = (e) => e?.response?.data?.errors || {};
export const assetUrl = (u) => (!u ? '' : u.startsWith('/uploads') ? `${API_URL}${u}` : u);
export default api;
