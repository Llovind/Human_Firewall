# Manual demo: selective TLS blocking

This change does not configure the employee OS proxy. Use a separate employee
VM/device and host SOC browser; keep AFFERENT's own dashboard/API in the proxy
exception list. User IPs are discovered from connections, never hardcoded.

## Apply

From the repo root, rebuild backend and proxy only (does not start n8n):

```powershell
docker compose up -d --build flask_api centralized_proxy
```

Preserve `.env.proxy.local` and Docker volumes. Do not use `down -v`.
Set `.env` values below if your environment already overrides the defaults:

```dotenv
PROXY_FAIL_MODE=closed
ML_LOCAL_ENABLED=true
ML_SCANNER_URL=
ML_DOMAIN_MODEL_DIR=/app/models/domain_v3
PROXY_REVOCATION_INTERVAL_SECONDS=0.5
```

For Kali bridged mode set `PROXY_BIND_IP` to the host LAN address or `0.0.0.0`
with a private-subnet firewall rule. The employee's IP can change without code
changes. Keep PostgreSQL/Redis, internal Squid 3129/3130, and service credentials
private. Configure the employee proxy using the server's address, port 3128.

Download **only the public CA** from `/api/proxy/ca.crt` using the employee
dashboard. Trust it in the test browser/device, including Firefox's own trust
store if required. Never move or install the CA private key on client devices.

## Manual checklist for Daf

- [ ] Proxy OFF/ON still changes the employee connection card correctly.
- [ ] Allow a known domain: its browser certificate stays the original site's,
      not an AFFERENT-issued certificate.
- [ ] Open a site as employee, then SOC Block its correctly spelled domain.
      The existing connection stops after controller propagation (polling
      interval plus network/backend time). Other sites on the same IP stay up.
- [ ] Navigate freshly to the blocked HTTPS domain: `BLOCKED BY AFFERENT` with
      no browser certificate warning when the CA is trusted.
- [ ] SOC Allow the same canonical domain, then open a new connection: access
      returns. A denial connection itself is never reused to forward content.
- [ ] Block a root domain and verify its `www`/subdomains; typing `yotube.com`
      must not silently block `youtube.com`.
- [ ] New domain + conclusive malicious ML: the first request is denied before
      origin HTTP content. Pending/unavailable ML is temporarily denied too,
      but it does not create a malicious blacklist entry.
- [ ] Genuine Unknown stays allowed and visible to SOC for review.
- [ ] SOC feed receives actual proxy requests, not controller reconciliation
      calls. SOC decisions retain actor/reason/request ID in append-only audit.

Background search/video requests may show an app/network error after revocation,
not replace the tab with a block page. Buffered/cached content cannot be erased.
Certificate-pinned apps may reject the denial certificate. Test via fresh
navigation rather than promising every AJAX request renders a blocking screen.

## Isolated checks already run

9 assertions/checks passed: 5 backend gate checks with mocked storage/network
and 4 real Squid/TLS/relay checks in a container with **no external network**.
The latter use disposable `.test` servers/certificates, not employee traffic.
No Windows proxy setting or browser trust store was changed by these checks.

Re-run from the repo root:

```powershell
docker build -t afferent-proxy-selective:local ./proxy
docker run --rm --network none --add-host allowed.afferent.test:127.0.0.1 --add-host blocked.afferent.test:127.0.0.1 --add-host slow.afferent.test:127.0.0.1 --mount "type=bind,src=$PWD/proxy,dst=/checks,readonly" --entrypoint python3 afferent-proxy-selective:local /checks/test_selective_tls.py
```

This is protocol verification, not a claim that the full browser/SOC/OTP demo
has been manually tested. See `DOMAIN_ML_EVALUATION.md` for model limitations.

## Denial screen refresh (3 October 2026)

The actual Squid error template now matches the modern AFFERENT education UI.
Poppins is bundled with its SIL Open Font License and embedded in the response,
so the blocked page does not depend on Google Fonts or another network request.
The screen displays only the target hostname and gateway, not raw HTTP headers,
cookies or full URL query strings. It does not fabricate a risk score or claim
an employee report was sent.

Set `PROXY_PORTAL_URL` to the employee-reachable dashboard URL for its return
button. If empty, it derives the dashboard host on port 3000 from
`SERVER_BASE_URL`; without either setting, it shows bookmark guidance instead.
Recreate `centralized_proxy` after changing these environment values.

The offline-template check and all four isolated Squid/TLS/relay tests passed
after this refresh, including the real denial HTML response. Proxy connection
status/probe behavior was not changed. Desktop visual review passed; mobile
screen testing was omitted at Daf's request. Browser rendering of blocked HTTPS
on the employee VM remains subject to the CA-trust/manual checks above.
