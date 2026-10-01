import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';
import api, { errMsg, fieldErrors } from '../services/api';
import { useToast } from '../context/ToastContext';
import { useFetch } from '../hooks/useFetch';
import { Field, Chips, Spinner, Async, TagInput } from '../components/ui';
import { ImageUpload } from '../components/Extras';
import { LocationPicker } from '../components/maps';
import { STYLES, TRANSPORT, toInputDate } from '../utils/format';
import { useCategories } from '../hooks/useCategories';

const blank = { title: '', description: '', coverImage: '', startDate: '', endDate: '', budget: '', maxMembers: 8, category: 'Adventure', travelStyle: '', difficulty: 'Easy', ageMin: 18, ageMax: 60, joinMode: 'open', visibility: 'public', meetingPoint: '', activities: [], itinerary: [] };
const today = () => new Date(Date.now() + 864e5).toISOString().slice(0, 10);

export default function TripForm({ edit }) {
  const { slug } = useParams(); const nav = useNavigate(); const toast = useToast(); const cats = useCategories();
  const existing = useFetch(`/trips/${slug}`, null, { enabled: !!edit });
  const [f, setF] = useState(blank); const [loc, setLoc] = useState(null); const [errs, setErrs] = useState({}); const [busy, setBusy] = useState(false);
  useEffect(() => {
    const t = existing.data?.trip; if (!t) return;
    setF({ ...blank, ...t, startDate: toInputDate(t.startDate), endDate: toInputDate(t.endDate), travelStyle: t.travelStyle || '', itinerary: (t.itinerary || []).map((i) => ({ ...i, date: toInputDate(i.date) })) });
    setLoc({ destination: t.destination, city: t.city, state: t.state, country: t.country, latitude: t.latitude, longitude: t.longitude });
  }, [existing.data]);
  const up = (k, v) => { setF((p) => ({ ...p, [k]: v })); setErrs((e) => ({ ...e, [k]: undefined })); };
  const days = (() => { if (!f.startDate || !f.endDate) return 0; return Math.round((new Date(f.endDate) - new Date(f.startDate)) / 864e5) + 1; })();
  const addDay = () => { const n = f.itinerary.length + 1; const d = f.startDate ? new Date(new Date(f.startDate).getTime() + (n - 1) * 864e5).toISOString().slice(0, 10) : ''; up('itinerary', [...f.itinerary, { day: n, date: d, time: '', locationName: loc?.destination || '', latitude: loc?.latitude, longitude: loc?.longitude, activity: '', description: '', transport: 'none', notes: '' }]); };
  const setItem = (i, patch) => up('itinerary', f.itinerary.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const removeItem = (i) => up('itinerary', f.itinerary.filter((_, j) => j !== i).map((x, j) => ({ ...x, day: j + 1 })));
  const pickStop = async (i, name) => { setItem(i, { locationName: name }); };
  const geocodeStop = async (i) => { const it = f.itinerary[i]; if (!it.locationName.trim()) return; try { const r = await api.get('/geo/search', { params: { q: `${it.locationName}, ${loc?.state || loc?.country || ''}` } }); const p = r.data.results[0]; if (p) setItem(i, { latitude: p.latitude, longitude: p.longitude }); else toast.info(`Couldn't find "${it.locationName}" on the map. It will still be listed in the itinerary.`); } catch { /* keep text only */ } };

  const validate = () => {
    const e = {};
    if (f.title.trim().length < 4) e.title = 'Title must be at least 4 characters';
    if (!loc) e.location = 'Search and select a destination on the map';
    if (f.description.trim().length < 20) e.description = 'Describe the trip in at least 20 characters';
    if (!f.startDate) e.startDate = 'Choose a start date'; else if (!edit && new Date(f.startDate) <= new Date()) e.startDate = 'Start date must be in the future';
    if (!f.endDate) e.endDate = 'Choose an end date'; else if (f.startDate && f.endDate < f.startDate) e.endDate = 'End date cannot be before start date';
    if (f.budget === '' || Number(f.budget) < 0) e.budget = 'Enter an estimated budget (₹)';
    if (!(Number(f.maxMembers) >= 2)) e.maxMembers = 'At least 2 members';
    if (Number(f.ageMax) < Number(f.ageMin)) e.ageMax = 'Max age must be at least min age';
    f.itinerary.forEach((i, idx) => { if (!i.locationName.trim() || !i.activity.trim()) e.itinerary = `Day ${idx + 1} needs a location and an activity`; });
    setErrs(e); return !Object.keys(e).length;
  };
  const submit = async (ev) => {
    ev.preventDefault(); if (!validate()) { toast.error('Please fix the highlighted fields'); return; }
    setBusy(true);
    try {
      const body = { ...f, ...loc, budget: Number(f.budget), maxMembers: Number(f.maxMembers), ageMin: Number(f.ageMin), ageMax: Number(f.ageMax), travelStyle: f.travelStyle || undefined, itinerary: f.itinerary.map((i) => ({ ...i, date: i.date || undefined, latitude: i.latitude ?? undefined, longitude: i.longitude ?? undefined })) };
      delete body.displayName; delete body._id; delete body.slug; delete body.creator; delete body.members; delete body.checklist; delete body.status; delete body.memberCount; delete body.conversation; delete body.__v; delete body.createdAt; delete body.updatedAt; delete body.durationDays; delete body.id; delete body.avgRating; delete body.reviewCount; delete body.savedCount;
      const r = edit ? await api.put(`/trips/${existing.data.trip._id}`, body) : await api.post('/trips', body);
      toast.success(edit ? 'Trip updated' : 'Trip created! You are the organizer.'); nav(`/trips/${r.data.trip.slug}`);
    } catch (e) { const fe = fieldErrors(e); setErrs(fe); toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  const section = (t, sub, children) => <section className="card space-y-5 p-5 sm:p-6"><div><h2 className="text-lg font-bold">{t}</h2>{sub && <p className="text-sm text-muted">{sub}</p>}</div>{children}</section>;
  const inp = (k, label, props = {}) => <Field label={label} error={errs[k]} htmlFor={`f-${k}`}><input id={`f-${k}`} className="input" value={f[k]} onChange={(e) => up(k, e.target.value)} {...props} /></Field>;

  return (
    <Async loading={edit && existing.loading} error={edit && existing.error} onRetry={existing.reload}>
      <form onSubmit={submit} className="container-x max-w-3xl space-y-6 py-8" noValidate>
        <div><h1 className="text-3xl font-extrabold">{edit ? 'Edit trip' : 'Create a trip'}</h1><p className="text-muted">{edit ? 'Changes are saved to the database and members are notified.' : 'You become the organizer and a group chat is created automatically.'}</p></div>
        {section('Basics', null, <>
          {inp('title', 'Trip title', { placeholder: 'Manali Mountain Trek', maxLength: 120 })}
          <Field label="Destination" error={errs.location || errs.latitude}><LocationPicker value={loc} onChange={setLoc} /></Field>
          <Field label="Description" error={errs.description} htmlFor="f-description"><textarea id="f-description" className="input min-h-32" value={f.description} onChange={(e) => up('description', e.target.value)} placeholder="What's the plan, who is it for, what should people expect?" /></Field>
          <Field label="Cover image"><ImageUpload value={f.coverImage} onChange={(u) => up('coverImage', u)} label="Upload cover" /></Field>
          <div className="grid gap-4 sm:grid-cols-2">{inp('startDate', 'Start date', { type: 'date', min: edit ? undefined : today() })}{inp('endDate', 'End date', { type: 'date', min: f.startDate || today() })}</div>
          {days > 0 && <p className="text-sm text-muted">{days} day{days > 1 ? 's' : ''}</p>}
          <div className="grid gap-4 sm:grid-cols-2">{inp('budget', 'Estimated budget per person (₹)', { type: 'number', min: 0 })}{inp('maxMembers', 'Maximum members', { type: 'number', min: 2, max: 100 })}</div>
          <Field label="Highlights (press Enter to add)"><TagInput value={f.activities} onChange={(v) => up('activities', v)} placeholder="Camping, Rafting…" /></Field>
        </>)}
        {section('Travel preferences', null, <>
          <Field label="Category"><Chips options={cats} value={[f.category]} onChange={(v) => v.length && up('category', v[v.length - 1])} /></Field>
          <Field label="Travel style"><Chips options={STYLES} value={f.travelStyle ? [f.travelStyle] : []} onChange={(v) => up('travelStyle', v[v.length - 1] || '')} /></Field>
          <div className="grid gap-4 sm:grid-cols-3"><Field label="Difficulty" htmlFor="diff"><select id="diff" className="input" value={f.difficulty} onChange={(e) => up('difficulty', e.target.value)}>{['Easy', 'Moderate', 'Hard'].map((d) => <option key={d}>{d}</option>)}</select></Field>{inp('ageMin', 'Preferred age from', { type: 'number', min: 18 })}{inp('ageMax', 'Preferred age to', { type: 'number', min: 18 })}</div>
          <div className="grid gap-4 sm:grid-cols-2"><Field label="Who can join?" htmlFor="jm"><select id="jm" className="input" value={f.joinMode} onChange={(e) => up('joinMode', e.target.value)}><option value="open">Open join: anyone can join instantly</option><option value="request">Request to join: I approve each traveler</option></select></Field>
            <Field label="Visibility" htmlFor="vis"><select id="vis" className="input" value={f.visibility} onChange={(e) => up('visibility', e.target.value)}><option value="public">Public: appears in search and map</option><option value="private">Private: invite only</option></select></Field></div>
          {inp('meetingPoint', 'Meeting point (optional)', { placeholder: 'Delhi ISBT Kashmere Gate, 8 PM' })}
        </>)}
        {section('Itinerary', 'Add each day. Stops with a place found on the map are drawn on the trip map with a real route.', <>
          {errs.itinerary && <p className="err">{typeof errs.itinerary === 'string' ? errs.itinerary : 'Check itinerary fields'}</p>}
          <div className="space-y-4">{f.itinerary.map((it, i) => (
            <fieldset key={i} className="space-y-3 rounded-xl border border-line p-4"><legend className="px-2 text-sm font-bold">Day {it.day}</legend>
              <div className="grid gap-3 sm:grid-cols-3"><label className="block"><span className="label">Date</span><input type="date" className="input" value={it.date || ''} onChange={(e) => setItem(i, { date: e.target.value })} /></label><label className="block"><span className="label">Time</span><input type="time" className="input" value={it.time || ''} onChange={(e) => setItem(i, { time: e.target.value })} /></label>
                <label className="block"><span className="label">Transport</span><select className="input" value={it.transport} onChange={(e) => setItem(i, { transport: e.target.value })}>{TRANSPORT.map((t) => <option key={t}>{t}</option>)}</select></label></div>
              <div className="grid gap-3 sm:grid-cols-2"><label className="block"><span className="label">Location</span><input className="input" value={it.locationName} onChange={(e) => pickStop(i, e.target.value)} onBlur={() => geocodeStop(i)} placeholder="Solang Valley" />{it.latitude != null && <span className="mt-1 block text-xs text-ok">Found on map</span>}</label><label className="block"><span className="label">Activity</span><input className="input" value={it.activity} onChange={(e) => setItem(i, { activity: e.target.value })} placeholder="Trek to Beas Kund" /></label></div>
              <label className="block"><span className="label">Description / notes</span><textarea className="input min-h-16" value={it.description || ''} onChange={(e) => setItem(i, { description: e.target.value })} /></label>
              <button type="button" className="text-sm text-danger" onClick={() => removeItem(i)}><Trash2 className="mr-1 inline h-4 w-4" />Remove day</button></fieldset>))}</div>
          <button type="button" className="btn-ghost" onClick={addDay}><Plus className="h-4 w-4" />Add day</button>
        </>)}
        <div className="sticky bottom-20 z-10 flex justify-end gap-3 rounded-2xl border border-line bg-surface/95 p-3 backdrop-blur md:bottom-4"><button type="button" className="btn-ghost" onClick={() => nav(-1)}>Cancel</button><button className="btn-primary" disabled={busy}>{busy && <Spinner className="h-4 w-4" />}{edit ? 'Save changes' : 'Create trip'}</button></div>
      </form>
    </Async>
  );
}
