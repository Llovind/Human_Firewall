'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useI18n } from '@/i18n/I18nProvider';
import { useNow } from '@/hooks/useNow';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { formatAgo } from '@/lib/relativeTime';
import DataTable, { type Column } from '@/components/ui/DataTable';
import Dialog from '@/components/ui/Dialog';
import Field from '@/components/ui/Field';
import FilterBar from '@/components/ui/FilterBar';
import SeverityBadge, { normalizeSeverity, type SeverityLevel } from '@/components/ui/SeverityBadge';
import StateMessage from '@/components/ui/StateMessage';
import StatusChip from '@/components/ui/StatusChip';
import { useToast } from '@/components/ui/Toast';
import type { Incident, IncidentEvent } from '@/components/admin/types';
import type { MessageKey } from '@/i18n/messages';

interface IncidentQueueProps {
  incidents: Incident[];
  /** SOC can resolve and reopen. GRC and CISO read only. */
  canResolve: boolean;
  /** Called after a change so the page can fetch the new list. */
  onChanged: () => void;
  loading?: boolean;
  error?: boolean;
}

type StatusFilter = 'open' | 'closed' | 'all';
const RANK: Record<SeverityLevel, number> = { critical: 5, high: 4, medium: 3, low: 2, info: 1, unknown: 0 };
const isOpen = (incident: Incident) => incident.status !== 'closed';

function typeKey(type: string): MessageKey {
  return type === 'phishing_url' ? 'inc.type.phishing_url' : type === 'threat_report' ? 'inc.type.threat_report' : 'inc.type.other';
}

type EventsState = { state: 'idle' | 'loading' | 'ready' | 'error'; items: IncidentEvent[] };

/** The history of one incident. Reloads when another incident is chosen or after a change. */
function useIncidentEvents(id: string | null, version: number): EventsState {
  const [loaded, setLoaded] = useState<{ key: string; items: IncidentEvent[] | null } | null>(null);
  const key = id ? `${id}:${version}` : '';
  useEffect(() => {
    if (!id) return;
    let active = true;
    fetch(`/api/incident/${encodeURIComponent(id)}/events`, { cache: 'no-store' })
      .then(async res => ({ ok: res.ok, body: await res.json() }))
      .then(({ ok, body }) => { if (active) setLoaded({ key, items: ok && Array.isArray(body.events) ? body.events : null }); })
      .catch(() => { if (active) setLoaded({ key, items: null }); });
    return () => { active = false; };
  }, [id, key]);
  if (!id) return { state: 'idle', items: [] };
  if (!loaded || loaded.key !== key) return { state: 'loading', items: [] };
  return loaded.items ? { state: 'ready', items: loaded.items } : { state: 'error', items: [] };
}

/**
 * The SOC queue: the list is the page. Click a row for details; resolve or reopen from the panel.
 * Resolve and reopen need a reason; every change is kept in the incident history.
 */
