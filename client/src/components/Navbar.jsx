import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useNavigate, Outlet, useLocation } from 'react-router-dom';
import { Compass, Home, Map as MapIcon, MessageCircle, Bell, User, Plus, Sun, Moon, Monitor, Menu, X, LogOut, Settings, Bookmark, Users, ShieldCheck, Luggage, Trash2, Check, Search, HeartHandshake } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useSocket } from '../context/SocketContext';
import { Avatar, Modal } from './ui';
import api, { errMsg } from '../services/api';
import { useToast } from '../context/ToastContext';
import { timeAgo } from '../utils/format';

export function ThemeToggle({ compact }) {
  const { theme, setTheme } = useTheme();
  const opts = [['light', Sun, 'Light'], ['dark', Moon, 'Dark'], ['system', Monitor, 'System']];
  return (
    <div className="inline-flex rounded-full border border-line bg-surface p-0.5" role="radiogroup" aria-label="Theme">
      {opts.map(([k, I, l]) => <button key={k} role="radio" aria-checked={theme === k} aria-label={`${l} theme`} title={`${l} theme`} onClick={() => setTheme(k)} className={`grid place-items-center rounded-full ${compact ? 'h-7 w-7' : 'h-8 w-8'} ${theme === k ? 'bg-brand text-brand-ink' : 'text-muted hover:text-ink'}`}><I className="h-4 w-4" /></button>)}
    </div>
  );
}

function GlobalSearch({ open, onClose }) {
  const [q, setQ] = useState(''); const nav = useNavigate(); const { user } = useAuth();
  const go = (path) => { const t = q.trim(); if (!t) return; onClose(); nav(`${path}?${path === '/explore' ? 'search' : 'q'}=${encodeURIComponent(t)}`); setQ(''); };
  return (
    <Modal open={open} onClose={onClose} title="Search" size="max-w-md">
      <form onSubmit={(e) => { e.preventDefault(); go('/explore'); }} className="space-y-3">
        <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Destination, trip or traveler name" aria-label="Search" />
        <div className="flex gap-2"><button className="btn-primary flex-1">Search trips</button>{user && <button type="button" className="btn-ghost flex-1" onClick={() => go('/partners')}>Search travelers</button>}</div>
      </form>
    </Modal>
  );
}
function VerifyBanner() {
  const { user } = useAuth(); const toast = useToast(); const [busy, setBusy] = useState(false);
  if (!user || user.emailVerified) return null;
  const resend = async () => { setBusy(true); try { await api.post('/auth/resend-verification'); toast.success('Verification email sent. Check your inbox.'); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); } };
  return <div className="bg-accent/20 px-4 py-2 text-center text-sm" role="status">Please verify your email address. <button className="font-semibold underline" disabled={busy} onClick={resend}>Resend link</button></div>;
}

function useOutside(ref, cb) { useEffect(() => { const h = (e) => { if (ref.current && !ref.current.contains(e.target)) cb(); }; document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h); }, [ref, cb]); }

