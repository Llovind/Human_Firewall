'use client';

import { useMemo } from 'react';
import KpiCard from '@/components/ui/KpiCard';
import SeverityBadge, { normalizeSeverity } from '@/components/ui/SeverityBadge';
import StateMessage from '@/components/ui/StateMessage';
import StatusChip from '@/components/ui/StatusChip';
import { useI18n } from '@/i18n/I18nProvider';
import { usePolling } from '@/hooks/usePolling';
import type { BehaviorScore, ComplianceSummary, GoPhishCampaign, Incident } from '@/components/admin/types';

const COMPLIANCE_GOAL = 80;
const DIVISION_WATCH = 50;

interface ExecutiveSummaryProps {
  incidents: Incident[];
  scores: BehaviorScore[];
  compliance: ComplianceSummary | null | undefined;
  campaigns: GoPhishCampaign[];
}

interface WeekPoint { week_start: string; avg_score: number; people: number; high_risk: number; open_incidents: number; reports: number; clicks: number }

/** Direction and size of the change across the window. "good" says whether a rise is welcome. */
function change(values: number[], goodWhenUp: boolean) {
  if (values.length < 2) return undefined;
  const delta = Math.round((values[values.length - 1] - values[0]) * 10) / 10;
  return { direction: delta > 0 ? 'up' as const : delta < 0 ? 'down' as const : 'flat' as const, delta: Math.abs(delta), good: delta === 0 ? undefined : (delta > 0) === goodWhenUp };
}

function Sparkline({ points, label }: { points: number[]; label: string }) {
  const W = 320, H = 72, pad = 6;
  const min = Math.min(...points), max = Math.max(...points), span = max - min || 1;
  const x = (i: number) => pad + (i * (W - pad * 2)) / Math.max(1, points.length - 1);
  const y = (v: number) => H - pad - ((v - min) / span) * (H - pad * 2);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} style={{ width: '100%', maxWidth: 420, height: 'auto' }}>
      <polyline points={points.map((v, i) => `${x(i)},${y(v)}`).join(' ')} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" />
      {points.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r={i === points.length - 1 ? 4 : 2.5} fill="var(--accent)" />)}
    </svg>
  );
}

const isHighRisk = (score: BehaviorScore) => ['high', 'critical'].includes((score.risk || '').toLowerCase());

/**
 * One screen for an executive: how bad is it, what needs attention, how ready are we.
 * Built only from data that exists today. Trends need history, which is not recorded yet.
 */
