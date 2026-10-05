'use client';

import { useI18n } from '@/i18n/I18nProvider';

/** EN / ID toggle for top bars and standalone pages. The sidebar has its own row built from the same context. */
export default function LanguageSwitch() {
  const { lang, setLang, t } = useI18n();
  return (
    <span className="lang-switch" role="group" aria-label={t('lang.label')}>
      <button type="button" aria-pressed={lang === 'en'} aria-label={t('lang.en')} lang="en" onClick={() => setLang('en')}>EN</button>
      <button type="button" aria-pressed={lang === 'id'} aria-label={t('lang.id')} lang="id" onClick={() => setLang('id')}>ID</button>
    </span>
  );
}
