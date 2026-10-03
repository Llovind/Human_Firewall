import { NextResponse } from 'next/server';
import { fetchFlaskBackend } from '@/lib/backendClient';

export async function GET() {
  try {
    const res = await fetchFlaskBackend('/api/admin/login-history');
    const data = await res.json();
    if (!res.ok) return NextResponse.json(data, { status: res.status });
    const logs = (data.logs || []).map((row: Record<string, string | number | boolean>) => ({
      ...row, login_time: row.created_at, division: row.role, device: 'Not collected', location: 'Not collected',
      network: 'Not collected', vpn: false, risk: row.success ? 'LOW' : 'MEDIUM',
      reason: row.reason || row.event_type,
    }));
    return NextResponse.json({ logs });
  } catch {
    return NextResponse.json({ error: 'Login audit unavailable' }, { status: 503 });
  }
}
