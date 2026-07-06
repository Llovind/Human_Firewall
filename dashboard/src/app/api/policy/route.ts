import { NextRequest, NextResponse } from 'next/server';
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
 * GET /api/policy — React UI polls for policy decisions.
 */
export async function GET() {
  seedIfEmpty();
  return NextResponse.json({ decisions: dataStore.getPolicyDecisions() });
}
