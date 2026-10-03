import { NextResponse } from 'next/server';
import { fetchFlaskBackend } from '@/lib/backendClient';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const res = await fetchFlaskBackend(`/api/admin/gophish/resources/setup`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }, 45000);
    return NextResponse.json(await res.json(), { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Layanan campaign belum dapat dihubungi. Periksa status campaign sebelum mencoba launch ulang.' }, { status: 503 });
  }
}
