'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Shield, Flame, Trophy, ShieldAlert } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';
import type { MessageKey } from '@/i18n/messages';

interface BadgeItem {
  id: string;
  label: string;
  threshold: number;
  achieved: boolean;
}
interface NextBadge {
  id: string;
  threshold: number;
  remaining: number;
}
interface ReportsSummary {
  employee_id: string;
  reports_count_malicious: number;
  reports_count_total: number;
  daily_streak: number;
  last_quiz_completed_at: string | null;
  badges: BadgeItem[];
  next_badge: NextBadge | null;
}

// Behaviour badges (from myScore.badges, points-based). Words come from the message table.
const LEGACY_BADGES = [
  { key: 'First Report', icon: 'flag', color: 'var(--sev-ok)' },
  { key: 'Streak Master', icon: 'flame-link', color: 'var(--sev-medium)' },
  { key: 'Guardian', icon: 'shield-check', color: 'var(--accent)' },
  { key: 'Quiz Champion', icon: 'target-check', color: 'var(--accent)' },
  { key: 'Sentinel', icon: 'radar', color: 'var(--accent-strong)' },
] as const;

// Reporting badges (from reports_count_malicious).
const REPORTING_RANKS: Record<string, { icon: string; color: string; threshold: number }> = {
  sentinel_troops: { icon: 'chevron-1', color: 'var(--accent)', threshold: 1 },
  front_line_defender: { icon: 'chevron-2', color: 'var(--accent)', threshold: 3 },
  the_front_man: { icon: 'chevron-3', color: 'var(--sev-medium)', threshold: 5 },
  cyber_shield_elite: { icon: 'chevron-star', color: 'var(--sev-ok)', threshold: 10 },
};

const REPORTING_FALLBACK: BadgeItem[] = Object.entries(REPORTING_RANKS).map(([id, rank]) => ({ id, label: id, threshold: rank.threshold, achieved: false }));

