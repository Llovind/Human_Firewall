import { NextRequest, NextResponse } from 'next/server';

const FLASK_API = process.env.API_URL || 'http://localhost:5000';
const SERVICE_API_KEY = process.env.SERVICE_API_KEY || '';

function getAuthHeader(): Record<string, string> {
  return SERVICE_API_KEY ? { 'Authorization': `Bearer ${SERVICE_API_KEY}` } : {};
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const refresh = searchParams.get('refresh') || 'false';

  try {
    const res = await fetch(
      `${FLASK_API}/api/ai/classify-all?refresh=${refresh}`,
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

export async function POST(req: NextRequest) {
  // Force invalidate cache
  try {
    const res = await fetch(`${FLASK_API}/api/ai/cache/invalidate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 503 });
  }
}
