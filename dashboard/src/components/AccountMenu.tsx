'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useI18n } from '@/i18n/I18nProvider';
import Link from 'next/link';
import ChangePasswordDialog from '@/components/ChangePasswordDialog';
import { ChevronsUpDown, KeyRound, LogOut, Settings, UserRound } from 'lucide-react';

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join('') || '?';
}

interface AccountMenuProps {
  /** "pill" for top bars, "sidebar" for the bottom of the navigation. */
  variant?: 'pill' | 'sidebar';
  roleLabel?: string;
}

export default function AccountMenu({ variant = 'pill', roleLabel }: AccountMenuProps) {
  const { user, logout } = useAuth();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const name = user?.userName || t('account.menu');
  const summary = variant === 'sidebar'
    ? <><span className="avatar" aria-hidden="true" data-initials={initials(name)} /><span className="sb-user-meta"><span>{name}</span>{roleLabel && <>{' '}<small>{roleLabel}</small></>}</span><ChevronsUpDown className="sb-user-chev" size={16} aria-hidden="true" /></>
    : <><UserRound size={16} aria-hidden="true" /><span>{name}</span></>;

  return <>
    <details className="account-menu">
      <summary className={variant === 'pill' ? 'user-badge' : undefined} aria-label={[name, roleLabel].filter(Boolean).join(' ')}>{summary}</summary>
      <div className="account-dropdown">
        <p>{user?.email}</p>
        <Link href="/settings" className="account-link"><Settings size={16} aria-hidden="true" />{t('settings.title')}</Link>
        <button type="button" onClick={() => setOpen(true)}><KeyRound size={16} aria-hidden="true" />{t('account.changePassword')}</button>
        <button type="button" onClick={() => void logout()}><LogOut size={16} aria-hidden="true" />{t('account.logout')}</button>
      </div>
    </details>
    <ChangePasswordDialog open={open} onClose={() => setOpen(false)} />
  </>;
}
