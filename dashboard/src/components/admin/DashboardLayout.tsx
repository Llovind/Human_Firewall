'use client';

import { useEffect, useState, ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Logo from '@/components/Logo';
import type { AdminRole } from '@/components/admin/types';
import { ROLE_ROUTES } from '@/components/admin/types';
import {
  LayoutDashboard, ShieldAlert, Trophy, FileWarning, Fish,
  Mail, Users, Brain, BarChart3, Eye, FileCheck, Shield
} from 'lucide-react';
import '@/app/dashboard.css';

/** Sidebar tab definitions per role */
type TabDef = { id: string; label: string; icon: ReactNode };

const ROLE_TABS: Record<AdminRole, TabDef[]> = {
  phishing_admin: [
    { id: 'gophish', label: 'GoPhish', icon: <Fish size={20} /> },
    { id: 'employees', label: 'Employees', icon: <Users size={20} /> },
    { id: 'webmail', label: 'Webmail', icon: <Mail size={20} /> },
    { id: 'leaderboard', label: 'Leaderboard', icon: <Trophy size={20} /> },
  ],
  soc: [
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard size={20} /> },
    { id: 'threats', label: 'Threats', icon: <ShieldAlert size={20} /> },
    { id: 'policy', label: 'Policy', icon: <FileWarning size={20} /> },
    { id: 'ai', label: 'AI Heatmap', icon: <Brain size={20} /> },
  ],
  grc: [
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard size={20} /> },
    { id: 'leaderboard', label: 'Leaderboard', icon: <Trophy size={20} /> },
    { id: 'compliance', label: 'Compliance', icon: <FileCheck size={20} /> },
    { id: 'ai', label: 'AI Heatmap', icon: <Brain size={20} /> },
    { id: 'employees', label: 'Employees', icon: <Users size={20} /> },
  ],
  ciso: [
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard size={20} /> },
    { id: 'threats', label: 'Threats', icon: <ShieldAlert size={20} /> },
    { id: 'leaderboard', label: 'Leaderboard', icon: <Trophy size={20} /> },
    { id: 'policy', label: 'Policy', icon: <FileWarning size={20} /> },
    { id: 'gophish', label: 'GoPhish', icon: <Fish size={20} /> },
    { id: 'employees', label: 'Employees', icon: <Users size={20} /> },
    { id: 'ai', label: 'AI Heatmap', icon: <Brain size={20} /> },
  ],
};

const ROLE_LABELS: Record<AdminRole, { label: string; icon: ReactNode }> = {
  phishing_admin: { label: 'Phishing Admin', icon: <Shield size={16} /> },
  soc: { label: 'SOC Analyst', icon: <Eye size={16} /> },
  grc: { label: 'GRC Specialist', icon: <FileCheck size={16} /> },
  ciso: { label: 'CISO Executive', icon: <BarChart3 size={16} /> },
};

interface DashboardLayoutProps {
  role: AdminRole;
  activeTab: string;
  onTabChange: (tab: string) => void;
  children: ReactNode;
}

export default function DashboardLayout({ role, activeTab, onTabChange, children }: DashboardLayoutProps) {
  const { user, isAuthenticated, isLoading: authLoading, logout } = useAuth();
  const router = useRouter();
  const [clock, setClock] = useState('');

  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Auth guard
  if (authLoading) {
    return (
      <div className="loading-screen" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <Logo size={52} variant="mark" logoAnimation="loading" />
        <p>Memuat Command Center...</p>
      </div>
    );
  }

  const validRoles: string[] = ['admin', 'phishing_admin', 'soc', 'grc', 'ciso'];
  if (!isAuthenticated || !user || !user.role || !validRoles.includes(user.role)) {
    if (typeof window !== 'undefined') window.location.href = '/admin/login';
    return null;
  }

  // Role mismatch guard: redirect to correct dashboard
  if (user.role !== role && user.role !== 'admin') {
    const correctRoute = ROLE_ROUTES[user.role as AdminRole];
    if (correctRoute && typeof window !== 'undefined') {
      window.location.href = correctRoute;
    }
    return null;
  }

  const tabs = ROLE_TABS[role] || [];
  const roleInfo = ROLE_LABELS[role];

  return (
    <div className="app-shell">
      {/* ── Sidebar ─────────────────────────────────────── */}
      <aside className="sidebar-nav" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', paddingTop: '8px' }}>
        <div className="radar-sweep-bg" />
        <div className="sidebar-nav-logo" style={{ marginBottom: '12px', display: 'flex', justifyContent: 'center' }}>
          <Logo variant="mark" size={54} />
        </div>

        {/* Role Badge */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
          padding: '6px 12px', margin: '0 12px 16px', borderRadius: '6px',
          background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.15)',
          fontSize: '11px', fontWeight: 600, color: '#94a3b8', letterSpacing: '0.5px',
          textTransform: 'uppercase',
        }}>
          {roleInfo.icon}
          {roleInfo.label}
        </div>

        {/* Tab Navigation */}
        <nav className="sidebar-menu" style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 'none' }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`sidebar-item ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => onTabChange(tab.id)}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* ── Main Content ────────────────────────────────── */}
      <div className="app-shell-main">
        {/* Topbar */}
        <header className="topbar-slim" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: 600 }}>
              {role === 'ciso' ? 'Executive Overview — Read Only' : 'Security Culture & Threat Triage Platform'}
            </h1>
          </div>
          <div className="topbar-right" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div className="live-indicator">
              <span className="live-dot" />
              <span>Live</span>
            </div>
            <span className="clock mono">{clock}</span>
            {role === 'ciso' && (
              <span style={{
                fontSize: '11px', fontWeight: 600, color: '#fbbf24',
                background: 'rgba(251, 191, 36, 0.08)', border: '1px solid rgba(251, 191, 36, 0.2)',
                padding: '4px 10px', borderRadius: '4px', letterSpacing: '0.5px',
              }}>
                READ-ONLY
              </span>
            )}
            <div
              className="user-badge"
              onClick={logout}
              title="Klik untuk logout"
              style={{
                border: '1px solid rgba(248,113,113,0.3)', background: 'rgba(248,113,113,0.05)',
                cursor: 'pointer', padding: '4px 12px', borderRadius: '4px',
                display: 'flex', alignItems: 'center', gap: '8px',
              }}
            >
              <span className="user-name" style={{ color: 'var(--danger)', fontSize: '13px', fontWeight: 600 }}>Logout</span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="main" style={{ padding: 0 }}>
          {children}
        </main>
      </div>
    </div>
  );
}
