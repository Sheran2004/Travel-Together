import { useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { Check, X, MessageCircle, UserMinus, Ban, Trash2, Users } from 'lucide-react';
import api, { errMsg } from '../services/api';
import { useFetch } from '../hooks/useFetch';
import { useToast } from '../context/ToastContext';
import { Async, Avatar, ConfirmModal, EmptyState } from '../components/ui';
import { dateRange } from '../utils/format';

export default function ManageTrip() {
  const { slug } = useParams(); const nav = useNavigate(); const toast = useToast();
  const trip = useFetch(`/trips/${slug}`); const t = trip.data?.trip;
  const reqs = useFetch(`/trips/${slug}/requests`, null, { enabled: !!t && trip.data?.viewer?.isCreator });
  const [confirm, setConfirm] = useState(null); const [busy, setBusy] = useState(false);
  const run = async (fn, ok) => { setBusy(true); try { await fn(); toast.success(ok); await Promise.all([trip.reload(), reqs.reload?.()]); setConfirm(null); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); } };
  if (t && !trip.data.viewer.isCreator) return <div className="container-x py-16"><EmptyState title="Only the organizer can manage this trip" action={<Link to={`/trips/${t.slug}`} className="btn-primary">Back to trip</Link>} /></div>;
  return (
    <Async loading={trip.loading} error={trip.error} onRetry={trip.reload}>
      {t && <div className="container-x max-w-4xl space-y-8 py-8">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><Link to={`/trips/${t.slug}`} className="text-sm text-brand">← Back to trip</Link><h1 className="text-3xl font-extrabold">Manage: {t.title}</h1><p className="text-muted">{dateRange(t.startDate, t.endDate)} · {t.memberCount}/{t.maxMembers} members · {t.status}</p></div>
          <div className="flex gap-2"><Link to={`/trips/${t.slug}/edit`} className="btn-ghost">Edit trip & itinerary</Link></div></div>

        <section className="card p-5"><h2 className="mb-4 text-lg font-bold">Join requests {reqs.data?.requests.length ? `(${reqs.data.requests.length})` : ''}</h2>
          <Async loading={reqs.loading} error={reqs.error} onRetry={reqs.reload}>
            {reqs.data?.requests.length ? <ul className="space-y-3">{reqs.data.requests.map((r) => (
              <li key={r._id} className="rounded-xl border border-line p-4"><div className="flex flex-wrap items-start gap-3"><Link to={`/travelers/${r.user.username}`}><Avatar user={r.user} size={48} /></Link>
                <div className="min-w-0 flex-1"><Link to={`/travelers/${r.user.username}`} className="font-semibold hover:text-brand">{r.user.name}</Link><p className="text-xs text-muted">{r.user.city} · {r.mutualConnections} mutual connection{r.mutualConnections === 1 ? '' : 's'} · {r.reviewsWritten} review{r.reviewsWritten === 1 ? '' : 's'} written</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">{[...(r.user.travelStyle || []), ...(r.user.travelInterests || [])].slice(0, 5).map((x) => <span key={x} className="chip">{x}</span>)}</div>
                  {r.message && <p className="mt-2 rounded-lg bg-raised p-2.5 text-sm">“{r.message}”</p>}</div>
                <div className="flex gap-2"><Link to={`/messages?user=${r.user._id}`} className="btn-ghost btn-sm" aria-label="Message applicant"><MessageCircle className="h-4 w-4" /></Link>
                  <button className="btn-primary btn-sm" disabled={busy} onClick={() => run(() => api.post(`/trips/${t._id}/requests/${r._id}/accept`), `${r.user.name} added to the trip`)}><Check className="h-4 w-4" />Accept</button>
                  <button className="btn-ghost btn-sm" disabled={busy} onClick={() => run(() => api.post(`/trips/${t._id}/requests/${r._id}/reject`), 'Request declined')}><X className="h-4 w-4" />Reject</button></div></div></li>))}</ul> : <p className="text-sm text-muted">{t.joinMode === 'request' ? 'No pending requests.' : 'This trip is open-join, so requests are not needed.'}</p>}</Async></section>

        <section className="card p-5"><h2 className="mb-4 text-lg font-bold">Members</h2>
          <ul className="divide-y divide-line">{trip.data.members.map((m) => <li key={m._id} className="flex items-center gap-3 py-3"><Avatar user={m} size={40} /><Link to={`/travelers/${m.username}`} className="flex-1 font-medium hover:text-brand">{m.name}{m.role === 'owner' && <span className="chip ml-2">Organizer</span>}</Link>
            {m.role !== 'owner' && <><button className="btn-ghost btn-sm" onClick={() => setConfirm({ kind: 'transfer', m })}>Make organizer</button><button className="btn-ghost btn-sm text-danger" onClick={() => setConfirm({ kind: 'remove', m })}><UserMinus className="h-4 w-4" />Remove</button></>}</li>)}</ul></section>

        <section className="card border-danger/30 p-5"><h2 className="mb-1 text-lg font-bold text-danger">Danger zone</h2><p className="mb-4 text-sm text-muted">Cancelling keeps the trip visible to members but hides it from discovery. Deleting removes it permanently.</p>
          <div className="flex flex-wrap gap-3">{t.status === 'active' && <button className="btn-ghost text-danger" onClick={() => setConfirm({ kind: 'cancel' })}><Ban className="h-4 w-4" />Cancel trip</button>}<button className="btn-danger" onClick={() => setConfirm({ kind: 'delete' })}><Trash2 className="h-4 w-4" />Delete trip</button></div></section>

        <ConfirmModal open={confirm?.kind === 'remove'} onClose={() => setConfirm(null)} busy={busy} danger title={`Remove ${confirm?.m?.name}?`} text="They will lose access to the group chat and be notified." confirmLabel="Remove member" onConfirm={() => run(() => api.delete(`/trips/${t._id}/members/${confirm.m._id}`), 'Member removed')} />
        <ConfirmModal open={confirm?.kind === 'transfer'} onClose={() => setConfirm(null)} busy={busy} title={`Make ${confirm?.m?.name} the organizer?`} text="They will be able to edit, manage and cancel this trip. You will become a regular member. This can only be undone by the new organizer." confirmLabel="Transfer ownership" onConfirm={() => run(() => api.post(`/trips/${t._id}/transfer`, { userId: confirm.m._id }), 'Ownership transferred')} />
        <ConfirmModal open={confirm?.kind === 'cancel'} onClose={() => setConfirm(null)} busy={busy} danger title="Cancel this trip?" text="All members are notified and the trip disappears from Explore and the map." confirmLabel="Cancel trip" onConfirm={() => run(() => api.post(`/trips/${t._id}/cancel`), 'Trip cancelled')} />
        <ConfirmModal open={confirm?.kind === 'delete'} onClose={() => setConfirm(null)} busy={busy} danger title="Delete this trip permanently?" text="This removes the trip, its group chat access, expenses and saved entries. This cannot be undone." confirmLabel="Delete forever" onConfirm={async () => { setBusy(true); try { await api.delete(`/trips/${t._id}`); toast.success('Trip deleted'); nav('/my-trips'); } catch (e) { toast.error(errMsg(e)); setBusy(false); } }} />
      </div>}
    </Async>
  );
}
