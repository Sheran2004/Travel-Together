import { useMemo, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Search, SlidersHorizontal, List, Map as MapIcon, LocateFixed, X, Compass } from 'lucide-react';
import { useFetch, useDebounced } from '../hooks/useFetch';
import { useSavedToggle } from '../hooks/useSaved';
import { useToast } from '../context/ToastContext';
import { TripCard } from '../components/cards';
import { Async, CardSkeletons, EmptyState, Pagination, Spinner } from '../components/ui';
import { TripMap } from '../components/maps';
import { STYLES } from '../utils/format';
import { useCategories } from '../hooks/useCategories';
import { approx } from '../utils/geo';

const RADII = [25, 50, 100, 250, 500];
const SORTS = [['newest', 'Newest'], ['soonest', 'Starting soon'], ['members', 'Most members'], ['lowest', 'Lowest budget'], ['highest', 'Highest budget']];

export default function Explore({ initialView = 'list' }) {
  const [sp, setSp] = useSearchParams(); const toast = useToast(); const cats = useCategories();
  const [view, setView] = useState(initialView); const [showFilters, setShowFilters] = useState(false);
  const [q, setQ] = useState(sp.get('search') || ''); const dq = useDebounced(q, 450);
  const [past, setPast] = useState(false); const [pos, setPos] = useState(null); const [locating, setLocating] = useState(false); const [radius, setRadius] = useState(100);
  const get = (k) => sp.get(k) || '';
  const set = (k, v) => { const n = new URLSearchParams(sp); v ? n.set(k, v) : n.delete(k); if (k !== 'page') n.delete('page'); setSp(n, { replace: true }); };
  const page = Number(get('page')) || 1;

  const params = useMemo(() => {
    const p = { search: dq || undefined, destination: get('destination') || undefined, category: get('category') || undefined, travelStyle: get('travelStyle') || undefined, minBudget: get('minBudget') || undefined, maxBudget: get('maxBudget') || undefined, startDate: get('startDate') || undefined, endDate: get('endDate') || undefined, minDuration: get('minDuration') || undefined, maxDuration: get('maxDuration') || undefined, groupSize: get('groupSize') || undefined, sort: get('sort') || 'newest', available: get('available') || undefined, upcoming: past ? undefined : 'true', status: past ? 'completed' : undefined };
    if (pos) Object.assign(p, { lat: pos.lat, lng: pos.lng, radius });
    return p;
  }, [sp, dq, pos, radius, past]); // eslint-disable-line
  const list = useFetch('/trips', { ...params, page, limit: 12 }, { enabled: view === 'list' });
  const all = useFetch('/trips', { ...params, all: 'true' }, { enabled: view === 'map' });
  const saved = useSavedToggle();

  const locate = () => {
    if (!navigator.geolocation) return toast.error('Location is not supported in this browser.');
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => { setPos({ lat: approx(p.coords.latitude), lng: approx(p.coords.longitude) }); setLocating(false); toast.success('Showing trips near you (approximate location, not stored)'); },
      (e) => { setLocating(false); toast.info(e.code === 1 ? 'Location permission denied. You can still browse all trips.' : 'Could not determine your location.'); },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
  };
  const active = ['destination', 'category', 'travelStyle', 'minBudget', 'maxBudget', 'startDate', 'endDate', 'minDuration', 'maxDuration', 'groupSize', 'available'].filter((k) => get(k));
  const clear = () => { setSp(new URLSearchParams()); setQ(''); setPos(null); };
  const data = view === 'map' ? all : list;
  const trips = data.data?.trips || [];
  const inp = 'input !py-2';

  const Filters = (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <label className="block"><span className="label">Destination</span><input className={inp} value={get('destination')} onChange={(e) => set('destination', e.target.value)} placeholder="e.g. Goa" /></label>
      <label className="block"><span className="label">Category</span><select className={inp} value={get('category')} onChange={(e) => set('category', e.target.value)}><option value="">Any</option>{cats.map((c) => <option key={c}>{c}</option>)}</select></label>
      <label className="block"><span className="label">Travel style</span><select className={inp} value={get('travelStyle')} onChange={(e) => set('travelStyle', e.target.value)}><option value="">Any</option>{STYLES.map((c) => <option key={c}>{c}</option>)}</select></label>
      <label className="block"><span className="label">Group size (at least)</span><input type="number" min="2" className={inp} value={get('groupSize')} onChange={(e) => set('groupSize', e.target.value)} /></label>
      <label className="block"><span className="label">Min budget (₹)</span><input type="number" min="0" className={inp} value={get('minBudget')} onChange={(e) => set('minBudget', e.target.value)} /></label>
      <label className="block"><span className="label">Max budget (₹)</span><input type="number" min="0" className={inp} value={get('maxBudget')} onChange={(e) => set('maxBudget', e.target.value)} /></label>
      <label className="block"><span className="label">Starts after</span><input type="date" className={inp} value={get('startDate')} onChange={(e) => set('startDate', e.target.value)} /></label>
      <label className="block"><span className="label">Ends before</span><input type="date" className={inp} value={get('endDate')} onChange={(e) => set('endDate', e.target.value)} /></label>
      <label className="block"><span className="label">Min days</span><input type="number" min="1" className={inp} value={get('minDuration')} onChange={(e) => set('minDuration', e.target.value)} /></label>
      <label className="block"><span className="label">Max days</span><input type="number" min="1" className={inp} value={get('maxDuration')} onChange={(e) => set('maxDuration', e.target.value)} /></label>
      <label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" checked={get('available') === 'true'} onChange={(e) => set('available', e.target.checked ? 'true' : '')} />Only trips with open spots</label>
    </div>
  );
  return (
    <div className="container-x py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-3xl font-extrabold sm:text-4xl">{view === 'map' ? 'Trips on the map' : 'Explore trips'}</h1><p className="text-muted">{data.loading ? 'Searching…' : `${data.data?.total ?? 0} trips${pos ? ` within ${radius} km` : ''}`}</p></div>
        <div className="inline-flex rounded-full border border-line bg-surface p-1" role="tablist" aria-label="View"><button role="tab" aria-selected={view === 'list'} onClick={() => setView('list')} className={`btn btn-sm ${view === 'list' ? 'bg-brand text-brand-ink' : ''}`}><List className="h-4 w-4" />List</button><button role="tab" aria-selected={view === 'map'} onClick={() => setView('map')} className={`btn btn-sm ${view === 'map' ? 'bg-brand text-brand-ink' : ''}`}><MapIcon className="h-4 w-4" />Map</button></div></div>

      <div className="card mb-6 space-y-4 p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative min-w-[14rem] flex-1"><Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" /><input className="input pl-10" placeholder="Search destination, trip name or activity" value={q} onChange={(e) => { setQ(e.target.value); const n = new URLSearchParams(sp); n.delete('page'); setSp(n, { replace: true }); }} aria-label="Search trips" /></div>
          <select className="input !w-auto" value={get('sort') || 'newest'} onChange={(e) => set('sort', e.target.value)} aria-label="Sort by">{SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={past} onChange={(e) => setPast(e.target.checked)} />Show past trips</label>
          <button className="btn-ghost" onClick={() => setShowFilters(!showFilters)} aria-expanded={showFilters}><SlidersHorizontal className="h-4 w-4" />Filters{active.length > 0 && <span className="rounded-full bg-brand px-1.5 text-xs text-brand-ink">{active.length}</span>}</button>
          {!pos ? <button className="btn-ghost" onClick={locate} disabled={locating}>{locating ? <Spinner className="h-4 w-4" /> : <LocateFixed className="h-4 w-4" />}Trips near me</button>
            : <div className="flex items-center gap-2"><select className="input !w-auto" value={radius} onChange={(e) => setRadius(+e.target.value)} aria-label="Distance">{RADII.map((r) => <option key={r} value={r}>Within {r} km</option>)}</select><button className="btn-ghost btn-sm" onClick={() => setPos(null)}><X className="h-4 w-4" />Clear</button></div>}
        </div>
        {showFilters && Filters}
        {(active.length > 0 || q || pos) && <button className="text-sm font-semibold text-brand" onClick={clear}>Clear all filters</button>}
      </div>

      <Async loading={data.loading} error={data.error} onRetry={data.reload} skeleton={view === 'map' ? <div className="skeleton h-[32rem] rounded-xl2" /> : <CardSkeletons />}>
        {trips.length === 0 ? <EmptyState icon={Compass} title="No trips found" text={pos ? `Nothing within ${radius} km. Try a larger distance.` : 'Try removing a filter or searching a different destination.'} action={<div className="flex gap-2"><button className="btn-ghost" onClick={clear}>Clear filters</button><Link to="/trips/new" className="btn-primary">Create a trip</Link></div>} /> :
          view === 'map' ? <div className="grid gap-5 lg:grid-cols-[1fr_22rem]"><TripMap trips={trips} userPos={pos} onLocate={locate} className="h-[70vh] min-h-[26rem]" />
            <aside className="card max-h-[70vh] divide-y divide-line overflow-y-auto"><p className="px-4 py-3 text-sm font-semibold">{trips.length} trips on map</p>{trips.slice(0, 60).map((t) => <Link key={t._id} to={`/trips/${t.slug}`} className="flex gap-3 px-4 py-3 hover:bg-raised"><img src={t.coverImage} alt="" className="h-14 w-14 rounded-lg object-cover" loading="lazy" /><span className="min-w-0"><b className="block truncate text-sm">{t.title}</b><span className="block truncate text-xs text-muted">{t.destination} · {t.memberCount}/{t.maxMembers}{t.distanceKm != null ? ` · ${t.distanceKm} km` : ''}</span></span></Link>)}</aside></div> :
          <><div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{trips.map((t) => <TripCard key={t._id} trip={t} onSave={saved.toggle} saved={saved.isSaved(t._id)} />)}</div><Pagination page={page} pages={list.data?.pages || 1} onChange={(p) => set('page', String(p))} /></>}
      </Async>
    </div>
  );
}
