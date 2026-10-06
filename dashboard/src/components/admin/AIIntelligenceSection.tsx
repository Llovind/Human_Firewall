'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Check, Copy, Download, FileText, RefreshCw } from 'lucide-react';
import { exportExecutivePdf } from '@/lib/ExecutivePdfExporter';
import DataTable, { type Column } from '@/components/ui/DataTable';
import Dialog from '@/components/ui/Dialog';
import FilterBar from '@/components/ui/FilterBar';
import KpiCard from '@/components/ui/KpiCard';
import SeverityBadge, { type SeverityLevel } from '@/components/ui/SeverityBadge';
import StateMessage from '@/components/ui/StateMessage';
import { useI18n } from '@/i18n/I18nProvider';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import type { MessageKey } from '@/i18n/messages';

export interface AIIntelligenceSectionProps {
  role?: 'soc' | 'ciso' | 'grc' | 'phishing_admin';
  markdownReport?: string;
  isLoading?: boolean;
  onRefresh?: () => void;
  onExportPdf?: () => void;
  isPdfLoading?: boolean;
  readOnly?: boolean;
}

type Level = 'SAFE' | 'VULNERABLE' | 'DANGER';

interface UserClassification {
  email: string; divisi: string; risk_level: Level; risk_score: number;
  primary_risk: string; one_line_assessment: string; education_tip: string;
}
interface OrgRiskSummary {
  safe_count: number; vulnerable_count: number; danger_count: number;
  most_at_risk_division: string; overall_assessment: string;
}
interface UserDeepDive {
  email: string; risk_level: Level; risk_score: number; vulnerable_to: string[];
  risk_factors: string[]; positive_factors: string[]; education_message: string;
  recommendations: string[]; priority_action: string; trend_assessment: string;
}
interface HeatmapData {
  classifications: UserClassification[]; org_risk_summary?: OrgRiskSummary; _warning?: string; _source?: string;
}

const SEVERITY: Record<Level, SeverityLevel> = { DANGER: 'high', VULNERABLE: 'medium', SAFE: 'low' };
const RANK: Record<Level, number> = { DANGER: 0, VULNERABLE: 1, SAFE: 2 };

/** Throws a short code; the component turns it into a sentence in the current language. */
async function loadHeatmap(role: string, refresh = false, signal?: AbortSignal): Promise<HeatmapData> {
  const res = await fetch(`/api/ai/classify?role=${role}${refresh ? '&refresh=true' : ''}`, { signal });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error('heatmap');
  if (!Array.isArray(data.classifications)) throw new Error('format');
  return data;
}

function MarkdownReport({ content }: { content: string }) {
  const lines = content.split('\n');
  const out: React.ReactNode[] = [];
  let table: string[] = [];
  const cells = (row: string) => row.split('|').map(c => c.trim()).filter(Boolean);
  const flush = (key: number) => {
    if (table.length >= 2) {
      const head = cells(table[0]);
      const rows = table.slice(2).map(cells);
      out.push(
        <div className="table-wrap" key={`t${key}`}>
          <table className="data-table">
            <thead><tr>{head.map((h, i) => <th key={i} scope="col">{h}</th>)}</tr></thead>
            <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
          </table>
        </div>,
      );
    }
    table = [];
  };
  lines.forEach((line, i) => {
    if (line.trim().startsWith('|')) { table.push(line); return; }
    if (table.length) flush(i);
    if (line.startsWith('# ')) out.push(<h1 key={i}>{line.slice(2)}</h1>);
    else if (line.startsWith('## ')) out.push(<h2 key={i}>{line.slice(3)}</h2>);
    else if (line.startsWith('### ')) out.push(<h3 key={i}>{line.slice(4)}</h3>);
    else if (line.startsWith('- ') || line.startsWith('* ')) out.push(<div className="md-li" key={i}><span aria-hidden="true">•</span><span>{line.slice(2)}</span></div>);
    else if (line.trim()) out.push(<p key={i}>{line}</p>);
  });
  if (table.length) flush(lines.length);
  return <div className="md-report">{out}</div>;
}

