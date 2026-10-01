import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errMsg, fieldErrors } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Field, Chips, TagInput, Spinner } from '../components/ui';
import { ImageUpload } from '../components/Extras';
import { STYLES, INTERESTS } from '../utils/format';

const pick = (u) => ({ name: u.name, username: u.username, bio: u.bio || '', age: u.age || '', gender: u.gender || '', city: u.city || '', country: u.country || '', profileImage: u.profileImage || '', languages: u.languages || [], travelInterests: u.travelInterests || [], travelStyle: u.travelStyle || [], favoriteDestinations: u.favoriteDestinations || [], budgetMin: u.budgetMin ?? 0, budgetMax: u.budgetMax ?? 0 });
export default function Profile() {
  const { user, setUser } = useAuth(); const toast = useToast(); const [f, setF] = useState(pick(user)); const [errs, setErrs] = useState({}); const [busy, setBusy] = useState(false); const [stats, setStats] = useState(null);
  useEffect(() => { api.get(`/users/${user._id}`).then((r) => setStats(r.data.user)).catch(() => {}); }, [user._id]);
  const up = (k, v) => { setF((p) => ({ ...p, [k]: v })); setErrs((e) => ({ ...e, [k]: undefined })); };
  const save = async (e) => { e.preventDefault(); setBusy(true); try { const r = await api.put('/users/profile', { ...f, age: Number(f.age), budgetMin: Number(f.budgetMin), budgetMax: Number(f.budgetMax) }); setUser(r.data.user); toast.success('Profile updated'); api.get(`/users/${user._id}`).then((x) => setStats(x.data.user)); } catch (er) { setErrs(fieldErrors(er)); toast.error(errMsg(er)); } finally { setBusy(false); } };
  const inp = (k, label, props = {}) => <Field label={label} error={errs[k]} htmlFor={`p-${k}`}><input id={`p-${k}`} className="input" value={f[k]} onChange={(e) => up(k, e.target.value)} {...props} /></Field>;
  return (
    <div className="container-x max-w-3xl space-y-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3"><h1 className="text-3xl font-extrabold">Your profile</h1><Link to={`/travelers/${user.username}`} className="btn-ghost btn-sm">View public profile</Link></div>
      {stats && <div className="card space-y-3 p-5"><div className="flex items-center justify-between"><p className="font-semibold">Profile completion</p><p className="font-display text-xl font-bold text-brand">{stats.completion}%</p></div><div className="h-2 overflow-hidden rounded-full bg-raised"><div className="h-full bg-brand transition-all" style={{ width: `${stats.completion}%` }} /></div>
        <div className="grid grid-cols-3 gap-3 text-center text-sm"><div><b className="block text-xl">{stats.stats.tripsCreated}</b>Trips created</div><div><b className="block text-xl">{stats.stats.tripsJoined}</b>Trips joined</div><div><b className="block text-xl">{stats.stats.connections}</b>Connections</div></div></div>}
      <form onSubmit={save} className="card space-y-5 p-5 sm:p-6" noValidate>
        <Field label="Profile photo"><ImageUpload shape="round" value={f.profileImage} onChange={(u) => up('profileImage', u)} label="Upload photo" /></Field>
        <div className="grid gap-4 sm:grid-cols-2">{inp('name', 'Full name')}{inp('username', 'Username')}</div>
        <Field label="Bio" error={errs.bio} htmlFor="p-bio"><textarea id="p-bio" className="input min-h-24" maxLength={500} value={f.bio} onChange={(e) => up('bio', e.target.value)} placeholder="Tell travelers about yourself" /></Field>
        <div className="grid gap-4 sm:grid-cols-3">{inp('age', 'Age', { type: 'number', min: 18 })}<Field label="Gender" htmlFor="p-g"><select id="p-g" className="input" value={f.gender} onChange={(e) => up('gender', e.target.value)}><option value="">Prefer not to say</option><option value="female">Female</option><option value="male">Male</option><option value="non-binary">Non-binary</option></select></Field>{inp('city', 'City')}</div>
        {inp('country', 'Country')}
        <Field label="Travel style"><Chips options={STYLES} value={f.travelStyle} onChange={(v) => up('travelStyle', v)} max={6} /></Field>
        <Field label="Travel interests"><Chips options={INTERESTS} value={f.travelInterests} onChange={(v) => up('travelInterests', v)} /></Field>
        <Field label="Favorite destinations (Enter to add)"><TagInput value={f.favoriteDestinations} onChange={(v) => up('favoriteDestinations', v)} placeholder="Manali, Kerala…" /></Field>
        <Field label="Languages (Enter to add)"><TagInput value={f.languages} onChange={(v) => up('languages', v)} placeholder="English, Hindi…" /></Field>
        <div className="grid gap-4 sm:grid-cols-2">{inp('budgetMin', 'Budget per trip from (₹)', { type: 'number', min: 0 })}{inp('budgetMax', 'Budget per trip up to (₹)', { type: 'number', min: 0 })}</div>
        <div className="flex justify-end"><button className="btn-primary" disabled={busy}>{busy && <Spinner className="h-4 w-4" />}Save profile</button></div>
      </form>
    </div>
  );
}
