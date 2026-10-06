import { NextRequest, NextResponse } from 'next/server';
import { fetchFlaskBackend } from '@/lib/backendClient';
import { AUTH_SESSION_COOKIE } from '@/lib/authSession';

/** Weekly numbers (score, people at risk, open incidents) for the executive trend. Staff only; the back end checks the role. */
export async function GET(request: NextRequest) {
  if (!request.cookies.get(AUTH_SESSION_COOKIE)?.value) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const weeks = Number(request.nextUrl.searchParams.get('weeks') ?? 12);
  if (!Number.isInteger(weeks) || weeks < 2 || weeks > 52) return NextResponse.json({ error: 'weeks must be between 2 and 52.' }, { status: 400 });
  try {
    const res = await fetchFlaskBackend(`/api/admin/trends?weeks=${weeks}`, { method: 'GET' }, 10000);
    return NextResponse.json(await res.json(), { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Trends are not available. Try again.' }, { status: 503 });
  }
}
