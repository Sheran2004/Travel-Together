import { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
const Ctx = createContext(null);
export const useToast = () => useContext(Ctx);
export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const remove = useCallback((id) => setItems((l) => l.filter((t) => t.id !== id)), []);
  const push = useCallback((message, type = 'info') => {
    const id = Math.random().toString(36).slice(2); setItems((l) => [...l.slice(-3), { id, message, type }]);
    setTimeout(() => remove(id), 4500);
  }, [remove]);
  const toast = { success: (m) => push(m, 'success'), error: (m) => push(m, 'error'), info: (m) => push(m, 'info') };
  const Icon = { success: CheckCircle2, error: AlertCircle, info: Info };
  return (
    <Ctx.Provider value={toast}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[3000] flex flex-col items-center gap-2 px-4 md:bottom-6 md:items-end md:pr-6" role="status" aria-live="polite">
        {items.map((t) => { const I = Icon[t.type]; return (
          <div key={t.id} className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border border-line bg-surface p-3.5 shadow-pop">
            <I className={`mt-0.5 h-5 w-5 shrink-0 ${t.type === 'success' ? 'text-ok' : t.type === 'error' ? 'text-danger' : 'text-brand'}`} />
            <p className="flex-1 text-sm">{t.message}</p>
            <button onClick={() => remove(t.id)} aria-label="Dismiss" className="text-muted hover:text-ink"><X className="h-4 w-4" /></button>
          </div>); })}
      </div>
    </Ctx.Provider>
  );
}
