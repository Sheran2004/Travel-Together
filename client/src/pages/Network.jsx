import { Link } from 'react-router-dom';
import { Users, Check, X, MessageCircle } from 'lucide-react';
import api, { errMsg } from '../services/api';
import { useFetch } from '../hooks/useFetch';
import { useToast } from '../context/ToastContext';
import { Async, Avatar, EmptyState } from '../components/ui';

const Row = ({ u, children, sub }) => <li className="flex items-center gap-3 py-3"><Link to={`/travelers/${u.username}`}><Avatar user={u} size={44} /></Link><div className="min-w-0 flex-1"><Link to={`/travelers/${u.username}`} className="font-semibold hover:text-brand">{u.name}</Link><p className="truncate text-xs text-muted">{sub || u.city}</p></div>{children}</li>;
export default function Network() {
  const { data, loading, error, reload } = useFetch('/connections'); const toast = useToast();
  const run = async (fn, ok) => { try { await fn(); toast.success(ok); reload(); } catch (e) { toast.error(errMsg(e)); } };
  const D = data;
  return (
    <div className="container-x max-w-4xl space-y-6 py-8"><h1 className="text-3xl font-extrabold">My travel network</h1>
      <Async loading={loading} error={error} onRetry={reload}>{D && <>
        {D.incoming.length > 0 && <section className="card p-5"><h2 className="font-bold">Connection requests</h2><ul className="divide-y divide-line">{D.incoming.map(({ user: u }) => <Row key={u._id} u={u}><button className="btn-primary btn-sm" onClick={() => run(() => api.post(`/connections/${u._id}/accept`), 'Connected')}><Check className="h-4 w-4" />Accept</button><button className="btn-ghost btn-sm" onClick={() => run(() => api.post(`/connections/${u._id}/reject`), 'Request declined')}><X className="h-4 w-4" />Reject</button></Row>)}</ul></section>}
        <section className="card p-5"><h2 className="font-bold">Connections ({D.accepted.length})</h2>{D.accepted.length ? <ul className="divide-y divide-line">{D.accepted.map(({ user: u }) => <Row key={u._id} u={u}><Link to={`/messages?user=${u._id}`} className="btn-ghost btn-sm"><MessageCircle className="h-4 w-4" />Message</Link><button className="btn-ghost btn-sm" onClick={() => run(() => api.delete(`/connections/${u._id}`), 'Connection removed')}>Remove</button></Row>)}</ul> : <EmptyState icon={Users} title="No connections yet" text="Connect with travelers you meet on trips or in Find Travel Partners." action={<Link to="/partners" className="btn-primary">Find travel partners</Link>} />}</section>
        {D.outgoing.length > 0 && <section className="card p-5"><h2 className="font-bold">Sent requests</h2><ul className="divide-y divide-line">{D.outgoing.map(({ user: u }) => <Row key={u._id} u={u}><button className="btn-ghost btn-sm" onClick={() => run(() => api.delete(`/connections/${u._id}`), 'Request cancelled')}>Cancel</button></Row>)}</ul></section>}
        <section className="card p-5"><h2 className="font-bold">Upcoming trip partners</h2>{D.upcomingPartners.length ? <ul className="divide-y divide-line">{D.upcomingPartners.map((p) => <Row key={p.user._id} u={p.user} sub={`Together on ${p.trip.title}`} />)}</ul> : <p className="mt-1 text-sm text-muted">People on your upcoming trips show up here.</p>}</section>
        <section className="card p-5"><h2 className="font-bold">Previous travel partners</h2>{D.previousPartners.length ? <ul className="divide-y divide-line">{D.previousPartners.map((p) => <Row key={p.user._id} u={p.user} sub={`Travelled together: ${p.trip.title}`} />)}</ul> : <p className="mt-1 text-sm text-muted">After a trip ends, your travel companions appear here.</p>}</section></>}</Async></div>
  );
}
