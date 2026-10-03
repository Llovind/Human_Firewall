import { NextRequest, NextResponse } from 'next/server';
import { fetchFlaskBackend } from '@/lib/backendClient';
import { AUTH_SESSION_COOKIE } from '@/lib/authSession';

export async function POST(request: NextRequest) {
  if (!request.cookies.get(AUTH_SESSION_COOKIE)?.value) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await request.json();
    const url = body.url || body.indicator;
    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Field "url" wajib diisi' },
        { status: 400 }
      );
    }

    // Same provider evidence as Report a link; scanning does not file a report.
      const scanRes = await fetchFlaskBackend('/api/threat/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      }, 20000);

    return NextResponse.json(await scanRes.json(), { status: scanRes.status });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Reputation lookup unavailable. Try again.' },
      { status: 503 }
    );
  }
}
