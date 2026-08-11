import { NextRequest, NextResponse } from 'next/server';
import { dataStore } from '@/lib/store';

/**
 * POST /api/auth/magic-link — Creates a magic link token.
 * Called by the Telegram Bot (via n8n) when a user requests dashboard access.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const token = crypto.randomUUID();
    dataStore.createAuthToken({
      token,
      email: body.email,
      userName: body.userName || body.email.split('@')[0],
      division: body.division || 'Unknown',
      telegramId: body.telegramId || '',
      createdAt: Date.now(),
      expiresAt: Date.now() + 15 * 60 * 1000, // 15 minutes
    });

    // The bot would send this URL to the user in Telegram
    const dashboardUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/auth?token=${token}`;

    return NextResponse.json({
      success: true,
      token,
      url: dashboardUrl,
      expiresIn: '15 minutes',
    }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }
}

/**
 * GET /api/auth/magic-link?token=XYZ — Validates the magic link token.
 * Called by the /auth page when the user clicks the link from Telegram.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  if (!token) {
    return NextResponse.json({ error: 'Token required' }, { status: 400 });
  }

  const authData = dataStore.validateAuthToken(token);
  if (!authData) {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
  }

  return NextResponse.json({
    success: true,
    user: {
      email: authData.email,
      userName: authData.userName,
      division: authData.division,
      telegramId: authData.telegramId,
    },
  });
}
