import { NextRequest, NextResponse } from 'next/server';
import { fetchFlaskBackend } from '@/lib/backendClient';
import { AUTH_SESSION_COOKIE } from '@/lib/authSession';

type RouteContext = { params: Promise<{ id: string }> };

/** Who resolved, reopened or assigned an incident, when and why. SOC, GRC and CISO may read it. */
export async function GET(request: NextRequest, context: RouteContext) {
  if (!request.cookies.get(AUTH_SESSION_COOKIE)?.value) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await context.params;
  if (!/^[A-Za-z0-9_-]{3,64}$/.test(id)) return NextResponse.json({ error: 'Incident not found.' }, { status: 404 });
  try {
    const res = await fetchFlaskBackend(`/api/incidents/${id}/events`, { method: 'GET' }, 10000);
    return NextResponse.json(await res.json(), { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Activity is not available. Try again.' }, { status: 503 });
  }
}
