import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { employee_id, token } = body;

    if (!employee_id || !token) {
      return NextResponse.json({ error: 'employee_id dan token wajib diisi' }, { status: 400 });
    }

    const apiUrl = (process.env.API_URL || process.env.NEXT_PUBLIC_API_URL) || 'http://flask_api:5000';
    const res = await fetch(`${apiUrl}/api/quiz/revive`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ employee_id, token }),
    });

    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json({ error: data.error || 'Gagal melakukan revive streak' }, { status: res.status });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: 'Gagal menghubungi server backend', detail: error.message }, { status: 500 });
  }
}
