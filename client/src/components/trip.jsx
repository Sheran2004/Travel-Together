import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plane, Train, Bus, Car, Bike, Footprints, Circle, Plus, Trash2, Check, ListChecks, Receipt, Cloud, Images, Lock } from 'lucide-react';
import api, { errMsg, assetUrl } from '../services/api';
import { useToast } from '../context/ToastContext';
import { Avatar, Spinner, Modal, Field, EmptyState, Async } from './ui';
import { inr, fmtDate, fmtDateFull } from '../utils/format';

const T_ICON = { flight: Plane, train: Train, bus: Bus, car: Car, bike: Bike, walking: Footprints, none: Circle };
export function ItineraryTimeline({ items, activeId, onSelect }) {
  if (!items?.length) return <p className="text-sm text-muted">The organizer hasn't added an itinerary yet.</p>;
  const days = [...items].sort((a, b) => a.day - b.day || (a.time || '').localeCompare(b.time || ''));
  const groups = days.reduce((a, i) => ({ ...a, [i.day]: [...(a[i.day] || []), i] }), {});
  return (
    <ol className="space-y-6">{Object.entries(groups).map(([d, list]) => (
      <li key={d}><div className="mb-2 flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-full bg-brand font-bold text-brand-ink">{d}</span><div><p className="font-display font-bold">Day {d}</p>{list[0].date && <p className="text-xs text-muted">{fmtDateFull(list[0].date)}</p>}</div></div>
        <ul className="ml-4 space-y-3 border-l-2 border-line pl-6">{list.map((i) => { const I = T_ICON[i.transport] || Circle; return (
          <li key={i._id} id={`it-${i._id}`}><button type="button" onClick={() => onSelect?.(i)} className={`w-full rounded-xl border p-3 text-left transition ${activeId === i._id ? 'border-brand bg-brand/5' : 'border-line hover:bg-raised'}`}>
            <div className="flex items-start justify-between gap-2"><p className="font-semibold">{i.activity}</p>{i.time && <span className="chip shrink-0">{i.time}</span>}</div>
            <p className="text-sm text-muted">{i.locationName}</p>{i.description && <p className="mt-1 text-sm">{i.description}</p>}
            {(i.transport && i.transport !== 'none' || i.departure || i.arrival) && <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted"><I className="h-4 w-4 text-brand" /><span className="capitalize">{i.transport}</span>{i.departure && <span>Departs {i.departure}</span>}{i.arrival && <span>Arrives {i.arrival}</span>}</p>}
            {i.notes && <p className="mt-1 text-xs italic text-muted">Note: {i.notes}</p>}</button></li>); })}</ul></li>))}</ol>
  );
}

export function Checklist({ tripId, isCreator }) {
  const [items, setItems] = useState(null); const [text, setText] = useState(''); const [err, setErr] = useState(''); const toast = useToast();
  const load = () => api.get(`/trips/${tripId}/checklist`).then((r) => setItems(r.data.checklist)).catch((e) => setErr(errMsg(e)));
  useEffect(() => { load(); }, [tripId]); // eslint-disable-line
  const toggle = async (i) => { setItems((l) => l.map((x) => (x._id === i._id ? { ...x, done: !x.done } : x))); try { const r = await api.patch(`/trips/${tripId}/checklist/${i._id}`, { done: !i.done }); setItems(r.data.checklist); } catch (e) { toast.error(errMsg(e)); load(); } };
  const add = async (e) => { e.preventDefault(); if (!text.trim()) return; try { const r = await api.post(`/trips/${tripId}/checklist`, { text }); setItems(r.data.checklist); setText(''); } catch (er) { toast.error(errMsg(er)); } };
  const remove = async (i) => { try { const r = await api.delete(`/trips/${tripId}/checklist/${i._id}`); setItems(r.data.checklist); } catch (e) { toast.error(errMsg(e)); } };
  const done = items?.filter((i) => i.done).length || 0;
  return (
    <Async loading={!items && !err} error={err} onRetry={load}>
      <div className="space-y-3">
        <div className="flex items-center gap-3"><div className="h-2 flex-1 overflow-hidden rounded-full bg-raised"><div className="h-full bg-ok transition-all" style={{ width: `${items?.length ? (done / items.length) * 100 : 0}%` }} /></div><span className="text-xs text-muted">{done}/{items?.length || 0}</span></div>
        {items?.length === 0 && <EmptyState icon={ListChecks} title="Nothing on the list yet" text={isCreator ? 'Add the first item below.' : 'The organizer will add checklist items.'} />}
        <ul className="space-y-1.5">{items?.map((i) => <li key={i._id} className="group flex items-center gap-3 rounded-xl border border-line px-3 py-2"><button onClick={() => toggle(i)} role="checkbox" aria-checked={i.done} aria-label={i.text} className={`grid h-6 w-6 shrink-0 place-items-center rounded-md border ${i.done ? 'border-ok bg-ok text-white' : 'border-line'}`}>{i.done && <Check className="h-4 w-4" />}</button><span className={`flex-1 text-sm ${i.done ? 'text-muted line-through' : ''}`}>{i.text}</span>{isCreator && <button onClick={() => remove(i)} aria-label={`Remove ${i.text}`} className="text-muted opacity-0 hover:text-danger group-hover:opacity-100 focus:opacity-100"><Trash2 className="h-4 w-4" /></button>}</li>)}</ul>
        {isCreator && <form onSubmit={add} className="flex gap-2"><input className="input" placeholder="Add an item, e.g. Power bank" value={text} onChange={(e) => setText(e.target.value)} maxLength={120} aria-label="New checklist item" /><button className="btn-primary" aria-label="Add item"><Plus className="h-4 w-4" /></button></form>}
      </div>
    </Async>
  );
}

export function ExpenseTracker({ tripId, members, meId }) {
  const [data, setData] = useState(null); const [err, setErr] = useState(''); const [open, setOpen] = useState(false); const toast = useToast();
  const [f, setF] = useState({ description: '', amount: '', paidBy: meId, participants: members.map((m) => m._id) }); const [busy, setBusy] = useState(false);
  const load = () => api.get(`/trips/${tripId}/expenses`).then((r) => setData(r.data)).catch((e) => setErr(errMsg(e)));
  useEffect(() => { load(); }, [tripId]); // eslint-disable-line
  const add = async () => { setBusy(true); try { await api.post(`/trips/${tripId}/expenses`, { ...f, amount: Number(f.amount) }); setOpen(false); setF({ ...f, description: '', amount: '' }); toast.success('Expense added'); load(); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); } };
  const remove = async (id) => { try { await api.delete(`/trips/${tripId}/expenses/${id}`); load(); } catch (e) { toast.error(errMsg(e)); } };
  const mine = data?.settlements.filter((s) => s.from === meId || s.to === meId) || [];
  const per = data && members.length ? data.total / members.length : 0;
  return (
    <Async loading={!data && !err} error={err} onRetry={load}>
      {data && <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3"><div className="rounded-xl bg-raised p-3"><p className="text-xs text-muted">Total spent</p><p className="font-display text-xl font-bold">{inr(data.total)}</p></div><div className="rounded-xl bg-raised p-3"><p className="text-xs text-muted">Average per member</p><p className="font-display text-xl font-bold">{inr(per)}</p></div></div>
        <div className="space-y-2">{data.settlements.length === 0 ? <p className="text-sm text-muted">{data.expenses.length ? 'Everyone is settled up.' : 'Add expenses to see who owes whom.'}</p> :
          data.settlements.map((s, i) => <p key={i} className={`rounded-xl px-3 py-2 text-sm ${s.from === meId ? 'bg-danger/10' : s.to === meId ? 'bg-ok/10' : 'bg-raised'}`}>{s.from === meId ? <>You owe <b>{s.toUser?.name}</b> <b>{inr(s.amount)}</b></> : s.to === meId ? <><b>{s.fromUser?.name}</b> owes you <b>{inr(s.amount)}</b></> : <><b>{s.fromUser?.name}</b> owes <b>{s.toUser?.name}</b> {inr(s.amount)}</>}</p>)}</div>
        <button className="btn-primary btn-sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" />Add expense</button>
        {data.expenses.length === 0 ? <EmptyState icon={Receipt} title="No expenses yet" text="Track hotels, taxis, food and tickets. Splits are calculated automatically." /> :
          <ul className="divide-y divide-line rounded-xl border border-line">{data.expenses.map((e) => <li key={e._id} className="flex items-center gap-3 px-3 py-2.5"><div className="min-w-0 flex-1"><p className="truncate font-medium">{e.description}</p><p className="text-xs text-muted">Paid by {e.paidBy?.name} · split {e.participants.length} ways · {fmtDate(e.date)}</p></div><b>{inr(e.amount)}</b>{(e.paidBy?._id === meId) && <button onClick={() => remove(e._id)} aria-label={`Delete ${e.description}`} className="text-muted hover:text-danger"><Trash2 className="h-4 w-4" /></button>}</li>)}</ul>}
        <Modal open={open} onClose={() => setOpen(false)} title="Add expense" footer={<><button className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button><button className="btn-primary" disabled={busy || !f.description || !f.amount} onClick={add}>{busy && <Spinner className="h-4 w-4" />}Save expense</button></>}>
          <div className="space-y-4"><Field label="Description" htmlFor="ed"><input id="ed" className="input" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Hotel, Taxi, Food…" /></Field>
            <Field label="Amount (₹)" htmlFor="ea"><input id="ea" className="input" type="number" min="1" step="0.01" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Field>
            <Field label="Paid by" htmlFor="ep"><select id="ep" className="input" value={f.paidBy} onChange={(e) => setF({ ...f, paidBy: e.target.value })}>{members.map((m) => <option key={m._id} value={m._id}>{m.name}{m._id === meId ? ' (you)' : ''}</option>)}</select></Field>
            <fieldset><legend className="label">Split between</legend><div className="grid gap-1.5">{members.map((m) => <label key={m._id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.participants.includes(m._id)} onChange={(e) => setF({ ...f, participants: e.target.checked ? [...f.participants, m._id] : f.participants.filter((x) => x !== m._id) })} /><Avatar user={m} size={22} />{m.name}</label>)}</div></fieldset></div>
        </Modal>
      </div>}
    </Async>
  );
}

