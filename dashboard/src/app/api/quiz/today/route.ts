import { NextRequest, NextResponse } from 'next/server';
import { fetchFlaskBackend } from '@/lib/backendClient';

export async function GET(request: NextRequest) {
  try {
    const email = request.nextUrl.searchParams.get('email');
    if (!email) {
      return NextResponse.json({ error: 'Parameter email wajib diisi' }, { status: 400 });
    }

    const res = await fetchFlaskBackend(`/api/quiz/today?employee_id=${encodeURIComponent(email)}`, {
      method: 'GET',
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Gagal menghubungi server backend', detail }, { status: 500 });
  }
}
