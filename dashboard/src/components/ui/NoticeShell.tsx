'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import Logo from '@/components/Logo';
import ThemeToggle from '@/components/ThemeToggle';
import LanguageSwitch from '@/components/ui/LanguageSwitch';
import { useI18n } from '@/i18n/I18nProvider';
import SeverityBadge, { type SeverityLevel } from '@/components/ui/SeverityBadge';
import '@/app/blocked/blocked.css';

/** One calm page for things that interrupt the person: blocked sites, 404, errors, no access, simulation education. */
export function NoticeShell({ children, footer }: { children: ReactNode; footer?: string }) {
  return (
    <div className="notice-page">
      <header className="notice-bar">
        <span className="notice-brand"><Logo variant="mark" size={26} />AFFERENT</span>
        <span className="notice-tools"><LanguageSwitch /><ThemeToggle /></span>
      </header>
      <main className="notice-main" id="content"><article className="notice-card">{children}</article></main>
      {footer && <footer className="notice-foot">{footer}</footer>}
    </div>
  );
}

/** The what happened / why / what next layout used by every notice. */
export function Notice({ level, status, title, why, children, actions }: { level: SeverityLevel; status: string; title: string; why?: ReactNode; children?: ReactNode; actions?: ReactNode }) {
  return (
    <>
      <div><SeverityBadge level={level} label={status} /></div>
      <h1>{title}</h1>
      {why && <p className="notice-lead">{why}</p>}
      {children}
      {actions && <div className="notice-actions">{actions}</div>}
    </>
  );
}

export function HomeLink({ href = '/', label }: { href?: string; label?: string }) {
  const { t } = useI18n();
  return <Link className="btn btn-primary" href={href}>{label ?? t('sys.home')}</Link>;
}
