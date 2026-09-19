import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { AUTH_SESSION_COOKIE } from '@/lib/authSession';

const PUBLIC_API_ROUTES = new Set([
  '/api/auth/login',
  '/api/auth/verify-otp',
  '/api/auth/resend-otp',
  '/api/auth/logout',
  '/api/config',
  '/api/proxy/ca.crt',
]);

function isLocalDevBypassEnabled(): boolean {
  const environment = (process.env.APP_ENV || process.env.NODE_ENV || 'development').toLowerCase();
  const bypass = process.env.DEV_BYPASS_AUTH?.trim().toLowerCase() === 'true';
  return bypass && ['development', 'dev', 'local', 'test'].includes(environment);
}

function hasValidServiceBearer(request: NextRequest): boolean {
  const expected = process.env.SERVICE_API_KEY;
  const authorization = request.headers.get('authorization') || '';
  if (!expected || !authorization.startsWith('Bearer ')) return false;

  const supplied = authorization.slice('Bearer '.length).trim();
  const suppliedBuffer = Buffer.from(supplied);
  const expectedBuffer = Buffer.from(expected);
  return suppliedBuffer.length === expectedBuffer.length
    && crypto.timingSafeEqual(suppliedBuffer, expectedBuffer);
}

/**
 * Lightweight edge gate. Presence is checked here; Flask validates the opaque
 * session and enforces the server-side RBAC role for every backend operation.
 */
export function proxy(request: NextRequest) {
  if (isLocalDevBypassEnabled()) return NextResponse.next();

  const { pathname } = request.nextUrl;
  if (pathname === '/admin/login' || pathname === '/auth' || PUBLIC_API_ROUTES.has(pathname)) {
    return NextResponse.next();
  }
  if (pathname.startsWith('/api/') && hasValidServiceBearer(request)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(AUTH_SESSION_COOKIE)?.value;
  if (!token) {
    if (!pathname.startsWith('/api/')) {
      return NextResponse.redirect(new URL('/auth', request.url));
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*', '/admin/:path*', '/dashboard/:path*'],
};
