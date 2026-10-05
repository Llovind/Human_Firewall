import { ROLES, SCENARIOS, SWITCHER_PATH } from './config';
import { ROLE_ROUTES } from '@/lib/authSession';

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

/** Plain HTML page at /api/__mock for picking who you are and which data state to preview. */
export function switcherPage(role: string, scenario: string): string {
  const link = (label: string, query: Record<string, string>, active = false) =>
    `<a class="${active ? 'on' : ''}" href="${SWITCHER_PATH}?${new URLSearchParams(query)}">${esc(label)}</a>`;
  const roleLinks = ROLES.map(r => link(r, { role: r, scenario, to: ROLE_ROUTES[r] || '/' }, r === role)).join('');
  const scenarioLinks = SCENARIOS.map(s => link(s, { role, scenario: s, to: ROLE_ROUTES[role] || '/' }, s === scenario)).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Mock mode</title><style>
body{font:15px/1.5 system-ui,sans-serif;max-width:560px;margin:40px auto;padding:0 16px;color:#1b2430}
h1{font-size:20px}h2{font-size:13px;text-transform:uppercase;letter-spacing:.06em;color:#667}
.row{display:flex;flex-wrap:wrap;gap:8px}a{padding:8px 14px;border:1px solid #c5ccd6;border-radius:8px;text-decoration:none;color:inherit}
a.on{background:#1b2430;color:#fff;border-color:#1b2430}p{color:#556}
</style></head><body>
<h1>Mock mode is on</h1><p>No backend or database is running. Pick a role and a data state; you will land on that role's home screen.</p>
<h2>Signed in as (current: ${esc(role)})</h2><div class="row">${roleLinks}</div>
<h2>Data state (current: ${esc(scenario)})</h2><div class="row">${scenarioLinks}</div>
<p>normal = full data · empty = no records · loading = replies take 4 seconds · error = every data request fails.</p>
<h2>Other</h2><div class="row">${link('Sign out and see the login screen', { role, scenario, signout: '1', to: '/auth' })}</div>
</body></html>`;
}