export function Weather({ lat, lng }) {
  const [w, setW] = useState(null); const [err, setErr] = useState(false);
  useEffect(() => { let live = true; api.get('/weather', { params: { lat, lng } }).then((r) => live && setW(r.data)).catch(() => live && setErr(true)); return () => { live = false; }; }, [lat, lng]);
  if (err) return <p className="text-sm text-muted">Weather is unavailable right now.</p>;
  if (!w) return <div className="skeleton h-28 rounded-xl" />;
  return (
    <div className="space-y-3"><div className="flex items-center gap-3"><Cloud className="h-8 w-8 text-brand" /><div><p className="font-display text-2xl font-bold">{Math.round(w.current.temperature)}°C</p><p className="text-sm text-muted">{w.current.condition} · wind {Math.round(w.current.wind)} km/h · humidity {w.current.humidity}%</p></div></div>
      <div className="no-scrollbar flex gap-2 overflow-x-auto">{w.forecast.map((d) => <div key={d.date} className="min-w-[4.5rem] rounded-xl bg-raised p-2 text-center text-xs"><p className="font-semibold">{new Date(d.date).toLocaleDateString('en-IN', { weekday: 'short' })}</p><p>{Math.round(d.max)}° / {Math.round(d.min)}°</p><p className="text-muted">{d.rainChance ?? 0}% rain</p></div>)}</div>
      <p className="text-[11px] text-muted">Live data from {w.source}</p></div>
  );
}

