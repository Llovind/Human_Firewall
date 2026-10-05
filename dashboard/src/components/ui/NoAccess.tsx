'use client';

import { NoticeShell, Notice, HomeLink } from '@/components/ui/NoticeShell';
import { useI18n } from '@/i18n/I18nProvider';
import type { MessageKey } from '@/i18n/messages';

/** Shown when someone signed in opens a page meant for another role. Replaces the silent redirect. */
export default function NoAccess({ neededRole, currentRole, homeHref }: { neededRole: string; currentRole: string; homeHref: string }) {
  const { t } = useI18n();
  const label = (role: string) => t(`role.${role}` as MessageKey);
  return (
    <NoticeShell>
      <Notice level="info" status={t('sys.noaccess.status')} title={t('sys.noaccess.title')}
        why={t('sys.noaccess.why', { needed: label(neededRole), mine: label(currentRole) })}
        actions={<HomeLink href={homeHref} />}>
        <p className="notice-help">{t('sys.noaccess.ask')}</p>
      </Notice>
    </NoticeShell>
  );
}
