import { NextRequest, NextResponse } from 'next/server';
import { fetchFlaskBackend } from '@/lib/backendClient';

export async function GET(request: NextRequest) {
  try {
    // Forward role and auth headers so Flask _verify_grc_ciso_access() passes in production
    const role = request.headers.get('x-user-role')
      || request.cookies.get('admin_role')?.value
      || 'grc';
    const token = request.headers.get('x-admin-token')
      || request.cookies.get('admin_token')?.value
      || '';

    const res = await fetchFlaskBackend('/api/admin/compliance-summary', {
      method: 'GET',
      headers: {
        'X-User-Role': role,
        ...(token ? { 'x-admin-token': token } : {}),
      },
    });
    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json(
        { error: data.error || 'Failed to fetch compliance readiness data' },
        { status: res.status }
      );
    }
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to reach backend server', detail: error.message },
      { status: 500 }
    );
  }
}
