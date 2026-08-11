import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const email = request.nextUrl.searchParams.get('email');
    const token = request.nextUrl.searchParams.get('token');

    if (!email || !token) {
      return NextResponse.json({ error: 'Parameters email dan token wajib diisi' }, { status: 400 });
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://flask_api:5000';
    const res = await fetch(`${apiUrl}/api/user-eligibility?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}`, {
      method: 'GET',
    });

    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json({ error: data.error || 'Gagal memeriksa kelayakan' }, { status: res.status });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: 'Gagal menghubungi server backend', detail: error.message }, { status: 500 });
  }
}
