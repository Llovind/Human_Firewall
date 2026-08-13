import { NextRequest, NextResponse } from 'next/server';
import { fetchFlaskBackend } from '@/lib/backendClient';

export async function GET(request: NextRequest) {
  try {
    const role = request.headers.get('x-user-role')
      || request.cookies.get('admin_role')?.value
      || 'grc';
    const token = request.headers.get('x-admin-token')
      || request.cookies.get('admin_token')?.value
      || '';

    const res = await fetchFlaskBackend('/api/admin/readiness-thresholds', {
      method: 'GET',
      headers: {
        'X-User-Role': role,
        ...(token ? { 'x-admin-token': token } : {}),
      },
    });
    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json(
        { error: data.error || 'Failed to fetch readiness thresholds' },
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const role = request.headers.get('x-user-role')
      || request.cookies.get('admin_role')?.value
      || 'grc';
    const token = request.headers.get('x-admin-token')
      || request.cookies.get('admin_token')?.value
      || '';

    const res = await fetchFlaskBackend('/api/admin/readiness-thresholds', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Role': role,
        ...(token ? { 'x-admin-token': token } : {}),
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json(
        { error: data.error || 'Failed to update threshold', detail: data.detail },
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
