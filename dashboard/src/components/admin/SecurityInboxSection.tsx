'use client';

import { FormEvent, useState } from 'react';
import { Flag, Mail, RefreshCw, History } from 'lucide-react';
import { usePolling } from '@/hooks/usePolling';
import ThreatEvidence, { EmployeeReport } from '../ThreatEvidence';
import AccessRequestsPanel from './AccessRequestsPanel';
import Dialog from '@/components/ui/Dialog';
import Field from '@/components/ui/Field';
import KpiCard from '@/components/ui/KpiCard';
import StateMessage from '@/components/ui/StateMessage';
import StatusChip from '@/components/ui/StatusChip';
import { useToast } from '@/components/ui/Toast';
import { useI18n } from '@/i18n/I18nProvider';
import type { MessageKey } from '@/i18n/messages';

type Employee = { id: number; email: string; divisi: string; points: number; canSend: boolean;
  delivery: { sent_at: string | null; last_error: string | null; created_at: string; attempts: number } | null };
type Report = EmployeeReport;
type Audit = { id: number; actor_email: string; actor_role: string; recipient: string; score: number; reason: string; created_at: string };
type Inbox = { employees: Employee[]; reports: Report[]; audit: Audit[]; threshold: number; emailEnabled: boolean; automatic: boolean; deliveryMode: string };

type Tab = 'reports' | 'access' | 'employees' | 'audit';

