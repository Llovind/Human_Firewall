import { NextRequest, NextResponse } from 'next/server';
import { dataStore } from '@/lib/store';
import { seedIfEmpty } from '@/lib/seed';
import type { BehaviorScore } from '@/lib/store';

/**
 * POST /api/behavior — Receives behavior score updates from Rizaldi's engine.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const score: BehaviorScore = {
      userId: body.userId || `USR-${Date.now()}`,
      userName: body.userName || 'Unknown',
      email: body.email || '',
      division: body.division || 'Unknown',
      score: body.score ?? 50,
      risk: body.risk || 'medium',
      reason: body.reason || '',
      lastUpdated: body.lastUpdated || new Date().toISOString(),
      streak: body.streak ?? 0,
      rank: body.rank ?? 0,
      totalPoints: body.totalPoints ?? 0,
      trainingCompleted: body.trainingCompleted ?? 0,
      badges: body.badges || [],
    };
    dataStore.updateBehaviorScore(score);
    return NextResponse.json({ success: true, userId: score.userId }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }
}

/**
 * GET /api/behavior — React UI polls for behavior scores + leaderboard.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');
    const token = searchParams.get('token');

    const apiUrl = process.env.API_URL || 'http://flask_api:5000';
    const serviceApiKey = process.env.SERVICE_API_KEY;

    if (!serviceApiKey) {
      console.error('[behavior proxy] SERVICE_API_KEY is not set');
      return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
    }

    let authenticated = false;
    if (email && token) {
      // Verify token via Flask /api/user-eligibility
      const verifyRes = await fetch(`${apiUrl}/api/user-eligibility?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}`);
      if (verifyRes.ok) {
        authenticated = true;
      }
    }

    const res = await fetch(`${apiUrl}/api/leaderboard`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${serviceApiKey}`
      },
      next: { revalidate: 0 }
    });

    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.individual)) {
        let scores: BehaviorScore[] = data.individual.map((u: any) => {
          const name = u.email.split('@')[0].split(/[._]/).map((s: string) => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
          const scoreVal = Math.round(u.points / 2.0);
          let risk: 'low' | 'medium' | 'high' | 'critical' = 'medium';
          if (scoreVal >= 70) {
            risk = 'low';
          } else if (scoreVal >= 40) {
            risk = 'medium';
          } else {
            risk = 'high';
          }

          let reason = 'Kewaspadaan baik.';
          if (scoreVal >= 70) {
            reason = 'Sangat waspada terhadap serangan phishing.';
          } else if (scoreVal < 40) {
            reason = 'Sering mengklik link simulasi. Perlu pelatihan.';
          }

          return {
            userId: u.email,
            userName: name,
            email: u.email,
            division: u.divisi || 'Unknown',
            score: scoreVal,
            risk: risk,
            reason: reason,
            lastUpdated: '2026-07-12T00:00:00Z',
            streak: u.daily_streak || 0,
            rank: u.rank,
            totalPoints: u.points,
            trainingCompleted: u.viewed_training_count || 0,
            badges: (() => {
              const bList: string[] = [];
              if (u.points >= 60) bList.push('Guardian');
              if (u.points >= 130) bList.push('Sentinel');
              if (u.reports_count_malicious > 0) bList.push('First Report');
              if (u.daily_streak >= 4) bList.push('Streak Master');
              if (u.spot_fake_wins > 0) bList.push('Quiz Champion');
              return bList;
            })(),
          };
        });

        // Filter: If email & token are provided, verify and return ONLY that user's score (employee view)
        // If no email & token are provided, return ALL scores (admin view)
        if (email || token) {
          if (authenticated && email) {
            scores = scores.filter(s => s.email.toLowerCase() === email.toLowerCase());
          } else {
            // Prevent PII leak if parameters were provided but invalid
            scores = [];
          }
        }

        // Map division averages from Flask by_divisi
        const by_divisi = Array.isArray(data.by_divisi) ? data.by_divisi.map((d: any) => ({
          division: d.divisi,
          avg: Math.round(d.avg_points / 2.0), // Scale by 1/2 to match frontend 0-100 format
          memberCount: d.member_count
        })) : [];

        return NextResponse.json({ scores, by_divisi });
      }
    }
  } catch (error) {
    console.error('Error fetching real behavior scores:', error);
  }

  // Fallback
  return NextResponse.json({ scores: [], by_divisi: [] });
}