'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { Flag, Mail, RefreshCw, Users, X, History } from 'lucide-react';
import { usePolling } from '@/hooks/usePolling';
import ThreatEvidence, { EmployeeReport } from '../ThreatEvidence';

type Employee = { id: number; email: string; divisi: string; points: number; canSend: boolean;
  delivery: { sent_at: string | null; last_error: string | null; created_at: string; attempts: number } | null };
type Report = EmployeeReport;
type Audit = { id: number; actor_email: string; actor_role: string; recipient: string; score: number; reason: string; created_at: string };
type Inbox = { employees: Employee[]; reports: Report[]; audit: Audit[]; threshold: number; emailEnabled: boolean; automatic: boolean; deliveryMode: string };

export default function SecurityInboxSection() {
  const { data, error, isLoading, refresh } = usePolling<Inbox>('/api/admin/security-inbox', 10000);
  const [tab, setTab] = useState<'reports' | 'employees' | 'audit'>('reports');
  const [selected, setSelected] = useState<Employee | null>(null);
  const [reason, setReason] = useState('Please complete your security training and quizzes to improve phishing awareness.');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [sendError, setSendError] = useState('');
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (selected) dialogRef.current?.showModal();
  }, [selected]);
  async function send(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    setBusy(true); setSendError(''); setNotice('');
    try {
      const res = await fetch('/api/admin/security-inbox', { method: 'POST',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accountId: selected.id, reason }) });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Warning has not been sent.');
      setNotice('Warning queued for Mailpit. Track delivery in Warnings.');
      setSelected(null); refresh();
    } catch (err) { setSendError(err instanceof Error ? err.message : 'Warning has not been sent.'); }
    finally { setBusy(false); }
  }
  return <section className="security-inbox">
    <header className="inbox-hero glass-card"><div><span className="proxy-ops-kicker">HUMAN SECURITY WORKSPACE</span><h2>Security inbox</h2><p>Review reports and follow up on low scores.</p></div><button className="btn" onClick={refresh} disabled={isLoading}><RefreshCw size={16} />Refresh</button></header>
    <div className="inbox-metrics"><div className="glass-card"><Flag size={20} /><strong>{data?.reports.length ?? '—'}</strong><span>Recent reports</span></div><div className="glass-card"><Users size={20} /><strong>{data?.employees.length ?? '—'}</strong><span>Scores below {data?.threshold ?? '—'}/200</span></div><div className="glass-card"><Mail size={20} /><strong>Mailpit</strong><span>{data?.automatic ? 'Automatic + manual approval' : 'Warnings approved by SOC/GRC'}</span></div></div>
    {error && <p className="debt-error" role="alert">Could not refresh the inbox. Showing the last snapshot.</p>}
    {notice && <p className="debt-notice" role="status">{notice}</p>}
    <div className="debt-tabs" aria-label="Inbox categories"><button className={'btn ' + (tab === 'reports' ? 'btn-primary' : '')} aria-pressed={tab === 'reports'} onClick={() => setTab('reports')}><Flag size={15} aria-hidden="true" />Link reports</button><button className={'btn ' + (tab === 'employees' ? 'btn-primary' : '')} aria-pressed={tab === 'employees'} onClick={() => setTab('employees')}><Mail size={15} aria-hidden="true" />Education warnings</button><button className={'btn ' + (tab === 'audit' ? 'btn-primary' : '')} aria-pressed={tab === 'audit'} onClick={() => setTab('audit')}><History size={15} aria-hidden="true" />Delivery audit</button></div>
    <div className="inbox-list">
      {isLoading && !data && <p className="proxy-empty">Loading inbox…</p>}
      {tab === 'reports' && data && <>
        <p className="debt-help">Scan evidence supports review. Apply Block/Allow in Traffic & policies.</p>
        {!data.reports.length && <div className="proxy-empty glass-card"><Flag size={24} />No reports yet.</div>}
        {data.reports.map(report => <article key={report.id} className="inbox-item glass-card"><div className="inbox-item-top"><span className="badge" data-status={report.status}>{report.status.replaceAll('_', ' ')}</span><time>{report.created_at} UTC</time></div><h3>{report.url}</h3><p>{report.description || 'No description provided.'}</p><ThreatEvidence analysis={report.analysis} /><div className="inbox-item-footer"><span>{report.email}</span><span>Evidence: {report.verdict} · not a SOC decision</span></div></article>)}
      </>}
      {tab === 'employees' && data && <>
        <p className="debt-help">Active employees with scores below {data.threshold}/200. Lab emails are captured by Mailpit, not delivered to external inboxes.</p>
        {!data.employees.length && <div className="proxy-empty glass-card"><Users size={24} />No employees below the baseline.</div>}
        {data.employees.map(employee => <article key={employee.id} className="inbox-item glass-card inbox-employee"><div><h3>{employee.email}</h3><p>{employee.divisi} · <strong>{employee.points}/200 points</strong></p><small>{employee.delivery ? employee.delivery.last_error === 'skipped_not_eligible' ? 'Cancelled: account or score is no longer eligible' : employee.delivery.sent_at ? `Sent to Mailpit · ${employee.delivery.sent_at} UTC` : employee.delivery.last_error ? 'Retry pending' : 'Queued — awaiting delivery' : 'No warning yet'}</small></div><button className="btn btn-primary" disabled={!employee.canSend || !data.emailEnabled} onClick={() => { setSelected(employee); setSendError(''); }}><Mail size={16} />{employee.canSend ? 'Send warning' : 'Queued / cooldown'}</button></article>)}
      </>}
      {tab === 'audit' && data && <>
        {!data.audit.length && <div className="proxy-empty glass-card">No manual warning approvals yet.</div>}
        {data.audit.map(item => <article key={item.id} className="inbox-item glass-card"><div className="inbox-item-top"><span className="badge">{item.actor_role.toUpperCase()} · Queued</span><time>{item.created_at} UTC</time></div><h3>{item.recipient}</h3><p>{item.reason}</p><small>Approved by {item.actor_email} · score at approval {item.score}/200. Track delivery in the Warnings tab.</small></article>)}
      </>}
    </div>
    {selected && <dialog ref={dialogRef} aria-labelledby="warning-title" className="inbox-dialog" onCancel={event => { if (busy) event.preventDefault(); else setSelected(null); }}><button className="account-close" aria-label="Close" disabled={busy} onClick={() => setSelected(null)}><X size={20} /></button><h2 id="warning-title">Send an education warning</h2><p>{selected.email} · {selected.points}/200 points</p><form className="debt-form" onSubmit={send}><label>Message / reason<textarea autoFocus required minLength={5} maxLength={1000} rows={4} value={reason} onChange={event => setReason(event.target.value)} /></label><small>Delivery is audited and captured by Mailpit.</small>{sendError && <p role="alert" className="debt-error">{sendError}</p>}<button disabled={busy} className="btn btn-primary">{busy ? 'Queuing…' : 'Approve & send warning'}</button></form></dialog>}
  </section>;
}
