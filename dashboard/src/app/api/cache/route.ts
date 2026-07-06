import { NextRequest, NextResponse } from 'next/server';
import { dataStore } from '@/lib/store';
import { seedIfEmpty } from '@/lib/seed';
import type { ThreatCacheEntry } from '@/lib/store';

/**
 * POST /api/cache — Webhook receiver for Threat Intelligence Cache updates.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const entry: ThreatCacheEntry = {
      id: body.id || `TC-${Date.now()}`,
      url: body.url,
      threatType: body.threatType || 'suspicious',
      score: body.score || 50,
      source: body.source || 'internal',
      action: body.action || 'warning',
      detectedAt: body.detectedAt || new Date().toISOString(),
      lastChecked: body.lastChecked || new Date().toISOString(),
    };
    dataStore.addThreatCache(entry);
    return NextResponse.json({ success: true, id: entry.id }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }
}

/**
 * GET /api/cache — React UI polls this for latest threat cache.
 */
export async function GET() {
  seedIfEmpty();
  return NextResponse.json({ cache: dataStore.getThreatCache() });
}
