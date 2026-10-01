import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Search, MessageCircle, Users } from 'lucide-react';
import api, { errMsg } from '../services/api';
import { useSocket } from '../context/SocketContext';
import { useToast } from '../context/ToastContext';
import { useDebounced } from '../hooks/useFetch';
import { Avatar, Spinner, EmptyState, Skeleton } from '../components/ui';
import { ChatWindow } from '../components/chat';
import { chatStamp } from '../utils/format';

export default function Messages() {
  const { id } = useParams(); const [sp] = useSearchParams(); const nav = useNavigate(); const toast = useToast(); const { socket, isOnline, seedOnline, refreshChatUnread } = useSocket();
  const [list, setList] = useState(null); const [q, setQ] = useState(''); const dq = useDebounced(q, 300); const [error, setError] = useState('');
  const load = useCallback(async () => { try { const r = await api.get('/conversations', { params: { q: dq || undefined } }); setList(r.data.conversations); setError(''); seedOnline(r.data.conversations.filter((c) => c.other?.online).map((c) => c.other._id)); } catch (e) { setError(errMsg(e)); setList((l) => l || []); } }, [dq]); // eslint-disable-line
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (!socket) return; const h = () => load(); socket.on('message:receive', h); socket.on('message:delete', h); return () => { socket.off('message:receive', h); socket.off('message:delete', h); }; }, [socket, load]);
  // /messages?user=<id> opens (or creates) a private conversation
  useEffect(() => { const u = sp.get('user'); if (!u) return; api.post(`/conversations/private/${u}`).then((r) => nav(`/messages/${r.data.conversationId}`, { replace: true })).catch((e) => { toast.error(errMsg(e)); nav('/messages', { replace: true }); }); }, [sp.get('user')]); // eslint-disable-line
  return (
    <div className="mx-auto flex h-[calc(100dvh-4rem)] w-full max-w-7xl border-x border-line bg-surface pb-[calc(3.6rem+env(safe-area-inset-bottom))] md:h-[calc(100dvh-4rem)] md:pb-0">
      <aside className={`${id ? 'hidden md:flex' : 'flex'} w-full min-h-0 flex-col border-r border-line md:w-96 md:shrink-0`}>
        <div className="border-b border-line p-4"><h1 className="mb-3 text-2xl font-extrabold">Messages</h1><div className="relative"><Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" /><input className="input pl-10" placeholder="Search conversations" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search conversations" /></div></div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {!list ? <div className="space-y-3 p-4">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-14" />)}</div> : error ? <p className="p-6 text-sm text-danger">{error}</p> : list.length === 0 ? <div className="p-4"><EmptyState icon={MessageCircle} title="No conversations" text={q ? 'No match for your search.' : 'Message a traveler from their profile, or join a trip to get a group chat.'} /></div> :
            <ul>{list.map((c) => { const title = c.group?.title || c.other?.name; const last = c.lastMessage; const preview = last ? (last.deleted ? 'Message deleted' : last.type === 'text' || last.type === 'system' || last.type === 'invite' ? last.text : last.type === 'voice' ? '🎤 Voice message' : last.type === 'image' ? '📷 Photo' : '📎 File') : 'No messages yet';
              return <li key={c._id}><button onClick={() => nav(`/messages/${c._id}`)} aria-current={id === c._id} className={`flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-raised ${id === c._id ? 'bg-brand/10' : ''}`}>
                {c.type === 'group' ? <span className="relative shrink-0"><img src={c.group?.coverImage} alt="" className="h-12 w-12 rounded-xl object-cover" /><Users className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-surface p-0.5 text-brand" /></span> : <Avatar user={c.other} size={48} online={isOnline(c.other?._id) || c.other?.online} />}
                <span className="min-w-0 flex-1"><span className="flex items-baseline justify-between gap-2"><b className="truncate">{title}</b><span className="shrink-0 text-[11px] text-muted">{last ? chatStamp(last.createdAt) : ''}</span></span>
                  <span className="flex items-center justify-between gap-2"><span className={`truncate text-sm ${c.unread ? 'font-semibold' : 'text-muted'}`}>{last?.sender?.name && c.type === 'group' && last.type !== 'system' ? `${last.sender.name}: ` : ''}{preview}</span>{c.unread > 0 && <span className="grid min-w-[1.25rem] place-items-center rounded-full bg-brand px-1.5 text-[11px] font-bold text-brand-ink">{c.unread}</span>}</span></span></button></li>; })}</ul>}
        </div>
      </aside>
      <section className={`${id ? 'flex' : 'hidden md:flex'} min-w-0 flex-1 flex-col`}>
        {id ? <ChatWindow key={id} conversationId={id} onBack={(deleted) => { nav('/messages'); if (deleted) load(); }} onChanged={() => { load(); refreshChatUnread(); }} /> : sp.get('user') ? <div className="grid flex-1 place-items-center"><Spinner className="h-8 w-8 text-brand" /></div> : <div className="hidden flex-1 place-items-center md:grid"><EmptyState icon={MessageCircle} title="Select a conversation" text="Pick a chat on the left to start talking." /></div>}
      </section>
    </div>
  );
}
