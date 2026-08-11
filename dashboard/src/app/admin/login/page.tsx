'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import type { AdminRole } from '@/context/AuthContext';
import Logo from '@/components/Logo';
import { Shield, Eye, BarChart3, FileCheck } from 'lucide-react';
import './login.css';

/** Map each RBAC role to its dashboard route */
const ROLE_ROUTES: Record<AdminRole, string> = {
  phishing_admin: '/dashboard/phishing-admin',
  soc: '/dashboard/soc',
  grc: '/dashboard/grc',
  ciso: '/dashboard/ciso',
};

const ROLE_OPTIONS: { value: AdminRole; label: string; icon: React.ReactNode; desc: string }[] = [
  { value: 'phishing_admin', label: 'Phishing Admin', icon: <Shield size={18} />, desc: 'Kampanye & Simulasi' },
  { value: 'soc', label: 'SOC Analyst', icon: <Eye size={18} />, desc: 'Investigasi & Respons' },
  { value: 'grc', label: 'GRC Specialist', icon: <FileCheck size={18} />, desc: 'Compliance & Leaderboard' },
  { value: 'ciso', label: 'CISO Executive', icon: <BarChart3 size={18} />, desc: 'Read-Only Overview' },
];

export default function AdminLoginPage() {
  const router = useRouter();
  const { login, isAuthenticated, user } = useAuth();
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState<AdminRole>('phishing_admin');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isAuthenticated && user) {
      const role = user.role as AdminRole;
      const route = ROLE_ROUTES[role];
      if (route) {
        router.push(route);
      } else if (user.role === 'admin') {
        // Backward compatibility: old 'admin' role goes to /admin
        router.push('/admin');
      }
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
        body: JSON.stringify({ password, username: selectedRole }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        login(data.user);
        const route = ROLE_ROUTES[selectedRole] || '/admin';
        router.push(route);
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
        <p className="admin-login-subtitle">Command Center Access</p>

        {errorMsg && (
          <div className="admin-error-box">
            <span>⚠️ {errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="admin-login-form">
          {/* ── Role Selector ────────────────────────────────── */}
          <div className="admin-form-group">
            <label>Workspace Role</label>
            <div className="role-selector-grid">
              {ROLE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`role-card ${selectedRole === opt.value ? 'active' : ''}`}
                  onClick={() => setSelectedRole(opt.value)}
                >
                  <span className="role-card-icon">{opt.icon}</span>
                  <span className="role-card-label">{opt.label}</span>
                  <span className="role-card-desc">{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ── Password Input ───────────────────────────────── */}
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
            {isLoading ? 'Mengautentikasi...' : `Masuk sebagai ${ROLE_OPTIONS.find(r => r.value === selectedRole)?.label}`}
          </button>
        </form>

        <div className="admin-footer-text">
          Sistem ini terbatas hanya untuk personel terverifikasi.
        </div>
      </div>
    </div>
  );
}