export function Gallery({ tripId, meId, isCreator }) {
  const [photos, setPhotos] = useState(null); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false); const [open, setOpen] = useState(null); const toast = useToast(); const ref = useRef(null);
  const load = () => api.get(`/trips/${tripId}/photos`).then((r) => setPhotos(r.data.photos)).catch((e) => setErr(errMsg(e)));
  useEffect(() => { load(); }, [tripId]); // eslint-disable-line
  const add = async (e) => {
    const f = e.target.files?.[0]; e.target.value = ''; if (!f) return; if (!f.type.startsWith('image/')) return toast.error('Choose an image file');
    setBusy(true);
    try { const fd = new FormData(); fd.append('file', f); const u = await api.post('/uploads/image', fd); await api.post(`/trips/${tripId}/photos`, { url: u.data.url }); toast.success('Photo added'); load(); }
    catch (er) { toast.error(errMsg(er, 'Upload failed')); } finally { setBusy(false); }
  };
  const remove = async (p) => { try { await api.delete(`/trips/${tripId}/photos/${p._id}`); setPhotos((l) => l.filter((x) => x._id !== p._id)); setOpen(null); } catch (e) { toast.error(errMsg(e)); } };
  return (
    <Async loading={!photos && !err} error={err} onRetry={load}>
      <div className="space-y-4">
        <input ref={ref} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" onChange={add} aria-label="Add photo" />
        <button className="btn-primary btn-sm" disabled={busy} onClick={() => ref.current.click()}>{busy ? <Spinner className="h-4 w-4" /> : <Plus className="h-4 w-4" />}Add photo</button>
        {photos?.length === 0 ? <EmptyState icon={Images} title="No photos yet" text="Share trip memories with your group. Only members can see them." /> :
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">{photos?.map((p) => <li key={p._id}><button onClick={() => setOpen(p)} className="block aspect-square w-full overflow-hidden rounded-xl bg-raised"><img src={assetUrl(p.url)} alt={`Photo by ${p.user?.name}`} loading="lazy" className="h-full w-full object-cover transition hover:scale-105" /></button></li>)}</ul>}
        <Modal open={!!open} onClose={() => setOpen(null)} title={open ? `Photo by ${open.user?.name}` : ''} size="max-w-2xl" footer={open && (open.user?._id === meId || isCreator) ? <button className="btn-danger btn-sm" onClick={() => remove(open)}><Trash2 className="h-4 w-4" />Delete photo</button> : null}>
          {open && <img src={assetUrl(open.url)} alt={`Photo by ${open.user?.name}`} className="mx-auto max-h-[60vh] rounded-xl" />}
        </Modal>
      </div>
    </Async>
  );
}

