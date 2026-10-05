import { NextRequest, NextResponse } from 'next/server';
import { fetchFlaskBackend } from '@/lib/backendClient';
import { AUTH_SESSION_COOKIE } from '@/lib/authSession';

/** SOC and GRC list access requests (the back end enforces the roles). */
export async function GET(request: NextRequest) {
  if (!request.cookies.get(AUTH_SESSION_COOKIE)?.value) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const status = request.nextUrl.searchParams.get('status');
    const res = await fetchFlaskBackend(`/api/admin/access-requests${status ? `?status=${encodeURIComponent(status)}` : ''}`, { method: 'GET' }, 10000);
    return NextResponse.json(await res.json(), { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Access requests are not available. Try again.' }, { status: 503 });
  }
}
