import { NextRequest, NextResponse } from 'next/server';
import { fetchFlaskBackend } from '@/lib/backendClient';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { employee_id } = body;

    if (!employee_id) {
      return NextResponse.json({ error: 'employee_id wajib diisi' }, { status: 400 });
    }

    const res = await fetchFlaskBackend('/api/quiz/revive', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ employee_id }),
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error: unknown) {
    return NextResponse.json({ error: 'Gagal menghubungi server backend', detail: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
