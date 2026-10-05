'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';

type ToastTone = 'ok' | 'bad' | 'neutral';
interface ToastInput { message: string; tone?: ToastTone; action?: { label: string; onClick: () => void }; durationMs?: number }
interface ToastItem extends ToastInput { id: number }

const ToastContext = createContext<{ show: (toast: ToastInput) => void }>({ show: () => {} });

/**
 * Short confirmations ("Division added"). Not for errors that need a decision: those use an inline message.
 * Announced politely to screen readers.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
    setItems(current => current.filter(item => item.id !== id));
  }, []);

  const show = useCallback((toast: ToastInput) => {
    const id = nextId.current++;
    setItems(current => [...current.slice(-2), { ...toast, id }]);
    timers.current.set(id, setTimeout(() => dismiss(id), toast.durationMs ?? 4000));
  }, [dismiss]);

  useEffect(() => {
    const active = timers.current;
    return () => { active.forEach(clearTimeout); active.clear(); };
  }, []);

  const value = useMemo(() => ({ show }), [show]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-region" role="status" aria-live="polite">
        {items.map(item => (
          <div key={item.id} className="toast" data-tone={item.tone ?? 'neutral'}>
            <span>{item.message}</span>
            {item.action && <button type="button" className="toast-action" onClick={() => { item.action?.onClick(); dismiss(item.id); }}>{item.action.label}</button>}
            <button type="button" className="toast-close" aria-label={t('common.dismiss')} onClick={() => dismiss(item.id)}><X size={14} aria-hidden="true" /></button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
