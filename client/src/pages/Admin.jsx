import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, Map, Activity, Flag, ShieldAlert, Trash2, Ban, CheckCircle2, X } from 'lucide-react';
import api, { errMsg } from '../services/api';
import { useFetch, useDebounced } from '../hooks/useFetch';
import { useToast } from '../context/ToastContext';
import { Async, Avatar, ConfirmModal, EmptyState, Pagination } from '../components/ui';
import { fmtDateFull, timeAgo } from '../utils/format';
import { resetCategoriesCache } from '../hooks/useCategories';

const Stat = ({ icon: I, label, value }) => <div className="card flex items-center gap-4 p-4"><span className="grid h-11 w-11 place-items-center rounded-xl bg-brand/10 text-brand"><I className="h-5 w-5" /></span><div><p className="font-display text-2xl font-extrabold">{value}</p><p className="text-xs text-muted">{label}</p></div></div>;
export default function Admin() {
  const [tab, setTab] = useState('overview'); const toast = useToast(); const stats = useFetch('/admin/stats'); const s = stats.data?.stats;
  const [q, setQ] = useState(''); const dq = useDebounced(q); const [page, setPage] = useState(1); const [confirm, setConfirm] = useState(null);
  const users = useFetch('/admin/users', { q: dq || undefined, page }, { enabled: tab === 'users' }); const trips = useFetch('/admin/trips', { q: dq || undefined, page }, { enabled: tab === 'trips' });
  const reports = useFetch('/admin/reports', null, { enabled: tab === 'reports' }); const activity = useFetch('/admin/activity', null, { enabled: tab === 'overview' });
  const run = async (fn, ok, after) => { try { await fn(); toast.success(ok); setConfirm(null); after(); stats.reload(); } catch (e) { toast.error(errMsg(e)); } };
  const tabs = [['overview', 'Overview'], ['users', 'Users'], ['trips', 'Trips'], ['categories', 'Categories'], ['reports', `Reports${s?.openReports ? ` (${s.openReports})` : ''}`]];
  return (
    <div className="container-x space-y-6 py-8"><h1 className="flex items-center gap-2 text-3xl font-extrabold"><ShieldAlert className="h-8 w-8 text-brand" />Admin dashboard</h1>
      <div className="no-scrollbar flex gap-2 overflow-x-auto" role="tablist">{tabs.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => { setTab(k); setPage(1); setQ(''); }} className={`btn btn-sm ${tab === k ? 'bg-brand text-brand-ink' : 'border border-line bg-surface'}`}>{l}</button>)}</div>
      {tab === 'overview' && <Async loading={stats.loading} error={stats.error} onRetry={stats.reload}>{s && <>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Stat icon={Users} label="Total users" value={s.users} /><Stat icon={Map} label="Total trips" value={s.trips} /><Stat icon={Activity} label="Active trips" value={s.activeTrips} /><Stat icon={CheckCircle2} label="Completed trips" value={s.completedTrips} />
          <Stat icon={Flag} label="Reported users" value={s.reportedUsers} /><Stat icon={Flag} label="Reported trips" value={s.reportedTrips} /><Stat icon={Users} label="Online now" value={s.onlineNow} /><Stat icon={Activity} label="Messages (24h)" value={s.messagesLast24h} /></div>
        <div className="grid gap-6 lg:grid-cols-2"><div className="card p-5"><h2 className="mb-3 font-bold">Trips by category</h2><ul className="space-y-2">{s.byCategory.map((c) => <li key={c._id} className="flex items-center gap-3 text-sm"><span className="w-24 shrink-0">{c._id}</span><span className="h-2 flex-1 overflow-hidden rounded-full bg-raised"><span className="block h-full bg-brand" style={{ width: `${(c.n / s.trips) * 100}%` }} /></span><b>{c.n}</b></li>)}</ul></div>
          <div className="card p-5"><h2 className="mb-3 font-bold">Recent activity</h2><Async loading={activity.loading} error={activity.error} onRetry={activity.reload}><ul className="space-y-2 text-sm">{activity.data?.activity.map((a, i) => <li key={i} className="flex justify-between gap-3"><span>{a.text}</span><span className="shrink-0 text-xs text-muted">{timeAgo(a.at)}</span></li>)}</ul></Async></div></div></>}</Async>}
      {tab === 'users' && <><input className="input max-w-sm" placeholder="Search users" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} aria-label="Search users" /><Async loading={users.loading} error={users.error} onRetry={users.reload}><div className="card overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-raised text-xs text-muted"><tr><th className="p-3">User</th><th className="p-3">Email</th><th className="p-3">Role</th><th className="p-3">Joined</th><th className="p-3">Status</th><th className="p-3" /></tr></thead><tbody className="divide-y divide-line">{users.data?.users.map((u) => <tr key={u._id}><td className="p-3"><Link to={`/travelers/${u.username}`} className="flex items-center gap-2 font-medium hover:text-brand"><Avatar user={u} size={28} />{u.name}</Link></td><td className="p-3">{u.email}</td><td className="p-3 capitalize">{u.role}</td><td className="p-3">{fmtDateFull(u.createdAt)}</td><td className="p-3">{u.suspended ? <span className="chip bg-danger/15 text-danger">Suspended</span> : <span className="chip">Active</span>}</td>
        <td className="p-3 text-right">{u.role !== 'admin' && <button className="btn-ghost btn-sm" onClick={() => setConfirm({ kind: 'suspend', u })}><Ban className="h-3.5 w-3.5" />{u.suspended ? 'Reinstate' : 'Suspend'}</button>}</td></tr>)}</tbody></table></div><Pagination page={page} pages={users.data?.pages || 1} onChange={setPage} /></Async></>}
      {tab === 'trips' && <><input className="input max-w-sm" placeholder="Search trips" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} aria-label="Search trips" /><Async loading={trips.loading} error={trips.error} onRetry={trips.reload}><div className="card overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-raised text-xs text-muted"><tr><th className="p-3">Trip</th><th className="p-3">Organizer</th><th className="p-3">Dates</th><th className="p-3">Members</th><th className="p-3">Status</th><th className="p-3" /></tr></thead><tbody className="divide-y divide-line">{trips.data?.trips.map((t) => <tr key={t._id}><td className="p-3"><Link to={`/trips/${t.slug}`} className="font-medium hover:text-brand">{t.title}</Link></td><td className="p-3">{t.creator?.name}</td><td className="p-3">{fmtDateFull(t.startDate)}</td><td className="p-3">{t.memberCount}/{t.maxMembers}</td><td className="p-3 capitalize">{t.status}</td><td className="p-3 text-right"><button className="btn-ghost btn-sm text-danger" onClick={() => setConfirm({ kind: 'trip', t })}><Trash2 className="h-3.5 w-3.5" />Remove</button></td></tr>)}</tbody></table></div><Pagination page={page} pages={trips.data?.pages || 1} onChange={setPage} /></Async></>}
      {tab === 'categories' && <Categories />}
      {tab === 'reports' && <Async loading={reports.loading} error={reports.error} onRetry={reports.reload}>{reports.data?.reports.length ? <ul className="space-y-3">{reports.data.reports.map((r) => <li key={r._id} className="card space-y-2 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold">{r.category} · <span className="capitalize">{r.targetType}</span></p><span className="text-xs text-muted">{timeAgo(r.createdAt)} · by {r.reporter?.name}</span></div>
        <p className="text-sm">{r.targetTrip ? <>Trip: <Link className="text-brand underline" to={`/trips/${r.targetTrip.slug}`}>{r.targetTrip.title}</Link></> : null}{r.targetUser ? <> · User: <Link className="text-brand underline" to={`/travelers/${r.targetUser.username}`}>{r.targetUser.name}</Link>{r.targetUser.suspended && ' (suspended)'}</> : null}</p>{r.details && <p className="rounded-lg bg-raised p-2.5 text-sm">{r.details}</p>}
        <div className="flex flex-wrap gap-2"><button className="btn-primary btn-sm" onClick={() => run(() => api.put(`/admin/reports/${r._id}`, { status: 'resolved' }), 'Report resolved', reports.reload)}><CheckCircle2 className="h-4 w-4" />Resolve</button><button className="btn-ghost btn-sm" onClick={() => run(() => api.put(`/admin/reports/${r._id}`, { status: 'dismissed' }), 'Report dismissed', reports.reload)}><X className="h-4 w-4" />Dismiss</button>
          {r.targetUser && !r.targetUser.suspended && <button className="btn-ghost btn-sm text-danger" onClick={() => setConfirm({ kind: 'suspend', u: r.targetUser, report: r })}>Suspend user</button>}{r.targetTrip && <button className="btn-ghost btn-sm text-danger" onClick={() => setConfirm({ kind: 'trip', t: r.targetTrip })}>Remove trip</button>}</div></li>)}</ul> : <EmptyState icon={Flag} title="No open reports" text="Nice and quiet." />}</Async>}
      <ConfirmModal open={confirm?.kind === 'suspend'} onClose={() => setConfirm(null)} danger title={`${confirm?.u?.suspended ? 'Reinstate' : 'Suspend'} ${confirm?.u?.name}?`} text={confirm?.u?.suspended ? 'They will be able to log in again.' : 'They will be logged out and unable to log in.'} confirmLabel={confirm?.u?.suspended ? 'Reinstate' : 'Suspend'} onConfirm={() => run(() => api.put(`/admin/users/${confirm.u._id}/suspend`, { suspended: !confirm.u.suspended }), 'User updated', () => { users.reload(); reports.reload(); })} />
      <ConfirmModal open={confirm?.kind === 'trip'} onClose={() => setConfirm(null)} danger title="Remove this trip?" text={`"${confirm?.t?.title}" will be deleted and members notified.`} confirmLabel="Remove trip" onConfirm={() => run(() => api.delete(`/admin/trips/${confirm.t._id}`), 'Trip removed', () => { trips.reload(); reports.reload(); })} />
    </div>
  );
}

