import { NextRequest, NextResponse } from 'next/server';
import { fetchFlaskBackend } from '@/lib/backendClient';
import { AUTH_SESSION_COOKIE } from '@/lib/authSession';

/** Employee requests to open a blocked site. A signed-in session is required; the back end checks the role. */
async function forward(request: NextRequest) {
  if (!request.cookies.get(AUTH_SESSION_COOKIE)?.value) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const post = request.method === 'POST';
    if (post && !(request.headers.get('content-type') || '').startsWith('application/json')) {
      return NextResponse.json({ error: 'A JSON request is required.' }, { status: 415 });
    }
    const res = await fetchFlaskBackend('/api/access-requests', {
      method: request.method,
      ...(post ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(await request.json()) } : {}),
    }, 15000);
    return NextResponse.json(await res.json(), { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Your request was not received. Try again.' }, { status: 503 });
  }
}
export const GET = forward;
export const POST = forward;
