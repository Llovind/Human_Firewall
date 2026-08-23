import { NextRequest, NextResponse } from 'next/server';
import { fetchFlaskBackend } from '@/lib/backendClient';
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

    // Forward to Flask if possible
    try {
      await fetchFlaskBackend('/api/admin/threat-cache', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
      });
    } catch {
      // ignore
    }

    dataStore.addThreatCache(entry);
    return NextResponse.json({ success: true, id: entry.id }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }
}

/**
 * GET /api/cache — React UI polls this for latest threat cache.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const queryString = searchParams.toString() ? `?${searchParams.toString()}` : '';
    const res = await fetchFlaskBackend(`/api/admin/threats/feed${queryString}`, { method: 'GET' });
    if (res.ok) {
      const data = await res.json();
      return NextResponse.json(data);
    }
  } catch (err) {
    console.warn('Flask threat feed fetch failed, using fallback store:', err);
  }

  seedIfEmpty();
  return NextResponse.json({ cache: dataStore.getThreatCache() });
}
