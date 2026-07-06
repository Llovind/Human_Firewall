'use client';

import { Suspense } from 'react';
import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Logo from '@/components/Logo';
import './auth.css';

function AuthContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { login, isAuthenticated, user } = useAuth();
  const [status, setStatus] = useState<'validating' | 'success' | 'error' | 'no-token'>('validating');
  const [errorMsg, setErrorMsg] = useState('');
  const [userName, setUserName] = useState('');
  const [botUsername, setBotUsername] = useState('HFL_BOT');

  useEffect(() => {
    fetch('/api/config')
      .then(res => res.json())
      .then(data => {
        if (data.botUsername) setBotUsername(data.botUsername);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      if (user?.role === 'admin') {
        router.push('/admin');
      } else {
        router.push('/');
      }
      return;
    }

    const token = searchParams.get('token');
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
            login(data.user);
            router.push('/');
          }, 2000);
        } else {
          setErrorMsg(data.error || 'Token tidak valid');
          setStatus('error');
        }
      } catch {
        setErrorMsg('Gagal menghubungi server');
        setStatus('error');
      }
    };

    validateToken();
  }, [searchParams, router, login, isAuthenticated, user]);

  return (
    <div className="auth-page">
      <div className="auth-scanline" />
      
      <div className="auth-container fade-up">
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '32px' }}>
          <Logo variant="full" size={36} />
        </div>

        {status === 'validating' && (
          <div className="auth-status">
            <div className="auth-spinner" />
            <h2 className="auth-title">Memvalidasi Token...</h2>
            <p className="auth-subtitle">Menghubungkan akun Telegram Anda</p>
            <div className="auth-progress">
              <div className="auth-progress-bar" />
            </div>
          </div>
        )}

        {status === 'success' && (
          <div className="auth-status auth-success-state">
            <div className="auth-checkmark">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h2 className="auth-title">Selamat Datang, {userName}!</h2>
            <p className="auth-subtitle">Autentikasi berhasil. Mengalihkan ke Dashboard...</p>
            <div className="auth-redirect-dots">
              <span className="dot" /><span className="dot" /><span className="dot" />
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="auth-status auth-error-state">
            <div className="auth-error-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            </div>
            <h2 className="auth-title">Token Tidak Valid</h2>
            <p className="auth-subtitle">{errorMsg}</p>
            <p className="auth-help">Silakan minta link baru dari Telegram Bot.</p>
          </div>
        )}

        {status === 'no-token' && (
          <div className="auth-status auth-notoken-state">
            <div className="auth-telegram-icon">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
              </svg>
            </div>
            <h2 className="auth-title">Akses Dashboard</h2>
            <p className="auth-subtitle">
              Untuk mengakses Dashboard, buka <strong>Telegram Bot</strong> kami 
              dan ketik <code>/dashboard</code> untuk mendapatkan link akses.
            </p>
            <a
              href={`https://t.me/${botUsername}`}
              target="_blank"
              rel="noopener noreferrer"
              className="auth-telegram-btn"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
                <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
              </svg>
              Buka Telegram Bot
            </a>
          </div>
        )}
      </div>

      <div className="auth-footer">
        Human Firewall · Centralized Security Platform
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={
      <div className="auth-page">
        <div className="auth-container fade-up">
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '32px' }}>
            <Logo variant="full" size={36} />
          </div>
          <div className="auth-status">
            <div className="auth-spinner" />
            <h2 className="auth-title">Memuat...</h2>
          </div>
        </div>
      </div>
    }>
      <AuthContent />
    </Suspense>
  );
}
