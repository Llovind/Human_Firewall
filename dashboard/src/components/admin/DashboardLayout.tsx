'use client';

import { useEffect, useState, ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Logo from '@/components/Logo';
import ThemeToggle from '@/components/ThemeToggle';
import AccountMenu from '@/components/AccountMenu';
import type { AdminRole } from '@/components/admin/types';
import { ROLE_ROUTES } from '@/components/admin/types';
import {
  LayoutDashboard, ShieldAlert, Trophy, FileWarning, Fish,
  Mail, Users, Brain, BarChart3, Eye, FileCheck, Shield
} from 'lucide-react';
import '@/app/dashboard.css';

/** Sidebar tab definitions per role */
type TabDef = { id: string; label: string; icon: ReactNode };
const ADMIN_ROLES: AdminRole[] = ['phishing_admin', 'soc', 'grc', 'ciso'];

const ROLE_TABS: Record<AdminRole, TabDef[]> = {
  phishing_admin: [
    { id: 'gophish', label: 'Phishing simulations', icon: <Fish size={20} /> },
    { id: 'employees', label: 'Accounts & divisions', icon: <Users size={20} /> },
    { id: 'leaderboard', label: 'Leaderboard', icon: <Trophy size={20} /> },
  ],
  soc: [
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard size={20} /> },
    { id: 'inbox', label: 'Security inbox', icon: <Mail size={20} /> },
    { id: 'threats', label: 'Traffic & policies', icon: <ShieldAlert size={20} /> },
    { id: 'ai', label: 'Risk analysis', icon: <Brain size={20} /> },
  ],
  grc: [
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard size={20} /> },
    { id: 'inbox', label: 'Security inbox', icon: <Mail size={20} /> },
    { id: 'leaderboard', label: 'Leaderboard', icon: <Trophy size={20} /> },
    { id: 'compliance', label: 'Compliance', icon: <FileCheck size={20} /> },
    { id: 'ai', label: 'Risk analysis', icon: <Brain size={20} /> },
    { id: 'employees', label: 'Accounts & divisions', icon: <Users size={20} /> },
  ],
  ciso: [
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard size={20} /> },
    { id: 'threats', label: 'Traffic & policies', icon: <ShieldAlert size={20} /> },
    { id: 'leaderboard', label: 'Leaderboard', icon: <Trophy size={20} /> },
    { id: 'policy', label: 'Policies', icon: <FileWarning size={20} /> },
    { id: 'gophish', label: 'Phishing simulations', icon: <Fish size={20} /> },
    { id: 'employees', label: 'Accounts & divisions', icon: <Users size={20} /> },
    { id: 'ai', label: 'Risk analysis', icon: <Brain size={20} /> },
  ],
};

const ROLE_LABELS: Record<AdminRole, { label: string; icon: ReactNode }> = {
  phishing_admin: { label: 'Administrator', icon: <Shield size={16} /> },
  soc: { label: 'SOC Analyst', icon: <Eye size={16} /> },
  grc: { label: 'GRC Specialist', icon: <FileCheck size={16} /> },
  ciso: { label: 'CISO', icon: <BarChart3 size={16} /> },
};

interface DashboardLayoutProps {
  role: AdminRole;
  activeTab: string;
  onTabChange: (tab: string) => void;
  children: ReactNode;
}

export default function DashboardLayout({ role, activeTab, onTabChange, children }: DashboardLayoutProps) {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [clock, setClock] = useState('');

  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
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
        <p className="font-body">Loading dashboard…</p>
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

        {/* Logo + Wordmark */}
        <div className="sidebar-nav-logo">
          <Logo variant="mark" size={36} />
          <span className="sidebar-wordmark">AFFERENT</span>
        </div>

        {/* Tab Navigation */}
        <nav className="sidebar-menu" aria-label="Main navigation">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`sidebar-item font-body ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => onTabChange(tab.id)}
              aria-current={activeTab === tab.id ? 'page' : undefined}
            >
              {tab.icon}
              <span>{tab.label}</span>
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
        <header className="topbar-slim">
          <div className="workspace-heading">
            <small>{roleInfo.label}</small>
            <h1>{tabs.find(tab => tab.id === activeTab)?.label || 'Dashboard'}</h1>
          </div>
          <div className="topbar-right" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span className="clock font-mono-data">{clock}</span>
            <ThemeToggle />
            {role === 'ciso' && (
              <span className="workspace-readonly">Read-only</span>
            )}
            <AccountMenu />
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
