import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { CalendarDays, Wallet, Users, MapPin, Bookmark, Share2, MessageCircle, Flag, Settings, Mountain, Clock, Star, Route as RouteIcon, MessageSquare } from 'lucide-react';
import api, { errMsg, assetUrl } from '../services/api';
import { useFetch } from '../hooks/useFetch';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Async, Avatar, ConfirmModal, Modal, Spinner, Stars, StarInput, Field, EmptyState, SafeImg } from '../components/ui';
import { ReportModal } from '../components/Extras';
import { ItineraryTimeline, Checklist, ExpenseTracker, Weather, Gallery, PrivateInfo } from '../components/trip';
import { MapView, ItineraryMap, RouteMap } from '../components/maps';
import { ReviewCard } from '../components/cards';
import { Marker } from 'react-leaflet';
import L from 'leaflet';
import { inr, dateRange, duration, fmtDate, shareUrl } from '../utils/format';

const pinIcon = L.divIcon({ className: '', html: '<div class="trip-pin"><span></span></div>', iconSize: [34, 34], iconAnchor: [17, 34] });
const Stat = ({ icon: I, label, value }) => <div className="flex items-center gap-3 rounded-xl bg-raised p-3"><I className="h-5 w-5 text-brand" /><div><p className="text-xs text-muted">{label}</p><p className="font-semibold">{value}</p></div></div>;

