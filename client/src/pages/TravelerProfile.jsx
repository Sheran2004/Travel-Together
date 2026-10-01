import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { MapPin, MessageCircle, UserPlus, Check, Clock, Flag, Ban, Lock, Calendar } from 'lucide-react';
import api, { errMsg } from '../services/api';
import { useFetch } from '../hooks/useFetch';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useToast } from '../context/ToastContext';
import { Async, Avatar, ConfirmModal, EmptyState } from '../components/ui';
import { ReportModal } from '../components/Extras';
import { dateRange, timeAgo, fmtDate } from '../utils/format';

export default function TravelerProfile() {
  const { username } = useParams(); const { user: me } = useAuth(); const { isOnline } = useSocket(); const toast = useToast(); const nav = useNavigate();
  const { data, loading, error, reload } = useFetch(`/users/by-username/${username}`);
  const [report, setReport] = useState(false); const [block, setBlock] = useState(false); const u = data?.user; const self = me && u && me._id === u._id;
  const need = () => { toast.info('Log in to continue'); nav('/login'); };
  const run = async (fn, ok) => { if (!me) return need(); try { await fn(); if (ok) toast.success(ok); reload(); } catch (e) { toast.error(errMsg(e)); } };
  const c = u?.connection;
  const TripList = ({ trips }) => <ul className="grid gap-3 sm:grid-cols-2">{trips.map((t) => <li key={t._id}><Link to={`/trips/${t.slug}`} className="card flex gap-3 p-3 hover:shadow-pop"><img src={t.coverImage} alt="" className="h-16 w-16 rounded-lg object-cover" loading="lazy" /><span className="min-w-0"><b className="block truncate">{t.title}</b><span className="text-xs text-muted">{t.destination} · {dateRange(t.startDate, t.endDate)}</span></span></Link></li>)}</ul>;
  return (
    <Async loading={loading} error={error} onRetry={reload}>
      {u && <div className="container-x max-w-4xl space-y-8 py-8">
        <div className="card flex flex-col gap-5 p-6 sm:flex-row sm:items-start">
          <Avatar user={u} size={104} online={u.limited ? undefined : (isOnline(u._id) || u.online)} />
          <div className="min-w-0 flex-1"><h1 className="text-3xl font-extrabold">{u.name}</h1><p className="text-muted">@{u.username}</p>
            {!u.limited && <><p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">{u.city && <span className="flex items-center gap-1"><MapPin className="h-4 w-4" />{[u.city, u.country].filter(Boolean).join(', ')}</span>}{u.age && <span>{u.age} yrs</span>}{!self && (isOnline(u._id) || u.online ? <span className="text-ok">● Online</span> : u.lastSeen && <span>Last seen {timeAgo(u.lastSeen)}</span>)}</p>
              {u.bio && <p className="mt-3">{u.bio}</p>}</>}
            {u.limited && <p className="mt-3 flex items-center gap-2 text-sm text-muted"><Lock className="h-4 w-4" />This traveler keeps their profile private.</p>}
            <div className="mt-4 flex flex-wrap gap-2">
              {self ? <Link to="/profile" className="btn-primary">Edit profile</Link> : <>
                <button className="btn-primary" onClick={() => (me ? nav(`/messages?user=${u._id}`) : need())}><MessageCircle className="h-4 w-4" />Message</button>
                {!c ? <button className="btn-ghost" onClick={() => run(() => api.post(`/connections/${u._id}/request`), 'Connection request sent')}><UserPlus className="h-4 w-4" />Connect</button>
                  : c.status === 'accepted' ? <button className="btn-ghost" onClick={() => run(() => api.delete(`/connections/${u._id}`), 'Connection removed')}><Check className="h-4 w-4" />Connected</button>
                  : c.direction === 'sent' ? <button className="btn-ghost" onClick={() => run(() => api.delete(`/connections/${u._id}`), 'Request cancelled')}><Clock className="h-4 w-4" />Pending</button>
                  : <button className="btn-ghost" onClick={() => run(() => api.post(`/connections/${u._id}/accept`), 'Connected!')}><Check className="h-4 w-4" />Accept request</button>}
                <button className="btn-ghost" onClick={() => (me ? setReport(true) : need())}><Flag className="h-4 w-4" />Report</button><button className="btn-ghost text-danger" onClick={() => (me ? setBlock(true) : need())}><Ban className="h-4 w-4" />Block</button></>}</div></div>
          {u.compatibility && u.compatibility.score > 0 && <div className="rounded-2xl bg-raised p-4 text-center sm:w-44"><p className="font-display text-4xl font-extrabold text-brand">{u.compatibility.score}%</p><p className="text-xs font-semibold">compatible</p><p className="mt-1 text-xs text-muted">{u.compatibility.explanation}</p></div>}
        </div>
        {!u.limited && <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[['Trips created', u.stats.tripsCreated], ['Trips joined', u.stats.tripsJoined], ['Connections', u.stats.connections], ['Member since', fmtDate(u.createdAt, { month: 'short', year: 'numeric' })]].map(([l, v]) => <div key={l} className="card p-4 text-center"><p className="font-display text-2xl font-bold">{v}</p><p className="text-xs text-muted">{l}</p></div>)}</div>
          <section className="card space-y-4 p-5"><h2 className="font-bold">Travel profile</h2>
            {[['Travel style', u.travelStyle], ['Interests', u.travelInterests], ['Favorite destinations', u.favoriteDestinations], ['Languages', u.languages]].map(([l, v]) => v?.length > 0 && <div key={l}><p className="mb-1.5 text-sm text-muted">{l}</p><div className="flex flex-wrap gap-2">{v.map((x) => <span key={x} className="chip">{x}</span>)}</div></div>)}</section>
          <section><h2 className="mb-3 text-xl font-bold">Trips organized</h2>{u.trips.created.length ? <TripList trips={u.trips.created} /> : <EmptyState icon={Calendar} title="No public trips yet" />}</section>
          {u.trips.joined.length > 0 && <section><h2 className="mb-3 text-xl font-bold">Trips joined</h2><TripList trips={u.trips.joined} /></section>}</>}
        <ReportModal open={report} onClose={() => setReport(false)} targetType="user" targetId={u._id} label={u.name} />
        <ConfirmModal open={block} onClose={() => setBlock(false)} danger title={`Block ${u.name}?`} text="They won't be able to message or call you and won't see your profile. You can unblock in Settings." confirmLabel="Block" onConfirm={async () => { await run(() => api.post(`/users/${u._id}/block`), `${u.name} blocked`); setBlock(false); nav('/partners'); }} />
      </div>}
    </Async>
  );
}
