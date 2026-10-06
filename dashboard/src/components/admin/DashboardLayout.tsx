'use client';

import { useEffect, useState, ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Logo from '@/components/Logo';
import AccountMenu from '@/components/AccountMenu';
import NotificationBell from '@/components/NotificationBell';
import { useI18n } from '@/i18n/I18nProvider';
import { usePreference } from '@/hooks/usePreference';
import { useTheme } from '@/hooks/useTheme';
import type { MessageKey } from '@/i18n/messages';
import type { AdminRole } from '@/components/admin/types';
import { ROLE_ROUTES } from '@/components/admin/types';
import NoAccess from '@/components/ui/NoAccess';
import {
  LayoutDashboard, ShieldAlert, Trophy, FileWarning, Fish,
  Mail, Users, Brain, FileCheck, Globe, Moon, Sun, Menu, PanelLeft, X
} from 'lucide-react';
import '@/app/dashboard.css';

/** Sidebar tab definitions per role. Labels come from the message table so they follow the language setting. */
type TabDef = { id: string; labelKey: MessageKey; icon: ReactNode };
const ICON = 18;

const TAB: Record<string, TabDef> = {
  overview: { id: 'overview', labelKey: 'nav.overview', icon: <LayoutDashboard size={ICON} aria-hidden="true" /> },
  inbox: { id: 'inbox', labelKey: 'nav.inbox', icon: <Mail size={ICON} aria-hidden="true" /> },
  threats: { id: 'threats', labelKey: 'nav.traffic', icon: <ShieldAlert size={ICON} aria-hidden="true" /> },
  ai: { id: 'ai', labelKey: 'nav.risk', icon: <Brain size={ICON} aria-hidden="true" /> },
  leaderboard: { id: 'leaderboard', labelKey: 'nav.leaderboard', icon: <Trophy size={ICON} aria-hidden="true" /> },
  compliance: { id: 'compliance', labelKey: 'nav.compliance', icon: <FileCheck size={ICON} aria-hidden="true" /> },
  policy: { id: 'policy', labelKey: 'nav.policies', icon: <FileWarning size={ICON} aria-hidden="true" /> },
  gophish: { id: 'gophish', labelKey: 'nav.phishing', icon: <Fish size={ICON} aria-hidden="true" /> },
  employees: { id: 'employees', labelKey: 'nav.accounts', icon: <Users size={ICON} aria-hidden="true" /> },
};

/** For SOC the first tab is the incident queue, so it carries that name. */
const SOC_INCIDENTS: TabDef = { ...TAB.overview, labelKey: 'nav.incidents' };

const CISO_POSTURE: TabDef = { ...TAB.overview, labelKey: 'nav.posture' };

const ROLE_TABS: Record<AdminRole, TabDef[]> = {
  phishing_admin: [TAB.gophish, TAB.employees, TAB.leaderboard],
  soc: [SOC_INCIDENTS, TAB.inbox, TAB.threats, TAB.ai],
  grc: [TAB.overview, TAB.inbox, TAB.leaderboard, TAB.compliance, TAB.ai, TAB.employees],
  ciso: [CISO_POSTURE, TAB.threats, TAB.leaderboard, TAB.policy, TAB.gophish, TAB.employees, TAB.ai],
};

interface DashboardLayoutProps {
  role: AdminRole;
  activeTab: string;
  onTabChange: (tab: string) => void;
  children: ReactNode;
}

export default function DashboardLayout({ role, activeTab, onTabChange, children }: DashboardLayoutProps) {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { t, lang, setLang } = useI18n();
  const router = useRouter();
  const [theme, toggleTheme] = useTheme();
  const [sidebar, setSidebar] = usePreference('afferent_sidebar', 'open');
  const [mobileOpen, setMobileOpen] = useState(false);
  const collapsed = sidebar === 'mini';

  // Signed-out visitors go to sign-in. Signed-in people on the wrong page see a clear "no access" screen instead.
  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated || !user) router.replace('/auth');
  }, [authLoading, isAuthenticated, router, user]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setMobileOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mobileOpen]);

  // Auth guard
  if (authLoading) {
    return (
      <div className="loading-screen" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }} role="status">
        <Logo size={52} variant="mark" logoAnimation="loading" />
        <p className="font-body">{t('shell.loading')}</p>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return null;
  }

  // Signed in, but this page belongs to another role.
  if (user.role !== role) {
    const home = user.role === 'employee' ? '/' : ROLE_ROUTES[user.role as AdminRole] || '/';
    return <NoAccess neededRole={role} currentRole={user.role} homeHref={home} />;
  }

  const tabs = ROLE_TABS[role] || [];
  const activeDef = tabs.find(tab => tab.id === activeTab);
  const roleLabel = t(`role.${role}` as MessageKey);
  const themeLabel = theme === 'dark' ? t('shell.theme.light') : t('shell.theme.dark');
  const choose = (id: string) => { onTabChange(id); setMobileOpen(false); };

  return (
    <div className="shell font-body" data-collapsed={collapsed} data-open={mobileOpen}>
      <a className="skip-link" href="#content">{t('shell.skip')}</a>
      <div className="shell-scrim" onClick={() => setMobileOpen(false)} aria-hidden="true" />

      {/* ── Sidebar ─────────────────────────────────────── */}
      <aside className="sb" aria-label={t('nav.main')}>
        <div className="sb-head">
          <div className="sb-brand">
            <Logo variant="mark" size={28} />
            <span className="sb-brand-text">AFFERENT</span>
          </div>
          <button type="button" className="iconbtn sb-collapse" onClick={() => setSidebar(collapsed ? 'open' : 'mini')} aria-label={collapsed ? t('nav.expand') : t('nav.collapse')} title={collapsed ? t('nav.expand') : t('nav.collapse')}>
            <PanelLeft size={18} className="sb-collapse-icon" aria-hidden="true" />
          </button>
          <button type="button" className="iconbtn shell-menu-close" style={{ display: mobileOpen ? 'inline-flex' : 'none' }} onClick={() => setMobileOpen(false)} aria-label={t('nav.close')}>
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <nav aria-label={t('nav.main')} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <div className="sb-group">{t('nav.menu')}</div>
          {tabs.map(tab => {
            const label = t(tab.labelKey);
            return (
              <button
                key={tab.id}
                type="button"
                className="sb-link"
                onClick={() => choose(tab.id)}
                aria-current={activeTab === tab.id ? 'page' : undefined}
                title={collapsed ? label : undefined}
              >
                {tab.icon}
                <span className="sb-label">{label}</span>
              </button>
            );
          })}
        </nav>

        <div className="sb-spacer" />
        <hr className="sb-sep" />

        <div className="sb-lang" role="group" aria-label={t('lang.label')}>
          <Globe size={ICON} aria-hidden="true" />
          <span className="sb-label">{t('lang.label')}</span>
          <span className="sb-lang-buttons">
            <button type="button" aria-pressed={lang === 'en'} aria-label={t('lang.en')} lang="en" onClick={() => setLang('en')}>EN</button>
            <button type="button" aria-pressed={lang === 'id'} aria-label={t('lang.id')} lang="id" onClick={() => setLang('id')}>ID</button>
          </span>
        </div>
        <button type="button" className="sb-link" onClick={toggleTheme} title={collapsed ? themeLabel : undefined}>
          {theme === 'dark' ? <Sun size={ICON} aria-hidden="true" /> : <Moon size={ICON} aria-hidden="true" />}
          <span className="sb-label">{themeLabel}</span>
        </button>
        <div className="sb-user sb-account">
          <AccountMenu variant="sidebar" roleLabel={roleLabel} />
        </div>
      </aside>

      {/* ── Main Content ────────────────────────────────── */}
      <div className="shell-main">
        <header className="shell-top">
          <button type="button" className="iconbtn shell-menu-btn" onClick={() => setMobileOpen(true)} aria-label={t('nav.open')}>
            <Menu size={20} aria-hidden="true" />
          </button>
          <div>
            <small>{roleLabel}</small>
            <h1>{activeDef ? t(activeDef.labelKey) : t('nav.overview')}</h1>
          </div>
          <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            {role === 'ciso' && <span className="shell-chip" title={t('shell.readonlyHint')}>{t('shell.readonly')}</span>}
            <NotificationBell role={role} onOpenTab={choose} />
          </span>
        </header>
        <div className="shell-content" id="content" tabIndex={-1}>
          <main className="main" style={{ padding: 0 }}>
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
