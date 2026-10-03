'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Custom hook for polling API endpoints every N seconds.
 * This is the core "Push-to-Pull" mechanism: backend POSTs to our API routes,
 * and the React UI pulls data from those same routes on a timer.
 *
 * Features:
 * - Automatic polling at specified interval
 * - Tracks whether data has changed (for triggering animations)
 * - Error resilience (continues polling even if one request fails)
 * - Pauses when browser tab is not visible (performance optimization)
 */
export function usePolling<T>(
  url: string,
  interval: number = 3000,
  transform?: (data: unknown) => T
): {
  data: T | null;
  isLoading: boolean;
  error: string | null;
  hasUpdated: boolean;
  refresh: () => void;
} {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasUpdated, setHasUpdated] = useState(false);
  const previousDataRef = useRef<string>('');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const flashRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchData = useCallback(async () => {
    if (controllerRef.current) return;
    const controller = new AbortController();
    controllerRef.current = controller;
    try {
      const res = await fetch(url, { signal: controller.signal, cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (controller.signal.aborted) return;
      const result = transform ? transform(json) : json as T;
      
      // Check if data actually changed to trigger animations
      const serialized = JSON.stringify(result);
      if (serialized !== previousDataRef.current) {
        setHasUpdated(true);
        previousDataRef.current = serialized;
        setData(result);
        // Reset the flash after animation duration
        if (flashRef.current) clearTimeout(flashRef.current);
        flashRef.current = setTimeout(() => setHasUpdated(false), 500);
      }
      
      setError(null);
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(err instanceof Error ? err.message : 'Failed to fetch');
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
      if (!controller.signal.aborted) setIsLoading(false);
    }
  }, [url, transform]);

  const refresh = useCallback(() => {
    setIsLoading(true);
    void fetchData();
  }, [fetchData]);

  useEffect(() => {
    previousDataRef.current = '';
    // Initial fetch
    const initialFetch = setTimeout(() => void fetchData(), 0);

    // Setup polling
    intervalRef.current = setInterval(fetchData, interval);

    // Pause polling when tab is hidden
    const handleVisibility = () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (!document.hidden) {
        fetchData();
        intervalRef.current = setInterval(fetchData, interval);
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearTimeout(initialFetch);
      controllerRef.current?.abort();
      controllerRef.current = null;
      if (flashRef.current) clearTimeout(flashRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [fetchData, interval]);

  return { data, isLoading, error, hasUpdated, refresh };
}
