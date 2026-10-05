'use client';

import { Flag, Link2, LockKeyhole, ShieldAlert } from 'lucide-react';
import { NoticeShell, Notice, HomeLink } from '@/components/ui/NoticeShell';
import { useI18n } from '@/i18n/I18nProvider';

/** Where a person lands after clicking a simulated phishing link: calm, specific, and useful. */
export default function SimulationEducation() {
  const { t } = useI18n();
  const habits = [
    { Icon: ShieldAlert, title: t('edu.h1.title'), body: t('edu.h1.body') },
    { Icon: Link2, title: t('edu.h2.title'), body: t('edu.h2.body') },
    { Icon: Flag, title: t('edu.h3.title'), body: t('edu.h3.body') },
  ];
  return (
    <NoticeShell footer={t('edu.footer')}>
      <Notice level="medium" status={t('edu.status')} title={t('edu.title')} why={t('edu.lead')} actions={<HomeLink label={t('edu.back')} />}>
        <div className="notice-banner" data-tone="ok"><strong><LockKeyhole size={14} aria-hidden="true" /> {t('edu.assure.title')}</strong>{t('edu.assure.body')}</div>
        <h2 className="notice-sub">{t('edu.habits')}</h2>
        <ol className="notice-habits">
          {habits.map(({ Icon, title, body }) => (
            <li key={title}><Icon size={18} aria-hidden="true" /><span><strong>{title}</strong>{body}</span></li>
          ))}
        </ol>
        <div className="notice-banner"><strong>{t('edu.bookmark.title')}</strong>{t('edu.bookmark.body')}</div>
      </Notice>
    </NoticeShell>
  );
}
