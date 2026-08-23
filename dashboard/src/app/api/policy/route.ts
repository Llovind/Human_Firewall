import { NextRequest, NextResponse } from 'next/server';
import { fetchFlaskBackend } from '@/lib/backendClient';
import { dataStore } from '@/lib/store';
import { seedIfEmpty } from '@/lib/seed';
import type { PolicyDecision } from '@/lib/store';

/**
 * POST /api/policy — Receives policy enforcement decisions.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const decision: PolicyDecision = {
      id: body.id || `POL-${Date.now()}`,
      timestamp: body.timestamp || new Date().toISOString(),
      threatScore: body.threatScore ?? 0,
      behaviorScore: body.behaviorScore ?? 0,
      finalAction: body.finalAction || 'warning',
      reason: body.reason || '',
      url: body.url,
      userId: body.userId,
    };
    dataStore.addPolicyDecision(decision);
    return NextResponse.json({ success: true, id: decision.id }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }
}

/**
 * GET /api/policy — React UI polls for live 2D Adaptive Policy decisions.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const queryString = searchParams.toString() ? `?${searchParams.toString()}` : '';
    const res = await fetchFlaskBackend(`/api/admin/policy/decisions${queryString}`, { method: 'GET' });
    if (res.ok) {
      const data = await res.json();
      return NextResponse.json(data);
    }
  } catch (err) {
    console.warn('Flask policy decisions fetch failed, using local store:', err);
  }

  seedIfEmpty();
  return NextResponse.json({ decisions: dataStore.getPolicyDecisions() });
}
