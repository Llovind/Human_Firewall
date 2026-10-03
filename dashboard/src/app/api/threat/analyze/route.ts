import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json({ error: 'Endpoint lama dihentikan. Gunakan Scan ML/DL atau Report Suspicious Link.' }, { status: 410 });
}
