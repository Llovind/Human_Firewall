import { NextRequest, NextResponse } from 'next/server';
import { fetchFlaskBackend } from '@/lib/backendClient';
import { AUTH_SESSION_COOKIE } from '@/lib/authSession';

function isSameOriginUpload(request: NextRequest): boolean {
  // Next may construct nextUrl with the container's internal hostname. Host is
  // the browser-facing authority; never substitute untrusted X-Forwarded-Host.
  const host = request.headers.get('host');
  const protocol = request.headers.get('x-forwarded-proto') ?? request.nextUrl.protocol.slice(0, -1);
  if (!host || /[\s/\\@?#]/.test(host) || !['http', 'https'].includes(protocol)) return false;
  try {
    return request.headers.get('origin') === new URL(`${protocol}://${host}`).origin;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  if (!request.cookies.get(AUTH_SESSION_COOKIE)?.value) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!isSameOriginUpload(request)) {
    return NextResponse.json({ error: 'Cross-origin uploads are not allowed.' }, { status: 403 });
  }
  const maxMb = Math.max(1, Math.min(10, Number(process.env.FILE_SCAN_MAX_MB || process.env.PDF_REPORT_MAX_MB) || 10));
  const limit = maxMb * 1024 * 1024 + 64 * 1024;
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.startsWith('multipart/form-data;') || !request.body) {
    return NextResponse.json({ error: 'A multipart file upload is required.' }, { status: 400 });
  }
  if (Number(request.headers.get('content-length')) > limit) {
    return NextResponse.json({ error: `File must be at most ${maxMb} MB.` }, { status: 413 });
  }
  const reader = request.body.getReader();
  try {
    // Do not trust Content-Length. Bound the bytes before formData() allocates.
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        return NextResponse.json({ error: `File must be at most ${maxMb} MB.` }, { status: 413 });
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    const form = await new Response(bytes, { headers: { 'Content-Type': contentType } }).formData();
    const file = form.get('file');
    if (!(file instanceof File) || !file.name || file.size === 0 || file.size > maxMb * 1024 * 1024) {
      return NextResponse.json({ error: `Choose a non-empty file up to ${maxMb} MB.` }, { status: 400 });
    }
    const res = await fetchFlaskBackend('/api/threat/file-scan', { method: 'POST', body: form }, 10000);
    return NextResponse.json(await res.json(), { status: res.status });
  } catch {
    return NextResponse.json({ error: 'File scan could not be accepted. Please retry.' }, { status: 503 });
  } finally { reader.releaseLock(); }
}

export async function GET(request: NextRequest) {
  if (!request.cookies.get(AUTH_SESSION_COOKIE)?.value) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const res = await fetchFlaskBackend('/api/threat/file-scan', { method: 'GET' }, 10000);
    return NextResponse.json(await res.json(), {
      status: res.status, headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch {
    return NextResponse.json({ error: 'File scan results are unavailable. Please retry.' }, { status: 503 });
  }
}
