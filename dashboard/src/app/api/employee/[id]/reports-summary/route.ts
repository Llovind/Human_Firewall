import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: 'Parameter employee id wajib diisi' }, { status: 400 });
    }

    // Forward token dari query string ke Flask — Flask yang validasi
    // (dashboard_token, cocok/tidaknya sama employee_id). Route ini
    // sengaja gak nge-judge valid/tidaknya sendiri, cuma passthrough,
    // biar single source of truth auth tetap di satu tempat (Flask).
    const token = request.nextUrl.searchParams.get('token');
    if (!token) {
      return NextResponse.json({ error: 'Parameter token wajib diisi' }, { status: 401 });
    }

    const apiUrl = (process.env.API_URL || process.env.NEXT_PUBLIC_API_URL) || 'http://flask_api:5000';
    const res = await fetch(
      `${apiUrl}/api/employee/${encodeURIComponent(id)}/reports-summary?token=${encodeURIComponent(token)}`,
      { method: 'GET' }
    );

    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json({ error: data.error?.message || data.error || 'Gagal mengambil ringkasan laporan' }, { status: res.status });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: 'Gagal menghubungi server backend', detail: error.message }, { status: 500 });
  }
}