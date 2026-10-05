'use client';

import { useCallback, useSyncExternalStore } from 'react';

/**
 * A small preference stored in the browser (language, theme, sidebar state).
 * Reads are safe on the server (the fallback is used) and when storage is blocked.
 * Several components using the same key stay in sync.
 */
const listeners = new Map<string, Set<() => void>>();

function read(key: string): string | null {
  try { return window.localStorage.getItem(key); } catch { return null; }
}

export function usePreference(key: string, fallback: string): [string, (value: string) => void] {
  const subscribe = useCallback((notify: () => void) => {
    let set = listeners.get(key);
    if (!set) { set = new Set(); listeners.set(key, set); }
    set.add(notify);
    const onStorage = (event: StorageEvent) => { if (event.key === key) notify(); };
    window.addEventListener('storage', onStorage);
    return () => { set.delete(notify); window.removeEventListener('storage', onStorage); };
  }, [key]);

  const value = useSyncExternalStore(subscribe, () => read(key) ?? fallback, () => fallback);

  const update = useCallback((next: string) => {
    try { window.localStorage.setItem(key, next); } catch { /* storage blocked: preference lasts until reload */ }
    listeners.get(key)?.forEach(notify => notify());
  }, [key]);

  return [value, update];
}
