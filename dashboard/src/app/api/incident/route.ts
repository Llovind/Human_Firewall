import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  try {
    const apiUrl = process.env.API_URL || 'http://flask_api:5000';
    const serviceApiKey = process.env.SERVICE_API_KEY;

    if (!serviceApiKey) {
      return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
    }

    const res = await fetch(`${apiUrl}/api/incidents`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${serviceApiKey}`,
      },
    });

    if (!res.ok) {
      const data = await res.json();
      return NextResponse.json({ error: data.error || 'Failed to fetch incidents' }, { status: res.status });
    }

    const data = await res.json();

    // Map Flask database incident representation to Next.js UI Incident interface
    const incidents = (data.incidents || []).map((inc: any) => ({
      id: inc.ticket_id,
      timestamp: inc.created_at,
      type: inc.source_type,
      severity: inc.severity || 'medium',
      source: inc.divisi || 'External',
      target: inc.reported_url || inc.file_hash || 'Unknown',
      description: [
        inc.vt_verdict ? `VirusTotal: ${inc.vt_verdict}` : null,
        inc.urlscan_verdict ? `urlscan.io: ${inc.urlscan_verdict}` : null,
        inc.original_filename ? `File: ${inc.original_filename}` : null
      ].filter(Boolean).join(', ') || 'Analisis ancaman eksternal.',
      status: inc.status || 'open',
      assignee: 'SOC-Team'
    }));

    // Fetch the behavior scores to calculate real avgBehaviorScore
    const behaviorRes = await fetch(`${apiUrl}/api/leaderboard`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${serviceApiKey}`
      }
    });
    let avgBehaviorScore = 65;
    if (behaviorRes.ok) {
      const bData = await behaviorRes.json();
      if (bData && Array.isArray(bData.individual) && bData.individual.length > 0) {
        const total = bData.individual.reduce((sum: number, u: any) => sum + Math.round(u.points / 2.0), 0);
        avgBehaviorScore = Math.round(total / bData.individual.length);
      }
    }

    // Fetch threat cache to count blocked URLs
    const cacheRes = await fetch(`${apiUrl}/api/admin/threat-cache`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${serviceApiKey}`
      }
    });
    let blockedUrlsCount = 0;
    if (cacheRes.ok) {
      const cData = await cacheRes.json();
      blockedUrlsCount = (cData.cache || []).filter((t: any) => t.verdict === 'malicious').length;
    }

    const stats = {
      totalIncidents: incidents.length,
      openIncidents: incidents.filter((i: any) => i.status === 'open').length,
      criticalIncidents: incidents.filter((i: any) => i.severity === 'critical' || i.severity === 'high').length,
      blockedUrls: blockedUrlsCount,
      totalEmployees: 12,
      avgBehaviorScore: avgBehaviorScore
    };

    return NextResponse.json({ incidents, stats });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to contact backend', detail: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const apiUrl = process.env.API_URL || 'http://flask_api:5000';
    const serviceApiKey = process.env.SERVICE_API_KEY;

    if (!serviceApiKey) {
      return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
    }

    // Forward to Flask backend POST /api/incidents
    const res = await fetch(`${apiUrl}/api/incidents`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: body.id,
        source_type: body.type,
        reported_url: body.target,
        divisi: body.source,
        severity: body.severity,
      })
    });

    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json({ error: data.error || 'Failed to create incident' }, { status: res.status });
    }

    return NextResponse.json({ success: true, id: data.ticket_id }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to contact backend', detail: error.message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, status } = body;
    if (!id || !status) {
      return NextResponse.json({ error: 'id and status are required' }, { status: 400 });
    }

    const apiUrl = process.env.API_URL || 'http://flask_api:5000';
    const serviceApiKey = process.env.SERVICE_API_KEY;

    if (!serviceApiKey) {
      return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
    }

    // Forward to Flask backend PATCH /api/incidents/<ticket_id>
    const res = await fetch(`${apiUrl}/api/incidents/${id}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${serviceApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status })
    });

    if (!res.ok) {
      const data = await res.json();
      return NextResponse.json({ error: data.error || 'Failed to update incident' }, { status: res.status });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to contact backend', detail: error.message }, { status: 500 });
  }
}
