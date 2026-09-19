'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight, CheckCircle2, Eye, EyeOff, KeyRound,
  LockKeyhole, Mail, Radar, ShieldCheck,
} from 'lucide-react';
import Logo from '@/components/Logo';
import { useAuth } from '@/context/AuthContext';
import { ROLE_ROUTES } from '@/lib/authSession';
import './auth.css';

type LoginStep = 'credentials' | 'otp' | 'success';

function formatCountdown(seconds: number) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
  const remaining = (seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${remaining}`;
}

export default function AuthPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: sessionLoading, refreshSession } = useAuth();
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
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Proses masuk gagal');
      setChallengeId(data.challengeId);
      setExpiresIn(Number(data.expiresIn || 300));
      setResendIn(Number(data.resendCooldown || 60));
      setPassword('');
      setStep('otp');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Proses masuk gagal');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleOtp(event: FormEvent) {
    event.preventDefault();
    if (otp.length !== 6) {
      setError('Masukkan enam digit kode OTP.');
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
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Verifikasi OTP gagal');
      setStep('success');
      const authenticatedUser = await refreshSession();
      window.setTimeout(() => {
        router.replace(ROLE_ROUTES[authenticatedUser?.role || 'employee'] || '/');
      }, 700);
    } catch (caught) {
      setOtp('');
      setError(caught instanceof Error ? caught.message : 'Verifikasi OTP gagal');
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
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'OTP baru gagal dikirim');
      setExpiresIn(Number(data.expiresIn || 300));
      setResendIn(Number(data.resendCooldown || 60));
      setOtp('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'OTP baru gagal dikirim');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-story" aria-label="AFFERENT platform overview">
        <div className="login-story-grid" />
        <div className="login-brand">
          <Logo variant="mark" size={48} />
          <div>
            <span>AFFERENT</span>
            <small>Human-Centric Telemetry Security</small>
          </div>
        </div>

        <div className="login-story-copy">
          <span className="login-eyebrow"><Radar size={15} /> Security awareness, made observable</span>
          <h1>Bangun keputusan keamanan dari perilaku manusia yang nyata.</h1>
          <p>
            Satu ruang kerja untuk simulasi phishing, telemetry employee, dan respons SOC—dirancang untuk tim yang membutuhkan konteks, bukan sekadar alert.
          </p>
          <div className="login-signal-row">
            <div><ShieldCheck size={18} /><span><strong>Protected</strong><small>OTP & session controls</small></span></div>
            <div><Radar size={18} /><span><strong>Observable</strong><small>Human-risk telemetry</small></span></div>
          </div>
        </div>

        <p className="login-story-footer">AFFERENT Lab Environment · Authorized users only</p>
      </section>

      <section className="login-panel">
        <div className="login-card">
          <div className="login-mobile-brand"><Logo variant="mark" size={42} /><span>AFFERENT</span></div>

          <div className="login-progress" aria-label="Tahapan autentikasi">
            <span className="active">1</span><i className={step !== 'credentials' ? 'active' : ''} />
            <span className={step !== 'credentials' ? 'active' : ''}>2</span>
          </div>

          {step === 'credentials' && (
            <>
              <div className="login-heading">
                <span className="login-kicker">Secure workspace</span>
                <h2>Masuk ke AFFERENT</h2>
                <p>Gunakan akun yang dibuat oleh Phishing Administrator.</p>
              </div>
              <form onSubmit={handleCredentials} className="login-form">
                <label htmlFor="email">Email organisasi</label>
                <div className="login-input-wrap">
                  <Mail size={18} />
                  <input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nama@organisasi.id" autoComplete="username" required autoFocus />
                </div>

                <label htmlFor="password">Password</label>
                <div className="login-input-wrap">
                  <LockKeyhole size={18} />
                  <input id="password" type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Masukkan password" autoComplete="current-password" required />
                  <button type="button" className="password-toggle" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}>
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>

                {error && <div className="login-error" role="alert">{error}</div>}
                <button className="login-primary" disabled={isSubmitting}>
                  {isSubmitting ? <span className="login-spinner" /> : <><span>Lanjutkan dengan OTP</span><ArrowRight size={18} /></>}
                </button>
              </form>
            </>
          )}

          {step === 'otp' && (
            <>
              <div className="login-heading">
                <span className="otp-icon"><KeyRound size={22} /></span>
                <h2>Periksa email Anda</h2>
                <p>Kami mengirim kode verifikasi enam digit ke <strong>{maskedEmail}</strong>.</p>
              </div>
              <form onSubmit={handleOtp} className="login-form">
                <label htmlFor="otp">Kode verifikasi</label>
                <input
                  id="otp"
                  className="otp-input"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={otp}
                  onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  autoComplete="one-time-code"
                  autoFocus
                />
                <div className="otp-meta">
                  <span className={expiresIn < 60 ? 'urgent' : ''}>Berlaku {formatCountdown(expiresIn)}</span>
                  <button type="button" disabled={resendIn > 0 || isSubmitting} onClick={handleResend}>
                    {resendIn > 0 ? `Kirim ulang dalam ${resendIn}s` : 'Kirim ulang OTP'}
                  </button>
                </div>
                {error && <div className="login-error" role="alert">{error}</div>}
                <button className="login-primary" disabled={isSubmitting || expiresIn === 0}>
                  {isSubmitting ? <span className="login-spinner" /> : <><span>Verifikasi dan masuk</span><ArrowRight size={18} /></>}
                </button>
                <button type="button" className="login-secondary" onClick={() => { setStep('credentials'); setOtp(''); setError(''); }}>
                  Gunakan akun lain
                </button>
              </form>
            </>
          )}

          {step === 'success' && (
            <div className="login-success" role="status">
              <CheckCircle2 size={52} />
              <h2>Identitas terverifikasi</h2>
              <p>Menyiapkan workspace sesuai hak akses Anda…</p>
              <span className="login-spinner dark" />
            </div>
          )}

          <div className="login-trust"><ShieldCheck size={14} /> Session disimpan dalam HTTP-only cookie</div>
        </div>
      </section>
    </main>
  );
}
