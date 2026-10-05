'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useI18n } from '@/i18n/I18nProvider';
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

export interface ProxyReport { registered: boolean; connected: boolean; checking: boolean; failed: boolean }

export default function ProxyConnectionCard({ onStatus }: { onStatus?: (report: ProxyReport) => void }) {
  const { t } = useI18n();
  const tRef = useRef(t);
  useEffect(() => { tRef.current = t; }, [t]);
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
          ? tRef.current('proxy.err.session')
          : tRef.current('proxy.err.status'),
      ));
    }
    const statusPayload = await statusResponse.json();
    let currentStatus = statusPayload?.status as ProxyStatus | undefined;
    if (!currentStatus) throw new Error(tRef.current('proxy.err.status'));
    if (!currentStatus.registered) {
      const registration = await directFetch('/api/proxy/device/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: 'Perangkat utama' }),
      });
      if (!registration.ok) {
        throw new Error(await responseError(registration, tRef.current('proxy.err.activate')));
      }
      const registered = (await registration.json())?.status as ProxyStatus | undefined;
      if (!registered) throw new Error(tRef.current('proxy.err.activate'));
      currentStatus = registered;
    }
    setStatus(currentStatus);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadStatus()
        .then(() => setError(''))
        .catch((err) => setError(err instanceof Error ? err.message : tRef.current('proxy.err.unavailable')))
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
    // Preserve the verified ON/OFF probe; reset when its network target changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
          setError(await responseError(response, tRef.current('proxy.err.lost')));
        }
      } catch {
        setError(tRef.current('proxy.err.lost'));
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
      if (!response.ok) throw new Error(payload.error || tRef.current('proxy.err.activate'));
      setStatus(payload.status);
    } catch (err) {
      setError(err instanceof Error ? err.message : tRef.current('proxy.err.activate'));
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
  useEffect(() => {
    onStatus?.({ registered: status.registered, connected: status.registered && probeState === 'connected', checking: loading || (status.registered && probeState === 'checking'), failed: Boolean(error) });
  }, [onStatus, status.registered, probeState, loading, error]);
  const proxyFailed = status.registered && probeState === 'disconnected';
  const stateColor = proxyConnected ? '#22c55e' : proxyFailed ? '#ef4444' : status.registered ? '#f59e0b' : '#94a3b8';
  const StateIcon = proxyConnected ? ShieldCheck : proxyFailed ? WifiOff : status.registered ? Network : WifiOff;
  const title = proxyConnected
    ? t('proxy.on.title')
    : proxyFailed
      ? t('proxy.failed.title')
      : status.registered
        ? t('proxy.registered.title')
        : t('proxy.setup.title');

  return (
    <section className="glass-card proxy-connect-card" aria-live="polite">
      <div className="proxy-connect-main">
        <div className="proxy-connect-icon" style={{ color: stateColor, borderColor: `${stateColor}55`, background: `${stateColor}12` }}>
          <StateIcon size={24} />
        </div>
        <div>
          <div className="proxy-eyebrow"><span style={{ background: stateColor }} /> {t('proxy.eyebrow')}</div>
          <h2>{title}</h2>
          <p>
            {proxyConnected
              ? t('proxy.on.body')
              : proxyFailed
                ? t('proxy.failed.body')
              : status.registered
                ? t('proxy.registered.body')
                : t('proxy.setup.body')}
          </p>
          {error && <div className="proxy-error">{error}</div>}
        </div>
      </div>
      <div className="proxy-connect-action">
        <span>{t('proxy.address')}</span>
        <button type="button" className="proxy-address" onClick={copyProxy} title={t('proxy.copy')} aria-label={t('proxy.copy')}>
          <Globe2 size={15} /> {proxyUrl} {copied ? <Check size={14} /> : <Copy size={14} />}
        </button>
        {!status.registered && (
          <button type="button" className="btn btn-primary proxy-activate" onClick={activate} disabled={loading}>
            {loading ? <Loader2 size={16} className="spin" /> : <ShieldCheck size={16} />}
            {t('proxy.activate')}
          </button>
        )}
        <a
          href="/api/proxy/ca.crt"
          download="afferent-proxy-ca.crt"
          className="btn btn-secondary proxy-ca-download"
          title={t('proxy.ca.hint')}
        >
          <Download size={13} /> {t('proxy.ca')}
        </a>
        {status.registered && <small>{t('proxy.ip', { ip: status.sourceIpHint || t('proxy.ip.stored') })}</small>}
      </div>
    </section>
  );
}
