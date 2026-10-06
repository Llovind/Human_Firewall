'use client';

import { useState } from 'react';
import { PolicyDecision } from '@/components/admin/types';
import DataTable, { type Column } from '@/components/ui/DataTable';
import Field from '@/components/ui/Field';
import StateMessage from '@/components/ui/StateMessage';
import StatusChip, { type StatusTone } from '@/components/ui/StatusChip';
import { useI18n } from '@/i18n/I18nProvider';
import { useNow } from '@/hooks/useNow';
import { formatAgo } from '@/lib/relativeTime';
import type { MessageKey } from '@/i18n/messages';

interface PolicySectionProps {
  readOnly: boolean;
  decisions: PolicyDecision[];
}

const TONE: Record<string, StatusTone> = { block: 'bad', warning: 'warn', allow: 'ok', notify_soc: 'open' };
const ACTIONS = ['block', 'warning', 'allow', 'notify_soc'] as const;

export default function PolicySection({ readOnly, decisions }: PolicySectionProps) {
  const { t, lang } = useI18n();
  const now = useNow();
  const safe = Array.isArray(decisions) ? decisions : [];
  const [tier, setTier] = useState('Guardian');
  const [score, setScore] = useState(65);
  const [result, setResult] = useState<{ action: string; reason: string } | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');

  const label = (action: string) => ((ACTIONS as readonly string[]).includes(action) ? t(`pol.sum.${action}` as MessageKey) : action);

  const simulate = async () => {
    setRunning(true); setError('');
    try {
      const res = await fetch('/api/admin/policy/evaluate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ threatScore: score, userTier: tier }) });
      if (res.ok) setResult(await res.json()); else setError(t('pol.sim.error'));
    } catch { setError(t('pol.sim.error')); } finally { setRunning(false); }
  };

  const columns: Column<PolicyDecision>[] = [
    { key: 'when', header: t('pol.col.when'), sortValue: d => d.timestamp, render: d => formatAgo(d.timestamp, lang, now) },
    { key: 'url', header: t('pol.col.link'), secondary: true, render: d => <span className="cell-clip" title={d.url}>{d.url || '—'}</span> },
    { key: 'threat', header: t('pol.col.threat'), align: 'right', secondary: true, sortValue: d => d.threatScore, render: d => d.threatScore },
    { key: 'behavior', header: t('pol.col.behavior'), align: 'right', secondary: true, sortValue: d => d.behaviorScore, render: d => d.behaviorScore },
    { key: 'result', header: t('pol.col.result'), render: d => <StatusChip tone={TONE[(d.finalAction || '').toLowerCase()] ?? 'neutral'}>{label((d.finalAction || '').toLowerCase())}</StatusChip> },
    { key: 'reason', header: t('pol.col.reason'), render: d => <span className="cell-clip" title={d.reason}>{d.reason}</span> },
  ];

  return (
    <div className="ops-page">
      <section className="ops-block" aria-labelledby="pol-title">
        <div className="ops-head">
          <h3 id="pol-title">{t('pol.title')}</h3>
          <span className="emp-muted">{t('pol.count', { n: safe.length })}</span>
        </div>
        <p className="emp-muted">{t('pol.intro')}</p>
        <div className="rule-grid">
          {(['block', 'warning', 'allow'] as const).map(key => (
            <div key={key}><strong>{t(`pol.rule.${key}` as MessageKey)}</strong>{t(`pol.rule.${key}.text` as MessageKey)}</div>
          ))}
        </div>
      </section>

      {!readOnly && (
        <section className="ops-block" aria-labelledby="pol-sim">
          <div className="ops-head"><h3 id="pol-sim">{t('pol.sim.title')}</h3></div>
          <div className="ops-card">
            <div className="sim-controls">
              <Field label={t('pol.sim.tier')}>{c => (
                <select {...c} value={tier} onChange={e => setTier(e.target.value)}>
                  {['Vulnerable', 'Guardian', 'Sentinel'].map(v => <option key={v} value={v}>{t(`pol.sim.tier.${v}` as MessageKey)}</option>)}
                </select>
              )}</Field>
              <Field label={`${t('pol.sim.score')}: ${score} / 100`}>{c => <input {...c} type="range" min={0} max={100} value={score} onChange={e => setScore(Number(e.target.value))} />}</Field>
            </div>
            <div><button type="button" className="btn btn-primary" onClick={simulate} disabled={running}>{running ? t('pol.sim.running') : t('pol.sim.run')}</button></div>
            {error && <p className="field-error" role="alert">{error}</p>}
            {result && (
              <div className="sim-result" role="status">
                <StatusChip tone={TONE[result.action] ?? 'neutral'}>{t('pol.sim.result', { action: label(result.action) })}</StatusChip>
                <span>{result.reason}</span>
              </div>
            )}
          </div>
        </section>
      )}

      <section className="ops-block" aria-label={t('pol.count', { n: safe.length })}>
        <div className="strip" role="group">
          {ACTIONS.map(action => (
            <span key={action} className="strip-static"><b>{safe.filter(d => (d.finalAction || '').toLowerCase() === action).length}</b> {t(`pol.sum.${action}` as MessageKey)}</span>
          ))}
        </div>
        <DataTable caption={t('pol.title')} columns={columns} rows={safe} rowKey={d => d.id} empty={<StateMessage variant="empty" title={t('pol.empty.title')} why={t('pol.empty.why')} />} />
      </section>
    </div>
  );
}
