import { NextRequest, NextResponse } from 'next/server';
import { dataStore } from '@/lib/store';
import { seedIfEmpty } from '@/lib/seed';
import type { Incident } from '@/lib/store';

/**
 * POST /api/incident — Webhook receiver for Threat Intelligence Service.
 * Dafa's backend (or n8n) sends incident data here.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const incident: Incident = {
      id: body.id || `INC-${Date.now()}`,
      timestamp: body.timestamp || new Date().toISOString(),
      type: body.type || 'suspicious_url',
      severity: body.severity || 'medium',
      source: body.source || 'Unknown',
      target: body.target || 'Unknown',
      description: body.description || '',
      status: body.status || 'open',
      assignee: body.assignee,
    };
    dataStore.addIncident(incident);
    return NextResponse.json({ success: true, id: incident.id }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }
}

/**
 * GET /api/incident — React UI polls this to get latest incidents.
 */
export async function GET() {
  seedIfEmpty();
  return NextResponse.json({
    incidents: dataStore.getIncidents(),
    stats: dataStore.getStats(),
  });
}
