import { NextRequest, NextResponse } from 'next/server';
import { fetchFlaskBackend } from '@/lib/backendClient';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const url = body.url || body.indicator;
    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Field "url" wajib diisi' },
        { status: 400 }
      );
    }

    // Try direct Char-BiLSTM DL scanner first
    try {
      const dlRes = await fetchFlaskBackend('/api/threat/scan-dl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      }, 5000);

      if (dlRes.ok) {
        const dlData = await dlRes.json();
        if (dlData.success && dlData.data) {
          return NextResponse.json({
            success: true,
            source: 'char_bilstm',
            data: dlData.data,
          });
        }
      }
    } catch (dlErr) {
      console.warn('Direct scan-dl failed, falling back to threat/analyze:', dlErr);
    }

    // Fallback to full Threat Analyze endpoint
    const res = await fetchFlaskBackend('/api/threat/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ indicator: url }),
    }, 8000);

    if (res.ok) {
      const data = await res.json();
      return NextResponse.json({
        success: true,
        source: 'threat_analyze',
        ...data,
      });
    }

    const errData = await res.json().catch(() => ({}));
    return NextResponse.json(
      { success: false, error: errData.error || 'Gagal memindai URL' },
      { status: res.status }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