export default function TripDetails() {
  const { slug } = useParams(); const { user } = useAuth(); const nav = useNavigate(); const loc = useLocation(); const toast = useToast();
  const { data, loading, error, reload } = useFetch(`/trips/${slug}`);
  const reviews = useFetch(`/trips/${slug}/reviews`);
  const [busy, setBusy] = useState(''); const [leave, setLeave] = useState(false); const [reqOpen, setReqOpen] = useState(false); const [msg, setMsg] = useState(''); const [report, setReport] = useState(false);
  const [tab, setTab] = useState('itinerary'); const [active, setActive] = useState(null); const [routeFrom, setRouteFrom] = useState(null); const [routeBusy, setRouteBusy] = useState(false);
  const [rv, setRv] = useState({ rating: 0, comment: '' });
  const t = data?.trip; const v = data?.viewer; const members = data?.members || [];

  useEffect(() => {
    if (!t) return; document.title = `${t.title} · Travel Together`;
    const set = (sel, attr, val) => { let el = document.head.querySelector(sel); if (!el) { el = document.createElement('meta'); const [k, n] = sel.match(/\[(.+?)="(.+?)"\]/).slice(1); el.setAttribute(k, n); document.head.appendChild(el); } el.setAttribute(attr, val); };
    set('meta[name="description"]', 'content', t.description.slice(0, 155)); set('meta[property="og:title"]', 'content', t.title); set('meta[property="og:description"]', 'content', t.description.slice(0, 155)); set('meta[property="og:image"]', 'content', t.coverImage);
    return () => { document.title = 'Travel Together — Find people. Share journeys. Create memories.'; };
  }, [t?._id]); // eslint-disable-line

  const needLogin = () => { toast.info('Log in to continue'); nav('/login', { state: { from: loc.pathname } }); };
  const act = async (key, fn, okMsg) => { if (!user) return needLogin(); setBusy(key); try { await fn(); if (okMsg) toast.success(okMsg); await reload(); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(''); } };
  const join = () => act('join', () => api.post(`/trips/${t._id}/join`), 'You joined the trip!');
  const doLeave = async () => { await act('leave', () => api.post(`/trips/${t._id}/leave`), 'You left the trip'); setLeave(false); };
  const request = async () => { await act('req', () => api.post(`/trips/${t._id}/request`, { message: msg }), 'Request sent to the organizer'); setReqOpen(false); };
  const cancelReq = () => act('req', () => api.delete(`/trips/${t._id}/request`), 'Request withdrawn');
  const save = () => act('save', () => (v.favorite ? api.delete(`/trips/${t._id}/favorite`) : api.post(`/trips/${t._id}/favorite`)), v?.favorite ? 'Removed from saved' : 'Trip saved');
  const share = async () => { const url = shareUrl(`/trips/${t.slug}`); try { if (navigator.share) await navigator.share({ title: t.title, text: `Join me on ${t.title}`, url }); else { await navigator.clipboard.writeText(url); toast.success('Link copied'); } } catch { /* user cancelled */ } };
  const submitReview = async () => { setBusy('rv'); try { await api.post(`/trips/${t._id}/reviews`, rv); toast.success('Thanks for your review'); setRv({ rating: 0, comment: '' }); reviews.reload(); reload(); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(''); } };
  const showRoute = async () => {
    if (!user?.city) return toast.info('Add your city to your profile to see a route.'); setRouteBusy(true);
    try { const r = await api.get('/geo/search', { params: { q: `${user.city}, ${user.country || ''}` } }); const p = r.data.results[0]; if (!p) throw new Error('Could not locate your city'); setRouteFrom({ latitude: p.latitude, longitude: p.longitude, label: user.city }); }
    catch (e) { toast.error(e.message || errMsg(e)); } finally { setRouteBusy(false); }
  };

  const joinBtn = () => {
    if (!t) return null;
    if (t.status === 'cancelled') return <button className="btn-ghost w-full" disabled>Trip cancelled</button>;
    if (v?.isCreator) return <Link to={`/trips/${t.slug}/manage`} className="btn-primary w-full"><Settings className="h-4 w-4" />Manage Trip{v.pendingRequests > 0 && <span className="rounded-full bg-accent px-2 text-xs text-[#1c1300]">{v.pendingRequests}</span>}</Link>;
    if (v?.isMember) return <div className="space-y-2"><button className="btn-ghost w-full !border-ok !text-ok" disabled>✓ Joined</button>{!v.ended && <button className="w-full text-sm text-muted underline" onClick={() => setLeave(true)}>Leave trip</button>}</div>;
    if (v?.started) return <button className="btn-ghost w-full" disabled>Trip already started</button>;
    if (v?.isFull) return <button className="btn-ghost w-full" disabled>Trip Full</button>;
    if (t.joinMode === 'request') return v?.requestStatus === 'pending' ? <div className="space-y-2"><button className="btn-ghost w-full" disabled>Request pending</button><button className="w-full text-sm text-muted underline" onClick={cancelReq}>Withdraw request</button></div>
      : v?.requestStatus === 'rejected' ? <button className="btn-ghost w-full" disabled>Request declined</button> : <button className="btn-primary w-full" onClick={() => (user ? setReqOpen(true) : needLogin())}>Request to Join</button>;
    return <button className="btn-primary w-full" disabled={busy === 'join'} onClick={join}>{busy === 'join' && <Spinner className="h-4 w-4" />}Join Trip</button>;
  };
  const tabs = [['itinerary', 'Itinerary'], ['members', `Members (${members.length})`], ...(v?.isMember ? [['checklist', 'Checklist'], ['expenses', 'Expenses'], ['photos', 'Photos'], ['private', 'My private info']] : []), ['reviews', `Reviews (${reviews.data?.count ?? 0})`]];
  const itin = t?.itinerary || [];

  return (
    <Async loading={loading} error={error} onRetry={reload}>
      {t && <div>
        <section className="relative h-64 sm:h-[26rem]"><SafeImg src={t.coverImage} alt={`${t.destination} cover`} label={t.destination} className="h-full w-full object-cover" /><div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          <div className="container-x absolute inset-x-0 bottom-0 pb-6 text-white"><div className="mb-2 flex flex-wrap gap-2"><span className="rounded-full bg-white/20 px-3 py-1 text-xs backdrop-blur">{t.category}</span>{t.travelStyle && <span className="rounded-full bg-white/20 px-3 py-1 text-xs backdrop-blur">{t.travelStyle}</span>}<span className="rounded-full bg-white/20 px-3 py-1 text-xs backdrop-blur">{t.difficulty}</span>{t.status === 'cancelled' && <span className="rounded-full bg-danger px-3 py-1 text-xs">Cancelled</span>}</div>
            <h1 className="text-3xl font-extrabold sm:text-5xl">{t.title}</h1><p className="mt-1 flex items-center gap-1"><MapPin className="h-4 w-4" />{[t.city, t.state, t.country].filter(Boolean).join(', ')}</p></div></section>

        <div className="container-x grid gap-8 py-8 lg:grid-cols-[1fr_22rem]">
          <div className="min-w-0 space-y-8">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Stat icon={CalendarDays} label="Dates" value={dateRange(t.startDate, t.endDate)} /><Stat icon={Clock} label="Duration" value={`${duration(t.startDate, t.endDate)} days`} /><Stat icon={Wallet} label="Budget / person" value={inr(t.budget)} />
              <Stat icon={Users} label="Members" value={`${t.memberCount} of ${t.maxMembers} · ${Math.max(0, t.maxMembers - t.memberCount)} left`} /><Stat icon={Mountain} label="Difficulty" value={t.difficulty} /><Stat icon={Star} label="Rating" value={data.rating.count ? `${data.rating.avg} (${data.rating.count})` : 'No reviews yet'} /></div>
            <section><h2 className="mb-2 text-xl font-bold">About this trip</h2><p className="whitespace-pre-line text-muted">{t.description}</p>
              {t.activities?.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{t.activities.map((a) => <span key={a} className="chip">{a}</span>)}</div>}
              {t.meetingPoint && <p className="mt-3 text-sm"><b>Meeting point:</b> {t.meetingPoint}</p>}<p className="mt-1 text-sm text-muted">Preferred ages {t.ageMin}–{t.ageMax} · {t.joinMode === 'request' ? 'Organizer approves requests' : 'Open to join'}</p></section>

            <section aria-label="Location"><h2 className="mb-3 text-xl font-bold">Location</h2>
              <MapView className="h-72" center={[t.latitude, t.longitude]} zoom={9}><Marker position={[t.latitude, t.longitude]} icon={pinIcon} /></MapView>
              <div className="mt-3 flex flex-wrap items-center gap-3"><p className="text-sm text-muted">{t.destination}, {t.state || t.country}</p>{user && !routeFrom && <button className="btn-ghost btn-sm" onClick={showRoute} disabled={routeBusy}>{routeBusy ? <Spinner className="h-4 w-4" /> : <RouteIcon className="h-4 w-4" />}Route from {user.city || 'my city'}</button>}</div>
              {routeFrom && <div className="mt-3"><RouteMap from={routeFrom} to={{ latitude: t.latitude, longitude: t.longitude, label: t.destination }} /></div>}</section>

            <div>
              <div className="no-scrollbar mb-4 flex gap-1 overflow-x-auto border-b border-line" role="tablist">{tabs.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`shrink-0 border-b-2 px-4 py-2.5 text-sm font-semibold ${tab === k ? 'border-brand text-brand' : 'border-transparent text-muted hover:text-ink'}`}>{l}</button>)}</div>
              {tab === 'itinerary' && <div className="space-y-6">{itin.some((i) => i.latitude != null) && <ItineraryMap items={itin} activeId={active} onSelect={(i) => { setActive(i._id); document.getElementById(`it-${i._id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }} />}<ItineraryTimeline items={itin} activeId={active} onSelect={(i) => setActive(i._id)} /></div>}
              {tab === 'members' && <ul className="grid gap-3 sm:grid-cols-2">{members.map((m) => <li key={m._id}><Link to={`/travelers/${m.username}`} className="card flex items-center gap-3 p-3 hover:shadow-pop"><Avatar user={m} size={44} /><span className="min-w-0"><b className="block truncate">{m.name}</b><span className="text-xs text-muted">{m.role === 'owner' ? 'Organizer' : 'Member'}{m.city ? ` · ${m.city}` : ''}</span></span></Link></li>)}</ul>}
              {tab === 'checklist' && <Checklist tripId={t._id} isCreator={v.isCreator} />}
              {tab === 'expenses' && <ExpenseTracker tripId={t._id} members={members} meId={user._id} />}
              {tab === 'photos' && <Gallery tripId={t._id} meId={user._id} isCreator={v.isCreator} />}
              {tab === 'private' && <PrivateInfo tripId={t._id} />}
              {tab === 'reviews' && <div className="space-y-4"><Async loading={reviews.loading} error={reviews.error} onRetry={reviews.reload}>
                {reviews.data?.count > 0 && <p className="flex items-center gap-2"><Stars value={reviews.data.average} /><b>{reviews.data.average}</b><span className="text-sm text-muted">from {reviews.data.count} reviews</span></p>}
                {reviews.data?.reviews.length ? reviews.data.reviews.map((r) => <ReviewCard key={r._id} r={r} />) : <EmptyState icon={Star} title="No reviews yet" text="Members can review the trip once it has ended." />}</Async>
                {v?.isMember && v.ended && !reviews.data?.reviews.some((r) => r.author?._id === user._id) && <div className="card space-y-3 p-4"><h3 className="font-bold">Rate this trip</h3><StarInput value={rv.rating} onChange={(rating) => setRv({ ...rv, rating })} /><textarea className="input min-h-20" placeholder="How was the trip and the group?" value={rv.comment} onChange={(e) => setRv({ ...rv, comment: e.target.value })} maxLength={1000} aria-label="Review comment" /><button className="btn-primary" disabled={!rv.rating || busy === 'rv'} onClick={submitReview}>{busy === 'rv' && <Spinner className="h-4 w-4" />}Post review</button></div>}</div>}
            </div>
          </div>

          <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
            <div className="card space-y-4 p-5"><div><p className="text-3xl font-extrabold">{inr(t.budget)}</p><p className="text-sm text-muted">estimated per person</p></div>
              <div><div className="mb-1 flex justify-between text-sm"><span>{t.memberCount} joined</span><span className="text-muted">{Math.max(0, t.maxMembers - t.memberCount)} spots left</span></div><div className="h-2 overflow-hidden rounded-full bg-raised"><div className="h-full bg-brand" style={{ width: `${(t.memberCount / t.maxMembers) * 100}%` }} /></div></div>
              {joinBtn()}
              {v?.isMember && t.conversation && <Link to={`/messages/${t.conversation}`} className="btn-ghost w-full"><MessageSquare className="h-4 w-4" />Open group chat</Link>}
              <div className="grid grid-cols-2 gap-2"><button className="btn-ghost btn-sm" onClick={save} aria-pressed={v?.favorite}><Bookmark className={`h-4 w-4 ${v?.favorite ? 'fill-brand text-brand' : ''}`} />{v?.favorite ? 'Saved' : 'Save'}</button><button className="btn-ghost btn-sm" onClick={share}><Share2 className="h-4 w-4" />Share</button></div>
              {v?.isCreator && <div className="grid grid-cols-2 gap-2"><Link to={`/trips/${t.slug}/edit`} className="btn-ghost btn-sm">Edit</Link><Link to={`/trips/${t.slug}/manage`} className="btn-ghost btn-sm">Manage</Link></div>}</div>
            <div className="card p-5"><p className="mb-3 text-sm font-semibold text-muted">Organized by</p><Link to={`/travelers/${t.creator.username}`} className="flex items-center gap-3"><Avatar user={t.creator} size={48} /><span><b className="block">{t.creator.name}</b><span className="text-xs text-muted">{t.creator.city}</span></span></Link>
              {!v?.isCreator && <div className="mt-4 grid grid-cols-2 gap-2"><button className="btn-primary btn-sm" onClick={() => (user ? nav(`/messages?user=${t.creator._id}`) : needLogin())}><MessageCircle className="h-4 w-4" />Message</button><button className="btn-ghost btn-sm" onClick={() => (user ? setReport(true) : needLogin())}><Flag className="h-4 w-4" />Report</button></div>}</div>
            <div className="card p-5"><h2 className="mb-3 font-bold">Weather at destination</h2><Weather lat={t.latitude} lng={t.longitude} /></div>
          </aside>
        </div>
        <ConfirmModal open={leave} onClose={() => setLeave(false)} onConfirm={doLeave} busy={busy === 'leave'} danger title="Leave this trip?" text="You'll be removed from the group and its chat. You can rejoin later if spots are open." confirmLabel="Leave trip" />
        <Modal open={reqOpen} onClose={() => setReqOpen(false)} title="Request to join" size="max-w-md" footer={<><button className="btn-ghost" onClick={() => setReqOpen(false)}>Cancel</button><button className="btn-primary" onClick={request} disabled={busy === 'req'}>{busy === 'req' && <Spinner className="h-4 w-4" />}Send request</button></>}>
          <Field label="Why do you want to join? (optional)" htmlFor="rm"><textarea id="rm" className="input min-h-28" maxLength={500} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Introduce yourself to the organizer" /></Field></Modal>
        {report && <ReportModal open onClose={() => setReport(false)} targetType="trip" targetId={t._id} label="trip" />}
      </div>}
    </Async>
  );
}
