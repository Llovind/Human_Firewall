import { NextRequest, NextResponse } from 'next/server';
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
export async function GET() {
  seedIfEmpty();
  return NextResponse.json({ summaries: dataStore.getAISummaries() });
}
