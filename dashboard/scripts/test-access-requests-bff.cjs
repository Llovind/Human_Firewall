// BFF contract for access requests: session required, JSON only, id validated, backend answers passed through.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { NextResponse } = require('next/server');

function load(file, backend) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, {
    exports, Response, URL, URLSearchParams,
    require: name => name === '@/lib/backendClient' ? { fetchFlaskBackend: backend }
      : name === '@/lib/authBackend' ? { fetchAuthBackend: (_request, path, options) => backend(path, options) }
      : name === '@/lib/authSession' ? { AUTH_SESSION_COOKIE: 'test_session' }
      : { NextResponse },
  });
  return exports;
}

function request(url, { method = 'GET', body, type = 'application/json', authenticated = true } = {}) {
  const req = new Request(`http://localhost:3000${url}`, { method, ...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body), headers: { 'content-type': type } }) });
  req.cookies = { get: () => (authenticated ? { value: 'isolated-fixture' } : undefined) };
  req.nextUrl = new URL(req.url);
  return req;
}

(async () => {
  const calls = [];
  const backend = (status = 200, payload = { ok: true }) => async (path, options) => { calls.push({ path, options }); return Response.json(payload, { status }); };

  // Employee endpoint
  let mine = load('src/app/api/access-requests/route.ts', backend(201, { success: true }));
  assert.equal((await mine.POST(request('/api/access-requests', { method: 'POST', body: { domain: 'a.example.com', reason: 'Need it for work' }, authenticated: false }))).status, 401);
  assert.equal((await mine.GET(request('/api/access-requests', { authenticated: false }))).status, 401);
  assert.equal((await mine.POST(request('/api/access-requests', { method: 'POST', body: '{"domain":"a.example.com"}', type: 'text/plain' }))).status, 415);
  assert.equal(calls.length, 0, 'nothing reaches the back end without a session and a JSON body');
  const created = await mine.POST(request('/api/access-requests', { method: 'POST', body: { domain: 'a.example.com', reason: 'Need it for work' } }));
  assert.equal(created.status, 201);
  assert.equal(calls[0].path, '/api/access-requests');
  assert.deepEqual(JSON.parse(calls[0].options.body), { domain: 'a.example.com', reason: 'Need it for work' });
  mine = load('src/app/api/access-requests/route.ts', backend(400, { error: 'Reason must be at least 5 characters.' }));
  const rejected = await mine.POST(request('/api/access-requests', { method: 'POST', body: { domain: 'a.example.com', reason: 'x' } }));
  assert.equal(rejected.status, 400);
  assert.equal((await rejected.json()).error, 'Reason must be at least 5 characters.');
  mine = load('src/app/api/access-requests/route.ts', async () => { throw new Error('backend down'); });
  assert.equal((await mine.GET(request('/api/access-requests'))).status, 503);

  // Staff list
  calls.length = 0;
  const list = load('src/app/api/admin/access-requests/route.ts', backend(200, { requests: [] }));
  assert.equal((await list.GET(request('/api/admin/access-requests', { authenticated: false }))).status, 401);
  assert.equal((await list.GET(request('/api/admin/access-requests?status=open'))).status, 200);
  assert.equal(calls[0].path, '/api/admin/access-requests?status=open');
  await list.GET(request('/api/admin/access-requests?status=a%26b'));
  assert.equal(calls[1].path, '/api/admin/access-requests?status=a%26b', 'status filter is encoded, never concatenated raw');

  // Decision
  calls.length = 0;
  const id = '7d1b5c22-4a0e-4c19-9d52-0a1b2c3d4e01';
  const ctx = value => ({ params: Promise.resolve({ id: value }) });
  let decide = load('src/app/api/admin/access-requests/[id]/decision/route.ts', backend(200, { success: true }));
  const post = (value, extra = {}) => decide.POST(request(`/api/admin/access-requests/${value}/decision`, { method: 'POST', body: { decision: 'allow', note: 'Checked and fine.' }, ...extra }), ctx(value));
  assert.equal((await post(id, { authenticated: false })).status, 401);
  assert.equal((await post('../../proxy/manual-decision')).status, 404);
  assert.equal((await post('not-a-uuid')).status, 404);
  assert.equal((await post(id, { type: 'text/plain' })).status, 415);
  assert.equal(calls.length, 0, 'bad ids, missing sessions and non-JSON never reach the back end');
  assert.equal((await post(id)).status, 200);
  assert.equal(calls[0].path, `/api/admin/access-requests/${id}/decision`);
  assert.deepEqual(JSON.parse(calls[0].options.body), { decision: 'allow', note: 'Checked and fine.' });
  decide = load('src/app/api/admin/access-requests/[id]/decision/route.ts', backend(409, { error: 'This request was already decided.' }));
  const conflict = await post(id);
  assert.equal(conflict.status, 409);
  assert.equal((await conflict.json()).error, 'This request was already decided.');
  // Weekly trend feed: session needed, weeks bounded, back end answer passed through
  calls.length = 0;
  let trends = load('src/app/api/admin/trends/route.ts', backend(200, { weeks: [] }));
  assert.equal((await trends.GET(request('/api/admin/trends', { authenticated: false }))).status, 401);
  assert.equal((await trends.GET(request('/api/admin/trends?weeks=1'))).status, 400);
  assert.equal((await trends.GET(request('/api/admin/trends?weeks=99'))).status, 400);
  assert.equal((await trends.GET(request('/api/admin/trends?weeks=abc'))).status, 400);
  assert.equal(calls.length, 0, 'bad weeks values never reach the back end');
  assert.equal((await trends.GET(request('/api/admin/trends?weeks=8'))).status, 200);
  assert.equal(calls[0].path, '/api/admin/trends?weeks=8');
  trends = load('src/app/api/admin/trends/route.ts', backend(403, { error: 'Forbidden' }));
  assert.equal((await trends.GET(request('/api/admin/trends'))).status, 403);
  trends = load('src/app/api/admin/trends/route.ts', async () => { throw new Error('backend down'); });
  assert.equal((await trends.GET(request('/api/admin/trends'))).status, 503);

  // Audit log feed: session needed, kind and limit validated, back end answer passed through
  calls.length = 0;
  let audit = load('src/app/api/admin/audit-log/route.ts', backend(200, { events: [] }));
  assert.equal((await audit.GET(request('/api/admin/audit-log', { authenticated: false }))).status, 401);
  assert.equal((await audit.GET(request('/api/admin/audit-log?kind=bogus'))).status, 400);
  assert.equal((await audit.GET(request('/api/admin/audit-log?limit=0'))).status, 400);
  assert.equal((await audit.GET(request('/api/admin/audit-log?limit=999'))).status, 400);
  assert.equal(calls.length, 0, 'bad filters never reach the back end');
  assert.equal((await audit.GET(request('/api/admin/audit-log?kind=proxy&limit=50'))).status, 200);
  assert.equal(calls[0].path, '/api/admin/audit-log?kind=proxy&limit=50');
  audit = load('src/app/api/admin/audit-log/route.ts', backend(403, { error: 'Forbidden' }));
  assert.equal((await audit.GET(request('/api/admin/audit-log'))).status, 403);
  audit = load('src/app/api/admin/audit-log/route.ts', async () => { throw new Error('backend down'); });
  assert.equal((await audit.GET(request('/api/admin/audit-log'))).status, 503);

  // Language on the account: session needed, JSON only, only en or id reach the back end
  calls.length = 0;
  let language = load('src/app/api/auth/language/route.ts', backend(200, { language: 'id' }));
  assert.equal((await language.POST(request('/api/auth/language', { method: 'POST', body: { language: 'id' }, authenticated: false }))).status, 401);
  assert.equal((await language.POST(request('/api/auth/language', { method: 'POST', body: '{"language":"id"}', type: 'text/plain' }))).status, 415);
  assert.equal((await language.POST(request('/api/auth/language', { method: 'POST', body: { language: 'fr' } }))).status, 400);
  assert.equal(calls.length, 0, 'unsupported languages never reach the back end');
  assert.equal((await language.POST(request('/api/auth/language', { method: 'POST', body: { language: 'id' } }))).status, 200);
  assert.deepEqual(JSON.parse(calls[0].options.body), { language: 'id' });
  language = load('src/app/api/auth/language/route.ts', async () => { throw new Error('backend down'); });
  assert.equal((await language.POST(request('/api/auth/language', { method: 'POST', body: { language: 'id' } }))).status, 503);

  console.log('PASS: access request, trend, audit and language routes need a session, accept JSON only, validate the id, encode filters and pass back end answers through');
})().catch(error => { console.error(error); process.exit(1); });
