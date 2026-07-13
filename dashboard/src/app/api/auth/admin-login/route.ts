import { NextRequest, NextResponse } from 'next/server';
import { createAdminSession, ADMIN_SESSION_COOKIE } from '@/lib/adminSession';

/**
 * POST /api/auth/admin-login
 * Proxy to Flask backend to authenticate the admin.
 *
 * PENTING: setelah Flask konfirmasi password benar, route ini WAJIB
 * menerbitkan session cookie httpOnly sendiri. Tanpa ini, tidak ada
 * bukti di sisi server bahwa browser benar-benar sudah login — semua
 * /api/admin/* route hanya bisa dipercaya kalau ada cookie sah ini
 * (divalidasi di middleware.ts), bukan dari state React di client
 * (localStorage bisa dipalsukan/dilewati begitu saja).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body || !body.password) {
      return NextResponse.json({ error: 'Password wajib diisi' }, { status: 400 });
    }

    const apiUrl = (process.env.API_URL || process.env.NEXT_PUBLIC_API_URL) || 'http://flask_api:5000';
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

    const { token, expiresAt } = createAdminSession();
    console.log(`[LOGIN DEBUG] PID: ${process.pid}, token: ${token}`);

    const response = NextResponse.json({
      success: true,
      user: data.user,
    });

    response.cookies.set(ADMIN_SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      expires: new Date(expiresAt),
    });

    return response;
  } catch (error: any) {
    return NextResponse.json({ error: 'Gagal menghubungi server backend', detail: error.message }, { status: 500 });
  }
}
