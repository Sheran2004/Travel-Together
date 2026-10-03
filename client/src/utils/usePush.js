import { useCallback, useEffect, useState } from 'react';
import api from '../services/api';
const b64 = (s) => { const raw = atob((s + '='.repeat((4 - (s.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from([...raw].map((c) => c.charCodeAt(0))); };

/** Web Push (VAPID) subscription state + actions for the current device. */
export function usePush() {
  const supported = typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  const [state, setState] = useState({ loading: true, configured: false, key: null, subscribed: false, permission: supported ? Notification.permission : 'denied' });
  const refresh = useCallback(async () => {
    if (!supported) return setState((s) => ({ ...s, loading: false }));
    try {
      const [{ data }, reg] = await Promise.all([api.get('/push/key'), navigator.serviceWorker.getRegistration('/sw.js')]);
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      setState({ loading: false, configured: data.enabled, key: data.publicKey, subscribed: !!sub, permission: Notification.permission });
    } catch { setState((s) => ({ ...s, loading: false })); }
  }, [supported]);
  useEffect(() => { refresh(); }, [refresh]);
  const enable = async () => {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') { await refresh(); throw new Error('Notification permission was not granted'); }
    const reg = await navigator.serviceWorker.register('/sw.js'); await navigator.serviceWorker.ready;
    const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(state.key) }));
    await api.post('/push/subscribe', sub.toJSON()); await refresh();
  };
  const disable = async () => {
    const reg = await navigator.serviceWorker.getRegistration('/sw.js'); const sub = await reg?.pushManager.getSubscription();
    if (sub) { await api.post('/push/unsubscribe', { endpoint: sub.endpoint }).catch(() => {}); await sub.unsubscribe(); }
    await refresh();
  };
  const test = () => api.post('/push/test');
  return { supported, ...state, enable, disable, test };
}
