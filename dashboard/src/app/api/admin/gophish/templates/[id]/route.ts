import { NextRequest, NextResponse } from 'next/server';

function getBackendConfig() {
  const apiUrl = (process.env.API_URL || process.env.NEXT_PUBLIC_API_URL) || 'http://flask_api:5000';
  const serviceApiKey = process.env.SERVICE_API_KEY;
  return { apiUrl, serviceApiKey };
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const body = await request.json();
    const { apiUrl, serviceApiKey } = getBackendConfig();
    if (!serviceApiKey) {
      console.error('[admin proxy] SERVICE_API_KEY is not set; refusing to call Flask backend.');
      return NextResponse.json({ error: 'Server misconfigured: SERVICE_API_KEY is not set' }, { status: 500 });
    }

    const res = await fetch(`${apiUrl}/api/admin/gophish/templates/${id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${serviceApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json({ error: data.error || 'Gagal memperbarui template' }, { status: res.status });
    }

    return NextResponse.json(data, { status: res.status });
  } catch (error: any) {
    return NextResponse.json({ error: 'Gagal menghubungi server backend', detail: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const { apiUrl, serviceApiKey } = getBackendConfig();
    if (!serviceApiKey) {
      console.error('[admin proxy] SERVICE_API_KEY is not set; refusing to call Flask backend.');
      return NextResponse.json({ error: 'Server misconfigured: SERVICE_API_KEY is not set' }, { status: 500 });
    }

    const res = await fetch(`${apiUrl}/api/admin/gophish/templates/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${serviceApiKey}` },
    });

    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json({ error: data.error || 'Gagal menghapus template' }, { status: res.status });
    }

    return NextResponse.json(data, { status: res.status });
  } catch (error: any) {
    return NextResponse.json({ error: 'Gagal menghubungi server backend', detail: error.message }, { status: 500 });
  }
}