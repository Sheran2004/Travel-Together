import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useLocation, useParams, Navigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Compass } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api, { errMsg, fieldErrors } from '../services/api';
import { Field, Spinner, Chips } from '../components/ui';
import { INTERESTS, STYLES } from '../utils/format';

const strong = z.string().min(8, 'At least 8 characters').regex(/[A-Z]/, 'Add an uppercase letter').regex(/[a-z]/, 'Add a lowercase letter').regex(/[0-9]/, 'Add a number').regex(/[^A-Za-z0-9]/, 'Add a special character');
const Shell = ({ title, sub, children }) => (
  <div className="container-x grid min-h-[80vh] place-items-center py-10"><div className="card w-full max-w-md p-6 sm:p-8">
    <div className="mb-6 text-center"><span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-brand text-brand-ink"><Compass className="h-6 w-6" /></span><h1 className="text-2xl font-extrabold">{title}</h1><p className="mt-1 text-sm text-muted">{sub}</p></div>{children}</div></div>
);
const Password = ({ id, reg, ...p }) => { const [show, setShow] = useState(false); return <div className="relative"><input id={id} type={show ? 'text' : 'password'} className="input pr-10" {...reg} {...p} /><button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'}>{show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div>; };

export function Login() {
  const { user, login } = useAuth(); const nav = useNavigate(); const loc = useLocation(); const toast = useToast(); const [err, setErr] = useState('');
  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(z.object({ email: z.string().email('Enter a valid email'), password: z.string().min(1, 'Enter your password') })) });
  if (user) return <Navigate to={loc.state?.from || '/dashboard'} replace />;
  const submit = async (d) => { setErr(''); try { const u = await login(d.email, d.password); toast.success(`Welcome back, ${u.name.split(' ')[0]}!`); nav(loc.state?.from || '/dashboard', { replace: true }); } catch (e) { setErr(errMsg(e)); } };
  return (
    <Shell title="Welcome back" sub="Log in to continue planning your next trip.">
      <form onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
        {err && <p className="rounded-xl bg-danger/10 p-3 text-sm text-danger" role="alert">{err}</p>}
        <Field label="Email" error={errors.email?.message} htmlFor="email"><input id="email" type="email" autoComplete="email" className="input" {...register('email')} /></Field>
        <Field label="Password" error={errors.password?.message} htmlFor="password"><Password id="password" autoComplete="current-password" reg={register('password')} /></Field>
        <div className="text-right"><Link to="/forgot-password" className="text-sm text-brand hover:underline">Forgot password?</Link></div>
        <button className="btn-primary w-full" disabled={isSubmitting}>{isSubmitting && <Spinner className="h-4 w-4" />}Log in</button>
        <button type="button" className="btn-ghost w-full" onClick={() => { setValue('email', 'demo@traveltogether.com'); setValue('password', 'Demo@12345'); }}>Fill demo account</button>
        <p className="text-center text-sm text-muted">New here? <Link to="/register" className="font-semibold text-brand">Create an account</Link></p>
      </form>
    </Shell>
  );
}

