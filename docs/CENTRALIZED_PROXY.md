# AFFERENT Centralized Proxy — Lab Architecture

## Outcome

The active proxy pipeline does not call VirusTotal or urlscan. Squid sends a
domain decision request to Flask. Redis provides the low-latency hot path;
PostgreSQL persists traffic, devices, verdicts, alerts, and append-only SOC
audit records.

Decision precedence is deterministic:

1. Active manual SOC block (including parent-domain policy)
2. Active manual SOC allow (trusted domain, audited whitelist)
3. Conclusive calibrated domain ML verdict: Block/Allow
4. Completed but inconclusive prediction: Allow/Unknown for SOC review
5. Pending, timeout, or unavailable prediction: temporary denial, no blacklist

A request is not forwarded while inference is pending. A model timeout is not
the same as a completed Unknown prediction: the former is denied temporarily,
the latter remains allowed for review under the agreed demo policy. SOC Block
always overrides ML and older/narrower SOC Allow entries. No `.com`/TLD bypass
is installed. The Decision API outage default is now `PROXY_FAIL_MODE=closed`.
An explicit `open` setting sacrifices the first-request enforcement guarantee.

Non-conclusive results are cached only for `PROXY_UNKNOWN_RETRY_SECONDS` to
avoid an ML request/alert storm while still retrying classification soon.

## Data path

```text
Employee device -> opaque TCP relay:3128 -> Squid (internal) -> Flask Decision API
                                    |-> Redis verdict/device lookup
                                    |-> PostgreSQL fallback/source of truth
                                    |-> Local domain ML / external HMAC ML (cache miss)
                                    |-> Redis Stream -> PostgreSQL traffic
                                    `-> Redis Pub/Sub -> SOC dashboard SSE

Relay controller -> internal enforcement/check -> committed PostgreSQL policy
               `-> close only live, previously allowed sockets now blocked
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
The request includes `inputScope: "domain"`; no fabricated full URL is sent.

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
- `POST /api/proxy/enforcement/check` — internal service only, 1..200 domains;
  read committed decisions without new scans/traffic events; not exposed by BFF
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

## Selective HTTPS denial and active revocation

The trusted AFFERENT CA is required **only to render an HTTPS denial page**.
Install the public certificate from `/api/proxy/ca.crt` in the employee test
browser/device; never distribute the CA private key. Use consenting managed
lab devices, not personal browsing without informed consent.

Allowed HTTPS is spliced: the browser receives the website's original
certificate and its payload stays encrypted end-to-end. Only a denied
connection is bumped locally to return `BLOCKED BY AFFERENT`. It is permanently
marked for denial and can never forward subsequent HTTP requests to the origin,
even if policy changes during that handshake. This is limited TLS interception
for the denial page, **not** a claim of zero TLS termination everywhere.

The relay reads the plaintext CONNECT authority, not TLS/application content.
The first-request ML gate uses that domain; HTTPS paths, search terms, passwords,
and cookies are neither model inputs nor persisted proxy telemetry. The block
template no longer prints raw request headers/cookies. Certificate-pinned
clients may reject the denial certificate and show a connection error instead.

Manual SOC policies are canonicalized by removing a leading `www.` and apply
to the canonical domain plus its subdomains. Typos remain distinct domains:
`yotube.com` does not and must not silently become `youtube.com`. A new HTTP
request or HTTPS CONNECT is evaluated without a Squid ACL cache. An opaque TCP
relay polls committed policy every `PROXY_REVOCATION_INTERVAL_SECONDS` (0.5 s
default), closing only previously allowed tunnels whose domain is now blocked.
The real bound includes API/network response time; it is not zero latency. A
denied handshake is not armed for revocation, so its page remains displayable.

After revocation, fresh navigation gets the blocking page when CA trust is
correct. A background search/video request can show an in-app/network error;
it cannot reliably replace the whole browser page with HTML. Already buffered
or cached content cannot be withdrawn. Domains sharing a CDN IP are not killed
together. Internal Squid ports 3129/3130 bind to container loopback only. The
PROXY protocol preserves client addresses; no NET_ADMIN, privileged container,
host networking, or Docker socket is required.

## Local domain model and evaluation

`ML_SCANNER_URL` empty + `ML_LOCAL_ENABLED=true` selects
`backend/models/domain_v3`, including the generated-hostname abstention guard.
Original Char-BiLSTM remains an offline experiment; employee URL checks now use
VT/urlscan and do not enforce proxy policy. URL-trained thresholds are not reused
on hostnames. VirusTotal/urlscan remain outside the proxy ML path. See
[evaluation notes](DOMAIN_ML_EVALUATION.md) and
[manifest](../backend/models/domain_v3/manifest.json).

High blocking precision is not high overall accuracy/recall. This is a
conservative demo baseline, not a pornography classifier or a guarantee
against every malicious website.

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
