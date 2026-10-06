'use client';

import React from 'react';
import { RefreshCw } from 'lucide-react';
import type { Stats, Incident, ThreatCacheEntry, AISummary, BehaviorScore, ComplianceSummary } from '@/components/admin/types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { TremorDonutCard } from '@/components/admin/TremorDonutCard';
import KpiCard from '@/components/ui/KpiCard';
import SeverityBadge from '@/components/ui/SeverityBadge';
import { useI18n } from '@/i18n/I18nProvider';
import { useNow } from '@/hooks/useNow';
import { formatAgo } from '@/lib/relativeTime';

interface OverviewSectionProps {
  readOnly: boolean;
  stats: Stats | undefined;
  incidents: Incident[];
  summaries: AISummary[];
  scores: BehaviorScore[];
  cache: ThreatCacheEntry[];
  complianceData: ComplianceSummary | null;
  incidentUpdated: boolean;
  cacheUpdated: boolean;
  summaryUpdated: boolean;
  behaviorUpdated: boolean;
  onSelectIncident?: (inc: Incident) => void;
  onRefreshSummary?: () => void;
}

const nameOf = (u: BehaviorScore, fallback: string) =>
  u.userName || (u.email ? u.email.split('@')[0].replace(/\./g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : fallback);

export default function OverviewSection({ stats, incidents, summaries, scores, cache, onRefreshSummary }: OverviewSectionProps) {
  const { t, lang } = useI18n();
  const now = useNow();

  const divisionTotals = scores.reduce<Record<string, { total: number; count: number }>>((acc, user) => {
    (acc[user.division] ||= { total: 0, count: 0 });
    acc[user.division].total += user.score;
    acc[user.division].count += 1;
    return acc;
  }, {});
  const divisionData = Object.entries(divisionTotals)
    .map(([name, d]) => ({ name, score: Math.min(100, Math.round(d.total / d.count)) }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

  const severity = { critical: 0, high: 0, medium: 0, low: 0 };
  incidents.forEach(inc => { const key = (inc.severity || '').toLowerCase() as keyof typeof severity; if (key in severity) severity[key] += 1; });
  const donut = [
    { name: t('ov.sev.critical'), value: severity.critical, color: 'var(--sev-critical)' },
    { name: t('ov.sev.high'), value: severity.high, color: 'var(--sev-high)' },
    { name: t('ov.sev.medium'), value: severity.medium, color: 'var(--sev-medium)' },
    { name: t('ov.sev.low'), value: severity.low, color: 'var(--sev-ok)' },
  ];

  const total = stats?.totalIncidents ?? incidents.length;
  const open = stats?.openIncidents ?? incidents.filter(i => i.status !== 'resolved').length;
  const resolved = Math.max(0, total - open);
  const critical = stats?.criticalIncidents ?? severity.critical;
  const avg = stats?.avgBehaviorScore ?? (scores.length > 0 ? Math.round(scores.reduce((sum, s) => sum + s.score, 0) / scores.length) : 0);
  const posture = avg >= 80 ? t('ov.posture.good') : avg >= 50 ? t('ov.posture.moderate') : t('ov.posture.high');
  const blocked = stats?.blockedUrls ?? cache.length;

  const best = [...scores].sort((a, b) => b.score - a.score || b.totalPoints - a.totalPoints).slice(0, 3);
  const worst = [...scores].sort((a, b) => a.score - b.score || a.totalPoints - b.totalPoints).slice(0, 3);
  const good = scores.filter(s => s.score >= 80).length;
  const moderate = scores.filter(s => s.score >= 50 && s.score < 80).length;
  const atRisk = scores.filter(s => s.score < 50).length;

  const person = (u: BehaviorScore, i: number, detail: React.ReactNode) => (
    <li key={u.userId || i}>
      <div className="emp-list-main person-mini">
        <span>{nameOf(u, t('ov.people.employee'))}<small>{u.division}</small></span>
        <span>{t('ov.people.pts', { n: u.score })}</span>
      </div>
      {detail}
    </li>
  );

  return (
    <div className="exec">
      <div className="exec-kpis">
        <KpiCard label={t('ov.kpi.total')} value={total} trend={{ direction: 'flat', text: t('ov.kpi.total.trend', { n: critical }) }} />
        <KpiCard label={t('ov.kpi.open')} value={open} trend={{ direction: 'flat', text: t('ov.kpi.open.trend', { n: resolved }) }} />
        <KpiCard label={t('ov.kpi.blocked')} value={blocked} trend={{ direction: 'flat', text: t('ov.kpi.blocked.trend', { n: blocked }) }} />
        <KpiCard label={t('ov.kpi.score')} value={avg || 0} unit="/100" trend={{ direction: 'flat', text: posture }} />
      </div>

      <div className="exec-grid">
        <section className="exec-card" aria-labelledby="ov-div">
          <div><h3 id="ov-div">{t('ov.div.title')}</h3><p className="emp-muted">{t('ov.div.desc')}</p></div>
          <div style={{ height: Math.max(180, divisionData.length * 34 + 40) }}>
            {divisionData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart layout="vertical" data={divisionData} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} stroke="var(--text-secondary)" fontSize={12} />
                  <YAxis type="category" dataKey="name" stroke="var(--text-secondary)" fontSize={12} width={110} />
                  <Tooltip cursor={false} itemStyle={{ color: 'var(--text-primary)' }} labelStyle={{ color: 'var(--text-secondary)' }} contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)' }} formatter={value => [value, t('ov.div.series')]} />
                  <Bar dataKey="score" radius={[0, 4, 4, 0]} barSize={16} isAnimationActive={false}>
                    {divisionData.map(entry => <Cell key={entry.name} fill={entry.score >= 80 ? 'var(--sev-ok)' : entry.score >= 50 ? 'var(--sev-medium)' : 'var(--sev-critical)'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="emp-muted">{t('ov.div.empty')}</p>}
          </div>
        </section>
        <TremorDonutCard title={t('ov.sev.title')} description={t('ov.sev.desc')} data={donut} totalLabel={t('ov.sev.total')} />
      </div>

      <div className="exec-grid">
        <section className="exec-card" aria-labelledby="ov-risk">
          <div className="ops-head">
            <h3 id="ov-risk">{t('ov.risk.title')}</h3>
            {onRefreshSummary && <button type="button" className="btn" onClick={onRefreshSummary}><RefreshCw size={14} aria-hidden="true" /> {t('ov.risk.refresh')}</button>}
          </div>
          {summaries.length > 0 ? (
            <ul className="emp-list">
              {summaries.slice(0, 3).map(s => (
                <li key={s.id}>
                  <div className="emp-list-main">
                    <SeverityBadge value={s.threatLevel} />
                    <strong style={{ display: 'block', marginTop: 4 }}>{s.title}</strong>
                    <details>
                      <summary style={{ cursor: 'pointer', minHeight: 32, display: 'flex', alignItems: 'center', color: 'var(--accent-strong)' }}>{t('ov.risk.more')}</summary>
                      <p>{s.summary}</p>
                      {s.recommendations.length > 0 && <><strong>{t('ov.risk.recs')}</strong><ul style={{ paddingLeft: 18 }}>{s.recommendations.map((r, i) => <li key={i}>{r}</li>)}</ul></>}
                    </details>
                  </div>
                  <span className="emp-list-time">{formatAgo(s.timestamp, lang, now)}</span>
                </li>
              ))}
            </ul>
          ) : <p className="emp-muted">{t('ov.risk.empty')}</p>}
        </section>

        <section className="exec-card" aria-labelledby="ov-people">
          <div className="ops-head"><h3 id="ov-people">{t('ov.people.title')}</h3><span className="emp-muted">{t('ov.people.count', { n: scores.length })}</span></div>
          <div className="strip" role="group" aria-label={t('ov.people.title')}>
            <span className="strip-static"><b>{good}</b> {t('ov.people.good')}</span>
            <span className="strip-static"><b>{moderate}</b> {t('ov.people.moderate')}</span>
            <span className="strip-static"><b>{atRisk}</b> {t('ov.people.atrisk')}</span>
          </div>
          <h4 style={{ fontSize: 14, fontWeight: 600 }}>{t('ov.people.top')}</h4>
          {best.length ? <ul className="emp-list">{best.map((u, i) => person(u, i, <span className="emp-list-time">{t('ov.people.weeks', { n: u.streak || 0 })}</span>))}</ul> : <p className="emp-muted">{t('ov.people.top.empty')}</p>}
          <h4 style={{ fontSize: 14, fontWeight: 600 }}>{t('ov.people.low')}</h4>
          {worst.length ? <ul className="emp-list">{worst.map((u, i) => person(u, i, <span className="emp-list-time">{u.risk || ''}</span>))}</ul> : <p className="emp-muted">{t('ov.people.low.empty')}</p>}
          <p className="inline-note">{t('ov.note')}</p>
        </section>
      </div>
    </div>
  );
}
