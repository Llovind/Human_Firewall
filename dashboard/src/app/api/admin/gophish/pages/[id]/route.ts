import { NextRequest, NextResponse } from 'next/server';
import { fetchFlaskBackend } from '@/lib/backendClient';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) return NextResponse.json({ error: 'ID tidak valid.' }, { status: 400 });
  try {
    const body = await request.json();
    const res = await fetchFlaskBackend(`/api/admin/gophish/pages/${id}${request.nextUrl.search}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }, 45000);
    return NextResponse.json(await res.json(), { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Layanan campaign belum dapat dihubungi. Periksa status campaign sebelum mencoba launch ulang.' }, { status: 503 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) return NextResponse.json({ error: 'ID tidak valid.' }, { status: 400 });
  try {
    const res = await fetchFlaskBackend(`/api/admin/gophish/pages/${id}${request.nextUrl.search}`, { method: 'DELETE' }, 45000);
    return NextResponse.json(await res.json(), { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Layanan campaign belum dapat dihubungi. Periksa status campaign sebelum mencoba launch ulang.' }, { status: 503 });
  }
}
