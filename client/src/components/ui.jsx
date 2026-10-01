import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { Loader2, X, Inbox, AlertTriangle, Star } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { assetUrl } from '../services/api';

export function SafeImg({ src, alt, label, className = '' }) {
  const [bad, setBad] = useState(false);
  useEffect(() => setBad(false), [src]);
  if (!src || bad) return <div role="img" aria-label={alt} className={`grid place-items-center bg-gradient-to-br from-brand to-accent/70 text-center text-white ${className}`}><span className="px-3 font-display text-lg font-bold drop-shadow">{label || alt}</span></div>;
  return <img src={assetUrl(src)} alt={alt} loading="lazy" className={className} onError={() => setBad(true)} />;
}
export const Spinner = ({ className = 'h-5 w-5' }) => <Loader2 className={`animate-spin ${className}`} aria-hidden />;
export const PageLoader = () => <div className="grid min-h-[50vh] place-items-center" role="status" aria-label="Loading"><Spinner className="h-8 w-8 text-brand" /></div>;
export const Skeleton = ({ className = '' }) => <div className={`skeleton rounded-xl ${className}`} aria-hidden />;
export const CardSkeletons = ({ n = 6 }) => (
  <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: n }).map((_, i) => <div key={i} className="card overflow-hidden"><Skeleton className="h-44 rounded-none" /><div className="space-y-3 p-4"><Skeleton className="h-5 w-3/4" /><Skeleton className="h-4 w-1/2" /><Skeleton className="h-4 w-2/3" /></div></div>)}</div>
);
export const EmptyState = ({ icon: Icon = Inbox, title, text, action }) => (
  <div className="card grid place-items-center gap-3 px-6 py-14 text-center">
    <div className="grid h-14 w-14 place-items-center rounded-full bg-raised"><Icon className="h-6 w-6 text-brand" /></div>
    <h3 className="text-lg font-bold">{title}</h3>{text && <p className="max-w-sm text-sm text-muted">{text}</p>}{action}
  </div>
);
export const ErrorState = ({ message, onRetry }) => (
  <div className="card grid place-items-center gap-3 px-6 py-12 text-center" role="alert">
    <AlertTriangle className="h-8 w-8 text-danger" /><p className="max-w-md text-sm">{message}</p>{onRetry && <button className="btn-ghost btn-sm" onClick={onRetry}>Try again</button>}
  </div>
);
export const Async = ({ loading, error, onRetry, skeleton, children }) => (loading ? skeleton || <PageLoader /> : error ? <ErrorState message={error} onRetry={onRetry} /> : children);

