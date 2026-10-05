'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import Logo from '@/components/Logo';
import ThemeToggle from '@/components/ThemeToggle';
import LanguageSwitch from '@/components/ui/LanguageSwitch';
import SeverityBadge from '@/components/ui/SeverityBadge';
import Field from '@/components/ui/Field';
import StateMessage from '@/components/ui/StateMessage';
import { useAuth } from '@/context/AuthContext';
import { useI18n } from '@/i18n/I18nProvider';
import type { MessageKey } from '@/i18n/messages';
import './blocked.css';

/** Turns whatever arrives in ?reason= into one of a few plain sentences. Raw codes are never shown. */
function reasonKey(reason: string | null): MessageKey {
  const value = (reason || '').toLowerCase();
  if (/phish|credential|lookalike|impersonat/.test(value)) return 'blocked.reason.phishing';
  if (/malware|malicious|trojan|ransom|virus/.test(value)) return 'blocked.reason.malware';
  if (/polic|categor|rule/.test(value)) return 'blocked.reason.policy';
  if (/pending|review|check|scan|unknown/.test(value)) return 'blocked.reason.pending';
  return 'blocked.reason.unknown';
}

/** Shows only the host, whether we were given "example.com" or a full address. */
function hostOf(raw: string | null): string | null {
  const value = (raw || '').trim();
  if (!value) return null;
  try { return new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `https://${value}`).host || null; } catch { return null; }
}

function BlockedContent() {
  const params = useSearchParams();
  const { t } = useI18n();
  const { isAuthenticated, isLoading } = useAuth();
  const domain = hostOf(params.get('domain') || params.get('url'));
  const [formOpen, setFormOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [phase, setPhase] = useState<'idle' | 'sending' | 'sent' | 'duplicate' | 'failed'>('idle');

  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (reason.trim().length < 5) { setFieldError(t('blocked.form.tooShort')); return; }
    setFieldError(''); setPhase('sending');
    try {
      // A dedicated access request: no scan, no reward. The security team answers it from the Security inbox.
      const res = await fetch('/api/access-requests', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain, reason: reason.trim() }),
      });
      const body = await res.json().catch(() => ({}));
      setPhase(!res.ok ? 'failed' : body.duplicate ? 'duplicate' : 'sent');
    } catch { setPhase('failed'); }
  }

  const canRequest = Boolean(domain);
  return (
    <div className="notice-page">
      <header className="notice-bar">
        <span className="notice-brand"><Logo variant="mark" size={26} />{t('blocked.brand').toUpperCase()}</span>
        <span className="notice-tools"><LanguageSwitch /><ThemeToggle /></span>
      </header>
      <main className="notice-main" id="content">
        <article className="notice-card" aria-labelledby="blocked-title">
          <div><SeverityBadge level="high" label={t('blocked.status')} /></div>
          <div>
            <h1 id="blocked-title">{t('blocked.heading')}{' '}{!domain && t('blocked.noAddress')}</h1>
            {domain && <span className="notice-domain">{domain}</span>}
          </div>
          <p className="notice-lead">{t(reasonKey(params.get('reason')))} {t('blocked.private')}</p>

          <div className="notice-actions">
            {canRequest && (isAuthenticated || isLoading
              ? <button type="button" className="btn btn-primary" aria-expanded={formOpen} aria-controls="request-access" onClick={() => setFormOpen(open => !open)} disabled={phase === 'sent' || phase === 'duplicate'}>{t('blocked.requestAccess')}</button>
              : <Link className="btn btn-primary" href="/auth">{t('blocked.signIn')}</Link>)}
            <Link className="btn" href="/">{t('blocked.goDashboard')}</Link>
          </div>
          {canRequest && !isAuthenticated && !isLoading && <p className="notice-help">{t('blocked.signInHint')}</p>}

          {formOpen && isAuthenticated && phase !== 'sent' && phase !== 'duplicate' && (
            <form id="request-access" className="notice-request" onSubmit={send} noValidate>
              <Field label={t('blocked.form.label')} hint={t('blocked.form.hint')} error={fieldError || undefined}>
                {control => <textarea {...control} rows={3} maxLength={1000} placeholder={t('blocked.form.placeholder')} value={reason} onChange={e => { setReason(e.target.value); if (fieldError) setFieldError(''); }} />}
              </Field>
              {phase === 'failed' && <div className="notice-banner" data-tone="bad" role="alert"><strong>{t('blocked.fail.title')}</strong>{t('blocked.fail.body')}</div>}
              <button className="btn btn-primary" disabled={phase === 'sending'}>{phase === 'sending' ? t('blocked.form.sending') : t('blocked.form.send')}</button>
            </form>
          )}
          {phase === 'duplicate' && <div className="notice-banner" data-tone="ok" role="status"><strong>{t('blocked.dup.title')}</strong>{t('blocked.dup.body', { domain: domain ?? '' })}</div>}
          {phase === 'sent' && <div className="notice-banner" data-tone="ok" role="status"><strong>{t('blocked.sent.title')}</strong>{t('blocked.sent.body', { domain: domain ?? '' })}</div>}

          <p className="notice-help">{t('blocked.help')}</p>
        </article>
      </main>
      <footer className="notice-foot">{t('blocked.footer')}</footer>
    </div>
  );
}

export default function BlockedPage() {
  return <Suspense fallback={<div className="notice-page"><main className="notice-main"><StateMessage variant="loading" /></main></div>}><BlockedContent /></Suspense>;
}
