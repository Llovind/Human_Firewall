# Phishing Administrator: demo GoPhish + Mailpit

Verified 3 October 2026 in this checkout. Campaigns now use the real GoPhish
API; all new campaign SMTP profiles must point to `mailpit:1025`. Mock Webmail
is no longer part of the administrator UI. Historical campaign/event data is
retained and shown as a separate local archive.

## Manual test

1. Open AFFERENT, sign in as **Administrator** through email/password/OTP.
2. Open **Simulasi phishing**. Resource setup is already done in the current
   lab. On a fresh lab, use **Siapkan demo lab** (development/test only).
3. Select active employee recipients. SOC/admin accounts are not targets.
4. Use **Buat campaign**; choose the template, landing page and Mailpit profile.
5. Check the GoPhish server URL. For a VM, use `http://HOST-LAN-IP:8080`, never
   `localhost` or the Flask `/redirect-handler` endpoint.
6. Launch once. The success message means GoPhish accepted the campaign, not
   that all email has already been delivered. Refresh to inspect per-recipient
   delivery/error status. If a request times out, check the list before retrying.
7. Open **Mailpit (host)** on the server host. Select the simulated email and
   open its link from the employee VM. The landing page is a safe awareness
   page by default; never enter a real password in a simulation.
8. Confirm **Clicked Link** in campaign detail. Scoring uses the existing
   gamification rules and an atomic receipt per campaign/recipient/event type.
   Repeated dashboard polling does not repeat the same penalty. The worker
   also syncs GoPhish telemetry every 10 seconds with the dashboard closed.
9. Use **Hentikan** to complete a campaign. **Hapus** explicitly selects either
   GoPhish or the historical local source, so equal numeric IDs do not collide.

## Network settings

Configure `.env` before recreating the affected services:

```dotenv
# Campaign links must be reachable from employee devices.
GOPHISH_PHISH_PUBLIC_URL=http://HOST-LAN-IP:8080
# Admin and inbox UI remain host-only unless deliberately exposed.
GOPHISH_ADMIN_PUBLIC_URL=https://localhost:3333
MAILPIT_PUBLIC_URL=http://127.0.0.1:8025
GOPHISH_ADMIN_BIND_IP=127.0.0.1
MAILPIT_BIND_IP=127.0.0.1
GOPHISH_SYNC_ENABLED=true
# Education page after submitting either built-in or cloned demo form.
SIMULATION_EDUCATION_URL=http://HOST-LAN-IP:3000/simulation/education
# Internal verified API, not an employee-facing link.
GOPHISH_API_URL=https://gophish:3333
GOPHISH_CA_BUNDLE=/etc/afferent-ca/gophish-ca.crt
```

If the explicit phishing URL is empty, the backend derives a host URL on port
8080 from `SERVER_BASE_URL`/`SIMULATION_BASE_URL`. It does not bind identity to
one VM IP. Allow port 8080 on the host firewall for the authorized lab network.
Keep ports 3333/8025 host-only; recipients do not need GoPhish admin access.

## Opening native GoPhish

Use **HTTPS**, not HTTP: `https://localhost:3333`. AFFERENT's admin login and
native GoPhish credentials are separate. AFFERENT campaign operations do not
require signing into the native GoPhish UI.

The backend verifies the private lab CA and hostname. A browser certificate
warning means that browser/OS does not yet trust the lab CA; it does not mean
the verified backend API is unavailable. For a lab machine you control:

1. Check the certificate being installed is the intended lab CA at
   `secrets/gophish-pki/afferent-lab-ca.crt` (not its private key).
2. If you choose to trust it, import this public CA through Windows Certificate
   Manager into the current user's Trusted Root Certification Authorities.
3. Restart the browser and use a hostname in the GoPhish certificate SAN.
4. Remove the lab CA trust when the lab is retired.

No CA was automatically added to Windows trust stores. TLS verification was
not disabled. The GoPhish API key must stay server-side and is never returned
to dashboard clients.

## Verification completed

- Five isolated regression checks: RBAC/error propagation, actual resource
  names, canonical collection routes, Mailpit-only selected targets, source
  namespace separation, secret redaction and atomic score deduplication.
- Real Mailpit smoke: one synthetic recipient, successful SMTP delivery,
  landing-page click tracking, a single scoring penalty in a temporary DB,
  campaign completion. Real employee scores were untouched.
- Sixteen related isolated regression checks passed; production dashboard
  build and targeted lint passed. All eight Compose services were healthy
  after activating the changes.
