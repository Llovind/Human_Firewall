import { cookies, headers as requestHeaders } from 'next/headers';
import { AUTH_SESSION_COOKIE } from '@/lib/authSession';

/**
 * Shared backend fetch helper for Next.js API route proxies.
 * One configured target, preserves backend errors and streaming responses.
 */

export async function fetchFlaskBackend(path: string, options: RequestInit = {}, timeoutMs = 4000): Promise<Response> {
  const serviceApiKey = process.env.SERVICE_API_KEY;
  const cookieStore = await cookies();
  const inboundHeaders = await requestHeaders();
  const sessionToken = cookieStore.get(AUTH_SESSION_COOKIE)?.value;

  const baseUrl = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL;
  if (!baseUrl) throw new Error('API_URL is required');

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
  headers.set('X-Request-ID', inboundHeaders.get('x-request-id') || crypto.randomUUID());
  // Never replay a mutation against fallback hosts; return backend errors intact.
  const controller = new AbortController();
  const timeoutId = timeoutMs > 0 ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    return await fetch(`${baseUrl.replace(/\/$/, '')}${path.startsWith('/') ? path : '/' + path}`, {
      ...options, headers, signal: options.signal || controller.signal, cache: 'no-store',
    });
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}
