import { NextRequest, NextResponse } from 'next/server';
import { AUTH_SESSION_COOKIE, shouldUseSecureCookies } from '@/lib/authSession';
import { fetchAuthBackend } from '@/lib/authBackend';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const backend = await fetchAuthBackend(request, '/api/auth/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await backend.json();
    if (!backend.ok) return NextResponse.json(data, { status: backend.status });

    const sessionToken = data.sessionToken as string;
    const expiresIn = Number(data.expiresIn || 28800);
    delete data.sessionToken;
    const response = NextResponse.json(data, { status: 200 });
    response.cookies.set(AUTH_SESSION_COOKIE, sessionToken, {
      httpOnly: true,
      secure: shouldUseSecureCookies(),
      sameSite: 'lax',
      path: '/',
      maxAge: expiresIn,
    });
    return response;
  } catch {
    return NextResponse.json({ error: 'Layanan autentikasi tidak tersedia' }, { status: 503 });
  }
}

