import { NextRequest, NextResponse } from 'next/server';
import { fetchFlaskBackend } from '@/lib/backendClient';

export async function GET() {
  try {
    const res = await fetchFlaskBackend('/api/admin/readiness-thresholds', {
      method: 'GET',
    });
    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json(
        { error: data.error || 'Failed to fetch readiness thresholds' },
        { status: res.status }
      );
    }
    return NextResponse.json(data);
  } catch (error: unknown) {
    return NextResponse.json(
      { error: 'Failed to reach backend server', detail: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const res = await fetchFlaskBackend('/api/admin/readiness-thresholds', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
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
  } catch (error: unknown) {
    return NextResponse.json(
      { error: 'Failed to reach backend server', detail: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
