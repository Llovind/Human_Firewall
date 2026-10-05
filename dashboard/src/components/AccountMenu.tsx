'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useI18n } from '@/i18n/I18nProvider';
import Dialog from '@/components/ui/Dialog';
import Field from '@/components/ui/Field';
import { ChevronsUpDown, KeyRound, LogOut, UserRound } from 'lucide-react';

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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');

  const close = () => { setOpen(false); setCurrentPassword(''); setNewPassword(''); setConfirmation(''); setError(''); };

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (newPassword !== confirmation) { setError(t('account.mismatch')); return; }
    setBusy(true); setError('');
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof body.error === 'string' ? body.error : t('account.failed'));
      await logout();
    } catch (err) { setError(err instanceof Error ? err.message : t('account.unreachable')); }
    finally { setBusy(false); }
  }

  const name = user?.userName || t('account.menu');
  const summary = variant === 'sidebar'
    ? <><span className="avatar" aria-hidden="true">{initials(name)}</span><span className="sb-user-meta"><span>{name}</span>{roleLabel && <small>{roleLabel}</small>}</span><ChevronsUpDown className="sb-user-chev" size={16} aria-hidden="true" /></>
    : <><UserRound size={16} aria-hidden="true" /><span>{name}</span></>;

  return <>
    <details className="account-menu">
      <summary className={variant === 'pill' ? 'user-badge' : undefined} aria-label={`${t('account.menu')}: ${name}`}>{summary}</summary>
      <div className="account-dropdown">
        <p>{user?.email}</p>
        <button type="button" onClick={() => setOpen(true)}><KeyRound size={16} aria-hidden="true" />{t('account.changePassword')}</button>
        <button type="button" onClick={() => void logout()}><LogOut size={16} aria-hidden="true" />{t('account.logout')}</button>
      </div>
    </details>
    <Dialog open={open} onClose={close} busy={busy} title={t('account.changePassword')} description={t('account.dialog.description')}>
      <form onSubmit={submit} className="ui-form">
        <Field label={t('account.current')}>{control => <input {...control} autoComplete="current-password" type="password" required maxLength={256} value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} />}</Field>
        <Field label={t('account.new')} hint={t('account.rule')}>{control => <input {...control} autoComplete="new-password" type="password" required minLength={12} maxLength={256} value={newPassword} onChange={e => setNewPassword(e.target.value)} />}</Field>
        <Field label={t('account.confirm')} error={error || undefined}>{control => <input {...control} autoComplete="new-password" type="password" required minLength={12} maxLength={256} value={confirmation} onChange={e => setConfirmation(e.target.value)} />}</Field>
        <div className="ui-dialog-footer">
          <button type="button" className="btn" disabled={busy} onClick={close}>{t('common.cancel')}</button>
          <button className="btn btn-primary" disabled={busy}>{busy ? t('account.saving') : t('account.save')}</button>
        </div>
      </form>
    </Dialog>
  </>;
}
