'use client';

import { useI18n } from '@/i18n/I18nProvider';
import type { MessageKey } from '@/i18n/messages';

export type SeverityLevel = 'critical' | 'high' | 'medium' | 'low' | 'info' | 'unknown';

const ALIASES: Record<string, SeverityLevel> = {
  critical: 'critical', crit: 'critical',
  high: 'high', high_risk: 'high',
  medium: 'medium', moderate: 'medium', warning: 'medium', warn: 'medium',
  low: 'low', safe: 'low', optimal: 'low',
  info: 'info', informational: 'info',
};

/** Maps whatever the back end sends ("HIGH", "moderate", "high_risk") to one of the five levels. */
export function normalizeSeverity(value?: string | null): SeverityLevel {
  return ALIASES[(value || '').trim().toLowerCase()] ?? 'unknown';
}

/** Shapes follow IBM Carbon's status pattern so severity never depends on colour alone. */
function SeveritySymbol({ level }: { level: SeverityLevel }) {
  const common = { viewBox: '0 0 12 12', 'aria-hidden': true as const, focusable: false as const };
  switch (level) {
    case 'critical': return <svg {...common}><circle cx="6" cy="6" r="6" fill="currentColor" /><path d="M3.8 3.8l4.4 4.4M8.2 3.8L3.8 8.2" stroke="var(--sev-critical-bg)" strokeWidth="1.4" /></svg>;
    case 'high': return <svg {...common}><path d="M6 .8l5.6 10H.4z" fill="currentColor" /></svg>;
    case 'medium': return <svg {...common}><path d="M6 1.4l4.8 8.8H1.2z" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>;
    case 'low': return <svg {...common}><rect x="1.5" y="1.5" width="9" height="9" fill="currentColor" /></svg>;
    default: return <svg {...common}><path d="M6 .8L11.2 6 6 11.2.8 6z" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>;
  }
}

export default function SeverityBadge({ level, value, label }: { level?: SeverityLevel; value?: string | null; /** Replaces the level word when the badge names a state, e.g. "Access blocked". */ label?: string }) {
  const { t } = useI18n();
  const resolved = level ?? normalizeSeverity(value);
  return (
    <span className="sev" data-level={resolved} title={t(`sev.${resolved}.hint` as MessageKey)}>
      <SeveritySymbol level={resolved} />
      {label ?? t(`sev.${resolved}` as MessageKey)}
    </span>
  );
}
