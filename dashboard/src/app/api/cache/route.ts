import { NextRequest, NextResponse } from 'next/server';
import { fetchFlaskBackend } from '@/lib/backendClient';

export async function POST() {
  return NextResponse.json({ error: 'Legacy webhook retired. Use authenticated SOC actions.' }, { status: 410 });
}

export async function GET(request: NextRequest) {
  try {
    const res = await fetchFlaskBackend(`/api/admin/threats/feed${request.nextUrl.search}`);
    return NextResponse.json(await res.json(), { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Threat feed unavailable; no simulated data substituted.' }, { status: 503 });
  }
}
