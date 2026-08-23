import { NextRequest, NextResponse } from 'next/server';
import { fetchFlaskBackend } from '@/lib/backendClient';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const refresh = searchParams.get('refresh') || 'false';

  try {
    const res = await fetchFlaskBackend(
      `/api/ai/classify-all?refresh=${refresh}`,
      { method: 'GET' }
    );
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return NextResponse.json({ error: 'Gagal menghubungi Flask API', detail: String(err) }, { status: 503 });
  }
}

export async function POST(req: NextRequest) {
  // Force invalidate cache
  try {
    const res = await fetchFlaskBackend('/api/ai/cache/invalidate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 503 });
  }
}
