import { NextRequest } from 'next/server';

export async function fetchAuthBackend(
  request: NextRequest,
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const targets = Array.from(new Set([
    process.env.API_URL,
    'http://flask_api:5000',
    process.env.NEXT_PUBLIC_API_URL,
    'http://127.0.0.1:5000',
  ])).filter(Boolean) as string[];

  const headers = new Headers(options.headers || {});
  const forwardedFor = request.headers.get('x-forwarded-for')
    || request.headers.get('x-real-ip');
  if (forwardedFor) headers.set('X-Forwarded-For', forwardedFor);
  const userAgent = request.headers.get('user-agent');
  if (userAgent) headers.set('User-Agent', userAgent);
  headers.set('X-Request-ID', request.headers.get('x-request-id') || crypto.randomUUID());

  let lastError: Error | null = null;
  for (const baseUrl of targets) {
    try {
      const response = await fetch(`${baseUrl}${path}`, {
        ...options,
        headers,
        cache: 'no-store',
      });
      if (response.status < 500 || response.status === 503) return response;
    } catch (error: unknown) {
      lastError = error instanceof Error ? error : new Error('Authentication backend unavailable');
    }
  }
  throw lastError || new Error('Authentication backend unavailable');
}

