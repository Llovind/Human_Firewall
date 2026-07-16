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

    // Notify Flask backend about this token so server-side validations
    // (user-eligibility, user-activity, gamification endpoints) can
    // resolve it via database.validate_dashboard_token(). This call is
    // REQUIRED for the employee dashboard to work — if it fails, every
    // subsequent Flask call made with this token will 403.
    const serviceApiKey = process.env.SERVICE_API_KEY;
    let backendSync: 'ok' | 'failed' | 'skipped' = 'skipped';

    if (!serviceApiKey) {
      // Fail loudly instead of silently sending an unauthenticated request
      // that Flask will reject anyway. This is a deployment misconfiguration.
      console.error(
        '[magic-link] SERVICE_API_KEY is not set. Skipping backend token registration — ' +
        `the dashboard token for ${body.email} will NOT be recognized by Flask, and ` +
        'user-eligibility/user-activity/gamification calls for this user will 403.'
      );
      backendSync = 'skipped';
    } else {
      try {
        const apiUrl = (process.env.API_URL || process.env.NEXT_PUBLIC_API_URL) || 'http://flask_api:5000';
        const res = await fetch(`${apiUrl}/api/auth/register-token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${serviceApiKey}`,
          },
          body: JSON.stringify({
            token,
            email: body.email,
            expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000, // Extend Flask validation life to 30 days for convenience
          }),
        });

        if (!res.ok) {
          const detail = await res.text().catch(() => '<no body>');
          console.error(
            `[magic-link] Backend token registration failed for ${body.email}: ` +
            `HTTP ${res.status} — ${detail}. This token will NOT authenticate against Flask.`
          );
          backendSync = 'failed';
        } else {
          backendSync = 'ok';
        }
      } catch (err) {
        console.error(
          `[magic-link] Backend token registration threw for ${body.email}:`, err,
          '— this token will NOT authenticate against Flask.'
        );
        backendSync = 'failed';
      }
    }

    // The bot would send this URL to the user in Telegram
    const dashboardUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/auth?token=${token}`;

    return NextResponse.json({
      success: true,
      token,
      url: dashboardUrl,
      expiresIn: '15 minutes',
      // Surfaces degraded state instead of hiding it: if this isn't "ok",
      // the employee dashboard will authenticate locally but Flask-backed
      // calls (eligibility, activity, gamification) will fail with 403.
      backendSync,
    }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }
}

import { seedIfEmpty } from '@/lib/seed';

/**
 * GET /api/auth/magic-link?token=XYZ — Validates the magic link token.
 * Called by the /auth page when the user clicks the link from Telegram.
 */
export async function GET(request: NextRequest) {
  seedIfEmpty();
  const token = request.nextUrl.searchParams.get('token');
  if (!token) {
    return NextResponse.json({ error: 'Token required' }, { status: 400 });
  }

  let authData = dataStore.validateAuthToken(token);

  if (!authData) {
    try {
      const apiUrl = (process.env.API_URL || process.env.NEXT_PUBLIC_API_URL) || 'http://flask_api:5000';
      const res = await fetch(`${apiUrl}/api/auth/validate-token?token=${encodeURIComponent(token)}`);
      if (res.ok) {
        const flaskData = await res.json();
        if (flaskData.valid) {
          authData = {
            token: token,
            email: flaskData.email,
            userName: flaskData.userName,
            division: flaskData.division,
            telegramId: '',
            createdAt: Date.now(),
            expiresAt: Date.now() + 15 * 60 * 1000,
          };
          // Cache it in-memory
          dataStore.createAuthToken(authData);
        }
      }
    } catch (err) {
      console.error('[magic-link-verify] Failed to check Flask backend for token:', err);
    }
  }

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
      role: 'employee',
      token: token,
    },
  });
}
