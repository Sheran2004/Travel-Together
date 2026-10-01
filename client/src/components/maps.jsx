import { Component, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, useMapEvents, ZoomControl } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import { Crosshair, Expand, Shrink, LocateFixed, Search, MapPin, CheckCircle2, Route as RouteIcon } from 'lucide-react';
import api, { errMsg } from '../services/api';
import { Spinner } from './ui';
import { useToast } from '../context/ToastContext';
import { useDebounced } from '../hooks/useFetch';
import { inr, fmtDate } from '../utils/format';

export class MapBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(e) { console.error('Map error', e); }
  render() { return this.state.failed ? <MapUnavailable className={this.props.className} /> : this.props.children; }
}
export const MapUnavailable = ({ className = 'h-72' }) => <div className={`grid place-items-center rounded-xl2 border border-line bg-raised text-center ${className}`}><div><MapPin className="mx-auto h-7 w-7 text-muted" /><p className="mt-2 font-semibold">Map temporarily unavailable</p><p className="text-sm text-muted">Trip details still work below.</p></div></div>;

const pin = (label = '') => L.divIcon({ className: '', html: `<div class="trip-pin"><span>${label}</span></div>`, iconSize: [34, 34], iconAnchor: [17, 34], popupAnchor: [0, -32] });
const stop = (n) => L.divIcon({ className: '', html: `<div class="stop-pin">${n}</div>`, iconSize: [26, 26], iconAnchor: [13, 13], popupAnchor: [0, -12] });
const meIcon = L.divIcon({ className: '', html: '<div class="me-pin"></div>', iconSize: [16, 16], iconAnchor: [8, 8] });

function Controls({ center, zoom, onLocate, fullscreen, onFullscreen, isFull }) {
  const map = useMap();
  useEffect(() => { setTimeout(() => map.invalidateSize(), 60); }, [isFull, map]);
  const btn = 'grid h-9 w-9 place-items-center rounded-lg bg-surface text-ink shadow-card hover:bg-raised';
  return (
    <div className="absolute right-3 top-3 z-[500] flex flex-col gap-2">
      <button type="button" className={btn} title="Re-center map" aria-label="Re-center map" onClick={() => map.flyTo(center, zoom)}><Crosshair className="h-4 w-4" /></button>
      {onLocate && <button type="button" className={btn} title="Use my location" aria-label="Use my location" onClick={onLocate}><LocateFixed className="h-4 w-4" /></button>}
      {fullscreen && <button type="button" className={btn} title="Full screen" aria-label={isFull ? 'Exit full screen' : 'Full screen map'} onClick={onFullscreen}>{isFull ? <Shrink className="h-4 w-4" /> : <Expand className="h-4 w-4" />}</button>}
    </div>
  );
}
function Fit({ points, padding = 40, max = 11 }) {
  const map = useMap();
  useEffect(() => { if (!points?.length) return; if (points.length === 1) map.setView(points[0], Math.min(max, 10)); else map.fitBounds(L.latLngBounds(points), { padding: [padding, padding], maxZoom: max }); }, [JSON.stringify(points)]); // eslint-disable-line
  return null;
}
function Fly({ to, zoom = 9 }) { const map = useMap(); useEffect(() => { if (to) map.flyTo(to, zoom); }, [to?.[0], to?.[1]]); return null; } // eslint-disable-line

/** Base map. Children render inside MapContainer. Wrapped in an error boundary so a map failure never crashes the page. */
export function MapView({ center = [22.5, 79], zoom = 5, className = 'h-[28rem]', children, onLocate, fullscreen = true, fit, flyTo }) {
  const [full, setFull] = useState(false); const [tileErrors, setTileErrors] = useState(0);
  useEffect(() => { const k = (e) => e.key === 'Escape' && setFull(false); document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k); }, []);
  return (
    <MapBoundary className={className}>
      <div className={full ? 'fixed inset-0 z-[2000] bg-bg' : `relative overflow-hidden rounded-xl2 border border-line ${className}`}>
        <MapContainer center={center} zoom={zoom} zoomControl={false} scrollWheelZoom className="h-full w-full" style={{ minHeight: 240 }}>
          <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19} eventHandlers={{ tileerror: () => setTileErrors((n) => n + 1), tileload: () => setTileErrors(0) }} />
          <ZoomControl position="bottomright" />
          <Controls center={center} zoom={zoom} onLocate={onLocate} fullscreen={fullscreen} onFullscreen={() => setFull(!full)} isFull={full} />
          {fit && <Fit points={fit} />}{flyTo && <Fly to={flyTo} />}
          {children}
        </MapContainer>
        {tileErrors > 6 && <div className="absolute inset-x-3 bottom-12 z-[500] rounded-lg bg-surface p-2 text-center text-xs shadow-card">Map tiles are having trouble loading. Check your connection.</div>}
      </div>
    </MapBoundary>
  );
}

