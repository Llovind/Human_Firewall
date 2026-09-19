# AFFERENT Centralized Proxy — Lab Architecture

## Outcome

The active proxy pipeline does not call VirusTotal or urlscan. Squid sends a
domain decision request to Flask. Redis provides the low-latency hot path;
PostgreSQL persists traffic, devices, verdicts, alerts, and append-only SOC
audit records.

Decision precedence is deterministic:

1. Active manual SOC block
2. Active manual SOC allow
3. ML evidence (visible to SOC, never an automatic block)
4. Unknown domain allowed and recorded as `Unknown`

A conclusive ML result is evidence for SOC review. Only a manual SOC `block`
is enforced by Squid. Timeout, unavailable model, low-confidence result, or
`unknown` fail open and remain visible in the live traffic feed. The
`PROXY_FAIL_MODE` setting applies only when the whole Decision API is
unreachable; its demo default is `open` so a backend restart does not remove
Internet access. Set it to `closed` explicitly when fail-closed behavior is
required and the Decision API is operated redundantly.

Non-conclusive results are cached only for `PROXY_UNKNOWN_RETRY_SECONDS` to
avoid an ML request/alert storm while still retrying classification soon.

## Data path

```text
Employee device -> Squid:3128 -> Flask Decision API
                                    |-> Redis verdict/device lookup
                                    |-> PostgreSQL fallback/source of truth
                                    |-> External ML (only cache miss)
                                    |-> Redis Stream -> PostgreSQL traffic
                                    `-> Redis Pub/Sub -> SOC dashboard SSE
```

SQLite remains the source for the existing login, phishing simulation,
gamification, quiz, and reporting features. This avoids a risky migration of
already-working functionality.

## ML synchronous request contract

`POST $ML_SCANNER_URL`

Headers:

- `Content-Type: application/json`
- `X-Afferent-Schema-Version: 1.0`
- `Idempotency-Key: <event UUID>`
- `X-Afferent-Signature: sha256=<HMAC-SHA256 of exact raw body>`

Request:

```json
{
  "schemaVersion": "1.0",
  "eventId": "uuid",
  "requestId": "uuid-or-trace-id",
  "domain": "example.org",
  "observedAt": "2026-09-19T01:02:03+00:00"
}
```

Response:

```json
{
  "verdict": "safe | malicious | unknown",
  "confidence": 0.97,
  "reason": "Human-readable model explanation",
  "modelVersion": "domain-model-1.0.0"
}
```

Confidence is a number from 0 to 1. The integration is domain-only: do not
expect HTTP path, page content, cookies, credentials, or decrypted HTTPS.

## ML asynchronous callback

The model may later call `POST /api/proxy/ml/verdict` with the same signature
header and this body:

```json
{
  "schemaVersion": "1.0",
  "eventId": "stable-unique-event-id",
  "domain": "example.org",
  "verdict": "malicious",
  "confidence": 0.97,
  "reason": "Model explanation",
  "modelVersion": "domain-model-1.0.0"
}
```

`eventId` is persisted as an idempotency key. Replaying it cannot create a
second verdict operation.

## Application endpoints

- `POST /api/proxy/device/register` — employee session; bind current device IP
- `POST /api/proxy/device/heartbeat` — employee session; renew the configurable
  device authorization window (8 hours by default)
- `GET /api/proxy/device/status` — employee session; registration/traffic status
- `POST /api/proxy/decision` — internal service bearer; Squid decision + telemetry
- `GET /api/proxy/alerts/stream` — SOC/CISO session; SSE update stream
- `POST /api/proxy/alerts/{id}/decision` — SOC session; audited Block/Allow
- `POST /api/proxy/manual-decision` — SOC session; audited manual domain override
- `GET /api/proxy/audit` — SOC/CISO session; append-only decision history
- `POST /api/proxy/ml/verdict` — external model; HMAC and idempotency required

The dashboard BFF explicitly refuses to proxy the internal Squid decision and
ML callback endpoints, preventing a browser from inheriting the service key.

## Local demo

1. Keep `PROXY_BIND_IP=127.0.0.1` and `PUBLIC_PROXY_URL=http://127.0.0.1:3128`.
2. Run `docker compose up -d --build`.
3. Open `http://127.0.0.1:3000`, log in as an employee, and complete OTP in
   Mailpit at `http://127.0.0.1:8025`. Use one hostname consistently. The
   dashboard now automatically keeps its public API and proxy URL on the same
   hostname, so `localhost` and `127.0.0.1` cookies are never mixed.
