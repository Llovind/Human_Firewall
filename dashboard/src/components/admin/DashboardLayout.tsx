'use client';

import { useEffect, useState, ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Logo from '@/components/Logo';
import ThemeToggle from '@/components/ThemeToggle';
import type { AdminRole } from '@/components/admin/types';
import { ROLE_ROUTES } from '@/components/admin/types';
import {
  LayoutDashboard, ShieldAlert, Trophy, FileWarning, Fish,
  Mail, Users, Brain, BarChart3, Eye, FileCheck, Shield, ExternalLink
} from 'lucide-react';
import '@/app/dashboard.css';

/** Sidebar tab definitions per role */
type TabDef = { id: string; label: string; icon: ReactNode };
const ADMIN_ROLES: AdminRole[] = ['phishing_admin', 'soc', 'grc', 'ciso'];

const ROLE_TABS: Record<AdminRole, TabDef[]> = {
  phishing_admin: [
    { id: 'gophish', label: 'Simulations', icon: <Fish size={20} /> },
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
    { id: 'gophish', label: 'Simulations', icon: <Fish size={20} /> },
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

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated || !user || !ADMIN_ROLES.includes(user.role as AdminRole)) {
      router.replace('/auth');
      return;
    }
    if (user.role !== role) {
      const correctRoute = user.role === 'employee'
        ? '/'
        : ROLE_ROUTES[user.role as AdminRole];
      if (correctRoute) router.replace(correctRoute);
    }
  }, [authLoading, isAuthenticated, role, router, user]);

  // Auth guard
  if (authLoading) {
    return (
      <div className="loading-screen" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <Logo size={52} variant="mark" logoAnimation="loading" />
        <p className="font-body">Loading Command Center...</p>
      </div>
    );
  }

  if (!isAuthenticated || !user || !ADMIN_ROLES.includes(user.role as AdminRole)) {
    return null;
  }

  // Role mismatch guard: redirect to correct dashboard
  if (user.role !== role) {
    return null;
  }

  const tabs = ROLE_TABS[role] || [];
  const roleInfo = ROLE_LABELS[role];

  return (
    <div className="app-shell font-body">
      {/* ── Sidebar ─────────────────────────────────────── */}
      <aside className="sidebar-nav">
        <div className="radar-sweep-bg" />

        {/* Logo + Wordmark */}
        <div className="sidebar-nav-logo">
          <Logo variant="mark" size={36} />
          <span className="sidebar-wordmark">AFFERENT</span>
        </div>

        {/* Tab Navigation */}
        <nav className="sidebar-menu" aria-label="Main navigation" style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`sidebar-item font-body ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => onTabChange(tab.id)}
              aria-current={activeTab === tab.id ? 'page' : undefined}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {tab.id === 'webmail' && <ExternalLink size={12} style={{ marginLeft: 'auto', opacity: 0.5 }} />}
            </button>
          ))}
        </nav>

        {/* User Card — bottom */}
        <div className="sidebar-user-card">
          <div className="sidebar-user-avatar">
            {(user?.userName || roleInfo.label).charAt(0).toUpperCase()}
          </div>
          <div className="sidebar-user-info">
            <span className="sidebar-user-name">{user?.userName || roleInfo.label}</span>
            <span className="sidebar-role-chip">
              {roleInfo.icon}
              {roleInfo.label}
            </span>
          </div>
        </div>
      </aside>

      {/* ── Main Content ────────────────────────────────── */}
      <div className="app-shell-main">
        {/* Topbar */}
        <header className="topbar-slim" style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'var(--bg-surface)',
          borderRadius: '16px',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-md)',
          padding: '16px 24px',
          marginBottom: '24px'
        }}>
          <div>
            <h1 className="font-heading" style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.2px' }}>
              {role === 'ciso' ? 'Executive Overview: Read-Only' : 'Security Culture & Threat Triage Platform'}
            </h1>
          </div>
          <div className="topbar-right" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div className="live-indicator">
              <span className="live-dot" />
              <span>Live</span>
            </div>
            <span className="clock font-mono-data">{clock}</span>
            <ThemeToggle />
            {role === 'ciso' && (
              <span style={{
                fontSize: '11px', fontWeight: 700, color: 'var(--text-warning)',
                background: 'var(--bg-warning)', border: '1px solid var(--border-warning)',
                padding: '4px 10px', borderRadius: '6px', letterSpacing: '0.5px',
              }}>
                READ-ONLY
              </span>
            )}
            <div
              className="user-badge"
              onClick={logout}
              title="Click to log out"
              style={{
                border: '1px solid var(--border-danger)', background: 'var(--bg-danger)',
                cursor: 'pointer', padding: '6px 14px', borderRadius: '8px',
                display: 'flex', alignItems: 'center', gap: '8px',
              }}
            >
              <span className="user-name font-body" style={{ color: 'var(--text-danger)', fontSize: '13px', fontWeight: 700 }}>Logout</span>
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