function Categories() {
  const { data, loading, error, reload } = useFetch('/admin/categories'); const toast = useToast(); const [name, setName] = useState(''); const [edit, setEdit] = useState(null);
  const run = async (fn, ok) => { try { await fn(); toast.success(ok); resetCategoriesCache(); reload(); } catch (e) { toast.error(errMsg(e)); } };
  return (
    <div className="space-y-4">
      <form onSubmit={(e) => { e.preventDefault(); if (!name.trim()) return; run(() => api.post('/admin/categories', { name }), 'Category added'); setName(''); }} className="flex max-w-md gap-2">
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="New category" aria-label="New category name" maxLength={40} /><button className="btn-primary">Add</button>
      </form>
      <Async loading={loading} error={error} onRetry={reload}>
        <ul className="card divide-y divide-line">{data?.categories.map((c) => (
          <li key={c._id} className="flex flex-wrap items-center gap-3 p-3">
            {edit?.id === c._id ? <input className="input !w-56 !py-1.5" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} aria-label="Category name" /> : <b className={c.active ? '' : 'text-muted line-through'}>{c.name}</b>}
            <span className="text-xs text-muted">{c.trips} trip{c.trips === 1 ? '' : 's'}</span>
            <div className="ml-auto flex gap-2">
              {edit?.id === c._id ? <><button className="btn-primary btn-sm" onClick={() => { run(() => api.put(`/admin/categories/${c._id}`, { name: edit.name }), 'Category renamed'); setEdit(null); }}>Save</button><button className="btn-ghost btn-sm" onClick={() => setEdit(null)}>Cancel</button></> : <button className="btn-ghost btn-sm" onClick={() => setEdit({ id: c._id, name: c.name })}>Rename</button>}
              <button className="btn-ghost btn-sm" onClick={() => run(() => api.put(`/admin/categories/${c._id}`, { active: !c.active }), c.active ? 'Category hidden from new trips' : 'Category active')}>{c.active ? 'Deactivate' : 'Activate'}</button>
              <button className="btn-ghost btn-sm text-danger" onClick={() => run(() => api.delete(`/admin/categories/${c._id}`), 'Category deleted')}>Delete</button>
            </div>
          </li>))}</ul>
      </Async>
    </div>
  );
}