const NOTE_KINDS = { hotel: 'Hotel booking', transport: 'Transport', emergency: 'Emergency contact', note: 'Note' };
export function PrivateInfo({ tripId }) {
  const [notes, setNotes] = useState(null); const [err, setErr] = useState(''); const [f, setF] = useState({ kind: 'hotel', title: '', content: '' }); const [busy, setBusy] = useState(false); const toast = useToast();
  const load = () => api.get(`/trips/${tripId}/notes`).then((r) => setNotes(r.data.notes)).catch((e) => setErr(errMsg(e)));
  useEffect(() => { load(); }, [tripId]); // eslint-disable-line
  const add = async (e) => { e.preventDefault(); setBusy(true); try { await api.post(`/trips/${tripId}/notes`, f); setF({ ...f, title: '', content: '' }); load(); } catch (er) { toast.error(errMsg(er)); } finally { setBusy(false); } };
  const remove = async (n) => { try { await api.delete(`/trips/${tripId}/notes/${n._id}`); setNotes((l) => l.filter((x) => x._id !== n._id)); } catch (e) { toast.error(errMsg(e)); } };
  return (
    <Async loading={!notes && !err} error={err} onRetry={load}>
      <div className="space-y-4">
        <p className="flex items-center gap-2 rounded-xl bg-raised p-3 text-sm"><Lock className="h-4 w-4 text-brand" />Private: only you can see these. They are never shared with the group.</p>
        <form onSubmit={add} className="space-y-3 rounded-xl border border-line p-4">
          <div className="grid gap-3 sm:grid-cols-3"><select className="input" aria-label="Type" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>{Object.entries(NOTE_KINDS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select><input className="input sm:col-span-2" placeholder="Title, e.g. Hotel Snow Valley, booking #" maxLength={100} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} aria-label="Title" /></div>
          <textarea className="input min-h-20" placeholder="Details" maxLength={2000} value={f.content} onChange={(e) => setF({ ...f, content: e.target.value })} aria-label="Details" />
          <button className="btn-primary btn-sm" disabled={busy || !f.title.trim()}>{busy && <Spinner className="h-4 w-4" />}Save privately</button>
        </form>
        {notes?.length === 0 ? <EmptyState icon={Lock} title="Nothing saved yet" text="Keep bookings, tickets info and emergency contacts for this trip here." /> :
          <ul className="space-y-2">{notes?.map((n) => <li key={n._id} className="flex gap-3 rounded-xl border border-line p-3"><div className="min-w-0 flex-1"><p className="text-xs text-muted">{NOTE_KINDS[n.kind]}</p><p className="font-semibold">{n.title}</p>{n.content && <p className="whitespace-pre-wrap text-sm text-muted">{n.content}</p>}</div><button onClick={() => remove(n)} aria-label={`Delete ${n.title}`} className="self-start text-muted hover:text-danger"><Trash2 className="h-4 w-4" /></button></li>)}</ul>}
      </div>
    </Async>
  );
}
