import { NextRequest, NextResponse } from 'next/server';
import { fetchAuthBackend } from '@/lib/authBackend';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const response = await fetchAuthBackend(request, '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status, headers: {
      ...(response.headers.get('retry-after') ? { 'Retry-After': response.headers.get('retry-after')! } : {}),
    } });
  } catch {
    return NextResponse.json({ error: 'Layanan autentikasi tidak tersedia' }, { status: 503 });
  }
}