- Remaining: Daf's browser/VM walkthrough and visual review. At the initial
  campaign check, Firecrawl/Gemini were not configured. The later Firecrawl
  clone addition and current key status are documented below; provider/AI
  generation flows are not claimed live-tested. The normal template-based
  campaign works without those optional providers.

The synthetic smoke campaigns are retained in GoPhish as **Completed**, clearly
named `AFFERENT Mailpit smoke ...`. Its captured email remains in Mailpit.

Repeatable checks from the repository root:

```powershell
rtk proxy docker compose exec -T flask_api python test_campaign_fixes.py -v
# Opt-in: creates another synthetic Mailpit-only campaign, then completes it.
rtk proxy docker compose exec -T flask_api python test_campaign_fixes.py --mailpit-smoke
```

API contract references: [GoPhish campaigns](https://docs.getgophish.com/api-documentation/campaigns)
and [sending profiles](https://docs.getgophish.com/api-documentation/sending-profiles).

## Password-change template and Firecrawl clone (3 October 2026)

The campaign workspace now offers **Dua cara membuat simulasi**:

1. **Perubahan password mendadak → Gunakan template ini** creates/reuses a
   professional account-notification email and a credential-free demo form.
   The prepared template and landing page are selected for the next campaign.
   This is an AFFERENT lab message, not an official Google/Gmail notification.
2. **Clone halaman · Firecrawl → Buka clone editor** accepts a public login URL
   owned by you or explicitly authorized for this simulation. Confirm permission,
   click **Clone Firecrawl**, review the static HTML, name it and save. Choose
   that page in the campaign launch dialog and pair it with the prepared email.

Use only dummy values in the demo form. Original scripts, forms, navigation and
external resources are not reused. The visible email/password inputs have no
`name`; GoPhish capture options are forced off. The native POST records the
submit event/recipient ID without sending those input values. Manually saved
form HTML is also replaced by the safe form; named credential fields are not
accepted unchanged. Historical data is not deleted.

Both options redirect after submit to `/simulation/education`. With an initial
score of 100: clicking costs 10 points, submitting costs another 20 → 70.
The existing atomic receipt prevents a repeated penalty for the same event
type, campaign and recipient. The worker syncs within its 10-second interval;
the education page does not itself modify scores or accept an employee identity.

Configure `FIRECRAWL_API_KEY` server-side and recreate Flask after `.env` changes.
The key is now present in this lab runtime; its provider validity/credits and a
real authorized target have not yet been verified. The integration uses
[Firecrawl v2 scrape](https://docs.firecrawl.dev/api-reference/endpoint/scrape)
with `rawHtml`. Missing keys, failed requests, provider errors and pages without
a static form are shown as errors, not fake successful clones. Public static
HTML is supported; JS-only/multistep OAuth, exact remote asset reproduction and
private VM/localhost login pages are not. Use the built-in template for those.

Current verification: eight isolated campaign checks, eleven related regression
checks, production dashboard build and targeted lint passed. The real Mailpit
smoke verified delivery, GET tracking, repeated empty-form POST → education,
100 → 90 → 70 scoring and campaign completion in a temporary DB. Actual employee
scores were untouched. Education URL on the configured LAN host returned HTTP
200. All eight Compose services were healthy. Browser/VM visual review and a
real Firecrawl scrape remain manual follow-ups.

## Browser redirect fix and education UI (3 October 2026)

Chrome reproduced a submission that GoPhish recorded as `Submitted Data`,
but did not navigate to education. The landing page's `form-action 'self'`
policy prevented the redirect from GoPhish to the dashboard on a different
port. See [MDN form-action](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/form-action).

Generated, cloned and saved demo forms now allow only the validated education
origin in addition to their own origin. No wildcard policy was introduced.
The existing built-in password demo page was repaired in the running lab.
Re-select **Gunakan template ini** to repair that preset in another lab.

The education screen and dashboard `/blocked` screen now share a modern
Poppins design, clear explanations and links back to AFFERENT. The actual
Squid denial screen also uses bundled offline Poppins; see `SELECTIVE_TLS_DEMO.md`.

Verification: nine isolated campaign checks passed; Chrome submission with
dummy inputs successfully reached `/simulation/education`. The Mailpit smoke
confirmed delivery and 100 → 90 → 70 scoring in a temporary database, without
changing employee scores. Production dashboard build and targeted lint passed.
Desktop visuals were reviewed; mobile screen testing was omitted at Daf's request.

For manual verification, launch a **new active campaign** and use its newest
Mailpit email. Completed smoke campaign links can return 404 and should not be
used to test this redirect. Refresh an already-open form to obtain its new CSP.
Use dummy inputs only; real credentials are neither required nor collected.
