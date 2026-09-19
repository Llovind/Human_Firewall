import { NextRequest, NextResponse } from 'next/server';
import { AUTH_SESSION_COOKIE } from '@/lib/authSession';
import { fetchAuthBackend } from '@/lib/authBackend';

export async function GET(request: NextRequest) {
  const token = request.cookies.get(AUTH_SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ authenticated: false }, { status: 401 });
  try {
    const backend = await fetchAuthBackend(request, '/api/auth/session', {
      method: 'GET',
      headers: { 'X-Afferent-Session': token },
    });
    const data = await backend.json();
    const response = NextResponse.json(data, { status: backend.status });
    if (!backend.ok) response.cookies.delete(AUTH_SESSION_COOKIE);
    return response;
  } catch {
    return NextResponse.json({ authenticated: false, error: 'Layanan autentikasi tidak tersedia' }, { status: 503 });
  }
}

