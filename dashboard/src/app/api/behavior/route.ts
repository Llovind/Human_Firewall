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
export async function GET() {
  seedIfEmpty();
  return NextResponse.json({ scores: dataStore.getBehaviorScores() });
}
