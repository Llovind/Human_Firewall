import { NextResponse } from 'next/server';

export async function GET() {
  // Read BOT_USERNAME from environment at runtime on the server
  return NextResponse.json({
    botUsername: process.env.NEXT_PUBLIC_BOT_USERNAME || 'HFL_BOT'
  });
}
