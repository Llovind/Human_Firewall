'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { useI18n } from '@/i18n/I18nProvider';

/** Icon button for top bars. The sidebar has its own labelled row that uses the same hook. */
export default function ThemeToggle() {
  const [theme, toggle] = useTheme();
  const { t } = useI18n();
  const label = theme === 'dark' ? t('shell.theme.light') : t('shell.theme.dark');
  return (
    <button type="button" className="iconbtn theme-toggle" onClick={toggle} title={label} aria-label={label}>
      {theme === 'dark' ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
    </button>
  );
}
