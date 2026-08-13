import { NextRequest, NextResponse } from 'next/server';
import { isValidAdminSession, ADMIN_SESSION_COOKIE } from '@/lib/adminSession';

/**
 * Gate every /api/admin/* route behind a valid, server-issued admin session
 * cookie (set in /api/auth/admin-login after Flask validates the password).
 *
 * Sebelum ini, semua route di bawah /api/admin/* langsung proxy ke Flask
 * pakai SERVICE_API_KEY tanpa ngecek sama sekali apakah request-nya
 * beneran datang dari admin yang sudah login — jadi siapapun yang tahu
 * path-nya bisa CRUD data karyawan/divisi tanpa login. proxy.ts ini jadi
 * satu titik enforcement untuk semua route admin, supaya tidak perlu
 * copy-paste auth check ke setiap route.ts satu-satu.
 *
 * File ini SENGAJA bernama `proxy.ts` (bukan `middleware.ts`) — di Next.js
 * 16.2, `proxy.ts` adalah pengganti resmi `middleware.ts` dan jalan di
 * Node.js runtime penuh (bukan Edge Runtime). Ini penting di sini karena
 * adminSession.ts pakai modul `crypto` bawaan Node, yang TIDAK tersedia
 * di Edge Runtime — kalau file ini masih bernama middleware.ts, dia akan
 * default ke Edge Runtime dan gagal/berperilaku tidak terduga.
 */
export function proxy(request: NextRequest) {
  if (process.env.DEV_BYPASS_AUTH?.trim().toLowerCase() === 'true') {
    return NextResponse.next();
  }

  const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  console.log(`[PROXY DEBUG] PID: ${process.pid}, token: ${token}, isValid: ${isValidAdminSession(token)}`);

  if (!isValidAdminSession(token)) {
    return NextResponse.json(
      { error: 'Unauthorized: admin session tidak valid atau sudah kedaluwarsa' },
      { status: 401 }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/admin/:path*'],
};
