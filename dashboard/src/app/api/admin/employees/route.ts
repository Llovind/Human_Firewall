import { NextRequest, NextResponse } from 'next/server';
import { fetchFlaskBackend } from '@/lib/backendClient';

type BackendPayload = { error?: string; code?: string; [key: string]: unknown };

function connectionError(error: unknown) {
  return error instanceof Error ? error.message : 'Unknown backend error';
}

export async function GET() {
  try {
    const res = await fetchFlaskBackend('/api/admin/employees', { method: 'GET' });
    const data = await res.json() as BackendPayload;
    if (!res.ok) {
      return NextResponse.json({ error: data.error || 'Gagal mengambil data karyawan', code: data.code }, { status: res.status });
    }
    return NextResponse.json(data);
  } catch (error: unknown) {
    return NextResponse.json({ error: 'Gagal menghubungi server backend', detail: connectionError(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const res = await fetchFlaskBackend('/api/admin/employees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await res.json() as BackendPayload;
    if (!res.ok) {
      return NextResponse.json({ error: data.error || 'Gagal menambah karyawan', code: data.code }, { status: res.status });
    }
    return NextResponse.json(data, { status: res.status });
  } catch (error: unknown) {
    return NextResponse.json({ error: 'Gagal menghubungi server backend', detail: connectionError(error) }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const res = await fetchFlaskBackend('/api/admin/employees', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await res.json() as BackendPayload;
    if (!res.ok) {
      return NextResponse.json({ error: data.error || 'Gagal mengubah karyawan', code: data.code }, { status: res.status });
    }
    return NextResponse.json(data, { status: res.status });
  } catch (error: unknown) {
    return NextResponse.json({ error: 'Gagal menghubungi server backend', detail: connectionError(error) }, { status: 500 });
  }
}
