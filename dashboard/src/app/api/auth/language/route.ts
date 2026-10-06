import { NextRequest, NextResponse } from 'next/server';
import { AUTH_SESSION_COOKIE } from '@/lib/authSession';
import { fetchAuthBackend } from '@/lib/authBackend';

/** Remember the signed-in person's language on their account, so it follows them to other browsers. */
export async function POST(request: NextRequest) {
  const token = request.cookies.get(AUTH_SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const origin = request.headers.get('origin');
  if (origin && new URL(origin).host !== request.headers.get('host')) return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
  if (!request.headers.get('content-type')?.includes('application/json')) return NextResponse.json({ error: 'JSON required' }, { status: 415 });
  const body = await request.json().catch(() => null);
  if (!body || (body.language !== 'en' && body.language !== 'id')) return NextResponse.json({ error: 'Language must be en or id.' }, { status: 400 });
  try {
    const res = await fetchAuthBackend(request, '/api/auth/language', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Afferent-Session': token },
      body: JSON.stringify({ language: body.language }),
    });
    return NextResponse.json(await res.json(), { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Language was not saved. Try again.' }, { status: 503 });
  }
}
