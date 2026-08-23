import { NextRequest, NextResponse } from 'next/server';
import { fetchFlaskBackend } from '@/lib/backendClient';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const res = await fetchFlaskBackend('/api/admin/policy/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const data = await res.json();
      return NextResponse.json(data);
    }
    const errData = await res.json().catch(() => ({}));
    return NextResponse.json(errData || { error: 'Policy evaluation failed' }, { status: res.status });
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to connect to Flask backend', detail: err.message }, { status: 502 });
  }
}
