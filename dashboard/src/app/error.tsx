'use client';

import { NoticeShell, Notice, HomeLink } from '@/components/ui/NoticeShell';
import { useI18n } from '@/i18n/I18nProvider';

/** Shown when a page fails while rendering. Says what happened, that data is safe, and what to do next. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useI18n();
  return (
    <NoticeShell>
      <Notice level="medium" status={t('sys.error.status')} title={t('sys.error.title')} why={t('sys.error.why')}
        actions={<><button type="button" className="btn btn-primary" onClick={reset}>{t('common.retry')}</button><HomeLink /></>}>
        {error.digest && <p className="notice-help mono">{t('sys.error.ref', { id: error.digest })}</p>}
      </Notice>
    </NoticeShell>
  );
}
