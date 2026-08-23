import { NextRequest, NextResponse } from 'next/server';
import { fetchFlaskBackend } from '@/lib/backendClient';
import { dataStore } from '@/lib/store';
import { seedIfEmpty } from '@/lib/seed';
import type { AISummary } from '@/lib/store';

/**
 * POST /api/summary — Webhook receiver for AI-generated threat summaries.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const summary: AISummary = {
      id: body.id || `SUM-${Date.now()}`,
      timestamp: body.timestamp || new Date().toISOString(),
      title: body.title || 'Untitled Summary',
      summary: body.summary || '',
      threatLevel: body.threatLevel || 'medium',
      recommendations: body.recommendations || [],
      relatedIncidents: body.relatedIncidents || [],
    };
    dataStore.addAISummary(summary);
    return NextResponse.json({ success: true, id: summary.id }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }
}

/**
 * GET /api/summary — React UI polls this for AI summaries.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const queryString = searchParams.toString() ? `?${searchParams.toString()}` : '';
    const res = await fetchFlaskBackend(`/api/admin/ai/summaries${queryString}`, { method: 'GET' });
    if (res.ok) {
      const data = await res.json();
      return NextResponse.json(data);
    }
  } catch (err) {
    console.warn('Flask AI summaries fetch failed, using fallback store:', err);
  }

  seedIfEmpty();
  return NextResponse.json({ summaries: dataStore.getAISummaries() });
}
