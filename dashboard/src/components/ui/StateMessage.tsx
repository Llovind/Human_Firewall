'use client';

import type { ReactNode } from 'react';
import { AlertTriangle, Inbox } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';

interface StateMessageProps {
  variant: 'empty' | 'error' | 'loading';
  /** What happened, in one sentence. */
  title?: string;
  /** Why, in one sentence. */
  why?: ReactNode;
  action?: { label: string; onClick: () => void };
  /** Shown under an error so people know how fresh the data on screen is. */
  lastUpdated?: string;
  compact?: boolean;
  /** Lines of skeleton to show while loading. */
  lines?: number;
}

/** Empty, error and loading states share one shape: what happened, why, what next. */
export default function StateMessage({ variant, title, why, action, lastUpdated, compact = false, lines = 3 }: StateMessageProps) {
  const { t } = useI18n();
  if (variant === 'loading') {
    return (
      <div className="state" data-variant="loading" data-compact={compact} role="status" aria-busy="true">
        <span className="visually-hidden">{title ?? t('state.loading')}</span>
        {Array.from({ length: lines }, (_, i) => <span key={i} className="skeleton-line" style={{ width: `${92 - i * 14}%` }} />)}
      </div>
    );
  }
  const Icon = variant === 'error' ? AlertTriangle : Inbox;
  return (
    <div className="state" data-variant={variant} data-compact={compact} role={variant === 'error' ? 'alert' : undefined}>
      <Icon size={20} aria-hidden="true" />
      <h3>{title ?? t(variant === 'error' ? 'state.error.title' : 'state.empty.title')}</h3>
      {(why || variant === 'error') && <p>{why ?? t('state.error.why')}</p>}
      {action && <button type="button" className="btn btn-primary" onClick={action.onClick}>{action.label}</button>}
      {lastUpdated && <small>{t('state.lastUpdated', { time: lastUpdated })}</small>}
    </div>
  );
}
