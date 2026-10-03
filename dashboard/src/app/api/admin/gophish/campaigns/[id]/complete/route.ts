import { NextRequest, NextResponse } from 'next/server';
import { fetchFlaskBackend } from '@/lib/backendClient';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) return NextResponse.json({ error: 'ID tidak valid.' }, { status: 400 });
  try {
    const res = await fetchFlaskBackend(`/api/admin/gophish/campaigns/${id}/complete${request.nextUrl.search}`, { method: 'POST' }, 45000);
    return NextResponse.json(await res.json(), { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Layanan campaign belum dapat dihubungi. Periksa status campaign sebelum mencoba launch ulang.' }, { status: 503 });
  }
}