export function Avatar({ user, size = 40, online, className = '' }) {
  const name = user?.name || '?'; const initials = name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  const hue = [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return (
    <span className={`relative inline-block shrink-0 ${className}`} style={{ width: size, height: size }}>
      {user?.profileImage ? <img src={assetUrl(user.profileImage)} alt={name} loading="lazy" className="h-full w-full rounded-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
        : null}
      <span className="absolute inset-0 -z-10 grid place-items-center rounded-full text-xs font-bold text-white" style={{ background: `hsl(${hue} 45% 42%)`, fontSize: size * 0.36 }} aria-hidden>{initials}</span>
      {online !== undefined && <span className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-surface ${online ? 'bg-ok' : 'bg-muted/50'}`} title={online ? 'Online' : 'Offline'} />}
    </span>
  );
}

export function Modal({ open, onClose, title, children, size = 'max-w-lg', footer }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return; const prev = document.activeElement; document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') onClose(); }; document.addEventListener('keydown', onKey);
    setTimeout(() => ref.current?.querySelector('input,textarea,select,button:not([data-close])')?.focus(), 30);
    return () => { document.body.style.overflow = ''; document.removeEventListener('keydown', onKey); prev?.focus?.(); };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[2500] grid place-items-end bg-black/50 p-0 sm:place-items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={title} className={`card flex max-h-[92vh] w-full ${size} flex-col rounded-b-none shadow-pop sm:rounded-b-[1.25rem]`}>
        <div className="flex items-center justify-between border-b border-line px-5 py-4"><h2 className="text-lg font-bold">{title}</h2><button data-close onClick={onClose} aria-label="Close" className="rounded-full p-1 text-muted hover:bg-raised hover:text-ink"><X className="h-5 w-5" /></button></div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}
export function ConfirmModal({ open, onClose, onConfirm, title, text, confirmLabel = 'Confirm', danger, busy }) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="max-w-md" footer={<><button className="btn-ghost" onClick={onClose}>Keep it</button><button className={danger ? 'btn-danger' : 'btn-primary'} disabled={busy} onClick={onConfirm}>{busy && <Spinner className="h-4 w-4" />}{confirmLabel}</button></>}>
      <p className="text-sm text-muted">{text}</p>
    </Modal>
  );
}

export function ProtectedRoute({ children, admin }) {
  const { user, loading } = useAuth(); const loc = useLocation();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" state={{ from: loc.pathname + loc.search }} replace />;
  if (admin && user.role !== 'admin') return <Navigate to="/dashboard" replace />;
  return children;
}

export const Stars = ({ value = 0, size = 16 }) => (
  <span className="inline-flex" aria-label={`${value} out of 5 stars`}>{[1, 2, 3, 4, 5].map((i) => <Star key={i} style={{ width: size, height: size }} className={i <= Math.round(value) ? 'fill-accent text-accent' : 'text-line'} />)}</span>
);
export const StarInput = ({ value, onChange }) => (
  <div className="flex gap-1" role="radiogroup" aria-label="Rating">{[1, 2, 3, 4, 5].map((i) => <button type="button" key={i} role="radio" aria-checked={value === i} aria-label={`${i} stars`} onClick={() => onChange(i)}><Star className={`h-7 w-7 ${i <= value ? 'fill-accent text-accent' : 'text-line'}`} /></button>)}</div>
);
export const Field = ({ label, error, children, hint, htmlFor }) => (
  <div><label className="label" htmlFor={htmlFor}>{label}</label>{children}{hint && !error && <p className="mt-1 text-xs text-muted">{hint}</p>}{error && <p className="err" role="alert">{error}</p>}</div>
);
export function Chips({ options, value = [], onChange, max }) {
  const toggle = (o) => { const has = value.includes(o); if (!has && max && value.length >= max) return; onChange(has ? value.filter((x) => x !== o) : [...value, o]); };
  return <div className="flex flex-wrap gap-2">{options.map((o) => <button type="button" key={o} aria-pressed={value.includes(o)} onClick={() => toggle(o)} className={`rounded-full border px-3 py-1.5 text-sm transition ${value.includes(o) ? 'border-brand bg-brand text-brand-ink' : 'border-line bg-surface hover:bg-raised'}`}>{o}</button>)}</div>;
}
export function TagInput({ value = [], onChange, placeholder }) {
  const [t, setT] = useState('');
  const add = () => { const v = t.trim(); if (v && !value.includes(v)) onChange([...value, v]); setT(''); };
  return (
    <div className="rounded-xl border border-line bg-surface p-2 focus-within:ring-2 focus-within:ring-brand/30">
      <div className="flex flex-wrap gap-1.5">{value.map((v) => <span key={v} className="chip">{v}<button type="button" aria-label={`Remove ${v}`} onClick={() => onChange(value.filter((x) => x !== v))}><X className="h-3 w-3" /></button></span>)}
        <input className="min-w-[8rem] flex-1 bg-transparent px-1.5 py-1 text-sm outline-none" value={t} placeholder={placeholder} onChange={(e) => setT(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); } }} onBlur={add} /></div>
    </div>
  );
}
export const Pagination = ({ page, pages, onChange }) => pages > 1 && (
  <nav className="mt-8 flex items-center justify-center gap-2" aria-label="Pagination">
    <button className="btn-ghost btn-sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>Previous</button>
    <span className="text-sm text-muted">Page {page} of {pages}</span>
    <button className="btn-ghost btn-sm" disabled={page >= pages} onClick={() => onChange(page + 1)}>Next</button>
  </nav>
);
export const SectionHead = ({ title, sub, to, linkText = 'See all' }) => (
  <div className="mb-4 flex items-end justify-between gap-4"><div><h2 className="text-xl font-bold sm:text-2xl">{title}</h2>{sub && <p className="text-sm text-muted">{sub}</p>}</div>{to && <Link to={to} className="shrink-0 text-sm font-semibold text-brand hover:underline">{linkText}</Link>}</div>
);