4. On the employee dashboard, click **Aktifkan perangkat**.
5. Configure the operating-system HTTP and HTTPS proxy to `127.0.0.1:3128`.
   Add `localhost;127.0.0.1` to the Windows proxy exception list so the
   AFFERENT dashboard/API bootstrap stays direct.
   When Squid itself runs in Docker Desktop on this same Windows computer, set
   **Docker Desktop > Settings > Resources > Proxies > Manual proxy
   configuration**, leave the HTTP/HTTPS fields empty, then Apply/Restart.
   Otherwise Docker Desktop inherits the Windows proxy and sends Squid's
   outbound traffic back to Squid, producing `Forwarding loop detected`,
   NeverSSL `Access Denied`, and HTTPS timeouts. This local-only adjustment is
   unnecessary when Squid runs on a separate lab server.
6. Browse to a domain. The card changes to **Terhubung** only after Squid has
   answered the reserved browser-side connectivity probe. Turning the OS proxy
   off changes the card to **Gagal terhubung** within about seven seconds.
7. Log in as SOC and open **Threat Intelligence** to see the live SSE queue,
   verdict cache, and audited manual Block/Allow controls.

PowerShell smoke test after device registration:

```powershell
curl.exe -x http://127.0.0.1:3128 http://example.org -I
```

## Tailscale lab server

On the server `.env`, set:

```dotenv
PROXY_BIND_IP=100.x.x.x
PROXY_PORT=3128
PUBLIC_PROXY_URL=http://100.x.x.x:3128
NEXT_PUBLIC_BASE_URL=http://100.x.x.x:3000
NEXT_PUBLIC_API_URL=http://100.x.x.x:5000
ALLOWED_ORIGINS=http://100.x.x.x:3000
```

Replace `100.x.x.x` with the server's actual Tailscale IP. Allow TCP/3128 only
on the Tailscale interface/firewall. Do not expose 3128 to the public Internet.
PostgreSQL and Redis have no published ports.

Add the same `100.x.x.x` server address to the employee device's proxy
exception list. Only AFFERENT's own dashboard/API traffic bypasses Squid; the
employee's external web traffic remains monitored.

SOC/CISO can retrieve the append-only decision trail from
`GET /api/proxy/audit`. PostgreSQL triggers reject both `UPDATE` and `DELETE`
against the audit table; manual decisions record actor, role, timestamp,
reason, before/after state, request ID, domain, and source alert.

## HTTPS limitation

No AFFERENT CA certificate is required for the current domain-only design.
Squid creates a raw HTTPS `CONNECT` tunnel and the browser validates the
website's original certificate directly.

Without TLS inspection, Squid can block an HTTPS CONNECT by hostname, but it
cannot see the full URL path. HTTP requests receive the branded AFFERENT block
page. Some browsers display a generic tunnel/proxy error for denied HTTPS
CONNECT requests; a fully branded HTTPS page would require TLS interception,
a managed CA on every device, and explicit institutional approval. That is
intentionally outside this demo.

Manual SOC policies are canonicalized by removing a leading `www.` and apply
to the canonical domain plus its subdomains. Typos remain distinct domains:
`yotube.com` does not and must not silently become `youtube.com`. A new HTTP
request or HTTPS CONNECT is evaluated without a Squid ACL cache. An HTTPS
tunnel that was established before a policy change cannot be interrupted by a
domain-only proxy; reload or open a new tab to establish a fresh CONNECT.

The proxy is device-wide. When SOC and employee sessions use two browsers on
the same Windows computer, external traffic from both browsers and background
applications shares the same source device. Use a second VM/device for a clean
multi-user lab demonstration; the AFFERENT dashboard itself can stay in the
localhost/Tailscale proxy-bypass list.

Some long-running desktop applications cache the system proxy setting until
they are restarted. After Windows proxy is switched off, Squid may therefore
still see those requests. Because they genuinely traverse Squid, they remain
visible in the SOC feed; device binding enriches attribution but is not a
static access whitelist.

## Bridged Kali VM demo

The employee VM address is never configured in AFFERENT. It may change between
boots. On the Windows host, set these values in `.env`:

```dotenv
WEB_BIND_IP=0.0.0.0
PROXY_BIND_IP=0.0.0.0
```

Open the dashboard from Kali with the Windows host LAN address, for example
`http://HOST_LAN_IP:3000`, and configure Kali's HTTP/HTTPS proxy as
`HOST_LAN_IP:3128`. Add that exact dashboard origin to `ALLOWED_ORIGINS`.
`/api/config` derives the browser-facing API/proxy hostname from the incoming
dashboard request, so no employee VM IP is hardcoded. Limit TCP 3000, 5000,
and 3128 to the private bridged subnet using Windows Firewall.
