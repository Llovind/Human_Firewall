import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const apiUrl = (process.env.API_URL || process.env.NEXT_PUBLIC_API_URL) || 'http://flask_api:5000';
    const secretKey = process.env.SECRET_KEY || 'dev-fallback-key-change-in-production';

    const res = await fetch(`${apiUrl}/api/admin/gophish/launch`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json({ error: data.error || 'Gagal meluncurkan kampanye' }, { status: res.status });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: 'Gagal menghubungi server backend', detail: error.message }, { status: 500 });
  }
}
