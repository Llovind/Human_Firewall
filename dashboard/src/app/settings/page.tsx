'use client';

import { useState } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, KeyRound, LogOut, Moon, Sun } from 'lucide-react';
import Logo from '@/components/Logo';
import ChangePasswordDialog from '@/components/ChangePasswordDialog';
import StateMessage from '@/components/ui/StateMessage';
import { useAuth } from '@/context/AuthContext';
import { useI18n } from '@/i18n/I18nProvider';
import { useTheme } from '@/hooks/useTheme';
import { ROLE_ROUTES } from '@/lib/authSession';
import type { MessageKey } from '@/i18n/messages';

/** One place for the things a person decides about themselves: language, theme, password, signing out. */
export default function SettingsPage() {
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const { t, lang, setLang } = useI18n();
  const [theme, toggleTheme] = useTheme();
  const [passwordOpen, setPasswordOpen] = useState(false);

  if (isLoading) return <main className="settings-page"><div className="settings-main"><StateMessage variant="loading" title={t('settings.loading')} /></div></main>;
  if (!isAuthenticated || !user) redirect('/auth');

  const home = ROLE_ROUTES[user.role] || '/';
  const setTheme = (next: 'light' | 'dark') => { if (next !== theme) toggleTheme(); };

  return (
    <main className="settings-page">
      <header className="settings-top">
        <span className="login-brand" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, fontWeight: 700, letterSpacing: '.04em' }}><Logo variant="mark" size={28} />AFFERENT</span>
        <Link className="btn" href={home}><ArrowLeft size={14} aria-hidden="true" /> {t('settings.back')}</Link>
      </header>
      <div className="settings-main">
        <h1>{t('settings.title')}</h1>

        <section className="settings-card" aria-labelledby="set-account">
          <h2 id="set-account">{t('settings.account')}</h2>
          <dl>
            <div><dt>{t('settings.name')}</dt><dd>{user.userName || '—'}</dd></div>
            <div><dt>{t('settings.email')}</dt><dd>{user.email}</dd></div>
            <div><dt>{t('settings.role')}</dt><dd>{t(`settings.role.${user.role}` as MessageKey)}</dd></div>
            <div><dt>{t('settings.division')}</dt><dd>{user.division || '—'}</dd></div>
          </dl>
        </section>

        <section className="settings-card" aria-labelledby="set-look">
          <h2 id="set-look">{t('settings.appearance')}</h2>
          <div className="settings-row">
            <span>{t('settings.theme')}</span>
            <div className="seg" role="group" aria-label={t('settings.theme')}>
              <button type="button" aria-pressed={theme === 'light'} onClick={() => setTheme('light')}><Sun size={14} aria-hidden="true" />{t('settings.theme.light')}</button>
              <button type="button" aria-pressed={theme === 'dark'} onClick={() => setTheme('dark')}><Moon size={14} aria-hidden="true" />{t('settings.theme.dark')}</button>
            </div>
          </div>
          <div className="settings-row">
            <span>{t('settings.language')}<br /><small>{t('settings.language.hint')}</small></span>
            <div className="seg" role="group" aria-label={t('settings.language')}>
              <button type="button" lang="en" aria-pressed={lang === 'en'} onClick={() => setLang('en')}>English</button>
              <button type="button" lang="id" aria-pressed={lang === 'id'} onClick={() => setLang('id')}>Bahasa Indonesia</button>
            </div>
          </div>
        </section>

        <section className="settings-card" aria-labelledby="set-security">
          <h2 id="set-security">{t('settings.security')}</h2>
          <div className="settings-row">
            <span>{t('settings.password')}<br /><small>{t('settings.password.hint')}</small></span>
            <button type="button" className="btn" onClick={() => setPasswordOpen(true)}><KeyRound size={14} aria-hidden="true" /> {t('account.changePassword')}</button>
          </div>
          <p className="emp-muted">{t('settings.session')}</p>
          <div><button type="button" className="btn" onClick={() => void logout()}><LogOut size={14} aria-hidden="true" /> {t('settings.signout')}</button></div>
        </section>
      </div>
      <ChangePasswordDialog open={passwordOpen} onClose={() => setPasswordOpen(false)} />
    </main>
  );
}
