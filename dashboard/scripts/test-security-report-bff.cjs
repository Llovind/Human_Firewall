// BFF contract checks in isolation; no real token, upload, VT request or policy.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { NextResponse } = require('next/server');

function load(file, backend, method = 'POST') {
  const exports = {};
  const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  vm.runInNewContext(compiled, {
    exports, process: { env: { FILE_SCAN_MAX_MB: '1' } }, File, Response, URL,
    require: name => name === '@/lib/backendClient' ? { fetchFlaskBackend: backend }
      : name === '@/lib/authSession' ? { AUTH_SESSION_COOKIE: 'test_session' }
      : { NextResponse },
  });
  return exports[method];
}

function request(body, headers = {}, authenticated = true, internalOrigin = 'http://localhost:3000') {
  const req = new Request(`${internalOrigin}/api/threat/file-scan`, {
    method: 'POST', body, headers: { host: 'afferent.test', ...headers },
  });
  req.cookies = { get: () => authenticated ? { value: 'isolated-fixture' } : undefined };
  req.nextUrl = new URL(req.url);
  return req;
}

(async () => {
  const calls = [];
  const post = load('src/app/api/threat/file-scan/route.ts', async (path, options) => {
    calls.push({ path, options });
    assert.ok(options.body.get('file').size > 0);
    assert.equal(options.body.get('consent'), 'true');
    return Response.json({ success: true }, { status: 202 });
  });
  const form = () => {
    const value = new FormData();
    value.set('file', new File(['%PDF-1.7\nTEST'], 'fixture.pdf', { type: 'application/pdf' }));
    value.set('consent', 'true');
    return value;
  };
  assert.equal((await post(request(form(), { origin: 'http://afferent.test' }, false))).status, 401);
  assert.equal((await post(request(form(), { origin: 'https://attacker.test' }))).status, 403);
  const rejectedOrigins = [
    {},
    { origin: 'null' },
    { origin: 'not-a-url' },
    { origin: 'http://afferent.test/' },
    { origin: 'http://afferent.test:3000' },
    { origin: 'https://afferent.test' },
    { origin: 'http://afferent.test http://attacker.test' },
    { origin: 'http://attacker.test', 'x-forwarded-host': 'attacker.test' },
    { origin: 'http://afferent.test', host: '' },
    { origin: 'http://afferent.test', host: 'afferent.test/path' },
    { origin: 'http://afferent.test', host: 'attacker.test@afferent.test' },
    { origin: 'http://afferent.test', host: 'afferent.test\\ignored' },
    { origin: 'http://afferent.test', host: 'afferent.test:invalid' },
    { origin: 'http://afferent.test', 'x-forwarded-proto': 'http, https' },
    { origin: 'ftp://afferent.test', 'x-forwarded-proto': 'ftp' },
  ];
  for (const headers of rejectedOrigins) {
    assert.equal((await post(request(form(), headers))).status, 403, JSON.stringify(headers));
  }
  assert.equal(calls.length, 0);
  const accepted = await post(request(form(), { origin: 'http://afferent.test' }));
  assert.equal(accepted.status, 202);
  assert.equal(calls[0].path, '/api/threat/file-scan');
  for (const [name, payload, type] of [
    ['fixture.txt', 'text fixture', 'text/plain'],
    ['fixture.zip', 'PK fixture', 'application/zip'],
    ['fixture.exe', 'MZ fixture', 'application/octet-stream'],
  ]) {
    const file = new FormData();
    file.set('file', new File([payload], name, { type }));
    file.set('consent', 'true');
    assert.equal((await post(request(file, { origin: 'http://afferent.test' }))).status, 202);
    assert.equal(calls.at(-1).options.body.get('file').name, name);
    assert.equal(calls.at(-1).options.body.get('file').type, type);
  }
  const empty = new FormData();
  empty.set('file', new File([], 'empty.txt'));
  assert.equal((await post(request(empty, { origin: 'http://afferent.test' }))).status, 400);
  const publicOrigins = [
    ['http://192.0.2.10:3000', '192.0.2.10:3000'],
    ['http://192.0.2.11:3000', '192.0.2.11:3000'],
    ['http://100.64.0.10:3000', '100.64.0.10:3000'],
    ['http://lab.example:3000', 'lab.example:3000'],
    ['http://[2001:db8::1]:3000', '[2001:db8::1]:3000'],
    ['http://afferent.test', 'afferent.test:80'],
    ['https://lab.example', 'lab.example:443', 'https'],
    ['https://lab.example:8443', 'lab.example:8443', 'https'],
  ];
  for (const [origin, host, protocol] of publicOrigins) {
    const headers = { origin, host, ...(protocol ? { 'x-forwarded-proto': protocol } : {}) };
    assert.equal((await post(request(form(), headers))).status, 202, origin);
  }
  // Native HTTPS (no forwarded header) also uses the public Host, not nextUrl.host.
  assert.equal((await post(request(form(), {
    origin: 'https://lab.example', host: 'lab.example',
  }, true, 'https://internal.test:3000'))).status, 202);
  const forwardedCount = calls.length;
  const tooLarge = '%PDF-1.7\n' + 'x'.repeat(1024 * 1024 + 65536);
  const big = new FormData();
  big.set('file', new File([tooLarge], 'large.pdf', { type: 'application/pdf' }));
  // Pre-encode the fixture so stream cancellation does not race undici's
  // asynchronous FormData encoder on newer host Node versions.
  const encoded = new Response(big);
  assert.equal((await post(request(await encoded.arrayBuffer(), {
    origin: 'http://afferent.test',
    'content-type': encoded.headers.get('content-type'),
    'content-length': '1', // The route must bound actual bytes, not trust this.
  }))).status, 413);
  assert.equal(calls.length, forwardedCount);
  const historyCalls = [];
  const history = load('src/app/api/threat/file-scan/route.ts', async (path, options) => {
    historyCalls.push({ path, options });
    return Response.json({ scans: [] });
  }, 'GET');
  assert.equal((await history(request(null, {}, false))).status, 401);
  assert.equal(historyCalls.length, 0);
  const historyResponse = await history(request(null));
  assert.equal(historyResponse.status, 200);
  assert.equal(historyResponse.headers.get('cache-control'), 'private, no-store');
  assert.equal(historyCalls[0].path, '/api/threat/file-scan');
  assert.equal(historyCalls[0].options.method, 'GET');
  const retired = load('src/app/api/reports/pdf/route.ts', () => {
    throw new Error('Retired reports must never forward a file');
  });
  assert.equal((await retired()).status, 410);
  const scanCalls = [];
  const scan = load('src/app/api/threat/scan/route.ts', async (path, options) => {
    scanCalls.push({ path, options });
    return Response.json({ success: true, data: { verdict: 'unknown' } });
  });
  const res = await scan(request(JSON.stringify({ url: 'https://example.test/' }), { 'Content-Type': 'application/json' }));
  assert.equal(res.status, 200);
  assert.equal(scanCalls[0].path, '/api/threat/scan');
  assert.ok(!scanCalls[0].path.includes('dl'));
  const policyPost = load('src/app/api/policy/route.ts', () => {
    throw new Error('Retired policy writes must not forward');
  });
  assert.equal((await policyPost()).status, 410);
  const policyGet = load('src/app/api/policy/route.ts', async () => {
    throw new Error('Backend unavailable');
  }, 'GET');
  const failedPolicy = await policyGet(request(null));
  assert.equal(failedPolicy.status, 503);
  assert.equal((await failedPolicy.json()).decisions, undefined);
  console.log('PASS: private file-scan auth, PDF/other formats, LAN/DNS/IPv6/HTTPS origins, cross-site rejection, bounds/history, retirement and provider-only URL scan');
})().catch(error => { console.error(error); process.exitCode = 1; });
