'use client';

import { NoticeShell, Notice, HomeLink } from '@/components/ui/NoticeShell';
import { useI18n } from '@/i18n/I18nProvider';

export default function NotFound() {
  const { t } = useI18n();
  return (
    <NoticeShell>
      <Notice level="info" status={t('sys.notfound.status')} title={t('sys.notfound.title')} why={t('sys.notfound.why')} actions={<HomeLink />} />
    </NoticeShell>
  );
}
