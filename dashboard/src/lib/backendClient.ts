/**
 * Shared backend fetch helper for Next.js API route proxies.
 * Handles SERVICE_API_KEY header and tries target URLs in order.
 */

const DEFAULT_SERVICE_KEY = '5f2970d4e3376a7e842e5f7f0f6df224cb01a50e3d8a60b75656de4372977036';

export async function fetchFlaskBackend(path: string, options: RequestInit = {}): Promise<Response> {
  const serviceApiKey = process.env.SERVICE_API_KEY || DEFAULT_SERVICE_KEY;

  // Prioritize Docker container DNS hostnames first, then localhost fallback
  const targetUrls = Array.from(new Set([
    process.env.API_URL,
    process.env.NEXT_PUBLIC_API_URL,
    'http://flask_api:5000',
    'http://hfl-flask:5000',
    'http://127.0.0.1:5000',
    'http://localhost:5000'
  ])).filter(Boolean) as string[];

  let lastError: Error | null = null;

  const headers = new Headers(options.headers || {});
  if (!headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${serviceApiKey}`);
  }

  for (const baseUrl of targetUrls) {
    try {
      const url = `${baseUrl}${path.startsWith('/') ? path : '/' + path}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const res = await fetch(url, {
        ...options,
        headers,
        signal: options.signal || controller.signal,
        cache: 'no-store'
      });
      clearTimeout(timeoutId);

      if (res && res.status < 500) {
        return res;
      }
    } catch (err: any) {
      lastError = err;
    }
  }

  throw lastError || new Error(`Failed to connect to Flask backend at ${path}`);
}
