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

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const result = transform ? transform(json) : json as T;
      
      // Check if data actually changed to trigger animations
      const serialized = JSON.stringify(result);
      if (serialized !== previousDataRef.current) {
        setHasUpdated(true);
        previousDataRef.current = serialized;
        // Reset the flash after animation duration
        setTimeout(() => setHasUpdated(false), 500);
      }
      
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch');
    } finally {
      setIsLoading(false);
    }
  }, [url, transform]);

  const refresh = useCallback(() => {
    setIsLoading(true);
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    // Initial fetch
    fetchData();

    // Setup polling
    intervalRef.current = setInterval(fetchData, interval);

    // Pause polling when tab is hidden
    const handleVisibility = () => {
      if (document.hidden) {
        if (intervalRef.current) clearInterval(intervalRef.current);
      } else {
        fetchData();
        intervalRef.current = setInterval(fetchData, interval);
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [fetchData, interval]);

  return { data, isLoading, error, hasUpdated, refresh };
}
