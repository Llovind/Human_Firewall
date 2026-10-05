'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Ban, CheckCircle2 } from 'lucide-react';
import DomainSecondOpinion from './DomainSecondOpinion';
import Dialog from '@/components/ui/Dialog';
import SeverityBadge from '@/components/ui/SeverityBadge';
import StateMessage from '@/components/ui/StateMessage';
import StatusChip from '@/components/ui/StatusChip';
import { useToast } from '@/components/ui/Toast';
import { useI18n } from '@/i18n/I18nProvider';
import { useNow } from '@/hooks/useNow';
import { formatAgo } from '@/lib/relativeTime';

type Alert = {
  id: string;
  domain: string;
  employee_email?: string;
  urgency: 'Critical' | 'Unknown';
  status: 'open' | 'blocked' | 'allowed';
  verdict: 'malicious' | 'unknown';
  reason: string;
  confidence?: number | null;
  source: string;
  created_at: string;
  stalePrediction?: boolean;
};

type Verdict = {
  id: string;
  domain: string;
  source: 'soc' | 'ml' | 'employee_report';
  decision: 'allow' | 'block';
  reason: string;
  confidence?: number | null;
  model_version?: string | null;
  updated_at: string;
};

type Traffic = {
  event_id: string;
  domain: string;
  employee_email?: string | null;
  method: string;
  port?: number | null;
  action: 'allow' | 'block';
  decision_source: string;
  reason: string;
  occurred_at: string;
};

const TRAFFIC_ROWS = 50;

