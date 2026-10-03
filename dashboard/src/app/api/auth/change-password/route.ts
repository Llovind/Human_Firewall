import { NextRequest, NextResponse } from 'next/server';
import { AUTH_SESSION_COOKIE, shouldUseSecureCookies } from '@/lib/authSession';
import { fetchAuthBackend } from '@/lib/authBackend';

export async function POST(request: NextRequest) {
  const token = request.cookies.get(AUTH_SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const origin = request.headers.get('origin');
  if (origin && new URL(origin).host !== request.headers.get('host')) {
    return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
  }
  try {
    const res = await fetchAuthBackend(request, '/api/auth/change-password', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Afferent-Session': token },
      body: JSON.stringify(await request.json()),
    });
    const response = NextResponse.json(await res.json(), { status: res.status });
    if (res.ok) response.cookies.set(AUTH_SESSION_COOKIE, '', {
      httpOnly: true, secure: shouldUseSecureCookies(), sameSite: 'lax', path: '/', expires: new Date(0),
    });
    return response;
  } catch {
    return NextResponse.json({ error: 'Password belum diubah. Coba kembali.' }, { status: 503 });
  }
}
