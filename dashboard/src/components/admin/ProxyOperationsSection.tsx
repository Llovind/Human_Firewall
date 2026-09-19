'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, Ban, CheckCircle2, Clock3, Radio, ShieldAlert, Sparkles } from 'lucide-react';

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

  const load = useCallback(async () => {
    const [alertResponse, verdictResponse, trafficResponse] = await Promise.all([
      fetch('/api/proxy/alerts', { cache: 'no-store' }),
      fetch('/api/proxy/verdicts', { cache: 'no-store' }),
      fetch('/api/proxy/traffic?limit=200', { cache: 'no-store' }),
    ]);
    if (alertResponse.ok) setAlerts((await alertResponse.json()).alerts || []);
    if (verdictResponse.ok) setVerdicts((await verdictResponse.json()).verdicts || []);
    if (trafficResponse.ok) setTraffic((await trafficResponse.json()).events || []);
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

  const decideAlert = async (alert: Alert, nextAction: 'block' | 'allow') => {
    const decisionReason = window.prompt(
      `Alasan ${nextAction === 'block' ? 'pemblokiran' : 'allow'} untuk ${alert.domain}:`,
      nextAction === 'block' ? 'Dikonfirmasi berbahaya oleh SOC' : 'False positive, diizinkan oleh SOC',
    );
    if (!decisionReason) return;
    setBusy(alert.id);
    const response = await fetch(`/api/proxy/alerts/${alert.id}/decision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: nextAction, reason: decisionReason }),
    });
    const payload = await response.json();
    setMessage(response.ok ? `Kebijakan ${alert.domain} diperbarui.` : payload.error || 'Keputusan gagal.');
    setBusy('');
    if (response.ok) await load();
  };

  const submitManual = async (event: FormEvent) => {
    event.preventDefault();
    setBusy('manual');
    const response = await fetch('/api/proxy/manual-decision', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain, action, reason }),
    });
    const payload = await response.json();
    setMessage(response.ok
      ? `Manual override ${action.toUpperCase()} aktif untuk ${payload.verdict?.domain || domain} dan seluruh subdomainnya. Koneksi HTTPS yang sudah terbuka perlu dimuat ulang.`
      : payload.error || 'Gagal menyimpan kebijakan.');
    setBusy('');
    if (response.ok) {
      setDomain(''); setReason(''); await load();
    }
  };

  const blockTraffic = async (item: Traffic) => {
    const decisionReason = window.prompt(
      `Alasan pemblokiran ${item.domain}:`,
      'Diblokir dari live traffic oleh SOC',
    );
    if (!decisionReason) return;
    setBusy(item.event_id);
    const response = await fetch('/api/proxy/manual-decision', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: item.domain, action: 'block', reason: decisionReason }),
    });
    const payload = await response.json();
    setMessage(response.ok
      ? `BLOCK aktif untuk ${payload.verdict?.domain || item.domain}. Request baru akan ditolak Squid.`
      : payload.error || 'Gagal memblokir domain.');
    setBusy('');
    if (response.ok) await load();
  };

  const counts = useMemo(() => ({
    open: alerts.filter((item) => item.status === 'open').length,
    blocked: verdicts.filter((item) => item.source === 'soc' && item.decision === 'block').length,
    traffic: traffic.length,
  }), [alerts, traffic, verdicts]);

  return (
    <section className="proxy-ops">
      <div className="proxy-ops-hero glass-card">
        <div><div className="proxy-ops-kicker"><Radio size={13} /> REAL-TIME CONTROL PLANE</div><h2>Centralized Proxy Operations</h2><p>Domain telemetry, ML verdict, dan manual override SOC dalam satu jalur audit.</p></div>
        <div className={`proxy-stream ${streamOnline ? 'online' : ''}`}><span /> {streamOnline ? 'SSE live' : 'Reconnecting'}</div>
      </div>

      <div className="proxy-stat-grid">
        <div className="glass-card"><Activity size={18} /><strong>{counts.traffic}</strong><span>Recent traffic</span></div>
        <div className="glass-card"><Ban size={18} /><strong>{counts.blocked}</strong><span>Blocked domains</span></div>
        <div className="glass-card"><ShieldAlert size={18} /><strong>{counts.open}</strong><span>Open alerts</span></div>
      </div>

      {message && <div className="proxy-ops-message">{message}</div>}

      <div className="glass-card proxy-alert-panel">
        <div className="proxy-section-title"><div><span>Passive monitoring</span><h3>Live proxy traffic</h3></div><b>{traffic.length} events</b></div>
        <div className="proxy-alert-list">
          {traffic.length === 0 && <div className="proxy-empty"><Activity size={22} /> Belum ada traffic dari Squid.</div>}
          {traffic.map((item) => (
            <article key={item.event_id} className="proxy-alert">
              <div className="proxy-alert-top">
                <span className={`urgency ${item.action === 'block' ? 'critical' : 'unknown'}`}>
                  {item.action === 'block' ? 'Blocked' : 'Unknown'}
                </span>
                <span className="proxy-time"><Clock3 size={12} /> {new Date(item.occurred_at).toLocaleString('id-ID')}</span>
              </div>
              <h4>{item.domain}{item.port ? `:${item.port}` : ''}</h4>
              <p>{item.reason}</p>
              <div className="proxy-alert-meta"><span>{item.employee_email || 'Unassigned proxy client'}</span><span>{item.method} · {item.decision_source.toUpperCase()}</span></div>
              {item.action !== 'block' && (
                <div className="proxy-alert-actions">
                  <button disabled={busy === item.event_id} onClick={() => void blockTraffic(item)} className="block"><Ban size={14} /> Block domain</button>
                </div>
              )}
            </article>
          ))}
        </div>
      </div>

      <div className="proxy-ops-grid">
        <div className="glass-card proxy-alert-panel">
          <div className="proxy-section-title"><div><span>Decision queue</span><h3>Live security alerts</h3></div><b>{counts.open} open</b></div>
          <div className="proxy-alert-list">
            {alerts.length === 0 && <div className="proxy-empty"><Activity size={22} /> Belum ada traffic alert.</div>}
            {alerts.map((alert) => (
              <article key={alert.id} className={`proxy-alert ${alert.status !== 'open' ? 'resolved' : ''}`}>
                <div className="proxy-alert-top"><span className={`urgency ${alert.urgency.toLowerCase()}`}>{alert.urgency}</span><span className="proxy-time"><Clock3 size={12} /> {new Date(alert.created_at).toLocaleString('id-ID')}</span></div>
                <h4>{alert.domain}</h4><p>{alert.reason}</p>
                <div className="proxy-alert-meta"><span>{alert.employee_email || 'ML callback'}</span><span>{alert.source.toUpperCase()}{alert.confidence != null ? ` · ${Math.round(alert.confidence * 100)}%` : ''}</span></div>
                {alert.status === 'open' ? <div className="proxy-alert-actions"><button disabled={busy === alert.id} onClick={() => void decideAlert(alert, 'allow')} className="allow"><CheckCircle2 size={14} /> Allow</button><button disabled={busy === alert.id} onClick={() => void decideAlert(alert, 'block')} className="block"><Ban size={14} /> Block</button></div> : <div className={`proxy-resolution ${alert.status}`}>{alert.status}</div>}
              </article>
            ))}
          </div>
        </div>

        <div className="proxy-ops-side">
          <form className="glass-card proxy-manual" onSubmit={submitManual}>
            <div className="proxy-section-title"><div><span>SOC override</span><h3>Manual domain policy</h3></div><Sparkles size={18} /></div>
            <label>Domain<input required value={domain} onChange={(event) => setDomain(event.target.value)} placeholder="contoh-domain.id" /></label>
            <small>Masukkan domain dengan tepat. Awalan www dinormalisasi otomatis dan policy berlaku untuk semua subdomain.</small>
            <label>Decision<select value={action} onChange={(event) => setAction(event.target.value as 'block' | 'allow')}><option value="block">Block</option><option value="allow">Allow</option></select></label>
            <label>Reason<textarea required minLength={5} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Alasan wajib untuk audit trail" /></label>
            <button className="btn btn-primary" disabled={busy === 'manual'}>{busy === 'manual' ? 'Menyimpan…' : 'Apply audited policy'}</button>
          </form>

          <div className="glass-card proxy-verdicts"><div className="proxy-section-title"><div><span>Hot verdict cache</span><h3>Latest policy</h3></div></div>{verdicts.slice(0, 8).map((item) => <div className="proxy-verdict-row" key={item.id}><div><strong>{item.domain}</strong><span>{item.source === 'soc' ? 'Manual SOC' : `ML ${item.model_version || ''}`}</span></div><b className={item.decision}>{item.decision}</b></div>)}</div>
        </div>
      </div>
    </section>
  );
}