export default function ProxyOperationsSection() {
  const { t, lang } = useI18n();
  const toast = useToast();
  const now = useNow();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [verdicts, setVerdicts] = useState<Verdict[]>([]);
  const [traffic, setTraffic] = useState<Traffic[]>([]);
  const [streamOnline, setStreamOnline] = useState(false);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [domain, setDomain] = useState('');
  const [action, setAction] = useState<'block' | 'allow'>('block');
  const [reason, setReason] = useState('');
  const [policyError, setPolicyError] = useState('');
  const [queueFilter, setQueueFilter] = useState('actionable');
  const [review, setReview] = useState<
    { kind: 'alert'; item: Alert; action: 'block' | 'allow' } |
    { kind: 'traffic'; item: Traffic; action: 'block' } | null
  >(null);
  const [reviewReason, setReviewReason] = useState('');
  const [reviewError, setReviewError] = useState('');

  const load = useCallback(async () => {
    try {
      const [alertResponse, verdictResponse, trafficResponse] = await Promise.all([
        fetch('/api/proxy/alerts', { cache: 'no-store' }),
        fetch('/api/proxy/verdicts', { cache: 'no-store' }),
        fetch('/api/proxy/traffic?limit=200', { cache: 'no-store' }),
      ]);
      if (alertResponse.ok) setAlerts((await alertResponse.json()).alerts || []);
      if (verdictResponse.ok) setVerdicts((await verdictResponse.json()).verdicts || []);
      if (trafficResponse.ok) setTraffic((await trafficResponse.json()).events || []);
      setMessage(!alertResponse.ok || !verdictResponse.ok || !trafficResponse.ok ? t('ops.fail.refresh') : '');
    } catch { setMessage(t('ops.fail.refresh')); }
  }, [t]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    const stream = new EventSource('/api/proxy/alerts/stream');
    stream.addEventListener('ready', () => setStreamOnline(true));
    stream.addEventListener('update', (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent).data);
        if (payload.type === 'traffic.observed' && payload.traffic) {
          setTraffic((current) => [
            payload.traffic,
            ...current.filter((item) => item.event_id !== payload.traffic.event_id),
          ].slice(0, 200));
          return;
        }
      } catch {
        // Non-traffic events fall through to an authoritative refresh.
      }
      void load();
    });
    stream.onerror = () => setStreamOnline(false);
    return () => stream.close();
  }, [load]);

  const openReview = (next: NonNullable<typeof review>, defaultReason: string) => {
    setReview(next); setReviewReason(defaultReason); setReviewError('');
  };

  const decideAlert = async (alert: Alert, nextAction: 'block' | 'allow', decisionReason: string) => {
    setBusy(alert.id);
    try {
      const response = await fetch(`/api/proxy/alerts/${alert.id}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: nextAction, reason: decisionReason }),
      });
      const payload = await response.json();
      if (response.ok) { toast.show({ message: t('ops.toast.policy', { domain: alert.domain }), tone: 'ok' }); await load(); }
      else setReviewError(payload.error || t('ops.fail.save'));
      return response.ok;
    } catch {
      setReviewError(t('ops.fail.unconfirmed'));
      return false;
    }
    finally { setBusy(''); }
  };

  const submitManual = async (event: FormEvent) => {
    event.preventDefault();
    if (reason.trim().length < 5) { setPolicyError(t('ops.dialog.short')); return; }
    setPolicyError('');
    setBusy('manual');
    try {
      const response = await fetch('/api/proxy/manual-decision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain, action, reason }),
      });
      const payload = await response.json();
      if (response.ok) {
        toast.show({ message: t('ops.toast.applied', { action: t(action === 'block' ? 'ops.action.block' : 'ops.action.allow'), domain: payload.verdict?.domain || domain }), tone: 'ok' });
        setDomain(''); setReason(''); await load();
      } else setPolicyError(payload.error || t('ops.fail.policy'));
    } catch { setPolicyError(t('ops.fail.policy')); }
    finally { setBusy(''); }
  };

  const blockTraffic = async (item: Traffic, decisionReason: string) => {
    setBusy(item.event_id);
    try {
      const response = await fetch('/api/proxy/manual-decision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: item.domain, action: 'block', reason: decisionReason }),
      });
      const payload = await response.json();
      if (response.ok) { toast.show({ message: t('ops.toast.blocked', { domain: payload.verdict?.domain || item.domain }), tone: 'ok' }); await load(); }
      else setReviewError(payload.error || t('ops.fail.save'));
      return response.ok;
    } catch {
      setReviewError(t('ops.fail.unconfirmed'));
      return false;
    }
    finally { setBusy(''); }
  };

  const counts = useMemo(() => ({
    open: alerts.filter((item) => item.status === 'open').length,
    blocked: verdicts.filter((item) => item.source === 'soc' && item.decision === 'block').length,
    traffic: traffic.length,
  }), [alerts, traffic, verdicts]);
  const visibleAlerts = alerts.filter(item => queueFilter === 'all' || (queueFilter === 'history' ? item.status !== 'open' || item.stalePrediction : item.status === 'open' && !item.stalePrediction && (queueFilter === 'unknown' ? item.urgency === 'Unknown' && item.source !== 'employee_report' : item.urgency === 'Critical' || item.source === 'employee_report')));
  const ago = (value: string) => formatAgo(value, lang, now);
  const blocking = review?.action === 'block';

  const submitReview = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || !review) return;
    const trimmedReason = reviewReason.trim();
    if (trimmedReason.length < 5) { setReviewError(t('ops.dialog.short')); return; }
    setReviewError('');
    const saved = review.kind === 'alert'
      ? await decideAlert(review.item, review.action, trimmedReason)
      : await blockTraffic(review.item, trimmedReason);
    if (saved) setReview(null);
  };

  return (
    <section className="proxy-ops ops-page">
      <div className="ops-intro">
        <p className="debt-help">{t('ops.desc')}</p>
        <StatusChip tone={streamOnline ? 'ok' : 'warn'}>{t(streamOnline ? 'ops.stream.on' : 'ops.stream.off')}</StatusChip>
      </div>
      <div className="strip" aria-label={t('ops.desc')}>
        <span className="strip-static"><b>{counts.open}</b>{t('ops.stat.alerts')}</span>
        <span className="strip-static"><b>{counts.blocked}</b>{t('ops.stat.blocks')}</span>
        <span className="strip-static"><b>{counts.traffic}</b>{t('ops.stat.traffic')}</span>
      </div>
      {message && <p className="debt-error" role="alert">{message}</p>}

      <div className="ops-layout">
        <div className="ops-main">
          <section className="ops-block" aria-labelledby="ops-alerts">
            <div className="ops-head"><h3 id="ops-alerts">{t('ops.alerts.title')}</h3><span className="emp-muted">{t('ops.alerts.count', { n: counts.open })}</span></div>
            <label className="ops-filter">{t('ops.filter.show')}
              <select value={queueFilter} onChange={event => setQueueFilter(event.target.value)}>
                <option value="actionable">{t('ops.filter.actionable')}</option>
                <option value="unknown">{t('ops.filter.unknown')}</option>
                <option value="history">{t('ops.filter.history')}</option>
                <option value="all">{t('ops.filter.all')}</option>
              </select>
            </label>
            <p className="debt-help">{t('ops.alerts.help')}</p>
            {visibleAlerts.length === 0
              ? <StateMessage variant="empty" title={t('ops.alerts.empty')} compact />
              : <div className="table-wrap"><table className="data-table">
                  <caption className="visually-hidden">{t('ops.alerts.caption')}</caption>
                  <thead><tr><th scope="col">{t('ops.col.urgency')}</th><th scope="col">{t('ops.col.domain')}</th><th scope="col" data-secondary>{t('ops.col.reason')}</th><th scope="col" data-secondary>{t('ops.col.client')}</th><th scope="col" data-narrow-hide>{t('ops.col.time')}</th><th scope="col">{t('ops.col.action')}</th></tr></thead>
                  <tbody>
                    {visibleAlerts.map((alert) => (
                      <tr key={alert.id}>
                        <td>{alert.stalePrediction
                          ? <SeverityBadge level="info" label={t('ops.urgency.historical')} />
                          : alert.urgency === 'Critical' ? <SeverityBadge level="critical" label={t('ops.urgency.critical')} /> : <SeverityBadge level="info" label={t('ops.urgency.unknown')} />}</td>
                        <td><span className="mono">{alert.domain}</span></td>
                        <td data-secondary><span className="cell-clip" title={alert.reason}>{alert.reason}</span></td>
                        <td data-secondary>{alert.employee_email || 'ML'}<small className="cell-sub">{alert.source.toUpperCase()}{alert.confidence != null ? ` · ${Math.round(alert.confidence * 100)}%` : ''}</small></td>
                        <td data-narrow-hide title={new Date(alert.created_at).toLocaleString()}>{ago(alert.created_at)}</td>
                        <td>{alert.status === 'open'
                          ? <span className="ops-actions">
                              <button type="button" className="btn" disabled={!!busy} onClick={() => openReview({ kind: 'alert', item: alert, action: 'allow' }, t('ops.dialog.defaultAllow'))}><CheckCircle2 size={14} aria-hidden="true" />{t('ops.action.allow')}</button>
                              <button type="button" className="btn btn-danger" disabled={!!busy} onClick={() => openReview({ kind: 'alert', item: alert, action: 'block' }, t('ops.dialog.defaultBlock'))}><Ban size={14} aria-hidden="true" />{t('ops.action.block')}</button>
                            </span>
                          : <StatusChip tone={alert.status === 'blocked' ? 'bad' : 'ok'}>{t(alert.status === 'blocked' ? 'ops.status.blocked' : 'ops.status.allowed')}</StatusChip>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table></div>}
          </section>

          <section className="ops-block" aria-labelledby="ops-traffic">
            <div className="ops-head"><h3 id="ops-traffic">{t('ops.traffic.title')}</h3><span className="emp-muted">{t('ops.traffic.count', { n: traffic.length })}</span></div>
            {traffic.length === 0
              ? <StateMessage variant="empty" title={t('ops.traffic.empty')} compact />
              : <div className="table-wrap"><table className="data-table">
                  <caption className="visually-hidden">{t('ops.traffic.caption')}</caption>
                  <thead><tr><th scope="col" data-narrow-hide>{t('ops.col.time')}</th><th scope="col">{t('ops.col.domain')}</th><th scope="col" data-secondary>{t('ops.col.client')}</th><th scope="col">{t('ops.col.decision')}</th><th scope="col" data-secondary>{t('ops.col.source')}</th><th scope="col">{t('ops.col.action')}</th></tr></thead>
                  <tbody>
                    {traffic.slice(0, TRAFFIC_ROWS).map((item) => (
                      <tr key={item.event_id}>
                        <td data-narrow-hide title={new Date(item.occurred_at).toLocaleString()}>{ago(item.occurred_at)}</td>
                        <td><span className="mono">{item.domain}{item.port ? `:${item.port}` : ''}</span></td>
                        <td data-secondary>{item.employee_email || t('ops.traffic.unidentified')}</td>
                        <td>{item.action === 'block'
                          ? <StatusChip tone="bad">{t('ops.status.blocked')}</StatusChip>
                          : ['soc', 'ml'].includes(item.decision_source) ? <StatusChip tone="ok">{t('ops.status.allowed')}</StatusChip> : <StatusChip tone="warn">{t('ops.traffic.unknownAllowed')}</StatusChip>}</td>
                        <td data-secondary><span className="cell-clip" title={item.reason}>{item.method} · {item.decision_source.toUpperCase()}</span></td>
                        <td>{item.action !== 'block' && <button type="button" className="btn btn-danger" disabled={!!busy} onClick={() => openReview({ kind: 'traffic', item, action: 'block' }, t('ops.dialog.defaultTraffic'))}><Ban size={14} aria-hidden="true" />{t('ops.action.block')}</button>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table></div>}
            {traffic.length > TRAFFIC_ROWS && <p className="emp-muted">{t('ops.traffic.more', { n: TRAFFIC_ROWS })}</p>}
          </section>
        </div>

        <aside className="ops-side">
          <form className="ops-card" onSubmit={submitManual} noValidate>
            <h3>{t('ops.policy.title')}</h3>
            <div className="field"><label htmlFor="policy-domain">{t('ops.policy.domain')}</label><input id="policy-domain" required value={domain} onChange={(event) => setDomain(event.target.value)} placeholder={t('ops.policy.placeholder')} /><small>{t('ops.policy.hint')}</small></div>
            <div className="field"><label htmlFor="policy-action">{t('ops.policy.decision')}</label><select id="policy-action" value={action} onChange={(event) => setAction(event.target.value as 'block' | 'allow')}><option value="block">{t('ops.action.block')}</option><option value="allow">{t('ops.action.allow')}</option></select></div>
            <div className="field" data-invalid={Boolean(policyError)}><label htmlFor="policy-reason">{t('ops.policy.reason')}</label><textarea id="policy-reason" required minLength={5} value={reason} onChange={(event) => setReason(event.target.value)} placeholder={t('ops.policy.reason.placeholder')} />{policyError && <small className="field-error" role="alert">{policyError}</small>}</div>
            <button type="submit" className="btn btn-primary" disabled={busy === 'manual'}>{busy === 'manual' ? t('ops.policy.saving') : t('ops.policy.apply')}</button>
          </form>

          <div className="ops-card">
            <h3>{t('ops.recent.title')}</h3>
            {verdicts.length === 0 && <p className="emp-muted">{t('ops.recent.empty')}</p>}
            <ul className="emp-list">
              {verdicts.slice(0, 8).map((item) => (
                <li key={item.id}>
                  <span className="emp-list-main"><span className="mono">{item.domain}</span><small>{item.source === 'soc' ? t('ops.recent.manual') : t('ops.recent.model', { v: item.model_version || '' })}</small></span>
                  <StatusChip tone={item.decision === 'block' ? 'bad' : 'ok'}>{t(item.decision === 'block' ? 'ops.status.blocked' : 'ops.status.allowed')}</StatusChip>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>

      <Dialog open={review !== null} onClose={() => { if (!busy) setReview(null); }} busy={!!busy} size="md" title={blocking ? t('ops.dialog.block') : t('ops.dialog.allow')}>
        {review && <>
          <p className="decision-domain mono">{review.item.domain}</p>
          {review.item.reason && <p className="decision-reason-text">{review.item.reason}</p>}
          <DomainSecondOpinion domain={review.item.domain} />
          <form className="ui-form" onSubmit={submitReview}>
            <div className="field" data-invalid={Boolean(reviewError)}>
              <label htmlFor="decision-reason">{t('ops.dialog.reason')}</label>
              <textarea id="decision-reason" autoFocus required minLength={5} maxLength={1000} rows={3} value={reviewReason} onChange={event => setReviewReason(event.target.value)} />
              <small>{t('ops.dialog.hint')}</small>
              {reviewError && <small className="field-error" role="alert">{reviewError}</small>}
            </div>
            <div className="ui-dialog-footer">
              <button type="button" className="btn" disabled={!!busy} onClick={() => setReview(null)}>{t('common.cancel')}</button>
              <button type="submit" className={`btn ${blocking ? 'btn-danger' : 'btn-primary'}`} disabled={!!busy}>{busy ? t('ops.dialog.saving') : blocking ? t('ops.dialog.confirmBlock') : t('ops.dialog.confirmAllow')}</button>
            </div>
          </form>
        </>}
      </Dialog>
    </section>
  );
}
