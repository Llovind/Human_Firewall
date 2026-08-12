import { NextRequest, NextResponse } from 'next/server';

const FLASK_API = process.env.API_URL || 'http://localhost:5000';
const SERVICE_API_KEY = process.env.SERVICE_API_KEY || '';

function getAuthHeader(): Record<string, string> {
  return SERVICE_API_KEY ? { 'Authorization': `Bearer ${SERVICE_API_KEY}` } : {};
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ email: string }> }
) {
  const { searchParams } = new URL(req.url);
  const days = searchParams.get('days') || '30';
  const refresh = searchParams.get('refresh') || 'false';
  const { email: rawEmail } = await params;
  const email = decodeURIComponent(rawEmail);

  try {
    const res = await fetch(
      `${FLASK_API}/api/ai/user/${encodeURIComponent(email)}?days=${days}&refresh=${refresh}`,
      {
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        cache: 'no-store',
      }
    );
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return NextResponse.json({ error: 'Gagal menghubungi Flask API', detail: String(err) }, { status: 503 });
  }
}
