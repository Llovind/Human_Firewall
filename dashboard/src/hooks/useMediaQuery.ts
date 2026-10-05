'use client';

import { useSyncExternalStore } from 'react';

/** True while the media query matches. False on the server and during hydration, then the real value. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    notify => {
      const list = window.matchMedia(query);
      list.addEventListener('change', notify);
      return () => list.removeEventListener('change', notify);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
