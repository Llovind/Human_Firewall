import { NextRequest, NextResponse } from 'next/server';
import { fetchFlaskBackend } from '@/lib/backendClient';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { employee_id, token, question_id, selected_option_index } = body;

    if (!employee_id || !token) {
      return NextResponse.json({ error: 'employee_id dan token wajib diisi' }, { status: 400 });
    }

    const res = await fetchFlaskBackend('/api/quiz/complete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ employee_id, token, question_id, selected_option_index }),
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error: any) {
    return NextResponse.json({ error: 'Gagal menghubungi server backend', detail: error.message }, { status: 500 });
  }
}
