import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/auth/admin-login
 * Proxy to Flask backend to authenticate the admin.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body || !body.password) {
      return NextResponse.json({ error: 'Password wajib diisi' }, { status: 400 });
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://flask_api:5000';
    const res = await fetch(`${apiUrl}/api/auth/admin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ password: body.password }),
    });

    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json({ error: data.error || 'Autentikasi gagal' }, { status: res.status });
    }

    return NextResponse.json({
      success: true,
      user: data.user,
    });
  } catch (error: any) {
    return NextResponse.json({ error: 'Gagal menghubungi server backend', detail: error.message }, { status: 500 });
  }
}
