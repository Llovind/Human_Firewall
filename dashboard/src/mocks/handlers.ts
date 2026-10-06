/**
 * Mock route table: one entry per browser-facing /api/* endpoint.
 * `normal` serves full data; `empty` (optional) serves the "no records yet" state.
 * Mutations are stateless: they answer success but nothing is stored.
 */
import { NextRequest, NextResponse } from 'next/server';
import { AUTH_SESSION_COOKIE } from '@/lib/authSession';
import { MockRole, MockScenario, SIGNED_OUT_COOKIE } from './config';
import * as f from './fixtures';

const CLOSED_COOKIE = 'afferent_mock_closed_incidents';
const OWNERS_COOKIE = 'afferent_mock_incident_owners';
const EVENTS_COOKIE = 'afferent_mock_incident_events';
function readJson(request: NextRequest, name: string, fallback: unknown): unknown {
  try { return JSON.parse(decodeURIComponent(request.cookies.get(name)?.value || '')); } catch { return fallback; }
}

type Json = Record<string, unknown> | unknown[];
export type Ctx = {
  request: NextRequest;
  match: RegExpMatchArray;
  role: MockRole;
  scenario: MockScenario;
  body: () => Promise<Record<string, unknown>>;
};
type Result = Json | NextResponse;
type Handler = (ctx: Ctx) => Result | Promise<Result>;
type Route = {
  method: string;
  path: RegExp;
  normal: Handler;
  empty?: Handler;
  /** Auth/config calls ignore the loading and error scenarios so you can always reach the app. */
  alwaysOk?: boolean;
};

