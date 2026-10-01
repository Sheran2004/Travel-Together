import { Link, useNavigate } from 'react-router-dom';
import { Bell, Trash2, CheckCheck } from 'lucide-react';
import { useSocket } from '../context/SocketContext';
import { Avatar, EmptyState } from '../components/ui';
import { timeAgo } from '../utils/format';
export default function Notifications() {
  const { notifications, unread, markRead, markAllRead, removeNotification } = useSocket(); const nav = useNavigate();
  return (
    <div className="container-x max-w-3xl py-8"><div className="mb-6 flex items-center justify-between"><h1 className="text-3xl font-extrabold">Notifications</h1>{unread > 0 && <button className="btn-ghost btn-sm" onClick={markAllRead}><CheckCheck className="h-4 w-4" />Mark all as read</button>}</div>
      {notifications.length === 0 ? <EmptyState icon={Bell} title="You're all caught up" text="Messages, invitations, join requests and trip updates will appear here." /> :
        <ul className="card divide-y divide-line">{notifications.map((n) => <li key={n._id} className={`flex gap-3 p-4 ${n.read ? '' : 'bg-brand/5'}`}><button className="flex flex-1 gap-3 text-left" onClick={() => { markRead(n._id); if (n.link) nav(n.link); }}><Avatar user={n.actor} size={44} /><span className="min-w-0"><b className="block">{n.title}</b><span className="block text-sm text-muted">{n.body}</span><span className="text-xs text-muted">{timeAgo(n.updatedAt || n.createdAt)}</span></span></button>
          <div className="flex flex-col items-end gap-2">{!n.read && <button onClick={() => markRead(n._id)} className="text-xs font-semibold text-brand">Mark read</button>}<button onClick={() => removeNotification(n._id)} aria-label="Delete notification" className="text-muted hover:text-danger"><Trash2 className="h-4 w-4" /></button></div></li>)}</ul>}</div>
  );
}
