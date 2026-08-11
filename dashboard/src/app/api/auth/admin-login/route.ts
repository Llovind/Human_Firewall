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

    const targetUrls = Array.from(new Set([
      process.env.NEXT_PUBLIC_API_URL,
      'http://127.0.0.1:5000',
      'http://localhost:5000',
      'http://flask_api:5000'
    ])).filter(Boolean) as string[];

    let res = null;
    let lastErr = null;

    for (const baseUrl of targetUrls) {
      try {
        const fetchRes = await fetch(`${baseUrl}/api/auth/admin`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: body.password }),
          cache: 'no-store'
        });
        if (fetchRes && (fetchRes.ok || fetchRes.status === 401 || fetchRes.status === 400)) {
          res = fetchRes;
          break;
        }
      } catch (err: any) {
        lastErr = err;
      }
    }

    if (!res) {
      return NextResponse.json({ error: 'Gagal menghubungi server backend', detail: lastErr?.message }, { status: 500 });
    }

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
