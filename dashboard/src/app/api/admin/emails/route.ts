import { NextResponse } from 'next/server';
import { fetchFlaskBackend } from '@/lib/backendClient';

export async function GET() {
  try {
    const res = await fetchFlaskBackend('/api/emails', { method: 'GET' });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error: unknown) {
    return NextResponse.json({ error: 'Gagal menghubungi server backend', detail: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
