import { NextRequest, NextResponse } from 'next/server';
import { fetchFlaskBackend } from '@/lib/backendClient';
import { AUTH_SESSION_COOKIE } from '@/lib/authSession';

type RouteContext = { params: Promise<{ id: string }> };

/** SOC allows the domain for everyone, or keeps it blocked. Only SOC passes the back end role check. */
export async function POST(request: NextRequest, context: RouteContext) {
  if (!request.cookies.get(AUTH_SESSION_COOKIE)?.value) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Access request not found.' }, { status: 404 });
  if (!(request.headers.get('content-type') || '').startsWith('application/json')) {
    return NextResponse.json({ error: 'A JSON request is required.' }, { status: 415 });
  }
  try {
    const res = await fetchFlaskBackend(`/api/admin/access-requests/${id}/decision`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(await request.json()),
    }, 15000);
    return NextResponse.json(await res.json(), { status: res.status });
  } catch {
    return NextResponse.json({ error: 'The decision was not saved. Try again.' }, { status: 503 });
  }
}
