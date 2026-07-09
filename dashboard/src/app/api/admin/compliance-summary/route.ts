import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const apiUrl = (process.env.API_URL || process.env.NEXT_PUBLIC_API_URL) || 'http://flask_api:5000';
    const serviceApiKey = process.env.SERVICE_API_KEY;
    if (!serviceApiKey) {
      // Fail fast: no insecure fallback credential. A missing key is a
      // deployment misconfiguration, not something to paper over.
      console.error('[admin proxy] SERVICE_API_KEY is not set; refusing to call Flask backend.');
      return NextResponse.json({ error: 'Server misconfigured: SERVICE_API_KEY is not set' }, { status: 500 });
    }

    const res = await fetch(`${apiUrl}/api/compliance-summary`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${serviceApiKey}`,
      },
    });

    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json({ error: data.error || 'Gagal mengambil data kepatuhan' }, { status: res.status });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: 'Gagal menghubungi server backend', detail: error.message }, { status: 500 });
  }
}
