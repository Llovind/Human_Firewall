'use client';

import { useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { KeyRound, LogOut, UserRound, X } from 'lucide-react';

export default function AccountMenu() {
  const { user, logout } = useAuth();
  const dialog = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const clear = () => { setCurrentPassword(''); setNewPassword(''); setConfirmation(''); setError(''); };
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (newPassword !== confirmation) { setError('Passwords do not match.'); return; }
    setBusy(true); setError('');
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Password has not been changed.');
      await logout();
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not reach the server.'); }
    finally { setBusy(false); }
  }
  return <>
    <details className="account-menu">
      <summary className="user-badge"><UserRound size={16} /><span>{user?.userName || 'Account'}</span></summary>
      <div className="account-dropdown">
        <p>{user?.email}</p>
        <button type="button" onClick={() => { clear(); dialog.current?.showModal(); }}><KeyRound size={16} />Change password</button>
        <button type="button" onClick={() => void logout()}><LogOut size={16} />Logout</button>
      </div>
    </details>
    <dialog ref={dialog} className="account-dialog" aria-labelledby="password-title" onClose={clear}>
      <button type="button" className="account-close" aria-label="Close" disabled={busy} onClick={() => dialog.current?.close()}><X size={18} /></button>
      <h2 id="password-title">Change password</h2>
      <p>All sessions will end. Sign in again with your new password and OTP.</p>
      <form onSubmit={submit} className="debt-form">
        <label>Current password<input autoComplete="current-password" type="password" required maxLength={256} value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} /></label>
        <label>New password<input autoComplete="new-password" type="password" required minLength={12} maxLength={256} value={newPassword} onChange={e => setNewPassword(e.target.value)} /></label>
        <label>Confirm password<input autoComplete="new-password" type="password" required minLength={12} maxLength={256} value={confirmation} onChange={e => setConfirmation(e.target.value)} /></label>
        <small>At least 12 characters, with uppercase, lowercase, and numbers.</small>
        {error && <p role="alert" className="debt-error">{error}</p>}
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save & sign in again'}</button>
      </form>
    </dialog>
  </>;
}
