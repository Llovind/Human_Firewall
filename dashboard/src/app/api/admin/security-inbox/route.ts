import { NextRequest, NextResponse } from 'next/server';
import { fetchFlaskBackend } from '@/lib/backendClient';

async function forward(request: NextRequest) {
  try {
    const post = request.method === 'POST';
    const res = await fetchFlaskBackend(`/api/admin/security-inbox${post ? '/warnings' : ''}`, {
      method: request.method,
      ...(post ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(await request.json()) } : {}),
    }, 10000);
    return NextResponse.json(await res.json(), { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Inbox belum tersedia. Coba kembali.' }, { status: 503 });
  }
}
export const GET = forward;
export const POST = forward;
