import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json({ error: 'PDF reporting is retired. Use Scan file in URL & file security.' }, { status: 410 });
}
