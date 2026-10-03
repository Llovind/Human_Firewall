import { NextResponse } from 'next/server';
import { fetchFlaskBackend } from '@/lib/backendClient';

export async function GET() {
  try {
    const res = await fetchFlaskBackend(`/api/admin/gophish/campaigns`, { method: 'GET' }, 45000);
    return NextResponse.json(await res.json(), { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Layanan campaign belum dapat dihubungi. Periksa status campaign sebelum mencoba launch ulang.' }, { status: 503 });
  }
}
