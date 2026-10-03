import { NextResponse } from 'next/server';
import { fetchFlaskBackend } from '@/lib/backendClient';

export async function GET() {
  try {
    const res = await fetchFlaskBackend('/api/admin/compliance-summary', {
      method: 'GET',
    });
    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json(
        { error: data.error || 'Failed to fetch compliance readiness data' },
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
