import { NextRequest, NextResponse } from 'next/server';
import { revokeAdminSession, ADMIN_SESSION_COOKIE } from '@/lib/adminSession';

/**
 * POST /api/auth/admin-logout
 * Revokes the admin session server-side and clears the cookie.
 */
export async function POST(request: NextRequest) {
  const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  revokeAdminSession(token);

  const response = NextResponse.json({ success: true });
  response.cookies.set(ADMIN_SESSION_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: new Date(0),
  });

  return response;
}
