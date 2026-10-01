import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Send, Smile, Paperclip, Image as ImageIcon, Mic, Square, X, Play, Pause, Phone, Video, MoreVertical, Reply, Copy, Trash2, Pin, Search, Check, CheckCheck, ArrowLeft, Ban, Flag, EyeOff, PlusCircle, Users, FileText, UserMinus, Download } from 'lucide-react';
import api, { errMsg, assetUrl } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useCall } from '../context/CallContext';
import { useToast } from '../context/ToastContext';
import { Avatar, Spinner, Modal, ConfirmModal, PageLoader, ErrorState } from './ui';
import { ReportModal } from './Extras';
import { fmtTime, fmtDate, mmss, timeAgo, dateRange } from '../utils/format';

const EMOJIS = '😀 😂 😍 🥰 😎 🤩 😊 🙏 👍 👏 🎉 🔥 ❤️ 💙 ✨ 🌄 🏔️ 🏖️ 🚗 🚆 ✈️ 🎒 📸 🍜 ☕ 🌅 🌊 ⛺ 🧗 🚴 😅 🤔 😢 😮 🙌 💯 👋 🤝'.split(' ');
const REACTIONS = ['👍', '❤️', '😂', '🎉', '😮', '🙏'];

export function EmojiPicker({ onPick }) {
  return <div className="card absolute bottom-14 left-0 z-30 grid w-64 grid-cols-8 gap-1 p-2 shadow-pop" role="listbox" aria-label="Emoji">{EMOJIS.map((e) => <button key={e} type="button" role="option" className="rounded p-1 text-lg hover:bg-raised" onClick={() => onPick(e)}>{e}</button>)}</div>;
}

