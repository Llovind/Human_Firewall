import { NextRequest, NextResponse } from 'next/server';
import { fetchFlaskBackend } from '@/lib/backendClient';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: 'Parameter employee id wajib diisi' }, { status: 400 });
    }

    const token = request.nextUrl.searchParams.get('token');
    if (!token) {
      return NextResponse.json({ error: 'Parameter token wajib diisi' }, { status: 401 });
    }

    const res = await fetchFlaskBackend(
      `/api/employee/${encodeURIComponent(id)}/reports-summary?token=${encodeURIComponent(token)}`,
      { method: 'GET' }
    );

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error: any) {
    return NextResponse.json({ error: 'Gagal menghubungi server backend', detail: error.message }, { status: 500 });
  }
}