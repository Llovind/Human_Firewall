import { NextRequest, NextResponse } from 'next/server';
import { fetchFlaskBackend } from '@/lib/backendClient';

// The legacy webhook must not accept client-supplied enforcement identities.
export async function POST() {
  return NextResponse.json({ error: 'Legacy webhook retired' }, { status: 410 });
}

export async function GET(request: NextRequest) {
  try {
    const query = request.nextUrl.searchParams.toString();
    const response = await fetchFlaskBackend(`/api/admin/policy/decisions${query ? '?' + query : ''}`);
    return NextResponse.json(await response.json(), { status: response.status });
  } catch {
    return NextResponse.json({ error: 'Policy decisions unavailable' }, { status: 503 });
  }
}
