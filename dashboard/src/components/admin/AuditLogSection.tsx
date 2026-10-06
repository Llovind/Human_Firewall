'use client';

import { useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { usePolling } from '@/hooks/usePolling';
import { useNow } from '@/hooks/useNow';
import { formatAgo } from '@/lib/relativeTime';
import DataTable, { type Column } from '@/components/ui/DataTable';
import FilterBar from '@/components/ui/FilterBar';
import StateMessage from '@/components/ui/StateMessage';
import StatusChip, { type StatusTone } from '@/components/ui/StatusChip';
import { useI18n } from '@/i18n/I18nProvider';
import type { MessageKey } from '@/i18n/messages';

interface AuditEvent { id: string; at: string; kind: 'incident' | 'access' | 'warning' | 'proxy'; event: string; actor: string; actor_role: string; subject: string; detail: string }

const KINDS = ['incident', 'access', 'warning', 'proxy'] as const;
const TONE: Record<string, StatusTone> = { 'access.allowed': 'ok', 'proxy.allow': 'ok', 'access.denied': 'bad', 'proxy.block': 'bad', 'incident.resolved': 'ok', 'warning.sent': 'open' };

/** One list of every decision, newest first. Read only: the original screens remain where decisions are made. */
export default function AuditLogSection() {
  const { t, lang } = useI18n();
  const now = useNow();
  const { data, error, isLoading, refresh } = usePolling<{ events: AuditEvent[] }>('/api/admin/audit-log?limit=200', 30000);
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState('ALL');

  const rows = useMemo(() => {
    const text = query.toLowerCase();
    return (data?.events ?? []).filter(e => (kind === 'ALL' || e.kind === kind) && (!text || [e.actor, e.subject, e.detail].some(v => v.toLowerCase().includes(text))));
  }, [data, query, kind]);

  const label = (e: AuditEvent) => {
    const key = `aud.ev.${e.kind}.${e.event}` as MessageKey;
    return t(['incident.resolved', 'incident.reopened', 'incident.assigned', 'incident.unassigned', 'access.allowed', 'access.denied', 'warning.sent', 'proxy.block', 'proxy.allow'].includes(`${e.kind}.${e.event}`) ? key : 'aud.ev.unknown');
  };

  const columns: Column<AuditEvent>[] = [
    { key: 'at', header: t('aud.col.when'), sortValue: e => e.at, render: e => <time dateTime={e.at} title={e.at}>{formatAgo(e.at, lang, now)}</time> },
    { key: 'actor', header: t('aud.col.who'), render: e => <span className="cell-clip" title={e.actor}>{e.actor || '—'}<span className="cell-sub">{e.actor_role.toUpperCase()}</span></span> },
    { key: 'event', header: t('aud.col.what'), render: e => <StatusChip tone={TONE[`${e.kind}.${e.event}`] ?? 'neutral'}>{label(e)}</StatusChip> },
    { key: 'subject', header: t('aud.col.subject'), secondary: true, render: e => <span className="cell-clip" title={e.subject}>{e.subject}</span> },
    { key: 'detail', header: t('aud.col.reason'), secondary: true, render: e => <span className="cell-clip" title={e.detail}>{e.detail || '—'}</span> },
  ];

  return (
    <section className="ops-page" aria-labelledby="aud-title">
      <div className="ops-intro">
        <div><h3 id="aud-title" style={{ fontSize: 16, fontWeight: 600 }}>{t('aud.title')}</h3><p className="emp-muted">{t('aud.desc')}</p></div>
        <span className="ops-actions" style={{ flexWrap: 'wrap' }}>
          <span className="emp-muted">{t('aud.count', { n: rows.length })}</span>
          <button type="button" className="btn" onClick={refresh} disabled={isLoading}><RefreshCw size={14} aria-hidden="true" /> {t('aud.refresh')}</button>
        </span>
      </div>
      <FilterBar
        search={{ value: query, onChange: setQuery, placeholder: t('aud.search') }}
        selects={[{ id: 'kind', label: t('aud.filter.kind'), value: kind, onChange: setKind, options: [{ value: 'ALL', label: t('aud.kind.all') }, ...KINDS.map(k => ({ value: k, label: t(`aud.kind.${k}` as MessageKey) }))] }]}
        activeCount={(query ? 1 : 0) + (kind !== 'ALL' ? 1 : 0)}
        onClear={() => { setQuery(''); setKind('ALL'); }}
      />
      {error && !data
        ? <StateMessage variant="error" title={t('aud.err.title')} action={{ label: t('common.retry'), onClick: refresh }} />
        : isLoading && !data
          ? <StateMessage variant="loading" />
          : <DataTable caption={t('aud.title')} columns={columns} rows={rows} rowKey={e => e.id} empty={<StateMessage variant="empty" title={t('aud.empty.title')} why={t('aud.empty.why')} />} />}
    </section>
  );
}
