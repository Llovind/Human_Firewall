'use client';

import { useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useI18n } from '@/i18n/I18nProvider';

/**
 * Keeps the language on the account and in the browser the same.
 * On sign-in the account's choice wins; after that, every change the person makes is saved to the account.
 */
export default function LanguageSync() {
  const { user } = useAuth();
  const { lang, setLang } = useI18n();
  const synced = useRef<{ id: number; lang: string } | null>(null);

  useEffect(() => {
    if (!user) { synced.current = null; return; }
    if (synced.current?.id !== user.id) {
      synced.current = { id: user.id, lang: user.language ?? lang };
      if (user.language && user.language !== lang) setLang(user.language);
      return;
    }
    if (lang !== synced.current.lang) {
      synced.current.lang = lang;
      void fetch('/api/auth/language', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ language: lang }) }).catch(() => {});
    }
  }, [user, lang, setLang]);

  return null;
}
