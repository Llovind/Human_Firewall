/**
 * Entry point for front-end-only mock mode. The only caller is src/proxy.ts.
 * To remove mock mode: delete this folder, the `mocks` lines in src/proxy.ts,
 * the dev:mock script in package.json and the check in scripts/validate-runtime-env.mjs.
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  LOADING_DELAY_MS, ROLE_COOKIE, SCENARIO_COOKIE, SIGNED_OUT_COOKIE, SWITCHER_PATH,
  asRole, asScenario,
} from './config';
import { routes, type Ctx } from './handlers';
import { switcherPage } from './switcher';

export { mocksEnabled } from './config';

/** Returns a response for any /api/* request, or null so pages render normally. */
export async function handleMockRequest(request: NextRequest): Promise<NextResponse | null> {
  const { pathname, searchParams } = request.nextUrl;
  if (!pathname.startsWith('/api/')) return null;

  const role = asRole(request.cookies.get(ROLE_COOKIE)?.value);
  const scenario = asScenario(request.cookies.get(SCENARIO_COOKIE)?.value);

  if (pathname === SWITCHER_PATH) return switchState(request, searchParams, role, scenario);

  const method = request.method.toUpperCase();
  for (const route of routes) {
    if (route.method !== method) continue;
    const match = pathname.match(route.path);
    if (!match) continue;

    if (!route.alwaysOk && scenario === 'loading') await new Promise(r => setTimeout(r, LOADING_DELAY_MS));
    if (!route.alwaysOk && scenario === 'error') {
      return NextResponse.json({ error: 'Mock error: the backend is unavailable.' }, { status: 503 });
    }
    let cached: Promise<Record<string, unknown>> | null = null;
    const ctx: Ctx = {
      request, match, role, scenario,
      body: () => (cached ??= request.json().catch(() => ({})) as Promise<Record<string, unknown>>),
    };
    const handler = scenario === 'empty' && route.empty ? route.empty : route.normal;
    const result = await handler(ctx);
    return result instanceof NextResponse ? result : NextResponse.json(result);
  }
  return NextResponse.json(
    { error: `Mock mode has no response for ${method} ${pathname}. Add one in src/mocks/handlers.ts.` },
    { status: 501 },
  );
}

/** /api/__mock shows the switcher; with ?role=&scenario=&to= it applies the choice and redirects. */
function switchState(request: NextRequest, params: URLSearchParams, role: string, scenario: string) {
  const wantsChange = ['role', 'scenario', 'signout', 'to'].some(key => params.has(key));
  if (!wantsChange) return new NextResponse(switcherPage(role, scenario), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });

  const target = params.get('to') || '/';
  const response = NextResponse.redirect(new URL(target.startsWith('/') && !target.startsWith('//') ? target : '/', request.url));
  const cookie = { path: '/', sameSite: 'lax' as const };
  if (params.has('role')) response.cookies.set(ROLE_COOKIE, asRole(params.get('role')), cookie);
  if (params.has('scenario')) response.cookies.set(SCENARIO_COOKIE, asScenario(params.get('scenario')), cookie);
  if (params.get('signout') === '1') response.cookies.set(SIGNED_OUT_COOKIE, '1', cookie);
  else response.cookies.delete(SIGNED_OUT_COOKIE);
  return response;
}