export function NotificationDropdown() {
  const { notifications, unread, markRead, markAllRead, removeNotification } = useSocket();
  const [open, setOpen] = useState(false); const ref = useRef(null); const nav = useNavigate();
  useOutside(ref, () => setOpen(false));
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)} aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`} aria-expanded={open} className="relative grid h-10 w-10 place-items-center rounded-full hover:bg-raised">
        <Bell className="h-5 w-5" />{unread > 0 && <span className="absolute right-1 top-1 grid min-w-[1.1rem] place-items-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">{unread > 99 ? '99+' : unread}</span>}
      </button>
      {open && (
        <div className="card absolute right-0 top-12 z-50 w-[22rem] max-w-[92vw] shadow-pop">
          <div className="flex items-center justify-between border-b border-line px-4 py-3"><h3 className="font-bold">Notifications</h3>{unread > 0 && <button onClick={markAllRead} className="text-xs font-semibold text-brand hover:underline">Mark all read</button>}</div>
          <ul className="max-h-96 overflow-y-auto">
            {notifications.length === 0 && <li className="px-4 py-10 text-center text-sm text-muted">You're all caught up.</li>}
            {notifications.slice(0, 8).map((n) => (
              <li key={n._id} className={`group flex gap-3 border-b border-line/60 px-4 py-3 last:border-0 ${n.read ? '' : 'bg-brand/5'}`}>
                <button className="flex flex-1 gap-3 text-left" onClick={() => { markRead(n._id); setOpen(false); if (n.link) nav(n.link); }}>
                  <Avatar user={n.actor} size={36} /><span className="min-w-0"><span className="block text-sm font-semibold">{n.title}</span><span className="line-clamp-2 block text-xs text-muted">{n.body}</span><span className="text-[11px] text-muted">{timeAgo(n.updatedAt || n.createdAt)}</span></span>
                </button>
                <button onClick={() => removeNotification(n._id)} aria-label="Delete notification" className="self-start text-muted opacity-0 hover:text-danger group-hover:opacity-100 focus:opacity-100"><Trash2 className="h-4 w-4" /></button>
              </li>))}
          </ul>
          <Link to="/notifications" onClick={() => setOpen(false)} className="block border-t border-line px-4 py-3 text-center text-sm font-semibold text-brand hover:bg-raised">View all</Link>
        </div>)}
    </div>
  );
}

function UserMenu() {
  const { user, logout } = useAuth(); const [open, setOpen] = useState(false); const ref = useRef(null); const nav = useNavigate();
  useOutside(ref, () => setOpen(false));
  const items = [[User, 'My profile', '/profile'], [Luggage, 'My trips', '/my-trips'], [Bookmark, 'Saved trips', '/saved'], [Users, 'Travel network', '/network'], [ShieldCheck, 'Safety center', '/safety'], [Settings, 'Settings', '/settings'], ...(user.role === 'admin' ? [[ShieldCheck, 'Admin dashboard', '/admin']] : [])];
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)} aria-label="Account menu" aria-expanded={open} className="rounded-full ring-2 ring-transparent hover:ring-brand/40"><Avatar user={user} size={38} /></button>
      {open && <div className="card absolute right-0 top-12 z-50 w-60 py-2 shadow-pop">
        <div className="border-b border-line px-4 pb-3 pt-1"><p className="truncate font-semibold">{user.name}</p><p className="truncate text-xs text-muted">@{user.username}</p></div>
        {items.map(([I, l, to]) => <Link key={to} to={to} onClick={() => setOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-raised"><I className="h-4 w-4 text-muted" />{l}</Link>)}
        <div className="border-t border-line px-4 py-3"><ThemeToggle compact /></div>
        <button onClick={() => { logout(); setOpen(false); nav('/'); }} className="flex w-full items-center gap-3 border-t border-line px-4 py-2.5 text-sm text-danger hover:bg-raised"><LogOut className="h-4 w-4" />Log out</button>
      </div>}
    </div>
  );
}

const linkCls = ({ isActive }) => `rounded-full px-3.5 py-2 text-sm font-medium transition ${isActive ? 'bg-brand/10 text-brand' : 'text-muted hover:text-ink hover:bg-raised'}`;

export function Navbar() {
  const { user } = useAuth(); const { chatUnread } = useSocket(); const [menu, setMenu] = useState(false); const [searchOpen, setSearchOpen] = useState(false); const loc = useLocation();
  useEffect(() => setMenu(false), [loc.pathname]);
  const main = user
    ? [['/', 'Home', true], ['/explore', 'Explore'], ['/partners', 'Travel Partners'], ['/my-trips', 'Trips'], ['/map', 'Map'], ['/messages', 'Messages']]
    : [['/', 'Home', true], ['/explore', 'Explore'], ['/map', 'Map'], ['/login', 'Login'], ['/register', 'Register']];
  return (
    <header className="sticky top-0 z-[1200] border-b border-line bg-bg/85 pt-[env(safe-area-inset-top)] backdrop-blur-lg">
      <div className="container-x flex h-16 items-center gap-4">
        <Link to="/" className="flex items-center gap-2 font-display text-xl font-extrabold"><span className="grid h-9 w-9 place-items-center rounded-xl bg-brand text-brand-ink"><Compass className="h-5 w-5" /></span><span className="hidden sm:inline">Travel Together</span></Link>
        <nav className="ml-4 hidden items-center gap-1 lg:flex" aria-label="Main">
          {main.filter(([to]) => !(!user && ['/login', '/register'].includes(to))).map(([to, l, end]) => (
            <NavLink key={to} to={to} end={end} className={linkCls}>{l}{l === 'Messages' && chatUnread > 0 && <span className="ml-1.5 rounded-full bg-danger px-1.5 py-0.5 text-[10px] font-bold text-white">{chatUnread}</span>}</NavLink>))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <button className="grid h-10 w-10 place-items-center rounded-full hover:bg-raised" aria-label="Search" onClick={() => setSearchOpen(true)}><Search className="h-5 w-5" /></button>
          {user ? (<>
            <Link to="/trips/new" className="btn-accent btn-sm hidden md:inline-flex"><Plus className="h-4 w-4" />Create Trip</Link>
            <NotificationDropdown /><UserMenu />
          </>) : (<>
            <div className="hidden sm:block"><ThemeToggle compact /></div>
            <Link to="/login" className="btn-ghost btn-sm hidden sm:inline-flex">Log in</Link><Link to="/register" className="btn-primary btn-sm">Sign up</Link>
          </>)}
          <button className="grid h-10 w-10 place-items-center rounded-full hover:bg-raised lg:hidden" aria-label={menu ? 'Close menu' : 'Open menu'} aria-expanded={menu} onClick={() => setMenu(!menu)}>{menu ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button>
        </div>
      </div>
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
      {menu && <nav className="border-t border-line bg-bg px-4 py-3 lg:hidden" aria-label="Mobile menu">
        <div className="grid gap-1">{main.map(([to, l, end]) => <NavLink key={to} to={to} end={end} className={linkCls}>{l}</NavLink>)}
          {user && <NavLink to="/saved" className={linkCls}>Saved</NavLink>}{user && <NavLink to="/notifications" className={linkCls}>Notifications</NavLink>}
          {!user && <div className="mt-2"><ThemeToggle /></div>}</div>
      </nav>}
    </header>
  );
}

export function MobileTabs() {
  const { user } = useAuth(); const { chatUnread } = useSocket(); const loc = useLocation();
  if (!user || loc.pathname.startsWith('/messages/')) return null;
  const tabs = [['/dashboard', Home, 'Home'], ['/explore', Search, 'Explore'], ['/map', MapIcon, 'Map'], ['/messages', MessageCircle, 'Messages'], ['/profile', User, 'Profile']];
  return (
    <>
      <Link to="/trips/new" aria-label="Create trip" className="fixed bottom-[calc(4.6rem+env(safe-area-inset-bottom))] right-4 z-[1300] grid h-14 w-14 place-items-center rounded-full bg-accent text-[#1c1300] shadow-pop md:hidden"><Plus className="h-6 w-6" /></Link>
      <nav className="fixed inset-x-0 bottom-0 z-[1250] grid grid-cols-5 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden" aria-label="Primary">
        {tabs.map(([to, I, l]) => <NavLink key={to} to={to} className={({ isActive }) => `relative flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium ${isActive ? 'text-brand' : 'text-muted'}`}><I className="h-5 w-5" />{l}{l === 'Messages' && chatUnread > 0 && <span className="absolute right-[26%] top-1.5 rounded-full bg-danger px-1.5 text-[10px] font-bold text-white">{chatUnread}</span>}</NavLink>)}
      </nav>
    </>
  );
}

export function Footer() {
  const cols = [['Company', [['About', '/about'], ['Contact', '/contact'], ['Help', '/help']]], ['Explore', [['Explore trips', '/explore'], ['Map', '/map'], ['Travel partners', '/partners'], ['Destinations', '/destinations/manali']]], ['Community', [['Create a trip', '/trips/new'], ['Safety center', '/safety'], ['Community guidelines', '/safety#guidelines']]], ['Legal', [['Privacy', '/privacy'], ['Terms', '/terms']]]];
  return (
    <footer className="mt-20 border-t border-line bg-surface pb-24 md:pb-0">
      <div className="container-x grid gap-10 py-12 md:grid-cols-5">
        <div className="md:col-span-1"><p className="flex items-center gap-2 font-display text-lg font-extrabold"><Compass className="h-5 w-5 text-brand" />Travel Together</p><p className="mt-2 text-sm text-muted">Find people. Share journeys. Create memories.</p></div>
        {cols.map(([h, links]) => <div key={h}><h3 className="mb-3 text-sm font-bold">{h}</h3><ul className="space-y-2 text-sm text-muted">{links.map(([l, to]) => <li key={l}><Link to={to} className="hover:text-brand">{l}</Link></li>)}</ul></div>)}
      </div>
      <div className="border-t border-line py-4 text-center text-xs text-muted">© {new Date().getFullYear()} Travel Together. Travel safely and meet in public places first.</div>
    </footer>
  );
}

export function Layout() {
  const loc = useLocation(); const full = loc.pathname.startsWith('/messages');
  useEffect(() => { window.scrollTo(0, 0); }, [loc.pathname]);
  return (<div className="flex min-h-screen flex-col"><a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[5000] focus:rounded-lg focus:bg-brand focus:px-4 focus:py-2 focus:text-brand-ink">Skip to content</a><Navbar /><VerifyBanner /><main id="main" className="flex-1"><Outlet /></main>{!full && <Footer />}<MobileTabs /></div>);
}
