import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { errMsg } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useFetch } from '../hooks/useFetch';
import { Field, Spinner, Modal, Avatar, Async } from '../components/ui';
import { ThemeToggle } from '../components/Navbar';
import { fmtDateFull } from '../utils/format';

const Section = ({ title, children }) => <section className="card space-y-4 p-5 sm:p-6"><h2 className="text-lg font-bold">{title}</h2>{children}</section>;
const Toggle = ({ label, checked, onChange }) => <label className="flex items-center justify-between gap-4 py-1.5 text-sm"><span>{label}</span><input type="checkbox" role="switch" checked={!!checked} onChange={(e) => onChange(e.target.checked)} className="h-5 w-9 cursor-pointer appearance-none rounded-full bg-line transition checked:bg-brand relative before:absolute before:left-0.5 before:top-0.5 before:h-4 before:w-4 before:rounded-full before:bg-white before:transition checked:before:translate-x-4" /></label>;

function DesktopNotif() {
  const supported = typeof window !== 'undefined' && 'Notification' in window; const [perm, setPerm] = useState(supported ? Notification.permission : 'unsupported');
  if (!supported) return <p className="text-xs text-muted">Desktop notifications are not supported in this browser.</p>;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-raised p-3 text-sm">
      <span>Desktop alerts when this site is open in a background tab {perm === 'granted' ? '(on)' : perm === 'denied' ? '(blocked in browser settings)' : ''}</span>
      {perm === 'default' && <button className="btn-primary btn-sm" onClick={async () => setPerm(await Notification.requestPermission())}>Enable</button>}
    </div>
  );
}
export default function Settings() {
  const { user, setUser, logout, logoutAll } = useAuth(); const toast = useToast(); const nav = useNavigate();
  const [acct, setAcct] = useState({ name: user.name, username: user.username }); const [pw, setPw] = useState({ currentPassword: '', newPassword: '' }); const [busy, setBusy] = useState('');
  const [del, setDel] = useState(false); const [delPw, setDelPw] = useState(''); const [ec, setEc] = useState(user.emergencyContact || { name: '', phone: '' });
  const blocked = useFetch('/users/blocked'); const reports = useFetch('/reports/mine');
  const save = async (patch, ok = 'Saved') => { try { const r = await api.put('/users/profile', patch); setUser(r.data.user); toast.success(ok); } catch (e) { toast.error(errMsg(e)); } };
  const priv = user.privacySettings || {}; const notif = user.notificationSettings || {};
  const changePw = async () => { setBusy('pw'); try { await api.put('/users/password', pw); toast.success('Password changed'); setPw({ currentPassword: '', newPassword: '' }); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(''); } };
  const unblock = async (id, kind) => { try { await api.delete(`/users/${id}/${kind}`); toast.success('Updated'); blocked.reload(); } catch (e) { toast.error(errMsg(e)); } };
  const deleteAcct = async () => { setBusy('del'); try { await api.delete('/users/me', { data: { password: delPw } }); toast.success('Account deleted'); logout(); nav('/'); } catch (e) { toast.error(errMsg(e)); setBusy(''); } };
  return (
    <div className="container-x max-w-3xl space-y-6 py-8"><h1 className="text-3xl font-extrabold">Settings</h1>
      <Section title="Account"><div className="grid gap-4 sm:grid-cols-2"><Field label="Name" htmlFor="s-n"><input id="s-n" className="input" value={acct.name} onChange={(e) => setAcct({ ...acct, name: e.target.value })} /></Field><Field label="Username" htmlFor="s-u"><input id="s-u" className="input" value={acct.username} onChange={(e) => setAcct({ ...acct, username: e.target.value })} /></Field></div>
        <Field label="Email" hint="Email changes are not supported yet."><input className="input" value={user.email} disabled /></Field><button className="btn-primary btn-sm" onClick={() => save(acct, 'Account updated')}>Save account</button></Section>
      <Section title="Privacy">
        <Field label="Who can message me" htmlFor="wm"><select id="wm" className="input" value={priv.whoCanMessage} onChange={(e) => save({ privacySettings: { whoCanMessage: e.target.value } })}><option value="everyone">Everyone</option><option value="connections">Connections only</option><option value="shared-trips">People on shared trips</option><option value="nobody">Nobody</option></select></Field>
        <Field label="Profile visibility" htmlFor="pv"><select id="pv" className="input" value={priv.profileVisibility} onChange={(e) => save({ privacySettings: { profileVisibility: e.target.value } })}><option value="public">Public</option><option value="members">Logged-in travelers only</option><option value="private">Private (name and photo only)</option></select></Field>
        <Toggle label="Show my online status" checked={priv.showOnlineStatus} onChange={(v) => save({ privacySettings: { showOnlineStatus: v } })} /><Toggle label="Show my last seen" checked={priv.showLastSeen} onChange={(v) => save({ privacySettings: { showLastSeen: v } })} /></Section>
      <Section title="Notifications"><DesktopNotif />{[['messages', 'Messages'], ['calls', 'Calls'], ['tripUpdates', 'Trip updates'], ['invitations', 'Invitations & requests'], ['marketing', 'Marketing']].map(([k, l]) => <Toggle key={k} label={l} checked={notif[k]} onChange={(v) => save({ notificationSettings: { [k]: v } })} />)}</Section>
      <Section title="Appearance"><ThemeToggle /><p className="text-xs text-muted">Saved to your account and applied on every device.</p></Section>
      <Section title="Emergency contact"><p className="text-sm text-muted">Stays private. Only you see it, and it is never contacted automatically.</p><div className="grid gap-4 sm:grid-cols-2"><Field label="Name" htmlFor="ecn"><input id="ecn" className="input" value={ec.name || ''} onChange={(e) => setEc({ ...ec, name: e.target.value })} /></Field><Field label="Phone" htmlFor="ecp"><input id="ecp" className="input" value={ec.phone || ''} onChange={(e) => setEc({ ...ec, phone: e.target.value })} /></Field></div><button className="btn-primary btn-sm" onClick={() => save({ emergencyContact: ec }, 'Emergency contact saved')}>Save contact</button></Section>
      <Section title="Security"><div className="grid gap-4 sm:grid-cols-2"><Field label="Current password" htmlFor="cpw"><input id="cpw" type="password" className="input" autoComplete="current-password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} /></Field><Field label="New password" hint="8+ chars with upper, lower, number and symbol" htmlFor="npw"><input id="npw" type="password" className="input" autoComplete="new-password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} /></Field></div>
        <div className="flex flex-wrap gap-3"><button className="btn-primary btn-sm" disabled={busy === 'pw' || !pw.currentPassword || !pw.newPassword} onClick={changePw}>{busy === 'pw' && <Spinner className="h-4 w-4" />}Change password</button><button className="btn-ghost btn-sm" onClick={async () => { await logoutAll(); nav('/login'); }}>Log out of all sessions</button><button className="btn-ghost btn-sm text-danger" onClick={() => setDel(true)}>Delete account</button></div></Section>
      <Section title="Safety"><div><h3 className="mb-2 text-sm font-semibold">Blocked users</h3><Async loading={blocked.loading} error={blocked.error} onRetry={blocked.reload}>{blocked.data?.blocked.length ? <ul className="divide-y divide-line">{blocked.data.blocked.map((u) => <li key={u._id} className="flex items-center gap-3 py-2"><Avatar user={u} size={36} /><span className="flex-1">{u.name}</span><button className="btn-ghost btn-sm" onClick={() => unblock(u._id, 'block')}>Unblock</button></li>)}</ul> : <p className="text-sm text-muted">You haven't blocked anyone.</p>}</Async>
        {blocked.data?.restricted.length > 0 && <><h3 className="mb-2 mt-4 text-sm font-semibold">Restricted users</h3><ul className="divide-y divide-line">{blocked.data.restricted.map((u) => <li key={u._id} className="flex items-center gap-3 py-2"><Avatar user={u} size={36} /><span className="flex-1">{u.name}</span><button className="btn-ghost btn-sm" onClick={() => unblock(u._id, 'restrict')}>Remove restriction</button></li>)}</ul></>}</div>
        <div><h3 className="mb-2 text-sm font-semibold">My reports</h3><Async loading={reports.loading} error={reports.error} onRetry={reports.reload}>{reports.data?.reports.length ? <ul className="space-y-2 text-sm">{reports.data.reports.map((r) => <li key={r._id} className="flex justify-between gap-3 rounded-lg bg-raised p-3"><span>{r.targetType}: {r.targetUser?.name || r.targetTrip?.title} · {r.category}</span><span className="chip capitalize">{r.status}</span></li>)}</ul> : <p className="text-sm text-muted">No reports filed.</p>}</Async></div></Section>
      <Modal open={del} onClose={() => setDel(false)} title="Delete your account" size="max-w-md" footer={<><button className="btn-ghost" onClick={() => setDel(false)}>Keep account</button><button className="btn-danger" disabled={!delPw || busy === 'del'} onClick={deleteAcct}>{busy === 'del' && <Spinner className="h-4 w-4" />}Delete permanently</button></>}>
        <p className="mb-3 text-sm text-muted">This removes your profile, memberships, saved trips and connections. You must cancel or delete your upcoming trips first.</p><Field label="Confirm with your password" htmlFor="dpw"><input id="dpw" type="password" className="input" value={delPw} onChange={(e) => setDelPw(e.target.value)} /></Field></Modal>
    </div>
  );
}
