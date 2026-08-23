'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Shield, Flame, Trophy, ShieldAlert } from 'lucide-react';

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

// ── Legacy behavior badges (from myScore.badges, points-based) ──
const LEGACY_BADGES = [
  { key: 'First Report', label: 'First Report', sub: 'First reported phishing threat', icon: 'flag', color: 'var(--success)' },
  { key: 'Streak Master', label: 'Streak Master', sub: '4+ weeks incident-free', icon: 'flame-link', color: 'var(--warning)' },
  { key: 'Guardian', label: 'Guardian', sub: 'Behavior score >= 60', icon: 'shield-check', color: 'var(--info)' },
  { key: 'Quiz Champion', label: 'Quiz Champion', sub: 'Won Spot the Fake challenge', icon: 'target-check', color: 'var(--accent)' },
  { key: 'Sentinel', label: 'Sentinel', sub: 'Behavior score >= 130', icon: 'radar', color: 'var(--accent-dim)' },
] as const;

// ── Reporting badges (from reports_count_malicious) ──
const REPORTING_RANKS: Record<string, { icon: string; color: string; sub: string }> = {
  sentinel_troops: { icon: 'chevron-1', color: 'var(--brand-sky)', sub: '1 report' },
  front_line_defender: { icon: 'chevron-2', color: 'var(--accent)', sub: '3 reports' },
  the_front_man: { icon: 'chevron-3', color: 'var(--warning)', sub: '5 reports' },
  cyber_shield_elite: { icon: 'chevron-star', color: 'var(--success)', sub: '10 reports' },
};

const REPORTING_FALLBACK: BadgeItem[] = [
  { id: 'sentinel_troops', label: 'Sentinel Troops', threshold: 1, achieved: false },
  { id: 'front_line_defender', label: 'Front Line Defender', threshold: 3, achieved: false },
  { id: 'the_front_man', label: 'The Front Man', threshold: 5, achieved: false },
  { id: 'cyber_shield_elite', label: 'Cyber Shield Elite', threshold: 10, achieved: false },
];

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

function impactStatement(reportsCount: number): string {
  if (reportsCount === 0) {
    return 'No threat reports submitted yet. Every suspicious link or file you report is an attack vector closed: start with your first report today.';
  }
  if (reportsCount === 1) {
    return `Your report has helped the security team neutralize 1 verified threat before reaching other colleagues. This is just the beginning.`;
  }
  if (reportsCount < 5) {
    return `Thanks to your ${reportsCount} verified reports, security analysts neutralized incoming threats before reaching other team members. You are actively fortifying the defense line.`;
  }
  return `${reportsCount} verified reports from you have prevented threats from propagating across the organization. Your security posture is outstanding: a true front-line defender.`;
}

interface UnifiedBadge {
  id: string;
  label: string;
  sub: string;
  icon: string;
  color: string;
  achieved: boolean;
}

export default function ReportingBadgesWidget({ email, token, legacyBadges }: { email: string; token?: string; legacyBadges: string[] }) {
  const [data, setData] = useState<ReportsSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!email || !token) return;
    const authToken = token;
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(`/api/employee/${encodeURIComponent(email)}/reports-summary?token=${encodeURIComponent(authToken)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled) setError('Failed to load reporting achievements.');
        console.error('ReportingBadgesWidget fetch error:', err);
      }
    }

    load();
    const interval = setInterval(load, 10000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [email, token]);

  const badges: UnifiedBadge[] = useMemo(() => {
    const behavior: UnifiedBadge[] = LEGACY_BADGES.map(b => ({
      id: b.key,
      label: b.label,
      sub: b.sub,
      icon: b.icon,
      color: b.color,
      achieved: (legacyBadges || []).includes(b.key),
    }));

    const reportingSource = data?.badges || REPORTING_FALLBACK;
    const reporting: UnifiedBadge[] = reportingSource.map(b => {
      const rank = REPORTING_RANKS[b.id] || { icon: 'chevron-1', color: 'var(--accent)', sub: `${b.threshold} reports` };
      return {
        id: b.id,
        label: b.label,
        sub: rank.sub,
        icon: rank.icon,
        color: rank.color,
        achieved: b.achieved,
      };
    });

    return [...behavior, ...reporting];
  }, [data, legacyBadges]);

  const achievedCount = badges.filter(b => b.achieved).length;

  return (
    <div className="panel glass-card font-body">
      <div className="panel-header">
        <h2 className="panel-title font-heading" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Shield size={18} /> Security Achievements
        </h2>
        <span className="panel-count font-mono-data">{achievedCount} / {badges.length}</span>
      </div>

      {/* ── Impact statement ── */}
      <div style={{
        marginTop: '16px',
        marginBottom: '20px',
        padding: '14px 16px',
        background: 'rgba(59, 130, 246, 0.05)',
        border: '1px solid rgba(59, 130, 246, 0.15)',
        borderRadius: '10px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '10px',
      }}>
        <ShieldAlert size={18} style={{ color: 'var(--success)', flexShrink: 0, marginTop: '1px' }} />
        <p style={{ fontSize: '13px', lineHeight: 1.5, color: 'var(--text-primary)', margin: 0 }}>
          {data ? impactStatement(data.reports_count_malicious) : 'Loading threat prevention impact...'}
        </p>
      </div>

      {/* ── Stats row ── */}
      {data && (
        <div style={{ display: 'flex', gap: '24px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Trophy size={16} style={{ color: 'var(--accent)' }} />
            <span style={{ fontSize: '13px' }}><strong className="font-mono-data">{data.reports_count_malicious}</strong> verified reports</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Flame size={16} style={{ color: 'var(--warning)' }} />
            <span style={{ fontSize: '13px' }}><strong className="font-mono-data">{data.daily_streak}</strong> day streak</span>
          </div>
        </div>
      )}

      {/* ── Badge Grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '16px', textAlign: 'center' }}>
        {badges.map(badge => (
          <div key={badge.id} style={{
            padding: '16px 12px',
            background: badge.achieved ? 'rgba(255,255,255,0.04)' : 'rgba(11, 17, 32, 0.15)',
            border: '1px solid',
            borderColor: badge.achieved ? badge.color : 'rgba(255,255,255,0.05)',
            borderRadius: '12px',
            opacity: badge.achieved ? 1 : 0.4,
            transition: 'all 0.3s ease',
          }} title={badge.sub}>
            <div style={{
              width: '40px', height: '40px', margin: '0 auto 8px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: badge.achieved ? badge.color : 'var(--text-muted)',
            }}>
              <BadgeIcon icon={badge.icon} />
            </div>
            <div style={{ fontSize: '11px', fontWeight: 600, color: badge.achieved ? 'var(--text-primary)' : 'var(--text-muted)' }}>{badge.label}</div>
            <div style={{ fontSize: '9px', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: '1.2' }}>{badge.sub}</div>
          </div>
        ))}
      </div>

      {data?.next_badge && (
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', textAlign: 'center', marginTop: '18px' }}>
          Need <strong className="font-mono-data">{data.next_badge.remaining}</strong> more reports to unlock <strong>{data.next_badge.id.replace(/_/g, ' ')}</strong>
        </div>
      )}

      {error && <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '12px' }}>{error}</p>}
    </div>
  );
}