const regSchema = z.object({
  name: z.string().trim().min(2, 'Enter your full name'), username: z.string().trim().toLowerCase().regex(/^[a-z0-9_.]{3,24}$/, '3–24 characters: letters, numbers, . or _'),
  email: z.string().email('Enter a valid email'), password: strong, confirmPassword: z.string(),
  age: z.coerce.number({ invalid_type_error: 'Enter your age' }).int().min(18, 'You must be 18 or older').max(100), gender: z.string().min(1, 'Choose one'),
  city: z.string().trim().min(1, 'Enter your city'), country: z.string().trim().min(1, 'Enter your country'), travelInterests: z.array(z.string()), travelStyle: z.array(z.string()),
  budgetMin: z.coerce.number().min(0), budgetMax: z.coerce.number().min(0)
}).refine((d) => d.password === d.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match' }).refine((d) => d.budgetMax >= d.budgetMin, { path: ['budgetMax'], message: 'Must be at least the minimum' });

export function Register() {
  const { user, register: signup } = useAuth(); const nav = useNavigate(); const toast = useToast(); const [err, setErr] = useState('');
  const { register, handleSubmit, control, setError, watch, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(regSchema), defaultValues: { gender: '', country: 'India', travelInterests: [], travelStyle: [], budgetMin: 3000, budgetMax: 30000 } });
  if (user) return <Navigate to="/dashboard" replace />;
  const pw = watch('password') || ''; const score = [/.{8,}/, /[A-Z]/, /[a-z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((r) => r.test(pw)).length;
  const submit = async (d) => { setErr(''); try { await signup(d); toast.success('Welcome to Travel Together!'); nav('/dashboard'); } catch (e) { const fe = fieldErrors(e); Object.entries(fe).forEach(([k, v]) => setError(k, { message: v })); setErr(errMsg(e)); } };
  const f = (k, label, props = {}) => <Field label={label} error={errors[k]?.message} htmlFor={k}><input id={k} className="input" {...register(k)} {...props} /></Field>;
  return (
    <div className="container-x grid place-items-center py-10"><div className="card w-full max-w-2xl p-6 sm:p-8">
      <h1 className="text-2xl font-extrabold">Create your traveler profile</h1><p className="mb-6 mt-1 text-sm text-muted">It takes a minute. Your details help us suggest better trips and travel partners.</p>
      <form onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
        {err && <p className="rounded-xl bg-danger/10 p-3 text-sm text-danger" role="alert">{err}</p>}
        <div className="grid gap-4 sm:grid-cols-2">{f('name', 'Full name', { autoComplete: 'name' })}{f('username', 'Username', { autoComplete: 'username' })}</div>
        {f('email', 'Email', { type: 'email', autoComplete: 'email' })}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Password" error={errors.password?.message} htmlFor="password"><Password id="password" autoComplete="new-password" reg={register('password')} /><div className="mt-2 flex gap-1" aria-hidden>{[1, 2, 3, 4, 5].map((i) => <span key={i} className={`h-1 flex-1 rounded ${i <= score ? (score < 3 ? 'bg-danger' : score < 5 ? 'bg-accent' : 'bg-ok') : 'bg-line'}`} />)}</div></Field>
          <Field label="Confirm password" error={errors.confirmPassword?.message} htmlFor="confirmPassword"><Password id="confirmPassword" autoComplete="new-password" reg={register('confirmPassword')} /></Field></div>
        <div className="grid gap-4 sm:grid-cols-3">{f('age', 'Age', { type: 'number', min: 18 })}
          <Field label="Gender" error={errors.gender?.message} htmlFor="gender"><select id="gender" className="input" {...register('gender')}><option value="">Select</option><option value="female">Female</option><option value="male">Male</option><option value="non-binary">Non-binary</option><option value="prefer-not-to-say">Prefer not to say</option></select></Field>{f('city', 'City')}</div>
        {f('country', 'Country')}
        <Field label="Travel interests"><Controller control={control} name="travelInterests" render={({ field }) => <Chips options={INTERESTS} value={field.value} onChange={field.onChange} />} /></Field>
        <Field label="Travel style (up to 3)"><Controller control={control} name="travelStyle" render={({ field }) => <Chips options={STYLES} value={field.value} onChange={field.onChange} max={3} />} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">{f('budgetMin', 'Trip budget from (₹)', { type: 'number' })}{f('budgetMax', 'Trip budget up to (₹)', { type: 'number' })}</div>
        <button className="btn-primary w-full" disabled={isSubmitting}>{isSubmitting && <Spinner className="h-4 w-4" />}Create account</button>
        <p className="text-center text-sm text-muted">Already registered? <Link to="/login" className="font-semibold text-brand">Log in</Link></p>
      </form></div></div>
  );
}

export function VerifyEmail() {
  const { token } = useParams(); const { user, refresh } = useAuth(); const [state, setState] = useState('loading'); const [msg, setMsg] = useState(''); const ran = useRef(false);
  useEffect(() => {
    if (ran.current) return; ran.current = true; // StrictMode runs effects twice; the token is single-use
    api.post('/auth/verify-email', { token }).then(() => { setState('ok'); if (user) refresh().catch(() => {}); }).catch((e) => { setState('err'); setMsg(errMsg(e)); });
  }, [token]); // eslint-disable-line
  return (
    <Shell title="Email verification" sub={state === 'loading' ? 'Verifying…' : ''}>
      {state === 'ok' && <p className="rounded-xl bg-ok/10 p-4 text-sm" role="status">Your email is verified. Thanks!</p>}
      {state === 'err' && <p className="rounded-xl bg-danger/10 p-4 text-sm text-danger" role="alert">{msg}</p>}
      <p className="mt-4 text-center text-sm"><Link to={user ? '/dashboard' : '/login'} className="text-brand">Continue</Link></p>
    </Shell>
  );
}

export function ForgotPassword() {
  const [sent, setSent] = useState(false); const [err, setErr] = useState('');
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(z.object({ email: z.string().email('Enter a valid email') })) });
  return (
    <Shell title="Reset your password" sub="We'll email you a link that works for 30 minutes.">
      {sent ? <div className="rounded-xl bg-ok/10 p-4 text-sm" role="status">If that email is registered, a reset link is on its way. Check your inbox and spam folder.</div> :
        <form onSubmit={handleSubmit(async (d) => { setErr(''); try { await api.post('/auth/forgot-password', d); setSent(true); } catch (e) { setErr(errMsg(e)); } })} className="space-y-4" noValidate>
          {err && <p className="text-sm text-danger" role="alert">{err}</p>}
          <Field label="Email" error={errors.email?.message} htmlFor="fe"><input id="fe" type="email" className="input" {...register('email')} /></Field>
          <button className="btn-primary w-full" disabled={isSubmitting}>{isSubmitting && <Spinner className="h-4 w-4" />}Send reset link</button></form>}
      <p className="mt-4 text-center text-sm"><Link to="/login" className="text-brand">Back to login</Link></p>
    </Shell>
  );
}
export function ResetPassword() {
  const { token } = useParams(); const nav = useNavigate(); const toast = useToast(); const [err, setErr] = useState('');
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(z.object({ password: strong, confirm: z.string() }).refine((d) => d.password === d.confirm, { path: ['confirm'], message: 'Passwords do not match' })) });
  return (
    <Shell title="Choose a new password" sub="You'll be logged out of other devices.">
      <form onSubmit={handleSubmit(async (d) => { setErr(''); try { await api.post('/auth/reset-password', { token, password: d.password }); toast.success('Password updated. Please log in.'); nav('/login'); } catch (e) { setErr(errMsg(e)); } })} className="space-y-4" noValidate>
        {err && <p className="text-sm text-danger" role="alert">{err}</p>}
        <Field label="New password" error={errors.password?.message} htmlFor="np"><Password id="np" reg={register('password')} /></Field>
        <Field label="Confirm password" error={errors.confirm?.message} htmlFor="cp"><Password id="cp" reg={register('confirm')} /></Field>
        <button className="btn-primary w-full" disabled={isSubmitting}>{isSubmitting && <Spinner className="h-4 w-4" />}Update password</button></form>
    </Shell>
  );
}
