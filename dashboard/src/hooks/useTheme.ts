'use client';

import { useCallback, useEffect } from 'react';
import { usePreference } from '@/hooks/usePreference';

export type Theme = 'light' | 'dark';
/** Same key the previous ThemeToggle used, so saved choices carry over. */
export const THEME_KEY = 'hfl_theme';

export function useTheme(): [Theme, () => void] {
  const [stored, setStored] = usePreference(THEME_KEY, 'light');
  const theme: Theme = stored === 'dark' ? 'dark' : 'light';
  useEffect(() => { document.documentElement.setAttribute('data-theme', theme); }, [theme]);
  const toggle = useCallback(() => setStored(theme === 'dark' ? 'light' : 'dark'), [theme, setStored]);
  return [theme, toggle];
}
