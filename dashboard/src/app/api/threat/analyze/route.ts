import { NextRequest, NextResponse } from 'next/server';
import { fetchFlaskBackend } from '@/lib/backendClient';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body || !body.indicator) {
      return NextResponse.json(
        { success: false, error: "Field 'indicator' wajib diisi" },
        { status: 400 }
      );
    }

    // Call Flask backend /api/threat/analyze with session token forwarded.
    // 12s timeout allows external VT/urlscan query without premature BFF abort.
    const res = await fetchFlaskBackend(
      '/api/threat/analyze',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
      12000
    );

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        success: false,
        error: 'Gagal menganalisis ancaman. Layanan backend sedang sibuk.',
        detail,
      },
      { status: 500 }
    );
  }
}