function BadgeIcon({ icon, size = 26 }: { icon: string; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 32 32',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  switch (icon) {
    case 'flag':
      return (
        <svg {...common}>
          <path d="M9 27V5" />
          <path d="M9 6l14 4.5L9 15" fill="currentColor" fillOpacity="0.85" stroke="none" />
          <circle cx="9" cy="27" r="1.4" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'flame-link':
      return (
        <svg {...common}>
          <path d="M16 6c2 3-1 4-1 6.5a3 3 0 0 0 6 0c2 2 2 6-1 8.5a7 7 0 0 1-10-9C11 9 13 7 16 6z" fill="currentColor" fillOpacity="0.85" stroke="none" />
          <ellipse cx="12" cy="26" rx="3.2" ry="2.2" transform="rotate(-20 12 26)" />
          <ellipse cx="18" cy="26.5" rx="3.2" ry="2.2" transform="rotate(20 18 26.5)" />
        </svg>
      );
    case 'shield-check':
      return (
        <svg {...common}>
          <path d="M16 4l10 3.5v7C26 21 22 25.5 16 28 10 25.5 6 21 6 14.5v-7L16 4z" />
          <path d="M11.5 16.5l3 3 6-6.5" />
        </svg>
      );
    case 'target-check':
      return (
        <svg {...common}>
          <circle cx="16" cy="16" r="10" />
          <circle cx="16" cy="16" r="5.5" />
          <path d="M12.5 16.3l2.4 2.4 5-5.4" fill="currentColor" fillOpacity="0.15" />
        </svg>
      );
    case 'radar':
      return (
        <svg {...common}>
          <circle cx="16" cy="16" r="11" strokeOpacity="0.4" />
          <circle cx="16" cy="16" r="7" strokeOpacity="0.65" />
          <path d="M16 16L25 9" />
          <path d="M16 16 L16 5 A11 11 0 0 1 25 9 Z" fill="currentColor" fillOpacity="0.18" stroke="none" />
          <circle cx="16" cy="16" r="1.6" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'chevron-1':
      return (
        <svg {...common}>
          <path d="M16 5l11 6-2 4-9 -5-9 5-2-4z" fill="currentColor" fillOpacity="0.15" />
          <path d="M7 21l9-5 9 5" />
        </svg>
      );
    case 'chevron-2':
      return (
        <svg {...common}>
          <path d="M7 14l9-5 9 5" />
          <path d="M7 22l9-5 9 5" />
        </svg>
      );
    case 'chevron-3':
      return (
        <svg {...common}>
          <path d="M7 10l9-5 9 5" />
          <path d="M7 17l9-5 9 5" />
          <path d="M7 24l9-5 9 5" />
        </svg>
      );
    case 'chevron-star':
      return (
        <svg {...common}>
          <path d="M16 4.5l1.7 3.6 3.9.4-2.9 2.7.8 3.9-3.5-2-3.5 2 .8-3.9-2.9-2.7 3.9-.4z" fill="currentColor" stroke="none" />
          <path d="M7 19l9-5 9 5" />
          <path d="M7 26l9-5 9 5" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="16" cy="16" r="10" />
        </svg>
      );
  }
}

interface UnifiedBadge {
  id: string;
  label: string;
  sub: string;
  icon: string;
  color: string;
  achieved: boolean;
}

export default function ReportingBadgesWidget({ email, legacyBadges }: { email: string; legacyBadges: string[] }) {
  const { t } = useI18n();
  const [data, setData] = useState<ReportsSummary | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!email) return;
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(`/api/employee/${encodeURIComponent(email)}/reports-summary`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!cancelled) { setData(json); setFailed(false); }
      } catch {
        if (!cancelled) setFailed(true);
      }
    }

    void load();
    const interval = setInterval(load, 10000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [email]);

  const badges: UnifiedBadge[] = useMemo(() => {
    const behavior: UnifiedBadge[] = LEGACY_BADGES.map(b => ({
      id: b.key,
      label: t(`bdg.b.${b.key}` as MessageKey),
      sub: t(`bdg.b.${b.key}.sub` as MessageKey),
      icon: b.icon,
      color: b.color,
      achieved: (legacyBadges || []).includes(b.key),
    }));
    const reportingSource = data?.badges || REPORTING_FALLBACK;
    const reporting: UnifiedBadge[] = reportingSource.map(b => {
      const rank = REPORTING_RANKS[b.id] || { icon: 'chevron-1', color: 'var(--accent)', threshold: b.threshold };
      const known = b.id in REPORTING_RANKS;
      return {
        id: b.id,
        label: known ? t(`bdg.r.${b.id}` as MessageKey) : b.label,
        sub: rank.threshold === 1 ? t('bdg.r.sub1') : t('bdg.r.sub', { n: rank.threshold }),
        icon: rank.icon,
        color: rank.color,
        achieved: b.achieved,
      };
    });
    return [...behavior, ...reporting];
  }, [data, legacyBadges, t]);

  const achieved = badges.filter(b => b.achieved).length;
  const count = data?.reports_count_malicious ?? 0;
  const impact = count === 0 ? t('bdg.impact.0') : count === 1 ? t('bdg.impact.1') : count < 5 ? t('bdg.impact.few', { n: count }) : t('bdg.impact.many', { n: count });

  return (
    <section className="ops-block" aria-labelledby="bdg-title">
      <div className="ops-head">
        <h3 id="bdg-title"><Shield size={16} aria-hidden="true" /> {t('bdg.title')}</h3>
        <span className="emp-muted">{achieved} / {badges.length}</span>
      </div>
      <p className="inline-note"><ShieldAlert size={16} aria-hidden="true" />{data ? impact : t('bdg.loading')}</p>
      {data && (
        <div className="strip" role="group">
          <span className="strip-static"><Trophy size={14} aria-hidden="true" /> {t('bdg.reports', { n: data.reports_count_malicious })}</span>
          <span className="strip-static"><Flame size={14} aria-hidden="true" /> {t('bdg.streak', { n: data.daily_streak })}</span>
        </div>
      )}
      <ul className="badge-grid">
        {badges.map(badge => (
          <li key={badge.id} data-earned={badge.achieved} title={badge.sub}>
            <span className="badge-icon" style={{ color: badge.achieved ? badge.color : undefined }}><BadgeIcon icon={badge.icon} /></span>
            <strong>{badge.label}</strong>
            <small>{badge.sub}</small>
            <em>{badge.achieved ? t('bdg.earned') : t('bdg.locked')}</em>
          </li>
        ))}
      </ul>
      {data?.next_badge && <p className="emp-muted">{t('bdg.next', { n: data.next_badge.remaining, name: data.next_badge.id.replace(/_/g, ' ') })}</p>}
      {failed && <p className="field-error" role="alert">{t('bdg.err')}</p>}
    </section>
  );
}
