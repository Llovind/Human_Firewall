import { NextRequest, NextResponse } from 'next/server';
import { fetchFlaskBackend } from '@/lib/backendClient';
import { AUTH_SESSION_COOKIE } from '@/lib/authSession';

async function forward(request: NextRequest) {
  if (!request.cookies.get(AUTH_SESSION_COOKIE)?.value) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const res = await fetchFlaskBackend('/api/reports', {
      method: request.method,
      ...(request.method === 'POST' ? {
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(await request.json()),
      } : {}),
    }, 20000);
    return NextResponse.json(await res.json(), { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Laporan belum diterima. Coba kembali.' }, { status: 503 });
  }
}
export const GET = forward;
export const POST = forward;
