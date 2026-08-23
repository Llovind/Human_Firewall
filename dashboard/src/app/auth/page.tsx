'use client';

import { Suspense } from 'react';
import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Logo from '@/components/Logo';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import './auth.css';

function AuthContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { login, isAuthenticated, user } = useAuth();
  const [status, setStatus] = useState<'validating' | 'success' | 'error' | 'no-token'>('validating');
  const [errorMsg, setErrorMsg] = useState('');
  const [userName, setUserName] = useState('');
  const [botUsername, setBotUsername] = useState('HFL_Notif_Bot');

  useEffect(() => {
    fetch('/api/config')
      .then(res => res.json())
      .then(data => {
        if (data.botUsername) setBotUsername(data.botUsername);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const token = searchParams.get('token');

    // Only auto-redirect if there is NO new token being passed in the URL
    if (isAuthenticated && !token) {
      if (user?.role === 'admin') {
        router.push('/admin');
      } else {
        router.push('/');
      }
      return;
    }

    if (!token) {
      setStatus('no-token');
      return;
    }

    const validateToken = async () => {
      try {
        const res = await fetch(`/api/auth/magic-link?token=${token}`);
        const data = await res.json();

        if (res.ok && data.success) {
          setUserName(data.user.userName);
          setStatus('success');
          setTimeout(() => {
            login({ ...data.user, token: token || data.user.token });
            router.push('/');
          }, 1800);
        } else {
          setErrorMsg(data.error || 'Invalid or expired access token');
          setStatus('error');
        }
      } catch {
        setErrorMsg('Failed to connect to authentication service');
        setStatus('error');
      }
    };

    validateToken();
  }, [searchParams, router, login, isAuthenticated, user]);

  return (
    <div className="auth-page">
      <div className="auth-container fade-up">
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
          <Logo variant="mark" size={80} />
        </div>

        <h2 className="auth-title">Afferent <strong>Platform</strong></h2>
        <p className="auth-subtitle">Employee Access Portal</p>

        {status === 'validating' && (
          <div className="auth-status">
            <div className="auth-spinner" />
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>Validating Security Token...</h3>
            <p className="auth-description" style={{ marginBottom: '16px' }}>Verifying your secure session credentials</p>
            <div className="auth-progress">
              <div className="auth-progress-bar" />
            </div>
          </div>
        )}

        {status === 'success' && (
          <div className="auth-status">
            <div className="auth-checkmark-icon">
              <CheckCircle2 size={40} />
            </div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--success)', marginBottom: '6px' }}>Welcome back, {userName}!</h3>
            <p className="auth-description" style={{ marginBottom: '12px' }}>Authentication verified. Redirecting to your dashboard...</p>
            <div className="auth-redirect-dots">
              <span className="dot" /><span className="dot" /><span className="dot" />
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="auth-status auth-error-state">
            <div className="auth-error-icon">
              <AlertCircle size={40} />
            </div>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--danger)', marginBottom: '6px' }}>Authentication Failed</h3>
            <p className="auth-description" style={{ marginBottom: '8px' }}>{errorMsg}</p>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Please request a new access link via the Telegram security bot.</p>
          </div>
        )}

        {status === 'no-token' && (
          <div className="auth-status">
            <p className="auth-description">
              Authenticate via the organization <b>Telegram Bot</b> to access your personal security telemetry, training modules, and phishing reports.
            </p>
            <a
              href={`https://t.me/${botUsername}`}
              target="_blank"
              rel="noopener noreferrer"
              className="auth-telegram-btn"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16" style={{ flexShrink: 0 }}>
                <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
              </svg>
              <span>Open Telegram Bot</span>
            </a>
          </div>
        )}
      </div>

      <div className="auth-footer">
        Afferent · Centralized Security Platform
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={
      <div className="auth-page">
        <div className="auth-container fade-up">
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
            <Logo variant="mark" size={80} />
          </div>
          <h2 className="auth-title">Afferent <strong>Platform</strong></h2>
          <p className="auth-subtitle">Employee Access Portal</p>
          <div className="auth-spinner" />
        </div>
      </div>
    }>
      <AuthContent />
    </Suspense>
  );
}
