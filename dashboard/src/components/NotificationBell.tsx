'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Bell } from 'lucide-react';
import { usePolling } from '@/hooks/usePolling';
import { usePreference } from '@/hooks/usePreference';
import { useI18n } from '@/i18n/I18nProvider';
import type { WorkQueue } from '@/hooks/useWorkQueue';

type Role = 'employee' | 'soc' | 'grc' | 'ciso' | 'phishing_admin';
interface MyRequest { id: string; domain: string; status: 'open' | 'allowed' | 'denied' }
interface Note { key: string; text: string; tab?: string; href?: string }

/** Everything the person should know about, in one list. Employees see answers to their requests; staff see work waiting. */
export default function NotificationBell({ role, onOpenTab, queue }: { role: Role; onOpenTab?: (tab: string) => void; /** Work waiting for staff; supplied by the layout so every number on screen comes from one place. */ queue?: WorkQueue }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const [seenRaw, setSeen] = usePreference('afferent_seen_requests', '');
  const seen = useMemo(() => new Set(seenRaw.split(',').filter(Boolean)), [seenRaw]);

  const isEmployee = role === 'employee';
  const { data: mine } = usePolling<{ requests: MyRequest[] }>(isEmployee ? '/api/access-requests' : '', 30000);

  const notes = useMemo<Note[]>(() => {
    const list: Note[] = [];
    if (isEmployee) {
      (mine?.requests ?? []).filter(r => r.status !== 'open' && !seen.has(r.id)).forEach(r => list.push({ key: r.id, text: t(r.status === 'allowed' ? 'notif.req.allowed' : 'notif.req.denied', { domain: r.domain }), href: '/' }));
    }
    if (queue && queue.requestsWaiting > 0) list.push({ key: 'staff-requests', text: t('notif.staff.requests', { n: queue.requestsWaiting }), tab: 'inbox' });
    if (queue && queue.urgentIncidents > 0) list.push({ key: 'staff-urgent', text: t('notif.staff.urgent', { n: queue.urgentIncidents }), tab: 'overview' });
    return list;
  }, [isEmployee, mine, queue, seen, t]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    const onClick = (event: MouseEvent) => { if (root.current && !root.current.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onClick); };
  }, [open]);

  if (role === 'phishing_admin') return null;
  const markRead = () => setSeen([...seen, ...(mine?.requests ?? []).filter(r => r.status !== 'open').map(r => r.id)].slice(-50).join(','));
  const label = notes.length ? t('notif.button', { n: notes.length }) : t('notif.button.none');

  return (
    <div className="notif" ref={root}>
      <button type="button" className="iconbtn notif-btn" aria-label={label} title={label} aria-expanded={open} aria-haspopup="true" onClick={() => setOpen(value => !value)}>
        <Bell size={18} aria-hidden="true" />
        {notes.length > 0 && <span className="notif-count" aria-hidden="true">{notes.length}</span>}
      </button>
      {open && (
        <div className="notif-panel" role="region" aria-label={t('notif.title')}>
          <div className="ops-head"><strong>{t('notif.title')}</strong>{isEmployee && notes.length > 0 && <button type="button" className="emp-link" onClick={markRead}>{t('notif.markRead')}</button>}</div>
          {notes.length === 0 ? <p className="emp-muted">{t('notif.none')}</p> : (
            <ul className="emp-list">
              {notes.map(note => (
                <li key={note.key}>
                  <span className="emp-list-main">{note.text}</span>
                  {note.tab && onOpenTab && <button type="button" className="btn" onClick={() => { onOpenTab(note.tab!); setOpen(false); }}>{t('notif.go')}</button>}
                  {note.href && <Link className="btn" href={note.href} onClick={() => setOpen(false)}>{t('notif.go')}</Link>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