export function TripPopup({ trip }) {
  return (
    <div className="p-3">
      <p className="font-display text-base font-bold leading-tight">{trip.title}</p>
      <p className="mt-0.5 text-xs text-muted">{trip.destination}{trip.state ? `, ${trip.state}` : ''}</p>
      <div className="mt-2 grid grid-cols-3 gap-1 text-center text-[11px]"><div className="rounded-lg bg-raised p-1.5"><b className="block text-xs">{fmtDate(trip.startDate)}</b>starts</div><div className="rounded-lg bg-raised p-1.5"><b className="block text-xs">{inr(trip.budget)}</b>budget</div><div className="rounded-lg bg-raised p-1.5"><b className="block text-xs">{trip.memberCount}/{trip.maxMembers}</b>members</div></div>
      <p className="mt-2 line-clamp-2 text-xs text-muted">{trip.description}</p>
      <Link to={`/trips/${trip.slug || trip._id}`} className="btn-primary btn-sm mt-3 w-full !text-brand-ink">View Trip</Link>
    </div>
  );
}

/** Clustered markers for real trips from the API. */
export function TripMap({ trips, userPos, onLocate, className, fit = true, flyTo, focus }) {
  const pts = useMemo(() => trips.map((t) => [t.latitude, t.longitude]), [trips]);
  return (
    <MapView className={className} onLocate={onLocate} fit={fit && !flyTo && pts.length ? pts : undefined} flyTo={flyTo}>
      <MarkerClusterGroup chunkedLoading maxClusterRadius={50}>
        {trips.map((t) => <Marker key={t._id} position={[t.latitude, t.longitude]} icon={pin(t.memberCount)}><Popup>{<TripPopup trip={t} />}</Popup></Marker>)}
      </MarkerClusterGroup>
      {userPos && <Marker position={[userPos.lat, userPos.lng]} icon={meIcon}><Popup><p className="p-3 text-sm">Your approximate location</p></Popup></Marker>}
    </MapView>
  );
}

