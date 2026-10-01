import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Compass, Pencil, Users, Trash2, LogOut, Eye } from 'lucide-react';
import api, { errMsg } from '../services/api';
import { useFetch } from '../hooks/useFetch';
import { useToast } from '../context/ToastContext';
import { Async, CardSkeletons, EmptyState, ConfirmModal } from '../components/ui';
import { TripCard } from '../components/cards';

const EMPTY = { created: ['No trips created yet', 'Create your first group and invite travelers.'], joined: ['You have not joined any trips', 'Browse Explore to find a group.'], upcoming: ['No upcoming trips', 'Your next adventure will appear here.'], completed: ['No completed trips', 'Trips you have finished will show here so you can review them.'] };
export default function MyTrips() {
  const [tab, setTab] = useState('upcoming'); const { data, loading, error, reload } = useFetch('/trips/mine'); const toast = useToast();
  const [confirm, setConfirm] = useState(null); const [busy, setBusy] = useState(false);
  const list = data?.[tab] || [];
  const act = async () => { setBusy(true); try { if (confirm.kind === 'leave') await api.post(`/trips/${confirm.t._id}/leave`); else if (confirm.kind === 'cancel') await api.post(`/trips/${confirm.t._id}/cancel`); else await api.delete(`/trips/${confirm.t._id}`); toast.success('Done'); setConfirm(null); reload(); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); } };
  return (
    <div className="container-x py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3"><h1 className="text-3xl font-extrabold">My trips</h1><Link to="/trips/new" className="btn-accent">Create trip</Link></div>
      <div className="no-scrollbar mb-6 flex gap-2 overflow-x-auto" role="tablist">{['upcoming', 'created', 'joined', 'completed'].map((k) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`btn btn-sm capitalize ${tab === k ? 'bg-brand text-brand-ink' : 'border border-line bg-surface'}`}>{k}{data && <span className="opacity-70">({data[k].length})</span>}</button>)}</div>
      <Async loading={loading} error={error} onRetry={reload} skeleton={<CardSkeletons n={3} />}>
        {list.length ? <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{list.map((t) => (
          <div key={t._id} className="space-y-2"><TripCard trip={t} />
            <div className="flex flex-wrap gap-2">{t.isCreator ? <>
              <Link to={`/trips/${t.slug}/edit`} className="btn-ghost btn-sm"><Pencil className="h-3.5 w-3.5" />Edit</Link><Link to={`/trips/${t.slug}/manage`} className="btn-ghost btn-sm"><Users className="h-3.5 w-3.5" />Members</Link>
              {t.status === 'active' && new Date(t.endDate) >= new Date() && <button className="btn-ghost btn-sm" onClick={() => setConfirm({ kind: 'cancel', t })}>Cancel</button>}<button className="btn-ghost btn-sm text-danger" onClick={() => setConfirm({ kind: 'delete', t })}><Trash2 className="h-3.5 w-3.5" />Delete</button></> : <>
              <Link to={`/trips/${t.slug}`} className="btn-ghost btn-sm"><Eye className="h-3.5 w-3.5" />View</Link>{new Date(t.endDate) >= new Date() && t.status === 'active' && <button className="btn-ghost btn-sm" onClick={() => setConfirm({ kind: 'leave', t })}><LogOut className="h-3.5 w-3.5" />Leave</button>}</>}
              {tab === 'completed' && <Link to={`/trips/${t.slug}`} className="btn-primary btn-sm">Write review</Link>}</div></div>))}</div>
          : <EmptyState icon={Compass} title={EMPTY[tab][0]} text={EMPTY[tab][1]} action={<Link to="/explore" className="btn-primary">Explore trips</Link>} />}
      </Async>
      <ConfirmModal open={!!confirm} onClose={() => setConfirm(null)} onConfirm={act} busy={busy} danger title={confirm?.kind === 'leave' ? 'Leave this trip?' : confirm?.kind === 'cancel' ? 'Cancel this trip?' : 'Delete this trip?'} text={confirm?.kind === 'leave' ? 'You will be removed from the group.' : confirm?.kind === 'cancel' ? 'Members are notified and the trip is hidden from discovery.' : 'This permanently deletes the trip for everyone.'} confirmLabel={confirm?.kind === 'leave' ? 'Leave' : confirm?.kind === 'cancel' ? 'Cancel trip' : 'Delete'} />
    </div>
  );
}
