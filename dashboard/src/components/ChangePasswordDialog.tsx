'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useI18n } from '@/i18n/I18nProvider';
import Dialog from '@/components/ui/Dialog';
import Field from '@/components/ui/Field';

/** Changing the password signs the person out everywhere, so the dialog ends with a sign-out. */
export default function ChangePasswordDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { logout } = useAuth();
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');


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

  const close = () => { onClose(); setCurrentPassword(''); setNewPassword(''); setConfirmation(''); setError(''); };

  return (
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
  );
}
