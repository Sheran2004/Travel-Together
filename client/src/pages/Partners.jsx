import { useState, useMemo } from 'react';
import { Users, SlidersHorizontal } from 'lucide-react';
import api, { errMsg } from '../services/api';
import { useFetch, useDebounced } from '../hooks/useFetch';
import { useToast } from '../context/ToastContext';
import { TravelerCard } from '../components/cards';
import { Async, CardSkeletons, EmptyState, Pagination } from '../components/ui';
import { STYLES } from '../utils/format';
import { useCategories } from '../hooks/useCategories';

export default function Partners() {
  const [f, setF] = useState({ q: new URLSearchParams(window.location.search).get('q') || '', destination: '', city: '', style: '', interest: '', tripType: '', minAge: '', maxAge: '', minBudget: '', maxBudget: '', startDate: '', endDate: '', gender: '' }); const [page, setPage] = useState(1); const [show, setShow] = useState(false);
  const d = useDebounced(f, 450); const toast = useToast(); const cats = useCategories();
  const params = useMemo(() => ({ ...Object.fromEntries(Object.entries(d).filter(([, v]) => v)), page, limit: 9 }), [d, page]);
  const { data, loading, error, reload, setData } = useFetch('/users/search', params);
  const up = (k, v) => { setF((p) => ({ ...p, [k]: v })); setPage(1); };
  const connect = async (t) => { try { await api.post(`/connections/${t._id}/request`); toast.success(`Connection request sent to ${t.name}`); setData((x) => ({ ...x, users: x.users.map((u) => (u._id === t._id ? { ...u, connection: { status: 'pending', direction: 'sent' } } : u)) })); } catch (e) { toast.error(errMsg(e)); } };
  const inp = 'input !py-2';
  return (
    <div className="container-x py-8">
      <h1 className="text-3xl font-extrabold sm:text-4xl">Find your travel partner</h1><p className="mb-6 text-muted">Sorted by a transparent compatibility score: destination, travel style, budget, interests and trip dates.</p>
      <div className="card mb-6 space-y-4 p-4"><div className="flex flex-wrap gap-3"><input className="input min-w-[14rem] flex-1" placeholder="Search by name or username" value={f.q} onChange={(e) => up('q', e.target.value)} aria-label="Search travelers" /><button className="btn-ghost" onClick={() => setShow(!show)} aria-expanded={show}><SlidersHorizontal className="h-4 w-4" />Filters</button></div>
        {show && <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label><span className="label">Destination</span><input className={inp} value={f.destination} onChange={(e) => up('destination', e.target.value)} placeholder="Manali" /></label>
          <label><span className="label">City</span><input className={inp} value={f.city} onChange={(e) => up('city', e.target.value)} /></label>
          <label><span className="label">Travel style</span><select className={inp} value={f.style} onChange={(e) => up('style', e.target.value)}><option value="">Any</option>{STYLES.map((s) => <option key={s}>{s}</option>)}</select></label>
          <label><span className="label">Interest</span><input className={inp} value={f.interest} onChange={(e) => up('interest', e.target.value)} placeholder="Trekking" /></label>
          <label><span className="label">Trip type</span><select className={inp} value={f.tripType} onChange={(e) => up('tripType', e.target.value)}><option value="">Any</option>{cats.map((s) => <option key={s}>{s}</option>)}</select></label>
          <label><span className="label">Age from</span><input type="number" className={inp} value={f.minAge} onChange={(e) => up('minAge', e.target.value)} /></label><label><span className="label">Age to</span><input type="number" className={inp} value={f.maxAge} onChange={(e) => up('maxAge', e.target.value)} /></label>
          <label><span className="label">Budget from (₹)</span><input type="number" className={inp} value={f.minBudget} onChange={(e) => up('minBudget', e.target.value)} /></label><label><span className="label">Budget to (₹)</span><input type="number" className={inp} value={f.maxBudget} onChange={(e) => up('maxBudget', e.target.value)} /></label>
          <label><span className="label">Travelling from</span><input type="date" className={inp} value={f.startDate} onChange={(e) => up('startDate', e.target.value)} /></label><label><span className="label">Travelling until</span><input type="date" className={inp} value={f.endDate} onChange={(e) => up('endDate', e.target.value)} /></label>
          <label><span className="label">Gender preference (optional)</span><select className={inp} value={f.gender} onChange={(e) => up('gender', e.target.value)}><option value="">No preference</option><option value="female">Women</option><option value="male">Men</option><option value="non-binary">Non-binary</option></select></label></div>}</div>
      <Async loading={loading} error={error} onRetry={reload} skeleton={<CardSkeletons n={6} />}>
        {data?.users.length ? <><p className="mb-3 text-sm text-muted">{data.total} travelers</p><div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{data.users.map((t) => <TravelerCard key={t._id} t={t} onConnect={connect} />)}</div><Pagination page={page} pages={data.pages} onChange={setPage} /></> : <EmptyState icon={Users} title="No travelers match" text="Loosen a filter or try a different destination." />}</Async>
    </div>
  );
}