export default function ExecutiveSummary({ incidents, scores, compliance, campaigns }: ExecutiveSummaryProps) {
  const { t } = useI18n();
  const { data: trendData } = usePolling<{ weeks: WeekPoint[] }>('/api/admin/trends?weeks=8', 60000);
  const weeks = trendData?.weeks ?? [];
  const span = Math.max(0, weeks.length - 1);
  const trendOf = (values: number[], goodWhenUp: boolean) => {
    const c = change(values, goodWhenUp);
    return c ? { direction: c.direction, good: c.good, text: t(`exec.trend.${c.direction}` as 'exec.trend.up', { n: c.delta, weeks: span }) } : undefined;
  };

  const data = useMemo(() => {
    const open = incidents.filter(i => i.status !== 'closed');
    const urgent = open.filter(i => ['critical', 'high'].includes(normalizeSeverity(i.severity)));
    const avg = scores.length ? Math.round(scores.reduce((sum, s) => sum + s.score, 0) / scores.length) : null;
    const atRisk = scores.filter(isHighRisk).length;
    const byDivision = Object.entries(scores.reduce((acc, s) => { (acc[s.division] ||= []).push(s); return acc; }, {} as Record<string, BehaviorScore[]>))
      .map(([division, list]) => ({ division, score: Math.round(list.reduce((sum, s) => sum + s.score, 0) / list.length), atRisk: list.filter(isHighRisk).length }))
      .filter(d => d.score < DIVISION_WATCH).sort((a, b) => a.score - b.score);
    const withStats = campaigns.filter(c => c.stats && c.stats.sent > 0);
    const sent = withStats.reduce((sum, c) => sum + (c.stats?.sent ?? 0), 0);
    const clicked = withStats.reduce((sum, c) => sum + (c.stats?.clicked ?? 0), 0);
    return { open, urgent, avg, atRisk, byDivision, clickRate: sent ? Math.round((clicked / sent) * 100) : null, campaignCount: withStats.length };
  }, [incidents, scores, campaigns]);

  const posture = data.avg === null ? null : data.avg >= 80 ? 'low' : data.avg >= 50 ? 'moderate' : 'high';
  const tone = posture === 'low' ? 'ok' : posture === 'moderate' ? 'warn' : 'bad';
  // Zero with no division data means nothing is configured yet, not that nothing is met.
  const hasCompliance = Boolean(compliance) && ((compliance?.divisi_risk_map?.length ?? 0) > 0 || (compliance?.compliance_pct ?? 0) > 0);
  const compliancePct = hasCompliance && compliance ? Math.round(compliance.compliance_pct) : null;

  const attention: { key: string; node: React.ReactNode }[] = [
    ...data.urgent.slice(0, 3).map(i => ({ key: `inc-${i.id}`, node: <><SeverityBadge value={i.severity} /><span className="exec-attn-text"><strong className="mono">{i.id}</strong> {i.target}<small>{i.source}</small></span></> })),
    ...data.byDivision.slice(0, 3).map(d => ({ key: `div-${d.division}`, node: <><StatusChip tone="warn">{d.division}</StatusChip><span className="exec-attn-text">{t('exec.attention.division', { division: d.division, score: d.score, n: d.atRisk })}</span></> })),
    ...(compliancePct !== null && compliancePct < COMPLIANCE_GOAL ? [{ key: 'compliance', node: <><StatusChip tone="warn">{t('exec.compliance')}</StatusChip><span className="exec-attn-text">{t('exec.attention.compliance', { pct: compliancePct, target: COMPLIANCE_GOAL })}</span></> }] : []),
  ];

  return (
    <section className="exec" aria-labelledby="exec-title">
      <div className="exec-headline">
        <h2 id="exec-title" className="visually-hidden">{t('exec.title')}</h2>
        {posture
          ? <p><StatusChip tone={tone}>{t(`exec.posture.${posture}` as 'exec.posture.low')}</StatusChip> {t('exec.headline', { posture: t(`exec.posture.${posture}` as 'exec.posture.low'), score: data.avg ?? 0, atRisk: data.atRisk, total: scores.length, open: data.open.length, critical: data.open.filter(i => normalizeSeverity(i.severity) === 'critical').length })}</p>
          : <p className="emp-muted">{t('exec.headline.noData')}</p>}
      </div>

      <div className="exec-kpis">
        <KpiCard label={t('exec.kpi.score')} value={data.avg ?? '—'} unit="/ 100" hint={t('exec.kpi.score.hint')} trend={trendOf(weeks.map(w => w.avg_score), true)} />
        <KpiCard label={t('exec.kpi.incidents')} value={data.open.length} hint={t('exec.kpi.incidents.hint', { n: data.urgent.length })} trend={trendOf(weeks.map(w => w.open_incidents), false)} />
        <KpiCard label={t('exec.kpi.people')} value={data.atRisk} hint={t('exec.kpi.people.hint', { total: scores.length })} trend={trendOf(weeks.map(w => w.high_risk), false)} />
        <KpiCard label={t('exec.kpi.clicks')} value={data.clickRate === null ? '—' : data.clickRate} unit={data.clickRate === null ? undefined : '%'} hint={data.clickRate === null ? t('exec.kpi.clicks.none') : t('exec.kpi.clicks.hint', { n: data.campaignCount })} />
      </div>

      <div className="exec-grid">
        <div className="exec-card">
          <h3>{t('exec.attention')}</h3>
          {attention.length === 0
            ? <StateMessage variant="empty" title={t('exec.attention.empty')} compact />
            : <ul className="exec-attention">{attention.map(item => <li key={item.key}>{item.node}</li>)}</ul>}
        </div>
        <div className="exec-card">
          <h3>{t('exec.compliance')}</h3>
          {compliancePct === null
            ? <p className="emp-muted">—</p>
            : <>
                <p className="exec-pct"><b>{compliancePct}</b>%</p>
                <div className="exec-bar" role="img" aria-label={`${compliancePct}%`}><i style={{ width: `${Math.min(100, Math.max(0, compliancePct))}%` }} /><span style={{ left: `${COMPLIANCE_GOAL}%` }} aria-hidden="true" /></div>
                <p className="emp-muted">{t('exec.compliance.hint')}</p>
              </>}
        </div>
      </div>
      {weeks.length >= 2
        ? (
          <div className="exec-card">
            <h3>{t('exec.trend.title')}</h3>
            <Sparkline points={weeks.map(w => w.avg_score)} label={t('exec.trend.chart', { from: weeks[0].week_start, to: weeks[weeks.length - 1].week_start, values: weeks.map(w => w.avg_score).join(', ') })} />
            <p className="emp-muted">{weeks[0].week_start} → {weeks[weeks.length - 1].week_start}</p>
          </div>
        )
        : <p className="emp-muted">{t('exec.trend.collecting')}</p>}
    </section>
  );
}