export default function IncidentQueue({ incidents, canResolve, onChanged, loading = false, error = false }: IncidentQueueProps) {
  const { t, lang } = useI18n();
  const toast = useToast();
  const now = useNow();
  const wide = useMediaQuery('(min-width: 1100px)');
  const [query, setQuery] = useState('');
  const [severity, setSeverity] = useState<'all' | SeverityLevel>('all');
  const [status, setStatus] = useState<StatusFilter>('open');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<null | 'resolve' | 'reopen'>(null);
  const [note, setNote] = useState('');
  const [noteError, setNoteError] = useState('');
  const [version, setVersion] = useState(0);
  const { user } = useAuth();
  const events = useIncidentEvents(selectedId, version);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState('');

  const counts = useMemo(() => ({
    open: incidents.filter(isOpen).length,
    critical: incidents.filter(i => isOpen(i) && normalizeSeverity(i.severity) === 'critical').length,
    high: incidents.filter(i => isOpen(i) && normalizeSeverity(i.severity) === 'high').length,
    closed: incidents.filter(i => !isOpen(i)).length,
  }), [incidents]);

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return incidents
      .filter(i => status === 'all' || (status === 'open') === isOpen(i))
      .filter(i => severity === 'all' || normalizeSeverity(i.severity) === severity)
      .filter(i => !needle || [i.id, i.target, i.description, i.source].some(v => String(v ?? '').toLowerCase().includes(needle)))
      .sort((a, b) => RANK[normalizeSeverity(b.severity)] - RANK[normalizeSeverity(a.severity)] || new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [incidents, query, severity, status]);

  const selected = incidents.find(i => i.id === selectedId) ?? null;
  const activeFilters = (status !== 'open' ? 1 : 0) + (severity !== 'all' ? 1 : 0) + (query ? 1 : 0);
  const clear = () => { setStatus('open'); setSeverity('all'); setQuery(''); };

  async function send(incident: Incident, body: Record<string, string>, toastKey: MessageKey, undoable = false) {
    setBusy(true); setFailure('');
    try {
      const res = await fetch('/api/incident', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ticket_id: incident.id, ...body }) });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof payload.error === 'string' ? payload.error : t('inc.fail'));
      setDialog(null); setNote(''); setVersion(v => v + 1);
      onChanged();
      toast.show({ message: t(toastKey), tone: 'ok', ...(undoable ? { action: { label: t('inc.undo'), onClick: () => void undo(incident) }, durationMs: 8000 } : {}) });
    } catch (err) { setFailure(err instanceof Error ? err.message : t('inc.fail')); }
    finally { setBusy(false); }
  }
  async function undo(incident: Incident) {
    try {
      const res = await fetch('/api/incident', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ticket_id: incident.id, status: 'open' }) });
      if (!res.ok) throw new Error();
      setVersion(v => v + 1); onChanged();
    } catch { toast.show({ message: t('inc.fail'), tone: 'bad' }); }
  }
  function submitDialog() {
    if (!selected || !dialog) return;
    const text = note.trim();
    if (dialog === 'resolve' && text.length < 5) { setNoteError(t('inc.note.short')); return; }
    setNoteError('');
    void send(selected, { status: dialog === 'resolve' ? 'closed' : 'open', note: text }, dialog === 'resolve' ? 'inc.toast.resolved' : 'inc.toast.reopened', dialog === 'resolve');
  }
  const openDialog = (mode: 'resolve' | 'reopen') => { setFailure(''); setNote(''); setNoteError(''); setDialog(mode); };
  const mine = (incident: Incident) => Boolean(user?.email) && incident.assignee?.toLowerCase() === user?.email.toLowerCase();

  const columns: Column<Incident>[] = [
    { key: 'severity', header: t('inc.col.severity'), sortValue: i => RANK[normalizeSeverity(i.severity)], render: i => <SeverityBadge value={i.severity} /> },
    { key: 'id', header: t('inc.col.id'), sortValue: i => i.id, render: i => <span className="mono">{i.id}</span> },
    { key: 'incident', header: t('inc.col.incident'), render: i => <span className="cell-clip" title={`${i.target} · ${i.description}`}><strong>{i.target}</strong><small className="cell-sub">{i.description}</small></span> },
    { key: 'division', header: t('inc.col.division'), sortValue: i => i.source, render: i => i.source, secondary: true },
    { key: 'owner', header: t('inc.col.owner'), sortValue: i => i.assignee ?? '', render: i => (i.assignee ? i.assignee.split('@')[0] : <span className="emp-muted">{t('inc.panel.unassigned')}</span>), secondary: true },
    { key: 'status', header: t('inc.col.status'), sortValue: i => i.status, render: i => <StatusChip tone={isOpen(i) ? 'open' : 'ok'}>{t(isOpen(i) ? 'status.open' : 'status.resolved')}</StatusChip> },
    { key: 'age', header: t('inc.col.age'), sortValue: i => new Date(i.timestamp).getTime(), render: i => formatAgo(i.timestamp, lang, now), align: 'right' },
  ];

  const detail = selected && (
    <div className="incident-detail">
      <div className="incident-detail-head"><span className="mono">{selected.id}</span><SeverityBadge value={selected.severity} /><StatusChip tone={isOpen(selected) ? 'open' : 'ok'}>{t(isOpen(selected) ? 'status.open' : 'status.resolved')}</StatusChip></div>
      <h3>{selected.target}</h3>
      <dl className="acc-facts">
        <div><dt>{t('inc.panel.evidence')}</dt><dd>{selected.description}</dd></div>
        <div><dt>{t('inc.panel.type')}</dt><dd>{t(typeKey(selected.type))}</dd></div>
        <div><dt>{t('inc.panel.division')}</dt><dd>{selected.source}</dd></div>
        <div><dt>{t('inc.panel.reported')}</dt><dd>{formatAgo(selected.timestamp, lang, now)}</dd></div>
        <div><dt>{t('inc.panel.owner')}</dt><dd>{selected.assignee ?? t('inc.panel.unassigned')}</dd></div>
      </dl>
      {canResolve
        ? <div className="incident-actions">
            {isOpen(selected)
              ? <button type="button" className="btn btn-primary" onClick={() => openDialog('resolve')}>{t('inc.action.resolve')}</button>
              : <button type="button" className="btn" disabled={busy} onClick={() => openDialog('reopen')}>{t('inc.action.reopen')}</button>}
            {mine(selected)
              ? <button type="button" className="btn" disabled={busy} onClick={() => void send(selected, { assignee: '' }, 'inc.toast.unassigned')}>{t('inc.action.unassign')}</button>
              : <button type="button" className="btn" disabled={busy} onClick={() => void send(selected, { assignee: 'me' }, 'inc.toast.assigned')}>{t('inc.action.assignMe')}</button>}
          </div>
        : <p className="emp-muted">{t('inc.readonly')}</p>}
      {failure && !dialog && <p className="debt-error" role="alert">{failure}</p>}
      <div className="incident-history">
        <h4>{t('inc.panel.activity')}</h4>
        {events.state === 'loading' && <StateMessage variant="loading" lines={2} compact />}
        {events.state === 'error' && <p className="emp-muted" role="alert">{t('inc.activity.error')}</p>}
        {events.state === 'ready' && events.items.length === 0 && <p className="emp-muted">{t('inc.activity.empty')}</p>}
        {events.state === 'ready' && events.items.length > 0 && (
          <ul className="emp-list">
            {events.items.map(event => (
              <li key={event.id}>
                <span className="emp-dot" data-tone={event.event === 'resolved' ? 'ok' : 'neutral'} aria-hidden="true" />
                <span className="emp-list-main">
                  {t(`inc.event.${event.event}` as MessageKey, { who: event.actor_email.split('@')[0], to: (event.note ?? '').split('@')[0] })}
                  {event.note && (event.event === 'resolved' || event.event === 'reopened') && <small>{event.note}</small>}
                </span>
                <time className="emp-list-time">{formatAgo(event.created_at, lang, now)}</time>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );

  const stripItem = (label: string, value: number, onClick: () => void, pressed: boolean) => (
    <button type="button" className="strip-item" aria-pressed={pressed} onClick={onClick}><b>{value}</b>{label}</button>
  );

  return (
    <section className="incident-queue" aria-label={t('inc.title')}>
      <div className="strip" role="group" aria-label={t('inc.summary.label')}>
        {stripItem(t('inc.summary.open'), counts.open, () => { setStatus('open'); setSeverity('all'); }, status === 'open' && severity === 'all')}
        {stripItem(t('inc.summary.critical'), counts.critical, () => { setStatus('open'); setSeverity('critical'); }, status === 'open' && severity === 'critical')}
        {stripItem(t('inc.summary.high'), counts.high, () => { setStatus('open'); setSeverity('high'); }, status === 'open' && severity === 'high')}
        {stripItem(t('inc.summary.resolved'), counts.closed, () => { setStatus('closed'); setSeverity('all'); }, status === 'closed')}
      </div>
      <FilterBar
        search={{ value: query, onChange: setQuery, placeholder: t('inc.search') }}
        selects={[
          { id: 'severity', label: t('inc.filter.severity'), value: severity, onChange: v => setSeverity(v as typeof severity),
            options: [{ value: 'all', label: t('inc.filter.allSeverities') }, ...(['critical', 'high', 'medium', 'low', 'info'] as const).map(v => ({ value: v, label: t(`sev.${v}` as MessageKey) }))] },
          { id: 'status', label: t('inc.filter.status'), value: status, onChange: v => setStatus(v as StatusFilter),
            options: [{ value: 'open', label: t('inc.filter.open') }, { value: 'closed', label: t('inc.filter.resolved') }, { value: 'all', label: t('inc.filter.all') }] },
        ]}
        activeCount={activeFilters} onClear={clear} clearLabel={t('common.clearFilters')} />
      {error && <StateMessage variant="error" title={t('inc.error.title')} why={t('inc.error.why')} action={{ label: t('common.retry'), onClick: onChanged }} compact />}
      {error && incidents.length === 0
        ? null
        : loading && incidents.length === 0
          ? <StateMessage variant="loading" lines={4} />
          : (
          <div className="incident-split" data-wide={wide}>
            <DataTable caption={t('inc.caption')} columns={columns} rows={rows} rowKey={i => i.id} selectedKey={selectedId}
              onRowClick={i => { setSelectedId(i.id); setFailure(''); }}
              empty={<StateMessage variant="empty" title={t('inc.empty.title')} why={t(activeFilters ? 'inc.empty.filtered' : 'inc.empty.open')} />} />
            {wide && <aside className="incident-panel" aria-label={selected ? selected.id : t('inc.title')}>{detail ?? <p className="emp-muted">{t('inc.panel.empty')}</p>}</aside>}
          </div>
        )}

      {!wide && (
        <Dialog open={selected !== null && !dialog} onClose={() => setSelectedId(null)} title={selected?.id ?? ''} size="md">{detail}</Dialog>
      )}
      <Dialog open={dialog !== null && selected !== null} onClose={() => !busy && setDialog(null)} busy={busy} size="sm"
        title={t(dialog === 'reopen' ? 'inc.reopen.title' : 'inc.resolve.title', { id: selected?.id ?? '' })}
        description={t(dialog === 'reopen' ? 'inc.reopen.body' : 'inc.resolve.body')}
        footer={<>
          <button type="button" className="btn" disabled={busy} onClick={() => setDialog(null)}>{t('common.cancel')}</button>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={submitDialog}>{t(dialog === 'reopen' ? 'inc.action.reopen' : 'inc.action.resolve')}</button>
        </>}>
        <Field label={t('inc.note.label')} hint={t('inc.note.hint')} error={noteError || undefined} optionalLabel={dialog === 'reopen' ? t('common.optional') : undefined}>
          {control => <textarea {...control} rows={3} maxLength={1000} value={note} onChange={e => { setNote(e.target.value); if (noteError) setNoteError(''); }} />}
        </Field>
        {failure && <p className="debt-error" role="alert">{failure}</p>}
      </Dialog>
    </section>
  );
}
