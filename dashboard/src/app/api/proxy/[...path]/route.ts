import { NextRequest } from 'next/server';
import { fetchFlaskBackend } from '@/lib/backendClient';

type RouteContext = { params: Promise<{ path: string[] }> };

async function forward(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  const method = request.method.toUpperCase();
  const relativePath = path.join('/');
  const allowed = new Set([
    'GET device/status',
    'GET config',
    'GET alerts',
    'GET verdicts',
    'GET traffic',
    'GET audit',
    'GET alerts/stream',
    'GET ca.crt',
    'POST device/register',
    'POST device/heartbeat',
    'POST manual-decision',
  ]);
  const isAlertDecision = method === 'POST' && /^alerts\/[0-9a-f-]{36}\/decision$/i.test(relativePath);
  if (!allowed.has(`${method} ${relativePath}`) && !isAlertDecision) {
    return Response.json({ error: 'Proxy route is not exposed by the dashboard BFF' }, { status: 404 });
  }
  const backendPath = `/api/proxy/${path.map(encodeURIComponent).join('/')}${request.nextUrl.search}`;
  const headers = new Headers();
  const contentType = request.headers.get('content-type');
  const requestId = request.headers.get('x-request-id');
  if (contentType) headers.set('Content-Type', contentType);
  if (requestId) headers.set('X-Request-ID', requestId);

  const isStream = relativePath === 'alerts/stream';
  const body = ['GET', 'HEAD'].includes(method) ? undefined : await request.text();
  const response = await fetchFlaskBackend(
    backendPath,
    { method, headers, body },
    isStream ? 0 : 5000,
  );

  const responseHeaders = new Headers();
  responseHeaders.set('Content-Type', response.headers.get('content-type') || 'application/json');
  const disposition = response.headers.get('content-disposition');
  if (disposition) responseHeaders.set('Content-Disposition', disposition);
  if (isStream) {
    responseHeaders.set('Cache-Control', 'no-cache, no-transform');
    responseHeaders.set('X-Accel-Buffering', 'no');
  }
  return new Response(response.body, { status: response.status, headers: responseHeaders });
}

export const GET = forward;
export const POST = forward;
