import { NextRequest, NextResponse } from 'next/server';
import { fetchFlaskBackend } from '@/lib/backendClient';

export async function GET(request: NextRequest) {
  try {
    const email = request.nextUrl.searchParams.get('email');
    const token = request.nextUrl.searchParams.get('token') || 'dev_token';

    if (!email) {
      return NextResponse.json({ error: 'Parameter email wajib diisi' }, { status: 400 });
    }

    const res = await fetchFlaskBackend(`/api/quiz/today?employee_id=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}`, {
      method: 'GET',
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error: any) {
    return NextResponse.json({ error: 'Gagal menghubungi server backend', detail: error.message }, { status: 500 });
  }
}