export default function SecurityInboxSection({ canDecideAccess = false }: { canDecideAccess?: boolean }) {
  const { t } = useI18n();
  const toast = useToast();
  const { data, error, isLoading, refresh } = usePolling<Inbox>('/api/admin/security-inbox', 10000);
  const [tab, setTab] = useState<Tab>('reports');
  const [selected, setSelected] = useState<Employee | null>(null);
  const [reason, setReason] = useState(() => t('inbox.dialog.default'));
  const [busy, setBusy] = useState(false);
  const [sendError, setSendError] = useState('');

  async function send(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    setBusy(true); setSendError('');
    try {
      const res = await fetch('/api/admin/security-inbox', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accountId: selected.id, reason }) });
      if (!res.ok) throw new Error('send');
      toast.show({ message: t('inbox.sent'), tone: 'ok' });
      setSelected(null); refresh();
    } catch { setSendError(t('inbox.err.send')); }
    finally { setBusy(false); }
  }

  const status = (value: string) => (['pending_review', 'open', 'resolved'].includes(value) ? t(`inbox.status.${value}` as MessageKey) : value.replaceAll('_', ' '));
  const delivery = (employee: Employee) => {
    const d = employee.delivery;
    if (!d) return t('inbox.emp.none');
    if (d.last_error === 'skipped_not_eligible') return t('inbox.emp.cancelled');
    if (d.sent_at) return t('inbox.emp.sent', { time: d.sent_at });
    return d.last_error ? t('inbox.emp.retry') : t('inbox.emp.queued');
  };
  const tabs: { id: Tab; label: string; icon: typeof Flag }[] = [
    { id: 'reports', label: t('inbox.tab.reports'), icon: Flag },
    { id: 'access', label: t('acc.tab'), icon: Flag },
    { id: 'employees', label: t('inbox.tab.warnings'), icon: Mail },
    { id: 'audit', label: t('inbox.tab.audit'), icon: History },
  ];

  return (
    <section className="ops-page" aria-labelledby="inbox-title">
      <div className="ops-intro">
        <div><h3 id="inbox-title" style={{ fontSize: 16, fontWeight: 600 }}>{t('inbox.title')}</h3><p className="emp-muted">{t('inbox.desc')}</p></div>
        <button type="button" className="btn" onClick={refresh} disabled={isLoading}><RefreshCw size={14} aria-hidden="true" /> {t('inbox.refresh')}</button>
      </div>
      <div className="exec-kpis">
        <KpiCard label={t('inbox.m.reports')} value={data?.reports.length ?? '—'} />
        <KpiCard label={t('inbox.m.low', { n: data?.threshold ?? '—' })} value={data?.employees.length ?? '—'} />
        <KpiCard label={t('inbox.m.mail')} value={<span style={{ fontSize: 18 }}>Mailpit</span>} hint={data?.automatic ? t('inbox.m.mail.auto') : t('inbox.m.mail.manual')} />
      </div>
      {error && <p className="field-error" role="alert">{t('inbox.err.refresh')}</p>}
      <div className="seg" role="group" aria-label={t('inbox.tabs')} style={{ flexWrap: 'wrap' }}>
        {tabs.map(({ id, label, icon: Icon }) => <button key={id} type="button" aria-pressed={tab === id} onClick={() => setTab(id)}><Icon size={14} aria-hidden="true" />{label}</button>)}
      </div>

      {isLoading && !data && tab !== 'access' && <StateMessage variant="loading" title={t('inbox.loading')} />}

      {tab === 'reports' && data && <div className="ops-block">
        <p className="emp-muted">{t('inbox.reports.help')}</p>
        {!data.reports.length && <StateMessage variant="empty" title={t('inbox.reports.empty')} why=" " />}
        {data.reports.map(report => (
          <article key={report.id} className="exec-card">
            <div className="ops-head"><StatusChip tone={report.status === 'resolved' ? 'ok' : 'open'}>{status(report.status)}</StatusChip><time className="emp-muted">{report.created_at} UTC</time></div>
            <h3 style={{ overflowWrap: 'anywhere' }}>{report.url}</h3>
            <p>{report.description || t('inbox.reports.nodesc')}</p>
            <ThreatEvidence analysis={report.analysis} />
            <p className="emp-muted">{report.email} · {t('inbox.reports.evidence', { verdict: report.verdict })}</p>
          </article>
        ))}
      </div>}

      {tab === 'access' && <AccessRequestsPanel canDecide={canDecideAccess} />}

      {tab === 'employees' && data && <div className="ops-block">
        <p className="emp-muted">{t('inbox.emp.help', { n: data.threshold })}</p>
        {!data.employees.length && <StateMessage variant="empty" title={t('inbox.emp.empty')} why=" " />}
        {data.employees.map(employee => (
          <article key={employee.id} className="exec-card">
            <div className="ops-intro">
              <div>
                <h3 style={{ overflowWrap: 'anywhere' }}>{employee.email}</h3>
                <p>{employee.divisi} · <strong>{t('inbox.emp.points', { n: employee.points })}</strong></p>
                <small className="emp-muted">{delivery(employee)}</small>
              </div>
              <button type="button" className="btn btn-primary" disabled={!employee.canSend || !data.emailEnabled} onClick={() => { setSelected(employee); setSendError(''); }}><Mail size={14} aria-hidden="true" /> {employee.canSend ? t('inbox.emp.send') : t('inbox.emp.cooldown')}</button>
            </div>
          </article>
        ))}
      </div>}

      {tab === 'audit' && data && <div className="ops-block">
        {!data.audit.length && <StateMessage variant="empty" title={t('inbox.audit.empty')} why=" " />}
        {data.audit.map(item => (
          <article key={item.id} className="exec-card">
            <div className="ops-head"><StatusChip>{t('inbox.audit.queued', { role: item.actor_role.toUpperCase() })}</StatusChip><time className="emp-muted">{item.created_at} UTC</time></div>
            <h3 style={{ overflowWrap: 'anywhere' }}>{item.recipient}</h3>
            <p>{item.reason}</p>
            <small className="emp-muted">{t('inbox.audit.by', { who: item.actor_email, score: item.score })}</small>
          </article>
        ))}
      </div>}

      <Dialog open={selected !== null} onClose={() => setSelected(null)} busy={busy} title={t('inbox.dialog.title')} description={selected ? t('inbox.dialog.person', { email: selected.email, points: selected.points }) : undefined}
        footer={<>
          <button type="button" className="btn" disabled={busy} onClick={() => setSelected(null)}>{t('common.cancel')}</button>
          <button type="submit" form="warning-form" className="btn btn-primary" disabled={busy}>{busy ? t('inbox.dialog.submitting') : t('inbox.dialog.submit')}</button>
        </>}>
        <form id="warning-form" className="ui-form" onSubmit={send}>
          <Field label={t('inbox.dialog.reason')} hint={t('inbox.dialog.note')} error={sendError}>{c => <textarea {...c} required minLength={5} maxLength={1000} rows={4} value={reason} onChange={event => setReason(event.target.value)} />}</Field>
        </form>
      </Dialog>
    </section>
  );
}
