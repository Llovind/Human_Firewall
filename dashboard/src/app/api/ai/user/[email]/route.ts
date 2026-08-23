import { NextRequest, NextResponse } from 'next/server';
import { fetchFlaskBackend } from '@/lib/backendClient';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ email: string }> }
) {
  const { searchParams } = new URL(req.url);
  const days = searchParams.get('days') || '30';
  const refresh = searchParams.get('refresh') || 'false';
  const { email: rawEmail } = await params;
  const email = decodeURIComponent(rawEmail);

  try {
    const res = await fetchFlaskBackend(
      `/api/ai/user/${encodeURIComponent(email)}?days=${days}&refresh=${refresh}`,
      { method: 'GET' }
    );
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return NextResponse.json({ error: 'Gagal menghubungi Flask API', detail: String(err) }, { status: 503 });
  }
}