const q = (ctx: Ctx, key: string) => ctx.request.nextUrl.searchParams.get(key);
const ok = (extra: Json = {}) => ({ success: true, ...(extra as object) });
const fail = (status: number, error: string) => NextResponse.json({ error }, { status });
const stream = () => new NextResponse(
  new ReadableStream({
    start(controller) {
      const enc = new TextEncoder();
      controller.enqueue(enc.encode('event: ready\ndata: {}\n\n'));
      // Comment lines keep the connection open without changing the screen.
      const timer = setInterval(() => {
        try { controller.enqueue(enc.encode(': keep-alive\n\n')); } catch { clearInterval(timer); }
      }, 15_000);
    },
  }),
  { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform' } },
);

const emptyStats = { totalIncidents: 0, openIncidents: 0, resolvedIncidents: 0, highSeverity: 0, activeThreats: 0 };

export const routes: Route[] = [
  /* ── Auth & config ─────────────────────────────────── */
  { method: 'GET', path: /^\/api\/config$/, alwaysOk: true, normal: ctx => ({
    authentication: 'email_otp', environment: 'mock',
    apiUrl: ctx.request.nextUrl.origin, proxyUrl: 'http://127.0.0.1:3128',
    proxyProbeUrl: 'http://proxy-check.afferent.invalid/__afferent_probe__',
  }) },
  { method: 'GET', path: /^\/api\/auth\/session$/, alwaysOk: true, normal: ctx => (
    ctx.request.cookies.get(SIGNED_OUT_COOKIE)?.value === '1'
      ? NextResponse.json({ authenticated: false }, { status: 401 })
      : { authenticated: true, user: f.MOCK_USERS[ctx.role] }) },
  { method: 'POST', path: /^\/api\/auth\/login$/, alwaysOk: true, normal: async ctx => {
    const body = await ctx.body();
    if (String(body.email || '').includes('bad')) return fail(401, 'Email or password is incorrect.');
    return ok({ challengeId: 'mock-challenge', expiresIn: 300, resendCooldown: 60 });
  } },
  { method: 'POST', path: /^\/api\/auth\/resend-otp$/, alwaysOk: true, normal: () => ok({ expiresIn: 300, resendCooldown: 60 }) },
  { method: 'POST', path: /^\/api\/auth\/verify-otp$/, alwaysOk: true, normal: async ctx => {
    const body = await ctx.body();
    if (body.otp === '000000') return fail(400, 'Invalid code. Please try again.');
    const response = NextResponse.json(ok({ user: f.MOCK_USERS[ctx.role], expiresIn: 28800 }));
    response.cookies.delete(SIGNED_OUT_COOKIE);
    return response;
  } },
  { method: 'POST', path: /^\/api\/auth\/logout$/, alwaysOk: true, normal: () => {
    const response = NextResponse.json(ok());
    response.cookies.set(SIGNED_OUT_COOKIE, '1', { path: '/', sameSite: 'lax' });
    response.cookies.set(AUTH_SESSION_COOKIE, '', { path: '/', expires: new Date(0) });
    return response;
  } },
  { method: 'POST', path: /^\/api\/auth\/change-password$/, alwaysOk: true, normal: async ctx => {
    const body = await ctx.body();
    if (body.currentPassword === 'wrong') return fail(400, 'Current password is incorrect.');
    return ok({ message: 'Password diubah. Masuk ulang dengan OTP.' });
  } },

  /* ── Employee home ─────────────────────────────────── */
  { method: 'GET', path: /^\/api\/behavior$/, normal: ctx => f.behavior(q(ctx, 'email')), empty: () => ({ scores: [], by_divisi: [] }) },
  { method: 'GET', path: /^\/api\/quiz\/today$/, normal: () => f.quizToday(), empty: () => f.quizDone() },
  { method: 'POST', path: /^\/api\/quiz\/complete$/, normal: async ctx => f.quizComplete((await ctx.body()).selected_option_index === 2) },
  { method: 'POST', path: /^\/api\/quiz\/revive$/, normal: () => ({ status: 'revived', daily_streak: 6, revives_remaining: 0, message: 'Streak Anda berhasil dipulihkan!' }) },
  { method: 'GET', path: /^\/api\/user-activity$/, normal: () => f.userActivity(), empty: () => ({ activities: [], count: 0 }) },
  { method: 'GET', path: /^\/api\/user-eligibility$/, normal: () => f.eligibility(), empty: () => ({
    eligible: false, reason: 'cooldown', cooldown_seconds: 5400, message: 'Anda sudah mengikuti latihan hari ini. Silakan kembali lagi setelah masa cooldown selesai.' }) },
  { method: 'POST', path: /^\/api\/event$/, normal: async ctx => {
    const body = await ctx.body();
    return NextResponse.json({ message: 'Event berhasil dicatat', email: body.email, event_type: body.event_type }, { status: 201 });
  } },
  { method: 'GET', path: /^\/api\/employee\/([^/]+)\/reports-summary$/, normal: ctx => f.reportsSummary(decodeURIComponent(ctx.match[1])),
    empty: ctx => ({ ...f.reportsSummary(decodeURIComponent(ctx.match[1])), reports_count_malicious: 0, reports_count_total: 0, daily_streak: 0,
      badges: f.reportsSummary('').badges.map(b => ({ ...b, achieved: false })), next_badge: { id: 'sentinel_troops', threshold: 1, remaining: 1 } }) },
  { method: 'GET', path: /^\/api\/threat\/stats$/, normal: ctx => ({ authenticated: true, email: f.MOCK_USERS[ctx.role].email, daily_count: 1, daily_cap: 5, wib_date: new Date().toISOString().slice(0, 10) }) },
  { method: 'POST', path: /^\/api\/threat\/scan$/, normal: async ctx => f.urlScan(String((await ctx.body()).url || '')) },
  { method: 'GET', path: /^\/api\/access-requests$/, normal: () => f.accessRequestsMine(), empty: () => ({ requests: [] }) },
  { method: 'POST', path: /^\/api\/access-requests$/, normal: async ctx => { const b = await ctx.body(); return NextResponse.json(f.accessRequestAccepted(String(b.domain || b.url || ''), String(b.reason || '')), { status: 201 }); } },
  { method: 'GET', path: /^\/api\/admin\/access-requests$/, normal: () => f.accessRequestsStaff(), empty: () => ({ requests: [], counts: { open: 0, allowed: 0, denied: 0 } }) },
  { method: 'POST', path: /^\/api\/admin\/access-requests\/([0-9a-f-]{36})\/decision$/, normal: async ctx => { const b = await ctx.body(); return f.accessRequestDecided(ctx.match[1], String(b.decision || ''), String(b.note || '')); } },
  { method: 'GET', path: /^\/api\/reports$/, normal: () => f.urlReports(), empty: () => ({ reports: [] }) },
  { method: 'POST', path: /^\/api\/reports$/, normal: async ctx => NextResponse.json(f.reportAccepted(String((await ctx.body()).url || '')), { status: 201 }) },
  { method: 'GET', path: /^\/api\/threat\/file-scan$/, normal: () => f.fileScans(), empty: () => ({ scans: [], maxBytes: 10 * 1024 * 1024 }) },
  { method: 'POST', path: /^\/api\/threat\/file-scan$/, normal: async ctx => {
    const file = (await ctx.request.formData()).get('file');
    return NextResponse.json(f.fileScanAccepted(file instanceof File ? file.name : 'upload.bin', file instanceof File ? file.size : 0), { status: 202 });
  } },

  /* ── SOC / GRC / CISO dashboards ───────────────────── */
  { method: 'GET', path: /^\/api\/incident$/, normal: ctx => f.incidents(ctx.request.cookies.get(CLOSED_COOKIE)?.value, readJson(ctx.request, OWNERS_COOKIE, {}) as Record<string, string | null>), empty: () => ({ incidents: [], stats: emptyStats }) },
  { method: 'GET', path: /^\/api\/admin\/trends$/, normal: () => f.weeklyTrends(), empty: () => ({ weeks: [] }) },
  { method: 'GET', path: /^\/api\/incident\/([A-Za-z0-9_-]{3,64})\/events$/, normal: ctx => f.incidentEvents(ctx.match[1], (readJson(ctx.request, EVENTS_COOKIE, []) as { ticket_id: string }[]).filter(e => e.ticket_id === ctx.match[1])), empty: () => ({ events: [] }) },
  { method: 'PATCH', path: /^\/api\/incident$/, normal: async ctx => {
    // Resolve, reopen and assign are remembered in cookies so the flow can be tried; clearing cookies resets it.
    const { ticket_id: id, status, note, assignee } = await ctx.body() as { ticket_id: string; status?: string; note?: string; assignee?: string };
    if (status === 'closed' && String(note || '').trim().length < 5) return NextResponse.json({ error: 'Add a reason of at least 5 characters to resolve an incident.' }, { status: 400 });
    const me = f.MOCK_USERS[ctx.role]?.email ?? f.MOCK_USERS.soc.email;
    const closed = new Set((ctx.request.cookies.get(CLOSED_COOKIE)?.value || '').split(',').filter(Boolean));
    const owners = readJson(ctx.request, OWNERS_COOKIE, {}) as Record<string, string | null>;
    const events = readJson(ctx.request, EVENTS_COOKIE, []) as Record<string, unknown>[];
    const push = (event: string, text: string | null) => events.unshift({ id: Date.now() * 100 + events.length, ticket_id: id, actor_email: me, actor_role: ctx.role, event, note: text, created_at: new Date().toISOString() });
    if (status === 'closed' && !closed.has(id)) { closed.add(id); push('resolved', String(note).trim()); }
    if (status === 'open' && closed.has(id)) { closed.delete(id); push('reopened', String(note || '').trim() || null); }
    if (assignee !== undefined) { owners[id] = assignee === 'me' ? me : null; push(assignee === 'me' ? 'assigned' : 'unassigned', assignee === 'me' ? me : null); }
    const response = NextResponse.json({ message: `Incident ${id} updated.` });
    const cookie = { path: '/', sameSite: 'lax' as const };
    response.cookies.set(CLOSED_COOKIE, [...closed].join(','), cookie);
    response.cookies.set(OWNERS_COOKIE, encodeURIComponent(JSON.stringify(owners)), cookie);
    response.cookies.set(EVENTS_COOKIE, encodeURIComponent(JSON.stringify(events.slice(0, 8))), cookie);
    return response;
  } },
  { method: 'GET', path: /^\/api\/cache$/, normal: () => f.threatFeed(), empty: () => ({ success: true, feed: [], cache: [], timeline: [], total: 0 }) },
  { method: 'GET', path: /^\/api\/admin\/threats\/feed$/, normal: () => f.threatFeed(), empty: () => ({ success: true, feed: [], cache: [], timeline: [], total: 0 }) },
  { method: 'POST', path: /^\/api\/admin\/threats\/action$/, normal: () => ok({ message: 'Action recorded (mock).' }) },
  { method: 'GET', path: /^\/api\/summary$/, normal: () => f.aiSummaries(), empty: () => ({ summaries: [] }) },
  { method: 'GET', path: /^\/api\/policy$/, normal: () => f.policyDecisions(), empty: () => ({ decisions: [] }) },
  { method: 'POST', path: /^\/api\/admin\/policy\/evaluate$/, normal: async ctx => f.policyEvaluation(await ctx.body()) },
  { method: 'GET', path: /^\/api\/admin\/compliance-summary$/, normal: () => ({ ...f.complianceSummary(), ...f.complianceReadiness() }),
    empty: () => ({ compliance_pct: 0, estimated_savings_idr: 0, divisi_risk_map: [], overall_readiness_indicator: 'Not Configured', clause_readiness: [], total_users: 0, total_reports: 0, total_clicks: 0, mean_time_to_close_hours: null, disclaimer: '' }) },
  { method: 'GET', path: /^\/api\/admin\/readiness-thresholds$/, normal: () => f.readinessThresholds(), empty: () => [] },
  { method: 'POST', path: /^\/api\/admin\/readiness-thresholds$/, normal: () => ok({ message: 'Threshold updated (mock).' }) },
  { method: 'GET', path: /^\/api\/admin\/leaderboard$/, normal: () => f.leaderboard(), empty: () => ({ individual: [], by_divisi: [] }) },
  { method: 'GET', path: /^\/api\/admin\/login-history$/, normal: () => f.loginHistory(), empty: () => ({ logs: [] }) },
  { method: 'GET', path: /^\/api\/admin\/security-inbox$/, normal: () => f.securityInbox(), empty: () => ({ ...f.securityInbox(), employees: [], reports: [], audit: [] }) },
  { method: 'POST', path: /^\/api\/admin\/security-inbox$/, normal: () => NextResponse.json(ok({ message: 'Warning queued (mock).' }), { status: 202 }) },
  { method: 'GET', path: /^\/api\/admin\/emails$/, normal: () => ({ status: 'success', emails: [], count: 0 }) },

  /* ── Roster (phishing admin, GRC, CISO) ────────────── */
  { method: 'GET', path: /^\/api\/admin\/employees$/, normal: () => f.employees(), empty: () => ({ employees: [] }) },
  { method: 'POST', path: /^\/api\/admin\/employees$/, normal: () => NextResponse.json({ message: 'Employee created (mock).' }, { status: 201 }) },
  { method: 'PUT', path: /^\/api\/admin\/employees$/, normal: () => ({ message: 'Employee updated (mock).' }) },
  { method: 'GET', path: /^\/api\/admin\/divisions$/, normal: () => f.divisions(), empty: () => ({ divisions: [] }) },
  { method: 'POST', path: /^\/api\/admin\/divisions$/, normal: () => NextResponse.json({ message: 'Division created (mock).' }, { status: 201 }) },

  /* ── Phishing simulation (GoPhish) ─────────────────── */
  { method: 'GET', path: /^\/api\/admin\/gophish\/campaigns$/, normal: () => f.campaigns(), empty: () => [] },
  { method: 'GET', path: /^\/api\/admin\/gophish\/campaigns\/(\d+)$/, normal: ctx => f.campaigns().find(c => String(c.id) === ctx.match[1]) ?? fail(404, 'Campaign not found.') },
  { method: 'DELETE', path: /^\/api\/admin\/gophish\/campaigns\/\d+$/, normal: () => ({ message: 'Campaign deleted (mock).' }) },
  { method: 'POST', path: /^\/api\/admin\/gophish\/campaigns\/\d+\/complete$/, normal: () => ok({ message: 'Campaign stopped (mock).' }) },
  { method: 'GET', path: /^\/api\/admin\/gophish\/resources$/, normal: () => f.gophishResources(), empty: () => ({ ...f.gophishResources(), templates: [], pages: [], profiles: [] }) },
  { method: 'POST', path: /^\/api\/admin\/gophish\/resources\/setup$/, normal: () => ({ message: 'Demo resources are ready (mock).', template_id: 1, page_id: 1 }) },
  { method: 'POST', path: /^\/api\/admin\/gophish\/sync$/, normal: () => ({ message: 'Employee roster synced to GoPhish (mock).' }) },
  { method: 'POST', path: /^\/api\/admin\/gophish\/launch$/, normal: () => NextResponse.json({ message: 'Campaign accepted (mock). Check Mailpit.' }, { status: 201 }) },
  { method: 'POST', path: /^\/api\/admin\/gophish\/templates$/, normal: () => NextResponse.json({ id: 2 }, { status: 201 }) },
  { method: 'PUT', path: /^\/api\/admin\/gophish\/templates\/\d+$/, normal: () => ({ id: 1 }) },
  { method: 'DELETE', path: /^\/api\/admin\/gophish\/templates\/\d+$/, normal: () => ({ message: 'Template deleted (mock).' }) },
  { method: 'POST', path: /^\/api\/admin\/gophish\/pages$/, normal: () => NextResponse.json({ id: 2 }, { status: 201 }) },
  { method: 'PUT', path: /^\/api\/admin\/gophish\/pages\/\d+$/, normal: () => ({ id: 1 }) },
  { method: 'DELETE', path: /^\/api\/admin\/gophish\/pages\/\d+$/, normal: () => ({ message: 'Landing page deleted (mock).' }) },
  { method: 'POST', path: /^\/api\/admin\/gophish\/import-site$/, normal: () => ({
    html: '<html><body><h1>Cloned sign-in page (mock)</h1><form><input name="email"><input name="password" type="password"></form></body></html>',
    redirect_url: 'https://example.com', message: 'Site imported (mock).' }) },

  /* ── AI intelligence ───────────────────────────────── */
  { method: 'GET', path: /^\/api\/ai\/classify$/, normal: () => f.aiHeatmap(), empty: () => ({ classifications: [], _source: 'baseline' }) },
  { method: 'POST', path: /^\/api\/ai\/classify$/, normal: () => ok({ message: 'Cache invalidated (mock).' }) },
  { method: 'GET', path: /^\/api\/ai\/report$/, normal: () => f.aiReport(), empty: () => ({ ...f.aiReport(), markdown_report: '' }) },
  { method: 'GET', path: /^\/api\/ai\/user\/([^/]+)$/, normal: ctx => f.aiUser(decodeURIComponent(ctx.match[1])) },

  /* ── Proxy ─────────────────────────────────────────── */
  { method: 'GET', path: /^\/api\/proxy\/device\/status$/, normal: () => ({ status: f.proxyDevice(true) }), empty: () => ({ status: f.proxyDevice(false) }) },
  { method: 'POST', path: /^\/api\/proxy\/device\/register$/, normal: () => ({ status: f.proxyDevice(true) }) },
  { method: 'POST', path: /^\/api\/proxy\/device\/heartbeat$/, normal: () => ({ status: f.proxyDevice(true) }) },
  { method: 'GET', path: /^\/api\/proxy\/alerts\/stream$/, alwaysOk: true, normal: () => stream() },
  { method: 'GET', path: /^\/api\/proxy\/alerts$/, normal: () => f.proxyAlerts(), empty: () => ({ alerts: [] }) },
  { method: 'POST', path: /^\/api\/proxy\/alerts\/[0-9a-f-]{36}\/decision$/, normal: () => ok() },
  { method: 'GET', path: /^\/api\/proxy\/verdicts$/, normal: () => f.proxyVerdicts(), empty: () => ({ verdicts: [] }) },
  { method: 'GET', path: /^\/api\/proxy\/traffic$/, normal: () => f.proxyTraffic(), empty: () => ({ events: [] }) },
  { method: 'POST', path: /^\/api\/proxy\/manual-decision$/, normal: async ctx => ok({ verdict: { domain: String((await ctx.body()).domain || 'example.com') } }) },
  { method: 'GET', path: /^\/api\/proxy\/second-opinion$/, normal: ctx => f.secondOpinion(q(ctx, 'domain') || 'example.com') },
  { method: 'POST', path: /^\/api\/proxy\/second-opinion$/, normal: async ctx => f.secondOpinion(String((await ctx.body()).domain || 'example.com')) },
  { method: 'GET', path: /^\/api\/proxy\/config$/, normal: () => ({ proxyUrl: 'http://127.0.0.1:3128' }) },
  { method: 'GET', path: /^\/api\/proxy\/audit$/, normal: () => ({ events: [] }) },
  { method: 'GET', path: /^\/api\/proxy\/ca\.crt$/, alwaysOk: true, normal: () => new NextResponse('-----BEGIN CERTIFICATE-----\nMOCK-ONLY\n-----END CERTIFICATE-----\n', {
    headers: { 'Content-Type': 'application/x-x509-ca-cert', 'Content-Disposition': 'attachment; filename="afferent-proxy-ca.crt"' } }) },
];
