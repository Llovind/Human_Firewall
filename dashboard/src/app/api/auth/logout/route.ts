import { NextRequest, NextResponse } from 'next/server';
import { AUTH_SESSION_COOKIE, shouldUseSecureCookies } from '@/lib/authSession';
import { fetchAuthBackend } from '@/lib/authBackend';

export async function POST(request: NextRequest) {
  const token = request.cookies.get(AUTH_SESSION_COOKIE)?.value;
  if (token) {
    try {
      await fetchAuthBackend(request, '/api/auth/logout', {
        method: 'POST',
        headers: { 'X-Afferent-Session': token },
      });
    } catch {
      // Local cookie is still cleared when backend revocation is unavailable.
    }
  }
  const response = NextResponse.json({ success: true });
  response.cookies.set(AUTH_SESSION_COOKIE, '', {
    httpOnly: true,
    secure: shouldUseSecureCookies(),
    sameSite: 'lax',
    path: '/',
    expires: new Date(0),
  });
  return response;
}

