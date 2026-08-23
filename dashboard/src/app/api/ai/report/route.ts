import { NextRequest, NextResponse } from 'next/server';
import { fetchFlaskBackend } from '@/lib/backendClient';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const days = searchParams.get('days') || '7';
  const refresh = searchParams.get('refresh') || 'false';

  try {
    const res = await fetchFlaskBackend(
      `/api/ai/report?days=${days}&refresh=${refresh}`,
      { method: 'GET' }
    );
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return NextResponse.json({ error: 'Gagal menghubungi Flask API', detail: String(err) }, { status: 503 });
  }
}
