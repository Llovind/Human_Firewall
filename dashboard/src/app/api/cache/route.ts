import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  try {
    const apiUrl = process.env.API_URL || 'http://flask_api:5000';
    const serviceApiKey = process.env.SERVICE_API_KEY;

    if (!serviceApiKey) {
      return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
    }

    const res = await fetch(`${apiUrl}/api/admin/threat-cache`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${serviceApiKey}`,
      },
    });

    if (!res.ok) {
      const data = await res.json();
      return NextResponse.json({ error: data.error || 'Failed to fetch threat cache' }, { status: res.status });
    }

    const data = await res.json();
    const cache = (data.cache || []).map((t: any) => {
      const score = Math.max(t.vt_score || 0, t.urlscan_score || 0) || (t.verdict === 'malicious' ? 85 : 45);
      return {
        id: `TC-${t.id}`,
        url: t.indicator,
        threatType: t.verdict === 'malicious' ? 'credential_harvesting' : t.verdict === 'suspicious' ? 'suspicious' : 'safe',
        score: score,
        source: t.source || 'VirusTotal',
        action: t.verdict === 'malicious' ? 'block' : t.verdict === 'suspicious' ? 'warning' : 'allow',
        detectedAt: t.created_at || new Date().toISOString(),
        lastChecked: t.expires_at || new Date().toISOString(),
      };
    });

    return NextResponse.json({ cache });
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

    const res = await fetch(`${apiUrl}/api/admin/threat-cache`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body)
    });

    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json({ error: data.error || 'Failed to save threat cache' }, { status: res.status });
    }

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to contact backend', detail: error.message }, { status: 500 });
  }
}
