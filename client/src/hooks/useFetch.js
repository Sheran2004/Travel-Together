import { useEffect, useState, useCallback, useRef } from 'react';
import api, { errMsg } from '../services/api';
/** GET helper with loading / error / data states and manual reload. */
export function useFetch(url, params, { enabled = true } = {}) {
  const [data, setData] = useState(null); const [loading, setLoading] = useState(enabled); const [error, setError] = useState('');
  const key = url + JSON.stringify(params || {}); const seq = useRef(0);
  const load = useCallback(async () => {
    if (!enabled || !url) return; const id = ++seq.current; setLoading(true); setError('');
    try { const r = await api.get(url, { params }); if (id === seq.current) setData(r.data); }
    catch (e) { if (id === seq.current) setError(errMsg(e)); }
    finally { if (id === seq.current) setLoading(false); }
  }, [key, enabled]); // eslint-disable-line
  useEffect(() => { load(); }, [load]);
  return { data, loading, error, reload: load, setData };
}
export function useDebounced(value, ms = 400) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}
