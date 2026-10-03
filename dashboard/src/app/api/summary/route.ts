import { NextRequest, NextResponse } from 'next/server';
import { fetchFlaskBackend } from '@/lib/backendClient';

export async function POST() {
  return NextResponse.json({ error: 'Legacy webhook retired' }, { status: 410 });
}

export async function GET(request: NextRequest) {
  try {
    const res = await fetchFlaskBackend(`/api/admin/ai/summaries${request.nextUrl.search}`, { method: 'GET' });
    if (!res.ok) return NextResponse.json({ error: 'Telemetry summary unavailable' }, { status: res.status });
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({ error: 'Telemetry unavailable; last snapshot retained' }, { status: 503 });
  }
}
