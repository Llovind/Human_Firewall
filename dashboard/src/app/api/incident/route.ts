import { NextRequest, NextResponse } from 'next/server';
import { fetchFlaskBackend } from '@/lib/backendClient';

export async function POST() {
  return NextResponse.json({ error: 'Legacy webhook retired. Reports are persisted by Flask.' }, { status: 410 });
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const hasStatus = body.status !== undefined;
    const hasAssignee = body.assignee !== undefined;
    if (!body.ticket_id || (!hasStatus && !hasAssignee) || (hasStatus && !['open', 'closed'].includes(body.status)) || (hasAssignee && !['me', ''].includes(body.assignee))) {
      return NextResponse.json({ error: 'ticket_id and a valid status or assignee are required' }, { status: 400 });
    }
    const payload: Record<string, string> = {};
    if (hasStatus) payload.status = body.status;
    if (hasAssignee) payload.assignee = body.assignee;
    if (typeof body.note === 'string') payload.note = body.note;
    const res = await fetchFlaskBackend(`/api/incidents/${encodeURIComponent(body.ticket_id)}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    return NextResponse.json(await res.json(), { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Incident not updated. Retry when backend is available.' }, { status: 503 });
  }
}

export async function GET() {
  try {
    const res = await fetchFlaskBackend('/api/incidents');
    const data = await res.json();
    if (!res.ok) return NextResponse.json(data, { status: res.status });
    const incidents = (data.incidents || []).map((inc: Record<string, string | number>) => ({
      id: inc.ticket_id, timestamp: inc.created_at, type: inc.reported_url ? 'phishing_url' : 'threat_report',
      severity: inc.severity, source: inc.divisi || 'Employee report', target: inc.reported_url || inc.file_hash || 'N/A',
      description: inc.vt_verdict || inc.urlscan_verdict || 'Report submitted via AFFERENT', status: inc.status,
      assignee: inc.assigned_to || null,
    }));
    return NextResponse.json({ incidents, stats: {
      totalIncidents: incidents.length,
      openIncidents: incidents.filter((i: { status: string }) => i.status !== 'closed').length,
      resolvedIncidents: incidents.filter((i: { status: string }) => i.status === 'closed').length,
      highSeverity: incidents.filter((i: { severity: string; status: string }) => ['high', 'critical'].includes(i.severity) && i.status !== 'closed').length,
      activeThreats: incidents.filter((i: { status: string }) => i.status !== 'closed').length,
    } });
  } catch {
    return NextResponse.json({ error: 'Incidents unavailable; no simulated data substituted.' }, { status: 503 });
  }
}