export const AIIntelligenceSection: React.FC<AIIntelligenceSectionProps> = ({ role = 'soc', markdownReport = '', isLoading = false, onExportPdf, isPdfLoading = false }) => {
  const { t } = useI18n();
  const wide = useMediaQuery('(min-width: 1100px)');
  const [tab, setTab] = useState<'heatmap' | 'report'>('heatmap');
  const [classifications, setClassifications] = useState<UserClassification[]>([]);
  const [org, setOrg] = useState<OrgRiskSummary | null>(null);
  const [heatmapLoading, setHeatmapLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [division, setDivision] = useState('ALL');
  const [level, setLevel] = useState('ALL');
  const [selected, setSelected] = useState<string | null>(null);
  const [deepDive, setDeepDive] = useState<UserDeepDive | null>(null);
  const [deepLoading, setDeepLoading] = useState(false);
  const deepRequest = useRef(0);
  const [report, setReport] = useState('');
  const [reportLoading, setReportLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [source, setSource] = useState('');
  const [pdfBusy, setPdfBusy] = useState(false);

  const activeReport = markdownReport || report;
  const reportBusy = isLoading || reportLoading;

  const describe = useCallback((err: unknown, fallback: MessageKey) => (err instanceof Error && err.message === 'format' ? t('ai.err.format') : t(fallback)), [t]);

  const apply = useCallback((data: HeatmapData) => {
    setClassifications(data.classifications);
    setSource(data._warning || (data._source === 'llm' ? 'llm' : 'baseline'));
    setOrg(data.org_risk_summary || null);
  }, []);

  const refresh = async () => {
    setHeatmapLoading(true); setError('');
    try { apply(await loadHeatmap(role, true)); } catch (err) { setError(describe(err, 'ai.err.heatmap')); } finally { setHeatmapLoading(false); }
  };

  useEffect(() => {
    const controller = new AbortController();
    loadHeatmap(role, false, controller.signal)
      .then(data => { if (!controller.signal.aborted) apply(data); })
      .catch(err => { if (!controller.signal.aborted) setError(describe(err, 'ai.err.heatmap')); })
      .finally(() => { if (!controller.signal.aborted) setHeatmapLoading(false); });
    return () => controller.abort();
  }, [role, apply, describe]);

  const selectUser = async (email: string) => {
    const id = ++deepRequest.current;
    setSelected(email); setDeepLoading(true); setDeepDive(null); setError('');
    try {
      const res = await fetch(`/api/ai/user/${encodeURIComponent(email)}?days=30`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error('user');
      if (id === deepRequest.current) setDeepDive(data);
    } catch (err) {
      if (id === deepRequest.current) setError(describe(err, 'ai.err.user'));
    } finally {
      if (id === deepRequest.current) setDeepLoading(false);
    }
  };

  const fetchReport = async (force = false) => {
    setReportLoading(true); setError('');
    try {
      const res = await fetch(`/api/ai/report?days=7${force ? '&refresh=true' : ''}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error('report');
      if (data.markdown_report) setReport(data.markdown_report);
    } catch (err) { setError(describe(err, 'ai.err.report')); } finally { setReportLoading(false); }
  };

  const copy = async () => {
    if (!activeReport) return;
    try { await navigator.clipboard.writeText(activeReport); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard blocked: nothing to do */ }
  };

  const download = () => {
    if (!activeReport) return;
    const url = URL.createObjectURL(new Blob([activeReport], { type: 'text/markdown;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `AFFERENT_${role.toUpperCase()}_Executive_Report_${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportPdf = async () => {
    if (onExportPdf) { onExportPdf(); return; }
    if (!activeReport) return;
    setPdfBusy(true);
    try { await exportExecutivePdf(role, activeReport); } catch { setError(t('ai.err.pdf')); } finally { setPdfBusy(false); }
  };

  const divisions = Array.from(new Set(classifications.map(c => c.divisi).filter(Boolean)));
  const text = query.toLowerCase();
  const users = classifications
    .filter(u => (u.email.toLowerCase().includes(text) || u.divisi.toLowerCase().includes(text) || u.one_line_assessment.toLowerCase().includes(text)) && (division === 'ALL' || u.divisi === division) && (level === 'ALL' || u.risk_level === level))
    .sort((a, b) => (RANK[a.risk_level] ?? 1) - (RANK[b.risk_level] ?? 1) || b.risk_score - a.risk_score);
  const active = classifications.find(u => u.email === selected);

  const levelBadge = (value: Level) => <SeverityBadge level={SEVERITY[value] ?? 'unknown'} label={t(`ai.level.${value}` as MessageKey)} />;
  const sourceText = source === 'llm' ? t('ai.source.llm') : source === 'baseline' ? t('ai.source.baseline') : source || (heatmapLoading ? t('ai.source.loading') : t('ai.source.default'));

  const columns: Column<UserClassification>[] = [
    { key: 'email', header: t('ai.col.person'), render: u => <span className="cell-clip" title={u.email}>{u.email}</span> },
    { key: 'division', header: t('ai.col.division'), secondary: true, sortValue: u => u.divisi, render: u => u.divisi || t('ai.general') },
    { key: 'level', header: t('ai.col.level'), render: u => levelBadge(u.risk_level) },
    { key: 'score', header: t('ai.col.score'), align: 'right', sortValue: u => u.risk_score, render: u => u.risk_score },
  ];

  const detail = active && (
    <div className="ai-detail">
      <div>
        <h3 style={{ fontSize: 16, fontWeight: 600, overflowWrap: 'anywhere' }}>{active.email}</h3>
        <p className="emp-muted">{t('ai.detail.division', { division: active.divisi || t('ai.general') })}</p>
      </div>
      <div className="incident-detail-head">{levelBadge(active.risk_level)}<span>{t('ai.detail.score')}: <b>{active.risk_score}</b> / 100</span></div>
      <div className="ai-meter" aria-hidden="true"><i style={{ width: `${Math.max(0, Math.min(100, active.risk_score))}%` }} /></div>
      <div className="ai-callout"><strong>{t('ai.detail.assessment')}</strong>{active.one_line_assessment}</div>
      {deepLoading ? <StateMessage variant="loading" compact title={t('ai.detail.loading')} />
        : deepDive ? (
          <>
            {deepDive.priority_action && <div className="ai-callout"><strong>{t('ai.detail.priority')}</strong>{deepDive.priority_action}</div>}
            {deepDive.education_message && <div className="ai-callout"><strong>{t('ai.detail.education')}</strong>{deepDive.education_message}</div>}
            <div className="ai-two">
              <div><h4>{t('ai.detail.risks')}</h4>{deepDive.risk_factors?.length ? <ul>{deepDive.risk_factors.map((f, i) => <li key={i}>{f}</li>)}</ul> : <p className="emp-muted">{t('ai.detail.risks.none')}</p>}</div>
              <div><h4>{t('ai.detail.positives')}</h4>{deepDive.positive_factors?.length ? <ul>{deepDive.positive_factors.map((f, i) => <li key={i}>{f}</li>)}</ul> : <p className="emp-muted">{t('ai.detail.positives.none')}</p>}</div>
            </div>
            {deepDive.recommendations?.length > 0 && <div><h4>{t('ai.detail.recs')}</h4><ul>{deepDive.recommendations.map((r, i) => <li key={i}>{r}</li>)}</ul></div>}
          </>
        ) : <p className="emp-muted">{t('ai.detail.pending')}</p>}
    </div>
  );

  return (
    <div className="ops-page">
      <div className="ops-intro">
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 600 }}>{t('ai.title')}</h3>
          <p className="emp-muted">{sourceText}</p>
        </div>
        <div className="seg" role="group" aria-label={t('ai.tab.label')}>
          <button type="button" aria-pressed={tab === 'heatmap'} onClick={() => setTab('heatmap')}>{t('ai.tab.heatmap')}</button>
          <button type="button" aria-pressed={tab === 'report'} onClick={() => { setTab('report'); if (!markdownReport && !report && !reportBusy) void fetchReport(); }}><FileText size={14} aria-hidden="true" />{t('ai.tab.report')}</button>
        </div>
      </div>

      {error && <StateMessage variant="error" compact title={error} why=" " action={{ label: t('ai.err.retry'), onClick: () => { setError(''); if (tab === 'heatmap') void refresh(); else void fetchReport(true); } }} />}

      {tab === 'heatmap' && (
        <>
          {org && (
            <div className="exec-kpis">
              <KpiCard label={t('ai.sum.safe')} value={org.safe_count} />
              <KpiCard label={t('ai.sum.attention')} value={org.vulnerable_count} />
              <KpiCard label={t('ai.sum.high')} value={org.danger_count} />
              <KpiCard label={t('ai.sum.division')} value={<span style={{ fontSize: 18 }}>{org.most_at_risk_division || '—'}</span>} />
            </div>
          )}
          <FilterBar
            search={{ value: query, onChange: setQuery, placeholder: t('ai.search') }}
            selects={[
              { id: 'division', label: t('ai.filter.division'), value: division, onChange: setDivision, options: [{ value: 'ALL', label: t('ai.division.all') }, ...divisions.map(d => ({ value: d, label: d }))] },
              { id: 'level', label: t('ai.filter.level'), value: level, onChange: setLevel, options: [{ value: 'ALL', label: t('ai.level.all') }, ...(['DANGER', 'VULNERABLE', 'SAFE'] as Level[]).map(v => ({ value: v, label: t(`ai.level.${v}` as MessageKey) }))] },
            ]}
            activeCount={(query ? 1 : 0) + (division !== 'ALL' ? 1 : 0) + (level !== 'ALL' ? 1 : 0)}
            onClear={() => { setQuery(''); setDivision('ALL'); setLevel('ALL'); }}
          />
          <div className="ops-intro">
            <span className="emp-muted">{t('ai.count', { n: users.length })}</span>
            <button type="button" className="btn" onClick={refresh} disabled={heatmapLoading}><RefreshCw size={14} aria-hidden="true" /> {t('ai.refresh')}</button>
          </div>
          {heatmapLoading ? <StateMessage variant="loading" /> : (
            <div className="incident-split" data-wide={wide}>
              <DataTable caption={t('ai.title')} columns={columns} rows={users} rowKey={u => u.email} selectedKey={selected} onRowClick={u => void selectUser(u.email)} empty={<StateMessage variant="empty" title={t('ai.empty.title')} why={t('ai.empty.why')} />} />
              {wide
                ? <aside className="incident-panel" aria-live="polite">{detail ?? <StateMessage variant="empty" compact title={t('ai.select.title')} why={t('ai.select.why')} />}</aside>
                : <Dialog open={Boolean(active)} onClose={() => setSelected(null)} size="lg" title={active?.email ?? ''}>{detail}</Dialog>}
            </div>
          )}
        </>
      )}

      {tab === 'report' && (
        <section className="ops-block" aria-labelledby="ai-report">
          <div className="ops-intro">
            <div><h3 id="ai-report" style={{ fontSize: 16, fontWeight: 600 }}>{t('ai.report.title')}</h3><p className="emp-muted">{t('ai.report.desc')}</p></div>
            <span className="ops-actions" style={{ flexWrap: 'wrap' }}>
              <button type="button" className="btn" onClick={() => fetchReport(true)} disabled={reportBusy}><RefreshCw size={14} aria-hidden="true" /> {t('ai.report.regen')}</button>
              <button type="button" className="btn" onClick={copy} disabled={!activeReport}>{copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />} {copied ? t('ai.report.copied') : t('ai.report.copy')}</button>
              <button type="button" className="btn" onClick={download} disabled={!activeReport}><Download size={14} aria-hidden="true" /> {t('ai.report.download')}</button>
              <button type="button" className="btn btn-primary" onClick={() => void exportPdf()} disabled={isPdfLoading || pdfBusy || !activeReport}><FileText size={14} aria-hidden="true" /> {isPdfLoading || pdfBusy ? t('ai.report.pdf.busy') : t('ai.report.pdf')}</button>
            </span>
          </div>
          {reportBusy ? <StateMessage variant="loading" title={t('ai.report.loading')} />
            : !activeReport ? <StateMessage variant="empty" title={t('ai.report.empty.title')} why={t('ai.report.empty.why')} />
            : <MarkdownReport content={activeReport} />}
        </section>
      )}
    </div>
  );
};

export default AIIntelligenceSection;
