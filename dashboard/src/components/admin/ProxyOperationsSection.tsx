'use client';

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Activity, Ban, CheckCircle2, Clock3, Radio, ShieldAlert, SlidersHorizontal, X } from 'lucide-react';
import DomainSecondOpinion from './DomainSecondOpinion';

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

export default function ProxyOperationsSection() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [verdicts, setVerdicts] = useState<Verdict[]>([]);
  const [traffic, setTraffic] = useState<Traffic[]>([]);
  const [streamOnline, setStreamOnline] = useState(false);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [domain, setDomain] = useState('');
  const [action, setAction] = useState<'block' | 'allow'>('block');
  const [reason, setReason] = useState('');
  const [queueFilter, setQueueFilter] = useState('actionable');
  const [review, setReview] = useState<
    { kind: 'alert'; item: Alert; action: 'block' | 'allow' } |
    { kind: 'traffic'; item: Traffic; action: 'block' } | null
  >(null);
  const [reviewReason, setReviewReason] = useState('');
  const [reviewError, setReviewError] = useState('');
  const reviewDialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (review) reviewDialog.current?.showModal();
  }, [review]);

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
    if (!alertResponse.ok || !verdictResponse.ok || !trafficResponse.ok) setMessage('Some telemetry could not refresh. Showing the last snapshot.');
    } catch { setMessage('Could not refresh telemetry. Check the backend connection.'); }
  }, []);

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

  const decideAlert = async (alert: Alert, nextAction: 'block' | 'allow', decisionReason: string) => {
    setBusy(alert.id);
    try {
    const response = await fetch(`/api/proxy/alerts/${alert.id}/decision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: nextAction, reason: decisionReason }),
    });
    const payload = await response.json();
    setMessage(response.ok ? `Policy updated for ${alert.domain}.` : payload.error || 'Could not save the decision.');
    if (response.ok) await load();
    else setReviewError(payload.error || 'Could not save the decision.');
    return response.ok;
    } catch {
      setReviewError('Decision unconfirmed. Check the policy before retrying.');
      return false;
    }
    finally { setBusy(''); }
  };

  const submitManual = async (event: FormEvent) => {
    event.preventDefault();
    setBusy('manual');
    try {
    const response = await fetch('/api/proxy/manual-decision', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain, action, reason }),
    });
    const payload = await response.json();
    setMessage(response.ok
      ? `${action.toUpperCase()} policy applied to ${payload.verdict?.domain || domain} and all subdomains. Reload existing HTTPS connections.`
      : payload.error || 'Could not save the policy.');
    if (response.ok) {
      setDomain(''); setReason(''); await load();
    }
    } catch { setMessage('Policy unconfirmed. Your form has been preserved.'); }
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
    setMessage(response.ok
      ? `BLOCK applied to ${payload.verdict?.domain || item.domain}. New proxy connections will be denied.`
      : payload.error || 'Could not block this domain.');
    if (response.ok) await load();
    else setReviewError(payload.error || 'Could not block this domain.');
    return response.ok;
    } catch {
      setReviewError('Block unconfirmed. Check the policy before retrying.');
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

  return (
    <section className="proxy-ops">
      <div className="proxy-ops-hero glass-card">
        <div><div className="proxy-ops-kicker"><Radio size={13} /> Proxy monitoring</div><h2>Traffic & policies</h2><p>Monitor access and manage domain policies.</p></div>
        <div className={`proxy-stream ${streamOnline ? 'online' : ''}`}><span /> {streamOnline ? 'Connected' : 'Reconnecting'}</div>
      </div>

      <div className="proxy-stat-grid">
        <div className="glass-card"><Activity size={18} /><strong>{counts.traffic}</strong><span>Recent traffic</span></div>
        <div className="glass-card"><Ban size={18} /><strong>{counts.blocked}</strong><span>SOC blocks</span></div>
        <div className="glass-card"><ShieldAlert size={18} /><strong>{counts.open}</strong><span>Open alerts</span></div>
      </div>

      {message && <div className="proxy-ops-message">{message}</div>}

      <div className="glass-card proxy-alert-panel">
        <div className="proxy-section-title"><div><span>Monitoring</span><h3>Live traffic</h3></div><b>{traffic.length} events</b></div>
        <div className="proxy-alert-list proxy-traffic-list">
          {traffic.length === 0 && <div className="proxy-empty"><Activity size={22} /> No traffic received from Squid yet.</div>}
          {traffic.map((item) => (
            <article key={item.event_id} className="proxy-alert">
              <div className="proxy-alert-top">
                <span className={`urgency ${item.action === 'block' ? 'critical' : 'unknown'}`}>
                  {item.action === 'block' ? 'Blocked' : ['soc', 'ml'].includes(item.decision_source) ? 'Allowed' : 'Unknown · allowed'}
                </span>
                <span className="proxy-time"><Clock3 size={12} /> {new Date(item.occurred_at).toLocaleString('en-GB')}</span>
              </div>
              <h4>{item.domain}{item.port ? `:${item.port}` : ''}</h4>
              <p>{item.reason}</p>
              <div className="proxy-alert-meta"><span>{item.employee_email || 'Unidentified client'}</span><span>{item.method} · {item.decision_source.toUpperCase()}</span></div>
              <DomainSecondOpinion domain={item.domain} />
              {item.action !== 'block' && (
                <div className="proxy-alert-actions">
                  <button disabled={!!busy} onClick={() => { setReview({ kind: 'traffic', item, action: 'block' }); setReviewReason('Blocked from live traffic by SOC'); setReviewError(''); }} className="block"><Ban size={14} /> Block</button>
                </div>
              )}
            </article>
          ))}
        </div>
      </div>

      <div className="proxy-ops-grid">
        <div className="glass-card proxy-alert-panel">
          <div className="proxy-section-title"><div><span>Review</span><h3>Security alerts</h3></div><b>{counts.open} open</b></div>
          <label className="proxy-queue-filter">Show<select value={queueFilter} onChange={event => setQueueFilter(event.target.value)}><option value="actionable">Critical & employee reports</option><option value="unknown">Unknown — monitoring</option><option value="history">History / older models</option><option value="all">All observations</option></select></label>
          <p className="debt-help">Unknown does not mean malicious. ML confidence is not proof of compromise.</p>
          <div className="proxy-alert-list">
            {visibleAlerts.length === 0 && <div className="proxy-empty"><Activity size={22} /> No alerts in this category.</div>}
            {visibleAlerts.map((alert) => (
              <article key={alert.id} className={`proxy-alert ${alert.status !== 'open' ? 'resolved' : ''}`}>
                <div className="proxy-alert-top"><span className={`urgency ${alert.stalePrediction ? 'unknown' : alert.urgency.toLowerCase()}`}>{alert.stalePrediction ? 'Historical prediction' : alert.urgency}</span><span className="proxy-time"><Clock3 size={12} /> {new Date(alert.created_at).toLocaleString('en-GB')}</span></div>
                <h4>{alert.domain}</h4><p>{alert.reason}</p>
                <div className="proxy-alert-meta"><span>{alert.employee_email || 'ML callback'}</span><span>{alert.source.toUpperCase()}{alert.confidence != null ? ` · ${Math.round(alert.confidence * 100)}%` : ''}</span></div>
                <DomainSecondOpinion domain={alert.domain} />
                {alert.status === 'open' ? <div className="proxy-alert-actions"><button disabled={!!busy} onClick={() => { setReview({ kind: 'alert', item: alert, action: 'allow' }); setReviewReason('False positive, allowed by SOC'); setReviewError(''); }} className="allow"><CheckCircle2 size={14} /> Allow</button><button disabled={!!busy} onClick={() => { setReview({ kind: 'alert', item: alert, action: 'block' }); setReviewReason('Confirmed malicious by SOC'); setReviewError(''); }} className="block"><Ban size={14} /> Block</button></div> : <div className={`proxy-resolution ${alert.status}`}>{alert.status}</div>}
              </article>
            ))}
          </div>
        </div>

        <div className="proxy-ops-side">
          <form className="glass-card proxy-manual" onSubmit={submitManual}>
            <div className="proxy-section-title"><div><span>SOC decision</span><h3>Domain policy</h3></div><SlidersHorizontal size={18} /></div>
            <label>Domain<input required value={domain} onChange={(event) => setDomain(event.target.value)} placeholder="contoh-domain.id" /></label>
            <small>Applies to this domain and all subdomains. Check the spelling.</small>
            <label>Decision<select value={action} onChange={(event) => setAction(event.target.value as 'block' | 'allow')}><option value="block">Block</option><option value="allow">Allow</option></select></label>
            <label>Reason<textarea required minLength={5} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Decision reason (required)" /></label>
            <button className="btn btn-primary" disabled={busy === 'manual'}>{busy === 'manual' ? 'Saving…' : 'Apply policy'}</button>
          </form>

          <div className="glass-card proxy-verdicts"><div className="proxy-section-title"><div><span>Saved policies</span><h3>Recent decisions</h3></div></div>{verdicts.slice(0, 8).map((item) => <div className="proxy-verdict-row" key={item.id}><div><strong>{item.domain}</strong><span>{item.source === 'soc' ? 'Manual SOC' : `ML ${item.model_version || ''}`}</span></div><b className={item.decision}>{item.decision}</b></div>)}</div>
        </div>
      </div>
      {review && <dialog ref={reviewDialog} className="inbox-dialog" aria-labelledby="decision-title" onCancel={event => { if (busy) event.preventDefault(); else setReview(null); }}>
        <button className="account-close" aria-label="Close" disabled={!!busy} onClick={() => setReview(null)}><X size={20} /></button>
        <h2 id="decision-title">{review.action === 'block' ? 'Block this domain?' : 'Allow this domain?'}</h2>
        <p className="decision-domain">{review.item.domain}</p>
        <form className="debt-form" onSubmit={async event => {
          event.preventDefault();
          if (busy) return;
          const trimmedReason = reviewReason.trim();
          if (trimmedReason.length < 5) { setReviewError('Enter a reason with at least 5 characters.'); return; }
          setReviewError('');
          const saved = review.kind === 'alert'
            ? await decideAlert(review.item, review.action, trimmedReason)
            : await blockTraffic(review.item, trimmedReason);
          if (saved) setReview(null);
        }}>
          <label>Decision reason<textarea autoFocus required minLength={5} maxLength={1000} rows={3} value={reviewReason} onChange={event => setReviewReason(event.target.value)} /></label>
          <small>This decision and its reason are recorded in the SOC audit.</small>
          {reviewError && <p className="debt-error" role="alert">{reviewError}</p>}
          <div className="decision-actions"><button type="button" className="btn" disabled={!!busy} onClick={() => setReview(null)}>Cancel</button><button className={`btn ${review.action === 'block' ? 'btn-danger' : 'btn-primary'}`} disabled={!!busy}>{busy ? 'Saving…' : review.action === 'block' ? 'Confirm Block' : 'Confirm Allow'}</button></div>
        </form>
      </dialog>}
    </section>
  );
}
