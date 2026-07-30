'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Logo from '@/components/Logo';
import './login.css';

export default function AdminLoginPage() {
  const router = useRouter();
  const { login, isAuthenticated, user } = useAuth();
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isAuthenticated && user?.role === 'admin') {
      router.push('/admin');
    }
  }, [isAuthenticated, user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setErrorMsg('Password wajib diisi');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/auth/admin-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        login(data.user);
        router.push('/admin');
      } else {
        setErrorMsg(data.error || 'Password salah');
      }
    } catch {
      setErrorMsg('Gagal menghubungi server');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="admin-login-page">
      <div className="admin-scanline" />
      <div className="admin-login-container fade-up">
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
          <Logo variant="mark" size={96} />
        </div>

        <h2 className="admin-login-title">Human <strong>Firewall</strong></h2>
        <p className="admin-login-subtitle">SOC Dashboard Access</p>

        {errorMsg && (
          <div className="admin-error-box">
            <span>⚠️ {errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="admin-login-form">
          <div className="admin-form-group">
            <label htmlFor="password">Security Password</label>
            <input
              type="password"
              id="password"
              placeholder="Masukkan password admin"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              autoComplete="off"
            />
          </div>

          <button type="submit" className="admin-submit-btn" disabled={isLoading}>
            {isLoading ? 'Mengautentikasi...' : 'Masuk Command Center'}
          </button>
        </form>

        <div className="admin-footer-text">
          Sistem ini terbatas hanya untuk analis SOC terverifikasi.
        </div>
      </div>
    </div>
  );
}
