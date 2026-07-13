import { NextRequest, NextResponse } from 'next/server';

const apiUrl = (process.env.API_URL || process.env.NEXT_PUBLIC_API_URL) || 'http://flask_api:5000';
const serviceApiKey = process.env.SERVICE_API_KEY;

export async function GET(request: NextRequest) {
  try {
    if (!serviceApiKey) {
      console.error('[admin proxy] SERVICE_API_KEY is not set; refusing to call Flask backend.');
      return NextResponse.json({ error: 'Server misconfigured: SERVICE_API_KEY is not set' }, { status: 500 });
    }

    const res = await fetch(`${apiUrl}/api/admin/divisions`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${serviceApiKey}`,
      },
    });

    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json({ error: data.error || 'Gagal mengambil data divisi' }, { status: res.status });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: 'Gagal menghubungi server backend', detail: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!serviceApiKey) {
      console.error('[admin proxy] SERVICE_API_KEY is not set; refusing to call Flask backend.');
      return NextResponse.json({ error: 'Server misconfigured: SERVICE_API_KEY is not set' }, { status: 500 });
    }

    const body = await request.json();

    const res = await fetch(`${apiUrl}/api/admin/divisions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceApiKey}`,
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json({ error: data.error || 'Gagal menambah divisi' }, { status: res.status });
    }

    return NextResponse.json(data, { status: res.status });
  } catch (error: any) {
    return NextResponse.json({ error: 'Gagal menghubungi server backend', detail: error.message }, { status: 500 });
  }
}
