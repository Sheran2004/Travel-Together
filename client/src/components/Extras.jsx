import { useRef, useState } from 'react';
import { ImagePlus } from 'lucide-react';
import { Modal, Spinner, Field } from './ui';
import api, { errMsg, assetUrl } from '../services/api';
import { useToast } from '../context/ToastContext';

export function ImageUpload({ value, onChange, label = 'Upload image', shape = 'rect' }) {
  const ref = useRef(null); const [busy, setBusy] = useState(false); const toast = useToast();
  const pick = async (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    if (!f.type.startsWith('image/')) return toast.error('Please choose an image file');
    if (f.size > 5 * 1024 * 1024) return toast.error('Image must be under 5MB');
    setBusy(true);
    try { const fd = new FormData(); fd.append('file', f); const r = await api.post('/uploads/image', fd); onChange(r.data.url); toast.success('Image uploaded'); }
    catch (er) { toast.error(errMsg(er, 'Upload failed')); } finally { setBusy(false); e.target.value = ''; }
  };
  return (
    <div className="flex items-center gap-4">
      <div className={`relative grid place-items-center overflow-hidden border border-dashed border-line bg-raised ${shape === 'round' ? 'h-24 w-24 rounded-full' : 'h-28 w-44 rounded-xl'}`}>
        {value ? <img src={assetUrl(value)} alt="Preview" className="h-full w-full object-cover" /> : <ImagePlus className="h-7 w-7 text-muted" />}
        {busy && <div className="absolute inset-0 grid place-items-center bg-black/40"><Spinner className="text-white" /></div>}
      </div>
      <div><input ref={ref} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" onChange={pick} aria-label={label} />
        <button type="button" className="btn-ghost btn-sm" onClick={() => ref.current.click()} disabled={busy}>{label}</button>
        {value && <button type="button" className="ml-2 text-xs text-muted underline" onClick={() => onChange('')}>Remove</button>}
        <p className="mt-1 text-xs text-muted">JPG, PNG, WebP or GIF · max 5MB</p></div>
    </div>
  );
}

export const REPORT_CATEGORIES = ['Spam', 'Harassment', 'Fake profile', 'Scam', 'Inappropriate content', 'Other'];
export function ReportModal({ open, onClose, targetType, targetId, label }) {
  const [category, setCategory] = useState('Spam'); const [details, setDetails] = useState(''); const [busy, setBusy] = useState(false); const toast = useToast();
  const submit = async () => {
    setBusy(true);
    try { const r = await api.post('/reports', { targetType, targetId, category, details }); toast.success(r.data.message); setDetails(''); onClose(); }
    catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title={`Report ${label || targetType}`} size="max-w-md" footer={<><button className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-danger" disabled={busy} onClick={submit}>{busy && <Spinner className="h-4 w-4" />}Submit report</button></>}>
      <div className="space-y-4">
        <Field label="What's wrong?" htmlFor="rc"><select id="rc" className="input" value={category} onChange={(e) => setCategory(e.target.value)}>{REPORT_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
        <Field label="Details (optional)" htmlFor="rd"><textarea id="rd" className="input min-h-24" maxLength={1000} value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Tell us what happened so moderators can act." /></Field>
        <p className="text-xs text-muted">Reports are private. The person you report won't be told who reported them.</p>
      </div>
    </Modal>
  );
}
