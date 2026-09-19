import { NextRequest, NextResponse } from 'next/server';

function resolvePublicUrl(configured: string | undefined, request: NextRequest, port: number) {
  const requestUrl = new URL(request.url);
  const publicHost = request.headers.get('x-forwarded-host') || request.headers.get('host') || requestUrl.host;
  const publicProtocol = request.headers.get('x-forwarded-proto') || requestUrl.protocol.replace(':', '');
  let publicHostname = requestUrl.hostname;
  try {
    publicHostname = new URL(`${publicProtocol}://${publicHost}`).hostname;
  } catch {
    // Retain the URL parsed by Next when an upstream sends an invalid Host.
  }
  const raw = configured || `${publicProtocol}://${publicHostname}:${port}`;

  try {
    const target = new URL(raw);
    // A cookie is shared across ports, but never across `localhost` and
    // `127.0.0.1`. Keep every browser-facing service on the exact hostname
    // used to open the dashboard. This also turns safe loopback defaults into
    // the server's Tailscale/LAN hostname when the dashboard is opened remotely.
    if (['localhost', '127.0.0.1', '::1', '[::1]'].includes(target.hostname)) {
      target.hostname = publicHostname;
    }
    return target.toString().replace(/\/$/, '');
  } catch {
    return `${publicProtocol}://${publicHostname}:${port}`;
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    authentication: 'email_otp',
    environment: process.env.APP_ENV || process.env.NODE_ENV || 'development',
    apiUrl: resolvePublicUrl(process.env.NEXT_PUBLIC_API_URL, request, 5000),
    proxyUrl: resolvePublicUrl(process.env.NEXT_PUBLIC_PROXY_URL, request, 3128),
    proxyProbeUrl: process.env.NEXT_PUBLIC_PROXY_PROBE_URL
      || 'http://proxy-check.afferent.invalid/__afferent_probe__',
  });
}