/** Real geocoding location picker: search → choose → marker → confirm. Click the map to reverse-geocode a point. */
export function LocationPicker({ value, onChange, error }) {
  const [q, setQ] = useState(value?.destination || ''); const dq = useDebounced(q, 600); const [results, setResults] = useState([]); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState('');
  const [open, setOpen] = useState(false); const toast = useToast(); const skip = useRef(!!value?.destination);
  useEffect(() => {
    if (skip.current) { skip.current = false; return; }
    if (dq.trim().length < 3) { setResults([]); setMsg(''); return; }
    let live = true; setBusy(true); setMsg('');
    api.get('/geo/search', { params: { q: dq } }).then((r) => { if (!live) return; setResults(r.data.results); setOpen(true); if (!r.data.results.length) setMsg(`No places found for "${dq}". Try a nearby city or a different spelling.`); })
      .catch((e) => live && setMsg(errMsg(e))).finally(() => live && setBusy(false));
    return () => { live = false; };
  }, [dq]);
  const choose = (r) => { onChange({ destination: r.destination, city: r.city, state: r.state, country: r.country, latitude: r.latitude, longitude: r.longitude, displayName: r.displayName }); setQ(r.destination); setOpen(false); setResults([]); };
  const Click = () => { useMapEvents({ click: async (e) => { try { const r = await api.get('/geo/reverse', { params: { lat: e.latlng.lat, lng: e.latlng.lng } }); choose(r.data.result); } catch (er) { toast.error(errMsg(er)); } } }); return null; };
  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input className="input pl-10" value={q} onChange={(e) => { setQ(e.target.value); if (value) onChange(null); }} placeholder="Search a destination, e.g. Manali" aria-label="Search destination" onFocus={() => results.length && setOpen(true)} />
        {busy && <Spinner className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />}
        {open && results.length > 0 && <ul className="card absolute z-[1000] mt-1 max-h-64 w-full overflow-auto shadow-pop" role="listbox">{results.map((r, i) => <li key={i}><button type="button" role="option" className="flex w-full items-start gap-2 px-3 py-2.5 text-left text-sm hover:bg-raised" onClick={() => choose(r)}><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand" /><span><b>{r.destination}</b><span className="block text-xs text-muted">{r.displayName}</span></span></button></li>)}</ul>}
      </div>
      {msg && <p className="text-sm text-muted" role="status">{msg}</p>}
      <MapView className="h-64" fit={value ? [[value.latitude, value.longitude]] : undefined} fullscreen={false}>
        <Click />{value && <Marker position={[value.latitude, value.longitude]} icon={pin('')} />}
      </MapView>
      {value ? <p className="flex items-start gap-2 rounded-xl bg-ok/10 p-3 text-sm"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-ok" /><span><b>{value.destination}</b> — {[value.city, value.state, value.country].filter(Boolean).join(', ')}<span className="block text-xs text-muted">{value.latitude.toFixed(4)}, {value.longitude.toFixed(4)} · saved automatically</span></span></p>
        : <p className="text-xs text-muted">Search and pick a result, or click the map to choose a spot.</p>}
      {error && <p className="err">{error}</p>}
    </div>
  );
}

/** Itinerary stops with numbered markers + real driving route (OSRM) between them. */
export function ItineraryMap({ items, activeId, onSelect, className = 'h-80', showRoute = true }) {
  const stops = items.filter((i) => Number.isFinite(i.latitude) && Number.isFinite(i.longitude));
  const [route, setRoute] = useState(null); const [routeErr, setRouteErr] = useState('');
  const key = stops.map((s) => `${s.latitude.toFixed(4)},${s.longitude.toFixed(4)}`).join(';');
  useEffect(() => {
    setRoute(null); setRouteErr(''); if (!showRoute || stops.length < 2 || stops.length > 25) return; let live = true;
    api.get('/geo/route', { params: { points: key } }).then((r) => live && setRoute(r.data)).catch((e) => live && setRouteErr(errMsg(e, 'Route unavailable'))); return () => { live = false; };
  }, [key, showRoute]); // eslint-disable-line
  if (!stops.length) return null;
  return (
    <div className="space-y-2">
      <MapView className={className} fit={stops.map((s) => [s.latitude, s.longitude])}>
        {route && <Polyline positions={route.line} pathOptions={{ color: '#0e7480', weight: 4, opacity: 0.85 }} />}
        {!route && stops.length > 1 && <Polyline positions={stops.map((s) => [s.latitude, s.longitude])} pathOptions={{ color: '#f2a93b', weight: 2, dashArray: '6 8' }} />}
        {stops.map((s, i) => <Marker key={s._id || i} position={[s.latitude, s.longitude]} icon={stop(s.day ?? i + 1)} eventHandlers={{ click: () => onSelect?.(s) }}><Popup><div className="p-3"><p className="text-xs text-muted">Day {s.day}{s.time ? ` · ${s.time}` : ''}</p><p className="font-bold">{s.activity}</p><p className="text-xs text-muted">{s.locationName}</p></div></Popup></Marker>)}
      </MapView>
      {route && <p className="flex items-center gap-2 text-sm text-muted"><RouteIcon className="h-4 w-4 text-brand" />Driving route: about {route.distanceKm} km · {route.durationHours} h between stops (OpenStreetMap routing)</p>}
      {routeErr && stops.length > 1 && <p className="text-xs text-muted">{routeErr}. Showing a straight dashed line between stops instead.</p>}
    </div>
  );
}

/** Route between two points (used on trip details: your city -> destination) */
export function RouteMap({ from, to, className = 'h-72' }) {
  const [route, setRoute] = useState(null); const [err, setErr] = useState('');
  useEffect(() => { let live = true; setRoute(null); setErr(''); api.get('/geo/route', { params: { points: `${from.latitude},${from.longitude};${to.latitude},${to.longitude}` } }).then((r) => live && setRoute(r.data)).catch((e) => live && setErr(errMsg(e))); return () => { live = false; }; }, [from.latitude, from.longitude, to.latitude, to.longitude]);
  return (
    <div className="space-y-2"><MapView className={className} fit={[[from.latitude, from.longitude], [to.latitude, to.longitude]]}>
      {route && <Polyline positions={route.line} pathOptions={{ color: '#0e7480', weight: 4 }} />}
      <Marker position={[from.latitude, from.longitude]} icon={stop('A')}><Popup><p className="p-3 text-sm">{from.label}</p></Popup></Marker><Marker position={[to.latitude, to.longitude]} icon={stop('B')}><Popup><p className="p-3 text-sm">{to.label}</p></Popup></Marker>
    </MapView>{route ? <p className="text-sm text-muted">{from.label} → {to.label}: about {route.distanceKm} km by road · {route.durationHours} h</p> : err && <p className="text-xs text-muted">{err}</p>}</div>
  );
}