export function VoiceMessage({ m, mine }) {
  const ref = useRef(null); const [playing, setPlaying] = useState(false); const [progress, setProgress] = useState(0); const [err, setErr] = useState(false);
  const bars = m.waveform?.length ? m.waveform : Array.from({ length: 32 }, (_, i) => 0.3 + 0.5 * Math.abs(Math.sin(i)));
  useEffect(() => () => ref.current?.pause(), []);
  const toggle = () => { const a = ref.current; if (!a) return; if (playing) a.pause(); else a.play().catch(() => setErr(true)); };
  return (
    <div className="flex min-w-[13rem] items-center gap-3">
      <audio ref={ref} src={assetUrl(m.mediaUrl)} preload="metadata" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => { setPlaying(false); setProgress(0); }} onTimeUpdate={(e) => setProgress(e.target.currentTime / (e.target.duration || m.duration || 1))} onError={() => setErr(true)} />
      <button onClick={toggle} aria-label={playing ? 'Pause voice message' : 'Play voice message'} className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${mine ? 'bg-white/25' : 'bg-brand text-brand-ink'}`}>{playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}</button>
      <div className="flex h-8 flex-1 items-center gap-[2px]" aria-hidden>{bars.map((b, i) => <span key={i} className="wave-bar" style={{ height: `${Math.max(12, b * 100)}%`, opacity: i / bars.length <= progress ? 1 : 0.4 }} />)}</div>
      <span className="text-xs tabular-nums">{err ? 'Error' : mmss(m.duration || 0)}</span>
    </div>
  );
}

function VoiceRecorder({ onDone, onCancel }) {
  const [secs, setSecs] = useState(0); const [error, setError] = useState(''); const rec = useRef(null); const chunks = useRef([]); const peaks = useRef([]); const stream = useRef(null); const cancelled = useRef(false);
  const timer = useRef(null); const ctx = useRef(null); const sampler = useRef(null); const t0 = useRef(Date.now());
  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) throw new Error('Voice recording is not supported in this browser.');
        stream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (dead) return stream.current.getTracks().forEach((t) => t.stop());
        const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].find((m) => MediaRecorder.isTypeSupported(m));
        rec.current = new MediaRecorder(stream.current, mime ? { mimeType: mime } : undefined);
        rec.current.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
        rec.current.onstop = () => {
          stream.current?.getTracks().forEach((t) => t.stop()); clearInterval(timer.current); clearInterval(sampler.current); ctx.current?.close();
          if (cancelled.current) return; // cancelled recordings are never uploaded
          const blob = new Blob(chunks.current, { type: rec.current.mimeType || 'audio/webm' }); const dur = (Date.now() - t0.current) / 1000;
          const n = 40, p = peaks.current, out = []; for (let i = 0; i < n; i++) { const s = p.slice(Math.floor(i * p.length / n), Math.max(Math.floor((i + 1) * p.length / n), Math.floor(i * p.length / n) + 1)); out.push(Math.round((s.length ? Math.max(...s) : 0.1) * 100) / 100); }
          const mx = Math.max(...out, 0.01); onDone(blob, Math.round(dur), out.map((v) => Math.round(v / mx * 100) / 100));
        };
        const AC = window.AudioContext || window.webkitAudioContext; ctx.current = new AC(); const an = ctx.current.createAnalyser(); an.fftSize = 256; ctx.current.createMediaStreamSource(stream.current).connect(an); const buf = new Uint8Array(an.fftSize);
        sampler.current = setInterval(() => { an.getByteTimeDomainData(buf); let mx = 0; for (const v of buf) mx = Math.max(mx, Math.abs(v - 128) / 128); peaks.current.push(mx); }, 100);
        rec.current.start(); t0.current = Date.now(); timer.current = setInterval(() => { const s = Math.floor((Date.now() - t0.current) / 1000); setSecs(s); if (s >= 300) rec.current?.state === 'recording' && rec.current.stop(); }, 250);
      } catch (e) { setError(e.name === 'NotAllowedError' ? 'Microphone permission was denied. Allow it in your browser settings to send voice messages.' : e.message || 'Could not start recording'); }
    })();
    return () => { dead = true; cancelled.current = true; clearInterval(timer.current); clearInterval(sampler.current); if (rec.current?.state === 'recording') rec.current.stop(); stream.current?.getTracks().forEach((t) => t.stop()); };
  }, []); // eslint-disable-line
  if (error) return <div className="flex items-center gap-3 rounded-xl bg-danger/10 p-3 text-sm"><span className="flex-1">{error}</span><button className="btn-ghost btn-sm" onClick={onCancel}>Close</button></div>;
  return (
    <div className="flex items-center gap-3 rounded-full bg-raised px-3 py-2">
      <button onClick={() => { cancelled.current = true; rec.current?.state === 'recording' && rec.current.stop(); onCancel(); }} aria-label="Cancel recording" className="grid h-9 w-9 place-items-center rounded-full text-danger hover:bg-danger/10"><Trash2 className="h-5 w-5" /></button>
      <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-danger" /><span className="flex-1 text-sm tabular-nums">Recording… {mmss(secs)}</span>
      <button onClick={() => rec.current?.state === 'recording' && rec.current.stop()} aria-label="Stop and send" className="grid h-9 w-9 place-items-center rounded-full bg-brand text-brand-ink"><Send className="h-4 w-4" /></button>
    </div>
  );
}

const Tick = ({ status }) => status === 'read' ? <CheckCheck className="h-3.5 w-3.5 text-accent" aria-label="Read" /> : status === 'delivered' ? <CheckCheck className="h-3.5 w-3.5 opacity-70" aria-label="Delivered" /> : <Check className="h-3.5 w-3.5 opacity-70" aria-label="Sent" />;

function MessageBubble({ m, mine, group, status, onReply, onReact, onDelete, onPin, canModerate, onInviteAction, meId, onReport }) {
  const [menu, setMenu] = useState(false); const toast = useToast();
  if (m.type === 'system') return <div className="my-2 text-center text-xs text-muted">{m.text}</div>;
  const reacts = Object.entries((m.reactions || []).reduce((a, r) => ({ ...a, [r.emoji]: (a[r.emoji] || 0) + 1 }), {}));
  const copy = async () => { try { await navigator.clipboard.writeText(m.text); toast.success('Copied'); } catch { toast.error('Could not copy'); } setMenu(false); };
  const inv = m.invitation;
  return (
    <div className={`group flex gap-2 ${mine ? 'flex-row-reverse' : ''}`}>
      {!mine && group && <Avatar user={m.sender} size={30} className="mt-5" />}
      <div className={`max-w-[80%] ${mine ? 'items-end' : 'items-start'} flex flex-col`}>
        {!mine && group && <span className="mb-0.5 ml-1 text-xs font-medium text-muted">{m.sender?.name}</span>}
        <div className={`relative rounded-2xl px-3.5 py-2 ${mine ? 'rounded-br-md bg-brand text-brand-ink' : 'rounded-bl-md bg-raised'} ${m.deleted ? 'italic opacity-70' : ''}`}>
          {m.pinned && <Pin className="absolute -top-2 right-2 h-3.5 w-3.5 rotate-45 fill-accent text-accent" aria-label="Pinned" />}
          {m.replyTo && <div className={`mb-1.5 rounded-lg border-l-2 px-2 py-1 text-xs ${mine ? 'border-white/60 bg-white/15' : 'border-brand bg-surface'}`}><b>{m.replyTo.sender?.name}</b><p className="line-clamp-1 opacity-80">{m.replyTo.deleted ? 'Message deleted' : m.replyTo.text || `[${m.replyTo.type}]`}</p></div>}
          {m.deleted ? <p className="text-sm">This message was deleted</p> : <>
            {m.type === 'image' && <a href={assetUrl(m.mediaUrl)} target="_blank" rel="noreferrer"><img src={assetUrl(m.mediaUrl)} alt="Shared" loading="lazy" className="mb-1 max-h-64 rounded-xl" /></a>}
            {m.type === 'voice' && <VoiceMessage m={m} mine={mine} />}
            {m.type === 'file' && <a href={assetUrl(m.mediaUrl)} target="_blank" rel="noreferrer" download className="flex items-center gap-2 text-sm underline"><FileText className="h-5 w-5" /><span className="max-w-[12rem] truncate">{m.fileName || 'File'}</span><Download className="h-4 w-4" /></a>}
            {m.type === 'invite' && inv && (
              <div className="min-w-[14rem] space-y-2 text-sm"><p className="font-semibold">Trip invitation</p>
                <div className={`rounded-xl p-2.5 ${mine ? 'bg-white/15' : 'bg-surface'}`}><p className="font-bold">{inv.trip?.title}</p><p className="text-xs opacity-80">{inv.trip?.destination} · {fmtDate(inv.trip?.startDate)}</p></div>
                <div className="flex flex-wrap gap-2"><Link to={`/trips/${inv.trip?.slug}`} className={`btn-sm btn ${mine ? 'bg-white/25' : 'btn-ghost'}`}>View Trip</Link>
                  {!mine && inv.status === 'pending' && <><button className="btn-primary btn-sm" onClick={() => onInviteAction(inv._id, 'accept')}>Accept</button><button className="btn-ghost btn-sm" onClick={() => onInviteAction(inv._id, 'decline')}>Decline</button></>}
                  {inv.status !== 'pending' && <span className="chip capitalize">{inv.status}</span>}</div></div>)}
            {m.text && m.type !== 'invite' && <p className="whitespace-pre-wrap break-words text-sm">{m.text}</p>}
          </>}
          <div className={`mt-0.5 flex items-center justify-end gap-1 text-[10px] ${mine ? 'text-brand-ink/75' : 'text-muted'}`}>{fmtTime(m.createdAt)}{mine && !m.deleted && <Tick status={status} />}</div>
        </div>
        {reacts.length > 0 && <div className="-mt-1.5 flex gap-1 px-2">{reacts.map(([e, n]) => <button key={e} onClick={() => onReact(m, e)} className="rounded-full border border-line bg-surface px-1.5 text-xs shadow-card">{e}{n > 1 ? ` ${n}` : ''}</button>)}</div>}
      </div>
      {!m.deleted && (
        <div className="relative self-center opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
          <button onClick={() => setMenu(!menu)} aria-label="Message actions" aria-expanded={menu} className="rounded-full p-1.5 text-muted hover:bg-raised"><MoreVertical className="h-4 w-4" /></button>
          {menu && <div className={`card absolute z-20 w-44 py-1 text-sm shadow-pop ${mine ? 'right-0' : 'left-0'} bottom-8`} onMouseLeave={() => setMenu(false)}>
            <div className="flex justify-around border-b border-line px-2 pb-1">{REACTIONS.map((e) => <button key={e} className="rounded p-1 hover:bg-raised" onClick={() => { onReact(m, e); setMenu(false); }}>{e}</button>)}</div>
            <button className="flex w-full items-center gap-2 px-3 py-2 hover:bg-raised" onClick={() => { onReply(m); setMenu(false); }}><Reply className="h-4 w-4" />Reply</button>
            {m.text && <button className="flex w-full items-center gap-2 px-3 py-2 hover:bg-raised" onClick={copy}><Copy className="h-4 w-4" />Copy</button>}
            {(!group || canModerate) && <button className="flex w-full items-center gap-2 px-3 py-2 hover:bg-raised" onClick={() => { onPin(m); setMenu(false); }}><Pin className="h-4 w-4" />{m.pinned ? 'Unpin' : 'Pin'}</button>}
            {(mine || canModerate) && <button className="flex w-full items-center gap-2 px-3 py-2 text-danger hover:bg-raised" onClick={() => { onDelete(m); setMenu(false); }}><Trash2 className="h-4 w-4" />Delete</button>}
            {!mine && <button className="flex w-full items-center gap-2 px-3 py-2 hover:bg-raised" onClick={() => { onReport(m); setMenu(false); }}><Flag className="h-4 w-4" />Report</button>}
          </div>}
        </div>)}
    </div>
  );
}

function InviteModal({ open, onClose, userId, onSent }) {
  const [trips, setTrips] = useState(null); const [busy, setBusy] = useState(''); const toast = useToast();
  useEffect(() => { if (open) api.get('/trips/mine').then((r) => setTrips(r.data.upcoming.filter((t) => new Date(t.startDate) > new Date()))).catch(() => setTrips([])); }, [open]);
  const send = async (t) => { setBusy(t._id); try { await api.post(`/trips/${t._id}/invite`, { userId }); toast.success('Invitation sent'); onSent?.(); onClose(); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(''); } };
  return (
    <Modal open={open} onClose={onClose} title="Invite to a trip" size="max-w-md">
      {!trips ? <PageLoader /> : trips.length === 0 ? <p className="text-sm text-muted">You have no upcoming trips yet. Create or join a trip first.</p> :
        <ul className="space-y-2">{trips.map((t) => <li key={t._id} className="flex items-center justify-between gap-3 rounded-xl border border-line p-3"><div className="min-w-0"><p className="truncate font-semibold">{t.title}</p><p className="text-xs text-muted">{dateRange(t.startDate, t.endDate)} · {t.memberCount}/{t.maxMembers}</p></div><button className="btn-primary btn-sm" disabled={!!busy || t.memberCount >= t.maxMembers} onClick={() => send(t)}>{busy === t._id ? <Spinner className="h-4 w-4" /> : t.memberCount >= t.maxMembers ? 'Full' : 'Invite'}</button></li>)}</ul>}
    </Modal>
  );
}

export function ChatWindow({ conversationId, onBack, onChanged }) {
  const { user } = useAuth(); const { socket, isOnline, seedOnline, refreshChatUnread } = useSocket(); const { start } = useCall(); const toast = useToast(); const nav = useNavigate();
  const [conv, setConv] = useState(null); const [msgs, setMsgs] = useState([]); const [hasMore, setHasMore] = useState(false); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const [text, setText] = useState(''); const [reply, setReply] = useState(null); const [emoji, setEmoji] = useState(false); const [recording, setRecording] = useState(false); const [sending, setSending] = useState(false);
  const [typers, setTypers] = useState({}); const [search, setSearch] = useState(''); const [searching, setSearching] = useState(false); const [results, setResults] = useState(null);
  const [menu, setMenu] = useState(false); const [invite, setInvite] = useState(false); const [confirm, setConfirm] = useState(null); const [report, setReport] = useState(null); const [pinnedOnly, setPinnedOnly] = useState(false); const [members, setMembers] = useState(false);
  const bottom = useRef(null); const list = useRef(null); const typingTimer = useRef(null); const lastTyping = useRef(0); const stick = useRef(true); const imgIn = useRef(null); const fileIn = useRef(null);
  const meId = String(user._id); const isGroup = conv?.type === 'group';
  const other = conv?.other; const online = other ? (isOnline(other._id) || other.online) : false;
  const isOrganizer = isGroup && String(conv.group?.creator) === meId;

  const markRead = useCallback(() => { if (socket) socket.emit('message:read', { conversationId }, () => refreshChatUnread()); }, [socket, conversationId, refreshChatUnread]);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [c, m] = await Promise.all([api.get(`/conversations/${conversationId}`), api.get(`/conversations/${conversationId}/messages`)]);
      setConv(c.data.conversation); setMsgs(m.data.messages); setHasMore(m.data.hasMore); stick.current = true;
      if (c.data.conversation.other?.online) seedOnline([c.data.conversation.other._id]);
      onChanged?.();
    } catch (e) { setError(errMsg(e)); } finally { setLoading(false); }
  }, [conversationId]); // eslint-disable-line
  useEffect(() => { setMsgs([]); setConv(null); setReply(null); setText(''); setRecording(false); setResults(null); setSearching(false); load(); }, [load]);
  useEffect(() => { if (conv && socket) markRead(); }, [conv?._id, socket]); // eslint-disable-line

  useEffect(() => {
    if (!socket) return;
    const onMsg = (m) => { if (String(m.conversation) !== String(conversationId)) return; setMsgs((l) => (l.some((x) => x._id === m._id) ? l : [...l, m])); if (String(m.sender._id) !== meId) markRead(); onChanged?.(); };
    const onUpd = (m) => setMsgs((l) => l.map((x) => (x._id === m._id ? m : x)));
    const onDel = ({ id }) => setMsgs((l) => l.map((x) => (x._id === id ? { ...x, deleted: true, text: '', mediaUrl: undefined, pinned: false } : x)));
    const onRead = ({ conversationId: c, userId, messageIds }) => { if (String(c) === String(conversationId)) setMsgs((l) => l.map((x) => (messageIds.includes(x._id) ? { ...x, readBy: [...new Set([...(x.readBy || []), userId])], deliveredTo: [...new Set([...(x.deliveredTo || []), userId])] } : x))); };
    const onDeliv = ({ userId, messageIds }) => setMsgs((l) => l.map((x) => (messageIds.includes(x._id) ? { ...x, deliveredTo: [...new Set([...(x.deliveredTo || []), userId])] } : x)));
    const onType = ({ conversationId: c, userId, name, typing }) => { if (String(c) !== String(conversationId)) return; setTypers((t) => { const n = { ...t }; if (typing) n[userId] = name; else delete n[userId]; return n; }); if (typing) setTimeout(() => setTypers((t) => { const n = { ...t }; delete n[userId]; return n; }), 5000); };
    socket.on('message:receive', onMsg); socket.on('message:update', onUpd); socket.on('message:delete', onDel); socket.on('message:read', onRead); socket.on('message:delivered', onDeliv); socket.on('typing:update', onType);
    return () => { ['message:receive', 'message:update', 'message:delete', 'message:read', 'message:delivered', 'typing:update'].forEach((e) => socket.off(e)); };
  }, [socket, conversationId, meId, markRead]); // eslint-disable-line

  useEffect(() => { if (stick.current) bottom.current?.scrollIntoView({ block: 'end' }); }, [msgs.length, typers]);
  const onScroll = () => { const el = list.current; if (el) stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120; };
  const loadOlder = async () => { const first = msgs[0]; if (!first) return; const prevH = list.current.scrollHeight; try { const r = await api.get(`/conversations/${conversationId}/messages`, { params: { before: first.createdAt } }); setMsgs((l) => [...r.data.messages, ...l]); setHasMore(r.data.hasMore); stick.current = false; requestAnimationFrame(() => { list.current.scrollTop = list.current.scrollHeight - prevH; }); } catch (e) { toast.error(errMsg(e)); } };

  const emit = (payload) => new Promise((resolve, reject) => {
    const body = { conversationId, replyTo: reply?._id, ...payload };
    if (socket?.connected) socket.emit('message:send', body, (r) => (r?.ok ? resolve(r.message) : reject(new Error(r?.error || 'Could not send'))));
    else api.post(`/conversations/${conversationId}/messages`, body).then((r) => resolve(r.data.message)).catch(reject); // REST fallback when the socket is down
  });
  const send = async (payload) => {
    setSending(true);
    try { const m = await emit(payload); setMsgs((l) => (l.some((x) => x._id === m._id) ? l : [...l, m])); setReply(null); stick.current = true; return true; }
    catch (e) { toast.error(e.message || errMsg(e)); return false; } finally { setSending(false); }
  };
  const submit = async (e) => { e?.preventDefault(); const t = text.trim(); if (!t || sending) return; setText(''); setEmoji(false); socket?.emit('typing:stop', { conversationId }); const ok = await send({ type: 'text', text: t }); if (!ok) setText(t); };
  const onType = (v) => { setText(v); const now = Date.now(); if (now - lastTyping.current > 2000) { socket?.emit('typing:start', { conversationId }); lastTyping.current = now; } clearTimeout(typingTimer.current); typingTimer.current = setTimeout(() => socket?.emit('typing:stop', { conversationId }), 2500); };

  const upload = async (file, kind) => { const fd = new FormData(); fd.append('file', file); const r = await api.post(`/uploads/${kind}`, fd); return r.data; };
  const attach = async (e, kind) => {
    const f = e.target.files?.[0]; e.target.value = ''; if (!f) return; setSending(true);
    try { const u = await upload(f, kind); await send({ type: kind, mediaUrl: u.url, fileName: u.fileName, mimeType: u.mimeType }); } catch (er) { toast.error(errMsg(er, 'Upload failed')); } finally { setSending(false); }
  };
  const sendVoice = async (blob, dur, waveform) => {
    setRecording(false); if (dur < 1) return toast.info('Recording too short');
    try { setSending(true); const ext = blob.type.includes('mp4') ? 'm4a' : blob.type.includes('ogg') ? 'ogg' : 'webm'; const u = await upload(new File([blob], `voice.${ext}`, { type: blob.type }), 'voice'); await send({ type: 'voice', mediaUrl: u.url, duration: dur, waveform }); }
    catch (er) { toast.error(errMsg(er, 'Voice upload failed')); } finally { setSending(false); }
  };

  const react = async (m, emoji) => { try { await api.post(`/messages/${m._id}/react`, { emoji }); } catch (e) { toast.error(errMsg(e)); } };
  const pin = async (m) => { try { await api.post(`/messages/${m._id}/pin`); } catch (e) { toast.error(errMsg(e)); } };
  const del = async (m) => { try { await api.delete(`/messages/${m._id}`); } catch (e) { toast.error(errMsg(e)); } };
  const inviteAction = async (id, action) => { try { const r = await api.post(`/invitations/${id}/${action}`); toast.success(action === 'accept' ? 'You joined the trip!' : 'Invitation declined'); setMsgs((l) => l.map((m) => (m.invitation?._id === id ? { ...m, invitation: { ...m.invitation, status: r.data.status } } : m))); if (action === 'accept') nav(`/trips/${r.data.tripSlug}`); } catch (e) { toast.error(errMsg(e)); } };
  const runSearch = async (q) => { setSearch(q); if (q.trim().length < 2) return setResults(null); try { const r = await api.get(`/conversations/${conversationId}/messages`, { params: { search: q.trim(), limit: 30 } }); setResults(r.data.messages); } catch { setResults([]); } };
  const statusOf = (m) => { const others = (conv?.participants || []).filter((p) => String(p._id) !== meId).map((p) => String(p._id)); if (others.length && others.every((id) => (m.readBy || []).map(String).includes(id))) return 'read'; if ((m.deliveredTo || []).length) return 'delivered'; return 'sent'; };
  const doBlock = async () => { try { await api.post(`/users/${other._id}/block`); toast.success(`${other.name} is blocked`); setConfirm(null); onChanged?.(); load(); } catch (e) { toast.error(errMsg(e)); } };
  const doRestrict = async () => { try { await api.post(`/users/${other._id}/restrict`); toast.success('User restricted: you will not get notifications from them'); setMenu(false); } catch (e) { toast.error(errMsg(e)); } };
  const doDeleteConv = async () => { try { await api.delete(`/conversations/${conversationId}`); toast.success('Conversation deleted'); setConfirm(null); onBack?.(true); } catch (e) { toast.error(errMsg(e)); } };
  const removeMember = async (uid) => { try { await api.delete(`/trips/${conv.group._id}/members/${uid}`); toast.success('Member removed'); load(); } catch (e) { toast.error(errMsg(e)); } };

  if (loading && !conv) return <PageLoader />;
  if (error) return <div className="p-6"><ErrorState message={error} onRetry={load} /></div>;
  const shown = pinnedOnly ? msgs.filter((m) => m.pinned) : results ?? msgs;
  const typingNames = Object.values(typers);
  const headerTitle = isGroup ? conv.group.title : other?.name;

  return (
    <div className="flex h-full min-h-0 flex-col bg-bg">
      <header className="flex items-center gap-3 border-b border-line bg-surface px-3 py-3 sm:px-4">
        <button className="btn-ghost btn-sm !p-2 md:hidden" onClick={() => onBack?.()} aria-label="Back to conversations"><ArrowLeft className="h-4 w-4" /></button>
        {isGroup ? <Link to={`/trips/${conv.group.slug}`}><img src={assetUrl(conv.group.coverImage)} alt="" className="h-10 w-10 rounded-xl object-cover" /></Link> : <Link to={`/travelers/${other.username}`}><Avatar user={other} size={40} online={online} /></Link>}
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold">{headerTitle}</p>
          <p className="truncate text-xs text-muted" aria-live="polite">{typingNames.length ? <span className="text-brand">{typingNames.join(', ')} typing…</span> : isGroup ? `${conv.group.destination} · ${conv.group.memberCount} members · ${conv.participants.filter((p) => isOnline(p._id) || String(p._id) === meId).length} online` : online ? 'Online' : other.lastSeen ? `Last seen ${timeAgo(other.lastSeen)}` : 'Offline'}</p>
        </div>
        {!isGroup && <><button className="btn-ghost btn-sm !p-2" onClick={() => start(other, 'voice')} aria-label="Voice call" title="Voice call"><Phone className="h-4 w-4" /></button><button className="btn-ghost btn-sm !p-2" onClick={() => start(other, 'video')} aria-label="Video call" title="Video call"><Video className="h-4 w-4" /></button></>}
        <button className="btn-ghost btn-sm !p-2" onClick={() => setSearching(!searching)} aria-label="Search messages"><Search className="h-4 w-4" /></button>
        <div className="relative"><button className="btn-ghost btn-sm !p-2" onClick={() => setMenu(!menu)} aria-label="Conversation options" aria-expanded={menu}><MoreVertical className="h-4 w-4" /></button>
          {menu && <div className="card absolute right-0 top-10 z-30 w-56 py-1 text-sm shadow-pop" onMouseLeave={() => setMenu(false)}>
            <button className="flex w-full items-center gap-2 px-3 py-2 hover:bg-raised" onClick={() => { setPinnedOnly(!pinnedOnly); setMenu(false); }}><Pin className="h-4 w-4" />{pinnedOnly ? 'Show all messages' : 'Pinned messages'}</button>
            {isGroup ? <button className="flex w-full items-center gap-2 px-3 py-2 hover:bg-raised" onClick={() => { setMembers(true); setMenu(false); }}><Users className="h-4 w-4" />Group members</button> : <>
              <button className="flex w-full items-center gap-2 px-3 py-2 hover:bg-raised" onClick={() => { setInvite(true); setMenu(false); }}><PlusCircle className="h-4 w-4" />Invite to trip</button>
              <button className="flex w-full items-center gap-2 px-3 py-2 hover:bg-raised" onClick={doRestrict}><EyeOff className="h-4 w-4" />Restrict user</button>
              <button className="flex w-full items-center gap-2 px-3 py-2 hover:bg-raised" onClick={() => { setReport({ type: 'user', id: other._id, label: other.name }); setMenu(false); }}><Flag className="h-4 w-4" />Report user</button>
              <button className="flex w-full items-center gap-2 px-3 py-2 text-danger hover:bg-raised" onClick={() => { setConfirm('block'); setMenu(false); }}><Ban className="h-4 w-4" />Block user</button>
              <button className="flex w-full items-center gap-2 px-3 py-2 text-danger hover:bg-raised" onClick={() => { setConfirm('delete'); setMenu(false); }}><Trash2 className="h-4 w-4" />Delete conversation</button></>}
          </div>}</div>
      </header>
      {searching && <div className="border-b border-line bg-surface px-4 py-2"><input autoFocus className="input" placeholder="Search in this conversation…" value={search} onChange={(e) => runSearch(e.target.value)} aria-label="Search messages" />{results && <p className="mt-1 text-xs text-muted">{results.length} result{results.length === 1 ? '' : 's'}</p>}</div>}
      {pinnedOnly && <div className="bg-accent/15 px-4 py-1.5 text-center text-xs">Showing pinned messages · <button className="underline" onClick={() => setPinnedOnly(false)}>show all</button></div>}
      <div ref={list} onScroll={onScroll} className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-4 sm:px-5" role="log" aria-live="polite">
        {hasMore && !results && !pinnedOnly && <div className="text-center"><button className="btn-ghost btn-sm" onClick={loadOlder}>Load earlier messages</button></div>}
        {shown.length === 0 && <div className="grid h-full place-items-center text-center text-sm text-muted"><p>{results ? 'No matching messages' : pinnedOnly ? 'No pinned messages yet' : isGroup ? 'Say hello to your travel group 👋' : `Start the conversation with ${other?.name?.split(' ')[0]} 👋`}</p></div>}
        {shown.map((m, i) => { const showDay = i === 0 || new Date(shown[i - 1].createdAt).toDateString() !== new Date(m.createdAt).toDateString(); return (<div key={m._id}>{showDay && <div className="my-3 text-center text-[11px] font-medium text-muted">{fmtDate(m.createdAt, { weekday: 'short', day: 'numeric', month: 'short' })}</div>}
          <MessageBubble m={m} mine={String(m.sender?._id) === meId} group={isGroup} status={statusOf(m)} meId={meId} canModerate={isOrganizer} onReply={setReply} onReact={react} onDelete={(x) => setConfirm({ del: x })} onPin={pin} onInviteAction={inviteAction} onReport={(x) => setReport({ type: 'message', id: x._id, label: 'message' })} /></div>); })}
        <div ref={bottom} />
      </div>
      <div className="relative border-t border-line bg-surface p-3">
        {reply && <div className="mb-2 flex items-center gap-2 rounded-lg bg-raised px-3 py-2 text-xs"><Reply className="h-4 w-4 text-brand" /><div className="min-w-0 flex-1"><b>{reply.sender?.name}</b><p className="truncate text-muted">{reply.text || `[${reply.type}]`}</p></div><button onClick={() => setReply(null)} aria-label="Cancel reply"><X className="h-4 w-4" /></button></div>}
        {recording ? <VoiceRecorder onDone={sendVoice} onCancel={() => setRecording(false)} /> : (
          <form onSubmit={submit} className="flex items-end gap-2">
            <div className="relative"><button type="button" className="grid h-10 w-10 place-items-center rounded-full text-muted hover:bg-raised" onClick={() => setEmoji(!emoji)} aria-label="Emoji picker" aria-expanded={emoji}><Smile className="h-5 w-5" /></button>{emoji && <EmojiPicker onPick={(e) => setText((t) => t + e)} />}</div>
            <input ref={imgIn} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" onChange={(e) => attach(e, 'image')} aria-label="Send image" />
            <input ref={fileIn} type="file" accept=".pdf,.txt,.zip,.docx" className="sr-only" onChange={(e) => attach(e, 'file')} aria-label="Send file" />
            <button type="button" className="hidden h-10 w-10 place-items-center rounded-full text-muted hover:bg-raised sm:grid" onClick={() => imgIn.current.click()} aria-label="Attach image"><ImageIcon className="h-5 w-5" /></button>
            <button type="button" className="hidden h-10 w-10 place-items-center rounded-full text-muted hover:bg-raised sm:grid" onClick={() => fileIn.current.click()} aria-label="Attach file"><Paperclip className="h-5 w-5" /></button>
            <textarea rows={1} value={text} onChange={(e) => onType(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) submit(e); }} placeholder="Type a message" aria-label="Message" maxLength={4000} className="input max-h-32 min-h-[2.6rem] flex-1 resize-none rounded-2xl" />
            {text.trim() ? <button type="submit" disabled={sending} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand text-brand-ink" aria-label="Send message">{sending ? <Spinner className="h-4 w-4" /> : <Send className="h-4 w-4" />}</button>
              : <button type="button" onClick={() => setRecording(true)} disabled={sending} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand text-brand-ink" aria-label="Record voice message"><Mic className="h-5 w-5" /></button>}
          </form>)}
      </div>
      <InviteModal open={invite} onClose={() => setInvite(false)} userId={other?._id} onSent={load} />
      <ConfirmModal open={confirm === 'block'} onClose={() => setConfirm(null)} onConfirm={doBlock} danger title={`Block ${other?.name}?`} text="They won't be able to message or call you, and any connection between you will be removed. You can unblock from Settings." confirmLabel="Block" />
      <ConfirmModal open={confirm === 'delete'} onClose={() => setConfirm(null)} onConfirm={doDeleteConv} danger title="Delete this conversation?" text="This clears the chat from your side only. The other traveler keeps their copy." confirmLabel="Delete" />
      <ConfirmModal open={!!confirm?.del} onClose={() => setConfirm(null)} onConfirm={() => { del(confirm.del); setConfirm(null); }} danger title="Delete message?" text="It will be removed for everyone in this chat." confirmLabel="Delete" />
      {report && <ReportModal open onClose={() => setReport(null)} targetType={report.type} targetId={report.id} label={report.label} />}
      {isGroup && <Modal open={members} onClose={() => setMembers(false)} title="Group members" size="max-w-md">
        <ul className="space-y-2">{conv?.participants.map((p) => <li key={p._id} className="flex items-center gap-3"><Avatar user={p} size={36} online={isOnline(p._id) || String(p._id) === meId} /><Link to={`/travelers/${p.username}`} onClick={() => setMembers(false)} className="flex-1 font-medium hover:text-brand">{p.name}{String(p._id) === String(conv.group.creator) && <span className="chip ml-2">Organizer</span>}</Link>
          {isOrganizer && String(p._id) !== meId && <button className="btn-ghost btn-sm text-danger" onClick={() => removeMember(p._id)}><UserMinus className="h-4 w-4" />Remove</button>}</li>)}</ul>
        {isOrganizer && <Link to={`/trips/${conv.group.slug}/edit`} className="btn-ghost btn-sm mt-4" onClick={() => setMembers(false)}>Edit group information</Link>}
      </Modal>}
    </div>
  );
}
