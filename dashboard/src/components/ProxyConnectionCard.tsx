'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, Copy, Download, Globe2, Loader2, Network, ShieldCheck, WifiOff } from 'lucide-react';

type ProxyStatus = {
  registered: boolean;
  connected: boolean;
  deviceId?: string;
  label?: string;
  sourceIpHint?: string;
  lastProxySeenAt?: string | null;
};

type ProbeState = 'checking' | 'connected' | 'disconnected';

async function probeSystemProxy(url: string) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 2500);
  try {
    await fetch(`${url}${url.includes('?') ? '&' : '?'}nonce=${Date.now()}`, {
      cache: 'no-store',
      mode: 'no-cors',
      signal: controller.signal,
    });
    return true;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timeout);
  }
}

async function responseError(response: Response, fallback: string) {
  try {
    const payload = await response.json();
    return String(payload.error || fallback);
  } catch {
    return fallback;
  }
}

export default function ProxyConnectionCard() {
  const [status, setStatus] = useState<ProxyStatus>({ registered: false, connected: false });
  const [proxyUrl, setProxyUrl] = useState('http://127.0.0.1:3128');
  const [proxyProbeUrl, setProxyProbeUrl] = useState('');
  const [probeState, setProbeState] = useState<ProbeState>('checking');
  const [apiBase, setApiBase] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const deviceFetch = useCallback((path: string, options?: RequestInit) => fetch(
    `${apiBase}${path}`,
    { ...options, credentials: 'include' },
  ), [apiBase]);

  const loadStatus = useCallback(async () => {
    const configResponse = await fetch('/api/config', { cache: 'no-store' });
    const config = configResponse.ok ? await configResponse.json() : {};
    const runtimeApiBase = String(config.apiUrl || `${window.location.protocol}//${window.location.hostname}:5000`).replace(/\/$/, '');
    setApiBase(runtimeApiBase);
    if (config.proxyUrl) setProxyUrl(config.proxyUrl);
    setProxyProbeUrl(String(
      config.proxyProbeUrl || 'http://proxy-check.afferent.invalid/__afferent_probe__',
    ));
    const directFetch = (path: string, options?: RequestInit) => fetch(
      `${runtimeApiBase}${path}`,
      { ...options, credentials: 'include' },
    );
    const statusResponse = await directFetch('/api/proxy/device/status', { cache: 'no-store' });
    if (!statusResponse.ok) {
      throw new Error(await responseError(
        statusResponse,
        statusResponse.status === 401
          ? 'Sesi SSO tidak terbaca oleh layanan proxy. Muat ulang dashboard.'
          : 'Status proxy tidak dapat dibaca',
      ));
    }
    const statusPayload = await statusResponse.json();
    let currentStatus = statusPayload.status as ProxyStatus;
    if (!currentStatus.registered) {
      const registration = await directFetch('/api/proxy/device/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: 'Perangkat utama' }),
      });
      if (!registration.ok) {
        throw new Error(await responseError(registration, 'Aktivasi perangkat gagal'));
      }
      currentStatus = (await registration.json()).status;
    }
    setStatus(currentStatus);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadStatus()
        .then(() => setError(''))
        .catch((err) => setError(err instanceof Error ? err.message : 'Layanan proxy belum siap.'))
        .finally(() => setLoading(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadStatus]);

  useEffect(() => {
    if (!proxyProbeUrl) return;
    let active = true;
    const probe = async () => {
      const connected = await probeSystemProxy(proxyProbeUrl);
      if (active) setProbeState(connected ? 'connected' : 'disconnected');
    };
    setProbeState('checking');
    void probe();
    const timer = window.setInterval(() => void probe(), 5_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [proxyProbeUrl]);

  useEffect(() => {
    if (!status.registered) return;
    const heartbeat = async () => {
      try {
        const response = await deviceFetch('/api/proxy/device/heartbeat', { method: 'POST' });
        if (response.ok) {
          setStatus((await response.json()).status);
          setError('');
        } else {
          setError(await responseError(response, 'Heartbeat proxy gagal'));
        }
      } catch {
        setError('Koneksi ke layanan proxy terputus');
      }
    };
    const timer = window.setInterval(() => void heartbeat(), 10_000);
    return () => window.clearInterval(timer);
  }, [deviceFetch, status.registered]);

  const activate = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await deviceFetch('/api/proxy/device/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: 'Perangkat utama' }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Aktivasi gagal');
      setStatus(payload.status);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Aktivasi gagal');
    } finally {
      setLoading(false);
    }
  };

  const copyProxy = async () => {
    await navigator.clipboard.writeText(proxyUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  const proxyConnected = status.registered && probeState === 'connected';
  const proxyFailed = status.registered && probeState === 'disconnected';
  const stateColor = proxyConnected ? '#22c55e' : proxyFailed ? '#ef4444' : status.registered ? '#f59e0b' : '#94a3b8';
  const StateIcon = proxyConnected ? ShieldCheck : proxyFailed ? WifiOff : status.registered ? Network : WifiOff;
  const title = proxyConnected
    ? 'Terhubung ke AFFERENT Proxy'
    : proxyFailed
      ? 'Gagal terhubung ke AFFERENT Proxy'
    : status.registered
      ? 'Perangkat terdaftar — menunggu traffic proxy'
      : 'Menyiapkan perlindungan traffic';

  return (
    <section className="glass-card proxy-connect-card" aria-live="polite">
      <div className="proxy-connect-main">
        <div className="proxy-connect-icon" style={{ color: stateColor, borderColor: `${stateColor}55`, background: `${stateColor}12` }}>
          <StateIcon size={24} />
        </div>
        <div>
          <div className="proxy-eyebrow"><span style={{ background: stateColor }} /> LIVE DEVICE SECURITY</div>
          <h2>{title}</h2>
          <p>
            {proxyConnected
              ? 'Traffic domain Anda sedang dimonitor. Domain berbahaya diblokir otomatis dan dicatat untuk SOC.'
              : proxyFailed
                ? 'Proxy sistem tidak aktif atau tidak dapat dijangkau. Aktifkan kembali proxy perangkat untuk melanjutkan monitoring.'
              : status.registered
                ? 'Atur proxy perangkat ke alamat di samping, lalu buka situs apa pun untuk menyelesaikan koneksi.'
                : 'Daftarkan perangkat ini setelah login, lalu gunakan alamat proxy pada pengaturan jaringan sistem operasi.'}
          </p>
          {error && <div className="proxy-error">{error}</div>}
        </div>
      </div>
      <div className="proxy-connect-action">
        <span>HTTP / HTTPS proxy</span>
        <button type="button" className="proxy-address" onClick={copyProxy} title="Salin alamat proxy">
          <Globe2 size={15} /> {proxyUrl} {copied ? <Check size={14} /> : <Copy size={14} />}
        </button>
        {!status.registered && (
          <button type="button" className="btn btn-primary proxy-activate" onClick={activate} disabled={loading}>
            {loading ? <Loader2 size={16} className="spin" /> : <ShieldCheck size={16} />}
            Aktifkan perangkat
          </button>
        )}
        <a
          href="/api/proxy/ca.crt"
          download="afferent-proxy-ca.crt"
          className="btn btn-secondary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '6px 12px', marginTop: '6px', textDecoration: 'none' }}
          title="Download CA Certificate untuk HTTPS inspection"
        >
          <Download size={13} /> Download CA Cert
        </a>
        {status.registered && <small>IP binding: {status.sourceIpHint || 'tersimpan aman'}</small>}
      </div>
    </section>
  );
}
