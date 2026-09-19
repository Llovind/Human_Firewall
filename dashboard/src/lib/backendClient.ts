import { cookies, headers as requestHeaders } from 'next/headers';
import { AUTH_SESSION_COOKIE } from '@/lib/authSession';

/**
 * Shared backend fetch helper for Next.js API route proxies.
 * Handles SERVICE_API_KEY header and tries target URLs in order.
 */

export async function fetchFlaskBackend(path: string, options: RequestInit = {}, timeoutMs = 4000): Promise<Response> {
  const serviceApiKey = process.env.SERVICE_API_KEY;
  const cookieStore = await cookies();
  const inboundHeaders = await requestHeaders();
  const sessionToken = cookieStore.get(AUTH_SESSION_COOKIE)?.value;

  // Prioritize Docker container DNS hostnames first, then localhost fallback
  const targetUrls = Array.from(new Set([
    'http://flask_api:5000',
    process.env.API_URL,
    'http://hfl-flask:5000',
    process.env.NEXT_PUBLIC_API_URL,
    'http://127.0.0.1:5000',
    'http://localhost:5000'
  ])).filter(Boolean) as string[];

  let lastError: Error | null = null;

  const headers = new Headers(options.headers || {});
  if (sessionToken) {
    headers.set('X-Afferent-Session', sessionToken);
  } else if (!headers.has('Authorization') && serviceApiKey) {
    headers.set('Authorization', `Bearer ${serviceApiKey}`);
  } else if (!headers.has('Authorization')) {
    throw new Error('Authenticated session or SERVICE_API_KEY is required');
  }
  const forwardedFor = inboundHeaders.get('x-forwarded-for');
  const userAgent = inboundHeaders.get('user-agent');
  if (forwardedFor) headers.set('X-Forwarded-For', forwardedFor);
  if (userAgent) headers.set('User-Agent', userAgent);

  for (const baseUrl of targetUrls) {
    try {
      const url = `${baseUrl}${path.startsWith('/') ? path : '/' + path}`;
      const controller = new AbortController();
      const timeoutId = timeoutMs > 0 ? setTimeout(() => controller.abort(), timeoutMs) : null;

      const res = await fetch(url, {
        ...options,
        headers,
        signal: options.signal || controller.signal,
        cache: 'no-store'
      });
      if (timeoutId) clearTimeout(timeoutId);

      if (res && res.status < 500) {
        return res;
      }
    } catch (err: unknown) {
      lastError = err instanceof Error ? err : new Error('Unknown backend connection error');
    }
  }

  throw lastError || new Error(`Failed to connect to Flask backend at ${path}`);
}
