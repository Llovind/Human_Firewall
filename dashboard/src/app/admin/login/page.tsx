'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import type { AdminRole } from '@/context/AuthContext';
import Logo from '@/components/Logo';
import { Shield, Eye, BarChart3, FileCheck, AlertCircle } from 'lucide-react';
import './login.css';

/** Map each RBAC role to its dashboard route */
const ROLE_ROUTES: Record<AdminRole, string> = {
  phishing_admin: '/dashboard/phishing-admin',
  soc: '/dashboard/soc',
  grc: '/dashboard/grc',
  cISO: '/dashboard/ciso',
  ciso: '/dashboard/ciso',
} as any;

const ROLE_OPTIONS: { value: AdminRole; label: string; icon: React.ReactNode; desc: string }[] = [
  { value: 'phishing_admin', label: 'Phishing Admin', icon: <Shield size={16} />, desc: 'Campaigns & Simulator' },
  { value: 'soc', label: 'SOC Analyst', icon: <Eye size={16} />, desc: 'Triage & Incident Response' },
  { value: 'grc', label: 'GRC Specialist', icon: <FileCheck size={16} />, desc: 'Compliance & Audit' },
  { value: 'ciso', label: 'CISO Executive', icon: <BarChart3 size={16} />, desc: 'Posture & Executive Reports' },
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
        router.push('/admin');
      }
    }
  }, [isAuthenticated, user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setErrorMsg('Security passcode is required');
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
        const userObj = { ...data.user, role: selectedRole };
        login(userObj);
        const route = ROLE_ROUTES[selectedRole] || '/admin';
        router.push(route);
      } else {
        setErrorMsg(data.error || 'Invalid security passcode');
      }
    } catch {
      setErrorMsg('Failed to connect to authentication gateway');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="admin-login-page">
      <div className="admin-login-container fade-up">
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
          <Logo variant="mark" size={80} />
        </div>

        <h2 className="admin-login-title">Afferent <strong>Platform</strong></h2>
        <p className="admin-login-subtitle">Command Center Access</p>

        {errorMsg && (
          <div className="admin-error-box">
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <AlertCircle size={14} /> {errorMsg}
            </span>
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
            <label htmlFor="password">Security Passcode</label>
            <input
              type="password"
              id="password"
              placeholder="Enter administrative passcode"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              autoComplete="off"
            />
          </div>

          <button type="submit" className="admin-submit-btn" disabled={isLoading}>
            {isLoading ? 'Authenticating...' : `Sign in as ${ROLE_OPTIONS.find(r => r.value === selectedRole)?.label}`}
          </button>
        </form>

        <div className="admin-footer-text">
          Restricted administrative system. Authorized personnel only.
        </div>
      </div>
    </div>
  );
}
