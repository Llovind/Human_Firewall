import { NextRequest } from 'next/server';

export async function fetchAuthBackend(
  request: NextRequest,
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const baseUrl = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL;
  if (!baseUrl) throw new Error('API_URL is required');

  const headers = new Headers(options.headers || {});
  const forwardedFor = request.headers.get('x-forwarded-for')
    || request.headers.get('x-real-ip');
  if (forwardedFor) headers.set('X-Forwarded-For', forwardedFor);
  const userAgent = request.headers.get('user-agent');
  if (userAgent) headers.set('User-Agent', userAgent);
  headers.set('X-Request-ID', request.headers.get('x-request-id') || crypto.randomUUID());

  return fetch(`${baseUrl.replace(/\/$/, '')}${path}`, {
        ...options,
        headers,
        cache: 'no-store',
        signal: options.signal || AbortSignal.timeout(15000),
      });
}

