'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Info, Lock, RefreshCw } from 'lucide-react';
import DataTable, { type Column } from '@/components/ui/DataTable';
import StateMessage from '@/components/ui/StateMessage';
import StatusChip, { type StatusTone } from '@/components/ui/StatusChip';
import { useToast } from '@/components/ui/Toast';
import { useI18n } from '@/i18n/I18nProvider';
import type { MessageKey } from '@/i18n/messages';

export interface ClauseEvidence {
  label: string;
  formula: string;
  components: Record<string, number>;
}

export interface ReadinessClause {
  clause_id: string;
  clause_number: string;
  clause_title: string;
  current_value: number | null;
  target_value: number | null;
  unit: string;
  is_legally_mandated: boolean;
  readiness_tier: 'Strong Readiness' | 'Partial Readiness' | 'Needs Attention' | 'Not Configured';
  rationale: string;
  evidence?: ClauseEvidence;
}

export interface ReadinessSummaryResponse {
  disclaimer: string;
  overall_readiness_indicator: 'Strong Readiness' | 'Partial Readiness' | 'Needs Attention' | 'Not Configured';
  clause_readiness: ReadinessClause[];
  total_users: number;
  total_reports: number;
  total_clicks: number;
  mean_time_to_close_hours: number | null;
}

export interface ThresholdItem {
  clause_id: string;
  clause_number: string;
  clause_title: string;
  target_value: number | null;
  unit: string;
  is_legally_mandated: boolean;
  rationale: string;
}

export interface ComplianceReadinessSectionProps {
  readOnly?: boolean;
}

const TIER_TONE: Record<string, StatusTone> = { 'Strong Readiness': 'ok', 'Partial Readiness': 'warn', 'Needs Attention': 'bad', 'Not Configured': 'neutral' };

