'use client';

import { useMemo, useState } from 'react';
import { usePolling } from '@/hooks/usePolling';
import { useNow } from '@/hooks/useNow';
import { useI18n } from '@/i18n/I18nProvider';
import { formatAgo } from '@/lib/relativeTime';
import DataTable, { type Column } from '@/components/ui/DataTable';
import Dialog from '@/components/ui/Dialog';
import Field from '@/components/ui/Field';
import FilterBar from '@/components/ui/FilterBar';
import StateMessage from '@/components/ui/StateMessage';
import StatusChip, { type StatusTone } from '@/components/ui/StatusChip';
import { useToast } from '@/components/ui/Toast';
import type { MessageKey } from '@/i18n/messages';

export interface AccessRequest {
  id: string; email: string; domain: string; reason: string;
  status: 'open' | 'allowed' | 'denied';
  decision_note: string | null; decided_by: string | null; decided_at: string | null; created_at: string;
}
interface Listing { requests: AccessRequest[]; counts: { open: number; allowed: number; denied: number } }

const TONE: Record<AccessRequest['status'], StatusTone> = { open: 'open', allowed: 'ok', denied: 'neutral' };
const STATUS_KEY: Record<AccessRequest['status'], MessageKey> = { open: 'req.status.open', allowed: 'req.status.allowed', denied: 'req.status.denied' };

/**
 * SOC answers employee requests to open blocked sites. GRC can read but not decide.
 * The proxy only supports domain-wide rules, so "allow" opens the site for everyone.
 */
export default function AccessRequestsPanel({ canDecide, onChanged }: { canDecide: boolean; onChanged?: () => void }) {
  const { t, lang } = useI18n();
  const toast = useToast();
  const now = useNow();
  const { data, error, isLoading, refresh } = usePolling<Listing>('/api/admin/access-requests', 10000);
  const [status, setStatus] = useState<'open' | 'allowed' | 'denied' | 'all'>('open');
  const [selected, setSelected] = useState<AccessRequest | null>(null);
  const [note, setNote] = useState('');
  const [noteError, setNoteError] = useState('');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState('');

  const rows = useMemo(() => (data?.requests ?? []).filter(row => status === 'all' || row.status === status), [data, status]);

  const open = (row: AccessRequest) => { setSelected(row); setNote(''); setNoteError(''); setFailure(''); };
  const close = () => { if (!busy) setSelected(null); };

  async function decide(decision: 'allow' | 'deny') {
    if (!selected) return;
    if (note.trim().length < 5) { setNoteError(t('acc.dialog.note.short')); return; }
    setBusy(true); setFailure(''); setNoteError('');
    try {
      const res = await fetch(`/api/admin/access-requests/${selected.id}/decision`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ decision, note: note.trim() }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof body.error === 'string' ? body.error : t('acc.fail'));
      toast.show({ message: t(decision === 'allow' ? 'acc.toast.allowed' : 'acc.toast.denied'), tone: 'ok' });
      setSelected(null); refresh(); onChanged?.();
    } catch (err) { setFailure(err instanceof Error ? err.message : t('acc.fail')); }
    finally { setBusy(false); }
  }

  const columns: Column<AccessRequest>[] = [
    { key: 'domain', header: t('acc.col.domain'), sortValue: r => r.domain, render: r => <span className="mono">{r.domain}</span> },
    { key: 'who', header: t('acc.col.who'), sortValue: r => r.email, render: r => r.email, secondary: true },
    { key: 'reason', header: t('acc.col.reason'), render: r => <span className="cell-clip" title={r.reason}>{r.reason}</span>, secondary: true },
    { key: 'status', header: t('acc.col.status'), sortValue: r => r.status, render: r => <StatusChip tone={TONE[r.status]}>{t(STATUS_KEY[r.status])}</StatusChip> },
    { key: 'age', header: t('acc.col.age'), sortValue: r => r.created_at, render: r => formatAgo(r.created_at, lang, now), align: 'right' },
    { key: 'action', header: t('acc.col.action'), render: r => <button type="button" className="btn" onClick={event => { event.stopPropagation(); open(r); }}>{t('acc.review')}</button> },
  ];

  const filterOptions = [
    { value: 'open', label: `${t('acc.filter.open')}${data ? ` (${data.counts.open})` : ''}` },
    { value: 'allowed', label: t('acc.filter.allowed') },
    { value: 'denied', label: t('acc.filter.denied') },
    { value: 'all', label: t('acc.filter.all') },
  ];

  return (
    <div className="access-panel">
      <p className="debt-help">{t('acc.help')}</p>
      <FilterBar selects={[{ id: 'status', label: t('acc.filter.status'), value: status, options: filterOptions, onChange: value => setStatus(value as typeof status) }]}
        activeCount={status === 'open' ? 0 : 1} onClear={() => setStatus('open')} clearLabel={t('common.clearFilters')} />
      {isLoading && !data && <StateMessage variant="loading" />}
      {error && <StateMessage variant="error" title={t('acc.error.title')} why={t('acc.error.why')} action={{ label: t('common.retry'), onClick: refresh }} compact />}
      {data && (
        <DataTable caption={t('acc.caption')} columns={columns} rows={rows} rowKey={r => r.id} onRowClick={open} selectedKey={selected?.id}
          empty={<StateMessage variant="empty" title={t('acc.empty.title')} why={t(status === 'open' ? 'acc.empty.open' : 'acc.empty.filtered')} />} />
      )}

      <Dialog open={selected !== null} onClose={close} busy={busy} size="md" title={t('acc.dialog.title', { domain: selected?.domain ?? '' })}>
        {selected && <>
          <dl className="acc-facts">
            <div><dt>{t('acc.dialog.who')}</dt><dd>{selected.email}</dd></div>
            <div><dt>{t('acc.dialog.when')}</dt><dd>{formatAgo(selected.created_at, lang, now)}</dd></div>
            <div><dt>{t('acc.dialog.reason')}</dt><dd>{selected.reason}</dd></div>
          </dl>
          {selected.status !== 'open' && <>
            <StatusChip tone={TONE[selected.status]}>{t(STATUS_KEY[selected.status])}</StatusChip>
            {selected.decision_note && <p className="acc-note"><strong>{t('req.decision.note')}</strong>{selected.decision_note}</p>}
            <p className="emp-muted">{t('acc.dialog.decided', { time: selected.decided_at ? formatAgo(selected.decided_at, lang, now) : '', who: selected.decided_by ?? '' })}</p>
          </>}
          {selected.status === 'open' && !canDecide && <p className="emp-muted">{t('acc.dialog.readonly')}</p>}
          {selected.status === 'open' && canDecide && <>
            <p className="acc-warn">{t('acc.dialog.warn', { domain: selected.domain })}</p>
            <Field label={t('acc.dialog.note')} hint={t('acc.dialog.note.hint')} error={noteError || undefined}>
              {control => <textarea {...control} rows={3} maxLength={1000} value={note} onChange={e => { setNote(e.target.value); if (noteError) setNoteError(''); }} />}
            </Field>
            {failure && <p className="debt-error" role="alert">{t('acc.fail')} {failure}</p>}
            <div className="ui-dialog-footer">
              <button type="button" className="btn" disabled={busy} onClick={() => void decide('deny')}>{busy ? t('acc.dialog.saving') : t('acc.dialog.deny')}</button>
              <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void decide('allow')}>{busy ? t('acc.dialog.saving') : t('acc.dialog.allow')}</button>
            </div>
          </>}
        </>}
      </Dialog>
    </div>
  );
}
