import { NextResponse } from 'next/server';
import { fetchFlaskBackend } from '@/lib/backendClient';

export async function GET() {
  try {
    const res = await fetchFlaskBackend('/api/admin/leaderboard', { method: 'GET' });
    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json({ error: data.error || 'Gagal mengambil data leaderboard' }, { status: res.status });
    }
    return NextResponse.json(data);
  } catch (error: unknown) {
    return NextResponse.json({ error: 'Gagal menghubungi server backend', detail: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