export const ComplianceReadinessSection: React.FC<ComplianceReadinessSectionProps> = ({ readOnly = false }) => {
  const { t } = useI18n();
  const toast = useToast();
  const [data, setData] = useState<ReadinessSummaryResponse | null>(null);
  const [thresholds, setThresholds] = useState<ThresholdItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [editingValues, setEditingValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const tierLabel = (tier: string) => (tier in TIER_TONE ? t(`cmp.tier.${tier}` as MessageKey) : tier);

  const load = useCallback(async () => {
    try {
      const [resSummary, resThresholds] = await Promise.all([fetch('/api/admin/compliance-summary'), fetch('/api/admin/readiness-thresholds')]);
      if (resSummary.ok) { setData(await resSummary.json()); setFetchError(null); }
      else setFetchError('summary');
      if (resThresholds.ok) {
        const list: ThresholdItem[] = await resThresholds.json();
        setThresholds(list);
        setEditingValues(Object.fromEntries(list.map(item => [item.clause_id, item.target_value !== null ? String(item.target_value) : ''])));
      }
    } catch {
      setFetchError('network');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initializes server-owned readiness data, not derived render state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const save = async (clauseId: string) => {
    const raw = editingValues[clauseId];
    setSaving(clauseId);
    try {
      const res = await fetch('/api/admin/readiness-thresholds', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clause_id: clauseId, target_value: raw === '' || raw == null ? null : parseFloat(raw) }) });
      if (res.ok) { toast.show({ message: t('cmp.saved'), tone: 'ok' }); void load(); }
      else {
        const body = await res.json().catch(() => ({}));
        toast.show({ message: t('cmp.save.err', { detail: body.detail || body.error || res.status }), tone: 'bad' });
      }
    } catch {
      toast.show({ message: t('cmp.err.network'), tone: 'bad' });
    } finally {
      setSaving(null);
    }
  };

  const clauseCard = (c: ReadinessClause) => {
    const notConfigured = c.readiness_tier === 'Not Configured' || c.target_value === null;
    return (
      <article key={c.clause_id} className="clause">
        <div className="clause-top">
          <span className="clause-no">{c.clause_number}</span>
          <StatusChip tone={TIER_TONE[c.readiness_tier] ?? 'neutral'}>{tierLabel(c.readiness_tier)}</StatusChip>
        </div>
        <h4>{c.clause_title}</h4>
        {notConfigured ? (
          <p className="inline-note"><Info size={16} aria-hidden="true" />{t('cmp.notset')}</p>
        ) : (
          <dl>
            <div><dt>{t('cmp.current')}</dt><dd>{c.current_value !== null ? `${c.current_value} ${c.unit}` : t('cmp.na')}</dd></div>
            <div><dt>{t('cmp.target')}</dt><dd>{c.target_value !== null ? `${c.target_value} ${c.unit}` : t('cmp.unset')}</dd></div>
          </dl>
        )}
        {c.evidence && (
          <details>
            <summary>{t('cmp.evidence')}</summary>
            <p><strong>{c.evidence.label}</strong></p>
            <p className="emp-muted">{t('cmp.formula', { formula: c.evidence.formula })}</p>
            <dl>{Object.entries(c.evidence.components).map(([k, v]) => <div key={k}><dt>{k.replace(/_/g, ' ')}</dt><dd>{v}</dd></div>)}</dl>
          </details>
        )}
        <p className="clause-source"><strong>{t('cmp.rationale')}</strong> {c.rationale}</p>
      </article>
    );
  };

  const all = data?.clause_readiness || [];
  const legal = all.filter(c => c.clause_id.startsWith('UU_PDP') || c.clause_number.includes('UU PDP') || c.is_legally_mandated);
  const framework = all.filter(c => !legal.some(l => l.clause_id === c.clause_id));

  const columns: Column<ThresholdItem>[] = [
    { key: 'clause', header: t('cmp.col.clause'), render: item => <><span className="clause-no">{item.clause_number}</span> <span className="cell-clip" title={item.clause_title}>{item.clause_title}</span></> },
    { key: 'type', header: t('cmp.col.type'), secondary: true, render: item => item.is_legally_mandated ? <StatusChip tone="neutral"><Lock size={12} aria-hidden="true" /> {t('cmp.type.law')}</StatusChip> : t('cmp.type.edit') },
    { key: 'target', header: t('cmp.col.target'), render: item => item.is_legally_mandated
      ? t('cmp.locked', { value: item.target_value ?? '', unit: item.unit })
      : <><input className="num-input" type="number" inputMode="decimal" aria-label={t('cmp.input', { clause: item.clause_number })} value={editingValues[item.clause_id] ?? ''} onChange={e => setEditingValues({ ...editingValues, [item.clause_id]: e.target.value })} /> <span className="emp-muted">{item.unit}</span></> },
    { key: 'why', header: t('cmp.col.rationale'), secondary: true, render: item => <span className="cell-clip" title={item.rationale}>{item.rationale}</span> },
    { key: 'actions', header: t('cmp.col.actions'), align: 'right', render: item => item.is_legally_mandated ? null : <button type="button" className="btn" disabled={saving === item.clause_id} onClick={() => save(item.clause_id)}>{saving === item.clause_id ? t('cmp.saving') : t('cmp.save')}</button> },
  ];

  if (isLoading) return <StateMessage variant="loading" />;

  return (
    <div className="ops-page">
      <p className="inline-note"><Info size={16} aria-hidden="true" /><span><strong>{t('cmp.disclaimer.title')}.</strong> {t('cmp.disclaimer.text')}</span></p>

      {fetchError && <StateMessage variant="error" title={t(fetchError === 'network' ? 'cmp.err.network' : 'cmp.err.summary')} action={{ label: t('cmp.err.retry'), onClick: () => { setIsLoading(true); setFetchError(null); void load(); } }} />}

      {data && (
        <div className="ops-intro">
          <div><span className="emp-muted">{t('cmp.overall')}</span> <StatusChip tone={TIER_TONE[data.overall_readiness_indicator] ?? 'neutral'}>{tierLabel(data.overall_readiness_indicator)}</StatusChip></div>
          <button type="button" className="btn" onClick={() => { setIsLoading(true); setFetchError(null); void load(); }}><RefreshCw size={14} aria-hidden="true" /> {t('cmp.refresh')}</button>
        </div>
      )}

      {legal.length > 0 && (
        <section className="ops-block" aria-labelledby="cmp-legal">
          <div className="ops-head"><h3 id="cmp-legal"><Lock size={16} aria-hidden="true" /> {t('cmp.legal.title')}</h3><span className="emp-muted">{t('cmp.legal.count', { n: legal.length })}</span></div>
          <div className="clause-grid">{legal.map(clauseCard)}</div>
        </section>
      )}

      {framework.length > 0 && (
        <section className="ops-block" aria-labelledby="cmp-fw">
          <div className="ops-head"><h3 id="cmp-fw">{t('cmp.fw.title')}</h3><span className="emp-muted">{t('cmp.fw.count', { n: framework.length })}</span></div>
          <div className="clause-grid">{framework.map(clauseCard)}</div>
        </section>
      )}

      {!fetchError && all.length === 0 && <StateMessage variant="empty" title={t('cmp.empty.title')} why={t('cmp.empty.why')} />}

      {!readOnly && thresholds.length > 0 && (
        <section className="ops-block" aria-labelledby="cmp-admin">
          <div className="ops-head"><h3 id="cmp-admin">{t('cmp.admin.title')}</h3></div>
          <p className="emp-muted">{t('cmp.admin.desc')}</p>
          <DataTable caption={t('cmp.admin.title')} columns={columns} rows={thresholds} rowKey={item => item.clause_id} />
        </section>
      )}
    </div>
  );
};

export default ComplianceReadinessSection;
