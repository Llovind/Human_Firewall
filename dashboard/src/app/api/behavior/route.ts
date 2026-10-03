import { NextRequest, NextResponse } from 'next/server';
import { fetchFlaskBackend } from '@/lib/backendClient';
import type { BehaviorScore } from '@/components/admin/types';

type LeaderboardUser = {
  points?: number;
  email?: string;
  divisi?: string;
  badge?: string;
  streak_weeks?: number;
  daily_streak?: number;
  reports_count_malicious?: number;
  spot_fake_wins?: number;
  rank?: number;
  viewed_training_count?: number;
  updated_at?: string;
};

type LeaderboardDivision = {
  divisi?: string;
  avg_points?: number;
  member_count?: number;
};

/**
 * POST /api/behavior — Receives behavior score updates from engine.
 */
export async function POST() {
  return NextResponse.json({ error: 'Legacy webhook retired' }, { status: 410 });
}

/**
 * GET /api/behavior — React UI polls for behavior scores + leaderboard.
 * Fetches live data from SQLite via Flask backend and formats it for Employee Dashboard.
 */
export async function GET(request: NextRequest) {
  try {
    const requestedEmail = request.nextUrl.searchParams.get('email');
    const employeeRequest = Boolean(requestedEmail);

    const res = await fetchFlaskBackend('/api/admin/leaderboard', { method: 'GET' });
    if (!res.ok) return NextResponse.json({ error: 'Leaderboard unavailable' }, { status: res.status });
    if (res.ok) {
      const data = await res.json();
      const individual: LeaderboardUser[] = Array.isArray(data.individual) ? data.individual : [];
      const byDivisi: LeaderboardDivision[] = Array.isArray(data.by_divisi) ? data.by_divisi : [];

      const scores: BehaviorScore[] = individual.map((u, idx: number) => {
        const updatedAt = u.updated_at?.replace(' ', 'T') || '';
        const totalPoints = u.points || 0;
        const scoreVal = Math.max(0, Math.min(100, Math.round(totalPoints / 2.0)));
        const riskLevel = totalPoints >= 130 ? 'low' : totalPoints >= 60 ? 'medium' : 'high';
        const userName = u.email ? u.email.split('@')[0].replace(/\./g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()) : 'Karyawan';
        
        const badgesList: string[] = [];
        if (u.badge && u.badge !== 'None') badgesList.push(u.badge);
        if ((u.streak_weeks ?? 0) >= 4) badgesList.push('4-Week Streak');
        if ((u.reports_count_malicious ?? 0) > 0) badgesList.push('Threat Reporter');
        if ((u.spot_fake_wins ?? 0) > 0) badgesList.push('Spotter Master');
        if ((u.daily_streak ?? 0) >= 5) badgesList.push('Quiz Champion');

        return {
          userId: u.email || `USR-${idx + 1}`,
          userName,
          email: u.email || '',
          division: u.divisi || 'General',
          score: scoreVal,
          risk: riskLevel,
          reason: scoreVal >= 70 ? 'Konsisten menjaga kepatuhan' : scoreVal >= 40 ? 'Perlu meningkatkan kepatuhan' : 'Sering terjebak phishing simulasi',
          lastUpdated: updatedAt && !/(Z|[+-]\d{2}:\d{2})$/.test(updatedAt) ? updatedAt + 'Z' : updatedAt,
          streak: u.streak_weeks || 0,
          dailyStreak: u.daily_streak || 0,
          rank: u.rank || idx + 1,
          totalPoints: u.points || 0,
          trainingCompleted: u.viewed_training_count || 0,
          badges: badgesList,
        };
      });

      const formattedByDivisi = byDivisi.map((d) => ({
        division: d.divisi,
        avg: d.avg_points || 0,
        memberCount: d.member_count || 0,
      }));

      return NextResponse.json({
        scores: employeeRequest ? scores.filter((score) => score.email === requestedEmail) : scores,
        by_divisi: formattedByDivisi,
      });
    }
  } catch {
    return NextResponse.json({ error: 'Leaderboard unavailable; last snapshot retained' }, { status: 503 });
  }
  return NextResponse.json({ error: 'Leaderboard unavailable' }, { status: 503 });
}
