import { NextRequest, NextResponse } from 'next/server';
import { fetchFlaskBackend } from '@/lib/backendClient';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const queryString = searchParams.toString() ? `?${searchParams.toString()}` : '';
    const res = await fetchFlaskBackend(`/api/admin/threats/feed${queryString}`, {
      method: 'GET',
    });

    if (res.ok) {
      const data = await res.json();
      return NextResponse.json(data);
    }
    return NextResponse.json({ error: 'Flask backend returned error', status: res.status }, { status: res.status });
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to connect to Flask backend', detail: err.message }, { status: 502 });
  }
}
