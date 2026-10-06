'use client';

import { FormEvent, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, CheckCircle2, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import Logo from '@/components/Logo';
import { SESSION_ENDED_KEY, useAuth } from '@/context/AuthContext';
import { useI18n } from '@/i18n/I18nProvider';
import LanguageSwitch from '@/components/ui/LanguageSwitch';
import ThemeToggle from '@/components/ThemeToggle';
import { ROLE_ROUTES } from '@/lib/authSession';
import type { MessageKey } from '@/i18n/messages';
import './auth.css';

type LoginStep = 'credentials' | 'otp' | 'success';

const KNOWN_CODES = ['INVALID_CREDENTIALS', 'RATE_LIMITED', 'INVALID_OTP', 'OTP_EXPIRED', 'OTP_LOCKED', 'INVALID_CHALLENGE', 'RESEND_COOLDOWN', 'EMAIL_DELIVERY_FAILED', 'INVALID_PAYLOAD', 'UNAUTHORIZED', 'SERVICE_UNAVAILABLE'];

/** The back end sends a stable code plus a sentence in one fixed language; show the sentence in the person's language. */
function messageFor(data: { code?: string; error?: string }, t: (key: MessageKey, vars?: Record<string, string | number>) => string, fallback: MessageKey) {
  if (!data.code || !KNOWN_CODES.includes(data.code)) return t(fallback);
  if (data.code === 'INVALID_OTP') {
    const left = /(\d+)\s*$/.exec(data.error ?? '')?.[1];
    return left ? t('auth.code.INVALID_OTP', { n: left }) : t('auth.code.INVALID_OTP.plain');
  }
  return t(`auth.code.${data.code}` as MessageKey);
}

function formatCountdown(seconds: number) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
  const remaining = (seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${remaining}`;
}

export default function AuthPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: sessionLoading, refreshSession } = useAuth();
  const { t } = useI18n();
  // True when this visit follows a session that ended on its own. Read from the browser without causing a hydration mismatch.
  const sessionEnded = useSyncExternalStore(
    () => () => {},
    () => { try { return window.sessionStorage.getItem(SESSION_ENDED_KEY) === '1'; } catch { return false; } },
    () => false,
  );
  const [step, setStep] = useState<LoginStep>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [expiresIn, setExpiresIn] = useState(300);
  const [resendIn, setResendIn] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!sessionLoading && isAuthenticated && user) {
      try { window.sessionStorage.removeItem(SESSION_ENDED_KEY); } catch { /* nothing to clear */ }
      router.replace(ROLE_ROUTES[user.role] || '/');
    }
  }, [isAuthenticated, router, sessionLoading, user]);

  useEffect(() => {
    if (step !== 'otp') return;
    const timer = window.setInterval(() => {
      setExpiresIn((value) => Math.max(0, value - 1));
      setResendIn((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [step]);

  const maskedEmail = useMemo(() => {
    const [name, domain] = email.split('@');
    if (!domain) return email;
    return `${name.slice(0, 2)}${'•'.repeat(Math.max(2, name.length - 2))}@${domain}`;
  }, [email]);

  async function handleCredentials(event: FormEvent) {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(messageFor(data, t, 'auth.err.signin'));
      setChallengeId(data.challengeId);
      setExpiresIn(Number(data.expiresIn || 300));
      setResendIn(Number(data.resendCooldown || 60));
      setPassword('');
      setStep('otp');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('auth.err.signin'));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleOtp(event: FormEvent) {
    event.preventDefault();
    if (otp.length !== 6) {
      setError(t('auth.err.code'));
      return;
    }
    setError('');
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challengeId, otp }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(messageFor(data, t, 'auth.err.invalidCode'));
      setStep('success');
      const authenticatedUser = await refreshSession();
      window.setTimeout(() => {
        router.replace(ROLE_ROUTES[authenticatedUser?.role || 'employee'] || '/');
      }, 700);
    } catch (caught) {
      setOtp('');
      setError(caught instanceof Error ? caught.message : t('auth.err.invalidCode'));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResend() {
    if (resendIn > 0 || !challengeId) return;
    setError('');
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/auth/resend-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challengeId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(messageFor(data, t, 'auth.err.resend'));
      setExpiresIn(Number(data.expiresIn || 300));
      setResendIn(Number(data.resendCooldown || 60));
      setOtp('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('auth.err.resend'));
    } finally {
      setIsSubmitting(false);
    }
  }

  const stepNumber = step === 'credentials' ? 1 : 2;
  return (
    <main className="login-page">
      <header className="login-top">
        <span className="login-brand"><Logo variant="mark" size={28} /><span>AFFERENT</span></span>
        <span className="login-tools"><LanguageSwitch /><ThemeToggle /></span>
      </header>

      <div className="login-card">
        {step !== 'success' && <p className="login-step">{t('auth.stepOf', { n: stepNumber })} · {step === 'credentials' ? t('auth.step.account') : t('auth.step.verify')}</p>}

        {step === 'credentials' && (
          <>
            <h1>{t('auth.title')}</h1>
            <p className="login-sub">{t('auth.subtitle')}</p>
            {sessionEnded && <div className="login-notice" role="status"><strong>{t('auth.sessionEnded.title')}</strong>{t('auth.sessionEnded.body')}</div>}
            <form onSubmit={handleCredentials} className="login-form">
              <label htmlFor="email">{t('auth.email')}</label>
              <input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder={t('auth.email.placeholder')} autoComplete="username" required autoFocus />

              <label htmlFor="password">{t('auth.password')}</label>
              <div className="login-password">
                <input id="password" type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={t('auth.password.placeholder')} autoComplete="current-password" required />
                <button type="button" className="password-toggle" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? t('auth.password.hide') : t('auth.password.show')}>
                  {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                </button>
              </div>

              {error && <div className="login-error" role="alert">{error}</div>}
              <button className="login-primary" disabled={isSubmitting}>
                {isSubmitting ? <span className="login-spinner" aria-label={t('state.loading')} /> : <><span>{t('auth.continue')}</span><ArrowRight size={18} aria-hidden="true" /></>}
              </button>
            </form>
          </>
        )}

        {step === 'otp' && (
          <>
            <h1>{t('auth.otp.title')}</h1>
            <p className="login-sub">{t('auth.otp.sent', { email: maskedEmail })}</p>
            <form onSubmit={handleOtp} className="login-form">
              <label htmlFor="otp">{t('auth.otp.label')}</label>
              <input id="otp" className="otp-input" inputMode="numeric" pattern="[0-9]*" maxLength={6} value={otp}
                onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" autoComplete="one-time-code" autoFocus />
              <div className="otp-meta">
                <span className={expiresIn < 60 ? 'urgent' : ''}>{t('auth.otp.expires', { time: formatCountdown(expiresIn) })}</span>
                <button type="button" disabled={resendIn > 0 || isSubmitting} onClick={handleResend}>
                  {resendIn > 0 ? t('auth.otp.resendIn', { n: resendIn }) : t('auth.otp.resend')}
                </button>
              </div>
              {error && <div className="login-error" role="alert">{error}</div>}
              <button className="login-primary" disabled={isSubmitting || expiresIn === 0}>
                {isSubmitting ? <span className="login-spinner" aria-label={t('state.loading')} /> : <><span>{t('auth.otp.verify')}</span><ArrowRight size={18} aria-hidden="true" /></>}
              </button>
              <button type="button" className="login-secondary" onClick={() => { setStep('credentials'); setOtp(''); setError(''); }}>
                {t('auth.otp.other')}
              </button>
            </form>
          </>
        )}

        {step === 'success' && (
          <div className="login-success" role="status">
            <CheckCircle2 size={44} aria-hidden="true" />
            <h1>{t('auth.success.title')}</h1>
            <p className="login-sub">{t('auth.success.body')}</p>
          </div>
        )}

        <p className="login-trust"><ShieldCheck size={14} aria-hidden="true" /> {t('auth.trust')}</p>
      </div>
    </main>
  );
}
