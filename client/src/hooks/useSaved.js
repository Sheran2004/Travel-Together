import { useEffect, useState, useCallback } from 'react';
import api, { errMsg } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useNavigate } from 'react-router-dom';
/** Saved-trip state backed by /users/favorites (persisted in MongoDB). */
export function useSavedToggle(initial) {
  const { user } = useAuth(); const toast = useToast(); const nav = useNavigate();
  const [ids, setIds] = useState(new Set());
  useEffect(() => { if (initial) setIds(new Set(initial.map((t) => t._id))); }, [initial]);
  useEffect(() => { if (user && !initial) api.get('/users/favorites').then((r) => setIds(new Set(r.data.trips.map((t) => t._id)))).catch(() => {}); }, [user?._id]); // eslint-disable-line
  const toggle = useCallback(async (trip) => {
    if (!user) { toast.info('Log in to save trips'); return nav('/login'); }
    const has = ids.has(trip._id); const next = new Set(ids); has ? next.delete(trip._id) : next.add(trip._id); setIds(next);
    try { has ? await api.delete(`/trips/${trip._id}/favorite`) : await api.post(`/trips/${trip._id}/favorite`); toast.success(has ? 'Removed from saved' : 'Saved to your list'); }
    catch (e) { setIds(ids); toast.error(errMsg(e)); }
  }, [ids, user]); // eslint-disable-line
  return { isSaved: (id) => ids.has(id), toggle };
}
