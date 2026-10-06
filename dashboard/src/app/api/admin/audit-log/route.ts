import { NextRequest, NextResponse } from 'next/server';
import { fetchFlaskBackend } from '@/lib/backendClient';
import { AUTH_SESSION_COOKIE } from '@/lib/authSession';

const KINDS = new Set(['incident', 'access', 'warning', 'proxy']);

/** Merged list of who decided what: incidents, access requests, education warnings, proxy decisions. Staff only (the back end checks the role). */
export async function GET(request: NextRequest) {
  if (!request.cookies.get(AUTH_SESSION_COOKIE)?.value) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const params = new URLSearchParams();
  const kind = request.nextUrl.searchParams.get('kind');
  if (kind) {
    if (!KINDS.has(kind)) return NextResponse.json({ error: 'Unknown kind.' }, { status: 400 });
    params.set('kind', kind);
  }
  const limit = request.nextUrl.searchParams.get('limit');
  if (limit !== null) {
    const value = Number(limit);
    if (!Number.isInteger(value) || value < 1 || value > 300) return NextResponse.json({ error: 'limit must be between 1 and 300.' }, { status: 400 });
    params.set('limit', String(value));
  }
  try {
    const res = await fetchFlaskBackend(`/api/admin/audit-log${params.size ? `?${params}` : ''}`, { method: 'GET' }, 10000);
    return NextResponse.json(await res.json(), { status: res.status });
  } catch {
    return NextResponse.json({ error: 'The audit log is not available. Try again.' }, { status: 503 });
  }
}
