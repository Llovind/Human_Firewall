import { NextRequest, NextResponse } from 'next/server';
import { fetchFlaskBackend } from '@/lib/backendClient';
import { dataStore } from '@/lib/store';
import { seedIfEmpty } from '@/lib/seed';
import type { Incident } from '@/lib/store';

/**
 * POST /api/incident — Webhook receiver for Threat Intelligence Service.
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
 * PATCH /api/incident — Update incident status (e.g. resolve / close ticket).
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { ticket_id, status } = body;
    if (!ticket_id || !status) {
      return NextResponse.json({ error: 'ticket_id and status are required' }, { status: 400 });
    }

    const res = await fetchFlaskBackend(`/api/incidents/${ticket_id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });

    if (res.ok) {
      const data = await res.json();
      dataStore.updateIncidentStatus(ticket_id, status);
      return NextResponse.json(data);
    }
  } catch (err) {
    console.warn('Failed to update incident in Flask, falling back to dataStore:', err);
  }

  // Fallback to local store
  try {
    const body = await request.json();
    dataStore.updateIncidentStatus(body.ticket_id, body.status);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to update incident' }, { status: 500 });
  }
}

/**
 * GET /api/incident — React UI polls this to get latest incidents.
 */
export async function GET() {
  try {
    const res = await fetchFlaskBackend('/api/incidents', { method: 'GET' });
    if (res.ok) {
      const data = await res.json();
      const rawIncidents = Array.isArray(data.incidents) ? data.incidents : [];

      const incidents: any[] = rawIncidents.map((inc: any) => ({
        id: inc.ticket_id || `INC-${inc.id}`,
        timestamp: inc.created_at || new Date().toISOString(),
        type: inc.reported_url ? 'phishing_url' : inc.file_hash ? 'malware_file' : (inc.source_type || 'threat_report'),
        severity: inc.severity || 'medium',
        source: inc.divisi || 'Telegram Bot',
        target: inc.reported_url || inc.original_filename || inc.file_hash || 'N/A',
        description: inc.vt_verdict || inc.urlscan_verdict || 'Threat report submitted via Telegram',
        status: inc.status || 'open',
      }));

      const openIncidents = incidents.filter((i: any) => i.status !== 'closed').length;
      const resolvedIncidents = incidents.filter((i: any) => i.status === 'closed').length;
      const highSeverity = incidents.filter((i: any) => i.severity === 'high' && i.status !== 'closed').length;

      const stats = {
        totalIncidents: incidents.length,
        openIncidents,
        resolvedIncidents,
        highSeverity,
        activeThreats: openIncidents,
      };

      return NextResponse.json({ incidents, stats });
    }
  } catch (err) {
    console.warn('Flask incidents fetch warning, using fallback store:', err);
  }

  seedIfEmpty();
  return NextResponse.json({
    incidents: dataStore.getIncidents(),
    stats: dataStore.getStats(),
  });
}
