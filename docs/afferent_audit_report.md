# AFFERENT PLATFORM — FULL CODEBASE AUDIT

> **Date:** 2026-09-24  
> **Scope:** Trust code, not README. No modifications during this pass.  
> **Repo:** `c:\Human_Firewall`

---

## 1. ACTUAL CURRENT ARCHITECTURE

### What actually runs

```
┌──────────────────────────────────────────────────────────────┐
│                    docker-compose.yml                        │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  dashboard (Next.js 16 / React 19 / TailwindCSS 4)           │
│    └── :3000  BFF + SSR pages                                │
│        ├── /auth          email+password+OTP login           │
│        ├── /dashboard/    soc | ciso | grc | phishing-admin  │
│        ├── /admin         unified admin                      │
│        └── /api/*         15 BFF proxy routes → flask_api    │
│                                                              │
│  flask_api (Flask 3 / Python / SQLite + PostgreSQL + Redis)  │
│    └── :5000                                                 │
│        ├── Blueprints: auth, events, incidents, admin_api,   │
│        │   gamification, threat, proxy, ai                   │
│        ├── Services: auth_service, proxy_service,            │
│        │   proxy_store, threat_service, email_service        │
│        ├── AI: ai_router (Groq→OpenRouter→Gemini failover),  │
│        │   ai_analysis, ai_prompts, ai_cache, ai_telegram    │
│        └── SQLite: instance/human_firewall.db                │
│                                                              │
│  n8n  (:5678)  — workflow orchestrator                       │
│    ├── flow-a.json: GoPhish click → Telegram teachable       │
│    └── flow-b.json: Telegram report → VT/urlscan → SOC       │
│                                                              │
│  gophish  (:3333 admin, :8080 landing pages)                 │
│                                                              │
│  centralized_proxy (Squid ssl-bump → flask decision API)     │
│    └── :3128                                                 │
│                                                              │
│  proxy_postgres (PostgreSQL 17 — proxy verdicts/audit)       │
│  proxy_redis (Redis 7 — verdict cache / pubsub)              │
│  mailpit (local SMTP :8025 web inbox)                        │
│                                                              │
└──────────────────────────────────────────────────────────────┘

External:
  - Telegram Bot (@Afferent1_bot)
  - VirusTotal API v3
  - urlscan.io API
  - LLM providers: Groq / OpenRouter / Google Gemini
  - Firecrawl (optional, for AI template generation)
  - Cloudflare / Pinggy tunnel for webhook ingress
```

### Real data flow (from code)

```
FLOW A — Phishing Simulation Telemetry:
  GoPhish campaign → employee clicks link
    → /redirect-handler (Flask events.py)
      → record_event() in SQLite
      → classify_tier() (first-timer / repeat / chronic)
      → notify_n8n() fire-and-forget POST
      → render tier1.html (teachable moment) or tier2.html (fake login)
    → /api/fake-login-submit
      → record_event(submitted_data)
      → adjust_points(-20 credential_leak)
      → notify_n8n()
  n8n flow-a.json → Telegram notification to SOC + user

FLOW B — Employee Threat Report:
  Employee sends URL/file to Telegram bot
    → n8n flow-b.json receives message
    → POST /api/threat/analyze (Flask)
      → threat_service.analyze_indicator()
        → check threat_cache (SQLite)
        → if miss: VT API + urlscan.io API
        → merge_analysis() → policy.evaluate()
        → save_threat_cache()
        → if block: create incident + notify n8n
    → n8n sends Telegram reply with verdict
    → POST /api/incidents (Flask)
      → create incident ticket
      → award_points_for_report() if confirmed malicious
      → create_threat_report() for gamification tracking
```

### Database schema (actual SQLite tables)

| Table | Purpose | Status |
|-------|---------|--------|
| `user_history` | Employee behavioral profile (points, badge, click_count, streak, training) | ✅ Active, heavily used |
| `events` | Raw event log (clicked_link, submitted_data, viewed_training, quiz) | ✅ Active |
| `incidents` | Security incidents (ticket_id, source_type, VT/urlscan verdicts) | ✅ Active |
| `threat_cache` | Cached VT/urlscan results with TTL | ✅ Active |
| `threat_reports` | Per-report tracking for gamification dedup | ✅ Active |
| `daily_events` | Daily quiz completion tracking (streak) | ✅ Active |
| `employee_accounts` | Auth accounts (email, argon2 password_hash, role, OTP) | ✅ Active |
| `otp_challenges` | Login OTP challenges | ✅ Active |
| `auth_sessions` | Token-based sessions | ✅ Active |
| `login_audit` | Authentication audit log | ✅ Active |
| `simulation_campaigns` | Local campaign tracking (mirrors GoPhish) | ✅ Active |
| `quiz_questions` | 30 seeded quiz questions (Indonesian) | ✅ Active |
| `readiness_thresholds` | ISO 27001 / UU PDP compliance thresholds | ✅ Active |
| `divisions` | Organizational divisions | ✅ Active |
| `inbox_emails` | Mock webmail inbox for simulation | ✅ Active |
| `link_tokens` | Telegram deep-link tokens | ⚠️ Legacy (Telegram auth retired) |
| `dashboard_tokens` | Personal dashboard access tokens | ⚠️ Legacy |
| `registration_otp` | Telegram OTP registration | ⚠️ Legacy (retired) |

**PostgreSQL** (separate — proxy data plane only):
- `proxy_devices`, `proxy_verdicts`, `proxy_alerts`, `proxy_traffic`, `proxy_audit`, `ml_events` — all managed by [proxy_store.py](file:///c:/Human_Firewall/backend/services/proxy_store.py)

**Redis**: Verdict caching, scan locks, idempotency, pubsub for SSE alerts.

### RBAC roles (from code)

| Role | Access |
|------|--------|
| `employee` | Personal dashboard, quiz, spot-the-fake, proxy device registration |
| `phishing_admin` | GoPhish campaigns, templates, employee CRUD, leaderboard |
| `soc` | Threat feed, proxy decisions, manual block/allow, AI summaries |
| `grc` | Compliance summary, readiness thresholds |
| `ciso` | All of the above (read-mostly) |

---

## 2. IMPLEMENTED vs. ASPIRATIONAL FEATURES

### ✅ Fully Implemented (code exists, wired, tested)

| Feature | Evidence |
|---------|----------|
| Phishing simulation orchestration (GoPhish + n8n + Flask) | [events.py](file:///c:/Human_Firewall/backend/routes/events.py), [admin_api.py](file:///c:/Human_Firewall/backend/routes/admin_api.py), [gophish_client.py](file:///c:/Human_Firewall/backend/gophish_client.py) |
| Tiered teachable moment (tier1 micro-education, tier2 fake login) | [events.py L99-179](file:///c:/Human_Firewall/backend/routes/events.py#L99-L179), templates/ |
| Employee behavioral scoring (points 0-200, Sentinel/Guardian/Vulnerable) | [database.py L700-768](file:///c:/Human_Firewall/backend/database.py#L700-L768) |
| Threat analysis via VT + urlscan with caching | [integrations.py](file:///c:/Human_Firewall/backend/integrations.py), [threat_service.py](file:///c:/Human_Firewall/backend/services/threat_service.py) |
| Incident ticket creation and lifecycle | [incidents.py](file:///c:/Human_Firewall/backend/routes/incidents.py) |
| Email+password+OTP authentication (Mailpit for dev) | [auth.py](file:///c:/Human_Firewall/backend/routes/auth.py), [auth_service.py](file:///c:/Human_Firewall/backend/services/auth_service.py) |
| Server-side RBAC (5 roles, deny-by-default) | [security.py](file:///c:/Human_Firewall/backend/security.py), `@require_roles` decorator |
| Gamification (daily quiz, streak, badges, dedup, leaderboard) | [gamification_routes.py](file:///c:/Human_Firewall/backend/gamification_routes.py), [database.py L893-1200](file:///c:/Human_Firewall/backend/database.py#L893-L1200) |
| 2D Adaptive Policy Engine (threat severity × user tier) | [policy.py](file:///c:/Human_Firewall/backend/policy.py) |
| AI behavioral analysis (batch classify, per-user, org reports) | [ai_routes.py](file:///c:/Human_Firewall/backend/routes/ai_routes.py), [ai_router.py](file:///c:/Human_Firewall/backend/ai_router.py) |
| Agentic AI Investigator (multi-turn tool-calling loop, 5 iterations) | [ai_routes.py L338-525](file:///c:/Human_Firewall/backend/routes/ai_routes.py#L338-L525) |
| AI-generated phishing templates with Firecrawl scraping | [ai_routes.py L536-705](file:///c:/Human_Firewall/backend/routes/ai_routes.py#L536-L705) |
| Multi-provider LLM failover (Groq → OpenRouter → Gemini) | [ai_router.py](file:///c:/Human_Firewall/backend/ai_router.py) |
| Centralized forward proxy (Squid ssl-bump + decision API) | [proxy_service.py](file:///c:/Human_Firewall/backend/services/proxy_service.py), [proxy.py](file:///c:/Human_Firewall/backend/routes/proxy.py), [squid.conf](file:///c:/Human_Firewall/proxy/squid.conf) |
| ML webhook integration for proxy verdicts | [proxy_service.py L290-354](file:///c:/Human_Firewall/backend/services/proxy_service.py#L290-L354) |
| SOC real-time alert stream (SSE via Redis pubsub) | [proxy.py L198-219](file:///c:/Human_Firewall/backend/routes/proxy.py#L198-L219) |
| Next.js dashboard with 4 role-based views | [dashboard/src/app/dashboard/](file:///c:/Human_Firewall/dashboard/src/app/dashboard) |
| GRC/Compliance readiness against ISO 27001 + UU PDP | [admin_api.py L69-103](file:///c:/Human_Firewall/backend/routes/admin_api.py#L69-L103) |
| GoPhish simulation link detection in threat reports | [threat_service.py L9-66](file:///c:/Human_Firewall/backend/services/threat_service.py#L9-L66) |

### ⚠️ Partially Implemented

| Feature | Status |
|---------|--------|
| n8n-to-Flask incident webhook (`N8N_INCIDENT_WEBHOOK`) | Env var not set in .env; `send_to_n8n()` silently no-ops |
| ML Scanner integration | Code exists but `ML_SCANNER_URL` is empty; always returns "unknown" |
| Telegram AI reply (`ai_telegram.py`) | Module exists (6.7KB) but unclear if actively wired — n8n handles most Telegram interaction |
| Mock Webmail inbox delivery | `inbox_emails` table exists, `create_simulation_campaign` seeds emails, but no standalone inbox UI found |
| Proxy feature | `PROXY_FEATURE_ENABLED=false` in `.env` (but `true` in docker-compose for flask_api) — conflicting config |

### ❌ Not Implemented (documentation only or zero code)

| Feature | Where mentioned | Code evidence |
|---------|----------------|---------------|
| **Wazuh integration** | Project Desc docs, UI comment "WAZUH / CROWDSTRIKE STYLE" | Zero code. No API client, no agent, no syslog ingest. Pure aspirational. |
| **Shuffle SOAR** | README_profile.md badge | Zero code. Referenced only in another project's description. |
| **Endpoint telemetry correlation** | Conceptual architecture | No correlation engine exists. No IOC extraction pipeline. No endpoint query. |
| **Affected-users/endpoints discovery** | Hypothesis | No graph/correlation data structure. Incidents are isolated tickets. |
| **Reporter feedback loop** | Desired flow | Partial: Telegram gets verdict reply via n8n, but no structured "your report led to X" feedback. |
| **PostgreSQL for main data** | Mentioned in docs | PostgreSQL is only for proxy data plane. Main app is SQLite. |

---

## 3. TECHNICAL DEBT

### 🔴 Critical

| Issue | Location | Impact |
|-------|----------|--------|
| **Auth bypass bug** — Dead code after early return. Lines 130-141 in app.py: `if is_local_development() and env_flag('DEV_BYPASS_AUTH'): return` — the `return` on L131 causes the **entire** service-auth block and redirect logic (L133-141) to be **unreachable dead code**. When `DEV_BYPASS_AUTH=false`, non-public routes with no session AND no service key fall through to the view function **unauthenticated**. | [app.py L130-141](file:///c:/Human_Firewall/backend/app.py#L130-L141) | **Any API route is accessible without auth when DEV_BYPASS_AUTH=false and no session exists (except for routes using @require_roles explicitly).** Service-to-service auth is dead. |
| **Secrets committed to Git** — `.env` contains real API keys (OpenRouter, Groq, VirusTotal, urlscan, Telegram bot token, GoPhish API key, admin password) in plaintext. File is 6KB with live credentials. | [.env](file:///c:/Human_Firewall/.env) | Full compromise of all external integrations. Telegram bot takeover. GoPhish admin access. |
| **3241-line database.py** — Single file with all SQLite operations, 50+ functions, migrations, seed data, quiz questions, compliance calculations, gamification logic, dashboard summary generation. | [database.py](file:///c:/Human_Firewall/backend/database.py) (143KB) | Unmaintainable. Any change risks breaking unrelated features. |
| **Proxy config conflict** — `.env` says `PROXY_FEATURE_ENABLED=false` but docker-compose overrides to `true` for flask_api. Flask startup will fail locally without PostgreSQL/Redis. | [.env L118](file:///c:/Human_Firewall/.env#L118) vs [docker-compose L171](file:///c:/Human_Firewall/docker-compose.yml#L171) | Prevents local development without Docker |

### 🟡 Moderate

| Issue | Location |
|-------|----------|
| SQLite for production — no WAL mode configured, no connection pooling, `get_connection()` called per-operation (not per-request), connections may leak on exception paths | [database.py L45-54](file:///c:/Human_Firewall/backend/database.py#L45-L54) |
| 47 one-off fix/audit scripts in `scratch/` including 3 SQLite database copies (29.4MB total) | [scratch/](file:///c:/Human_Firewall/scratch) |
| n8n workflow JSON files (flow-a: 8KB, flow-b: 45KB) are opaque, fragile, and not version-controlled meaningfully — modifications require the n8n UI | [n8n-workflows/](file:///c:/Human_Firewall/n8n-workflows) |
| `malicious-pdf/` is a vendored third-party tool (143KB single Python file with its own `.git`) — unrelated to core product | [malicious-pdf/](file:///c:/Human_Firewall/malicious-pdf) |
| `gophish_client.py` uses `verify=True` by default but GoPhish runs self-signed certs — requests will fail unless CA is explicitly configured | [gophish_client.py L23](file:///c:/Human_Firewall/backend/gophish_client.py#L23) |
| Inconsistent formatting — `integrations.py` has double-spaced lines (331 lines, could be ~160), `threat.py` has inconsistent indentation | Various files |
| `dashboard/page.tsx` is 85KB — entire landing page in one component file | [page.tsx](file:///c:/Human_Firewall/dashboard/src/app/page.tsx) |

### 🟢 Low

| Issue |
|-------|
| Legacy tables (`link_tokens`, `dashboard_tokens`, `registration_otp`) still created on every startup but unused |
| `mock_ml_service.py` and `start_webhook.py` at repo root — unorganized utility scripts |
| `logger` used in `admin_api.py` but never imported (will crash on first GoPhish API error) |
| Two `replace-emp.js` / `replace.js` scripts in dashboard root — one-off migration artifacts |

---

## 4. STRONGEST PRODUCT / RESEARCH HYPOTHESIS

### What Afferent is genuinely good at today

1. **Phishing simulation → behavioral telemetry loop**: The GoPhish → tiered teachable moment → points/badges → leaderboard pipeline is complete and well-designed. The simulation detection in threat reports (employee reports their own simulation email → system recognizes it) is a clever touch.

2. **Employee threat reporting via Telegram**: Flow B genuinely works — employee sends a suspicious URL → VT + urlscan enrichment → incident ticket → points awarded. This is real, differentiated value for SMEs that don't have a SOC.

3. **2D Adaptive Policy Engine**: The concept of combining threat severity with employee vulnerability tier for access decisions is architecturally novel, even if the proxy enforcement path is incomplete.

### What is commodity / already solved

| Feature | Existing vendors |
|---------|-----------------|
| Phishing simulation + training | KnowBe4, Proofpoint, Cofense, Hoxhunt |
| Employee security awareness gamification | KnowBe4, Hoxhunt |
| VT/urlscan lookup | Literally any SOC tool, or a 10-line script |
| LLM-powered threat analysis narrative | Microsoft Copilot for Security, Google SecOps Gemini, Splunk AI |
| RBAC dashboards | Every SIEM |

### The strongest credible differentiation

The README hypothesis is partially right but needs correction:

> ❌ "Employee-originated phishing reports and machine-generated endpoint telemetry can be correlated to discover additional affected users/endpoints"

This is **not implemented at all**. There is zero Wazuh code, zero endpoint telemetry ingest, zero correlation engine.

> ✅ **What IS actually differentiating** in the current code:

**The bidirectional feedback loop between simulation behavioral data and real threat response quality, scored per-employee and used for adaptive policy enforcement.**

Specifically:
1. Employee's simulation behavior (click rate, training completion, quiz streak) → behavioral tier
2. Employee's real-world threat reports → verified by VT/urlscan → points/badges
3. Behavioral tier + threat severity → adaptive proxy blocking decisions
4. This creates a **measurable, closed-loop human risk score** that feeds into network policy

**No vendor does all four of these together.** KnowBe4 does 1. Cofense Triage does 2. CrowdStrike does proxy. Nobody feeds employee simulation performance back into real-time network access decisions.

### Is the correlation hypothesis technically feasible?

**With the current codebase: No.** There is no:
- Wazuh agent or SIEM ingest
- IOC extraction from threat reports (URLs are stored as strings, not parsed into domains/IPs/hashes)
- Graph or correlation data structure
- Query interface for "find all endpoints that visited domain X"
- Time-window correlation logic

**Architecturally: Yes, but it requires new components**, not just wiring existing ones.

### What existing components can be reused

| Component | Reusable for correlation experiment? |
|-----------|-------------------------------------|
| `threat_cache` table (indicator, verdict, scores) | ✅ IOC source — already stores enriched indicators |
| `threat_service.analyze_indicator()` | ✅ Enrichment pipeline — VT + urlscan already working |
| `incidents` table | ✅ Could be extended with `affected_entities` column |
| `policy.evaluate_2d()` | ✅ Decision engine — could incorporate correlation results |
| SQLite | ❌ Wrong for time-series endpoint telemetry. Need Wazuh's index or PostgreSQL with partitioning. |
| n8n | ⚠️ Possible as orchestrator, but fragile for complex correlation logic |
| Proxy decision engine | ✅ Already has verdict→block pipeline via PostgreSQL/Redis |
| AI router | ✅ Could generate natural-language investigation summaries from correlated data |

---

## 5. MINIMUM EXPERIMENT ARCHITECTURE

### Goal
Test ONE hypothesis: **Does correlating employee-reported IOCs with Wazuh endpoint logs reveal additional affected users that manual SOC investigation would miss?**

### Smallest testable system

```
phishing report (Telegram or dashboard)
        ↓
  [EXISTING] threat_service.analyze_indicator()
        → VT + urlscan enrichment
        ↓
  [NEW] IOC extractor
        → extract domains, IPs, file hashes from reported URL/file
        ↓
  [NEW] Wazuh query client
        → search Wazuh alerts/archives for IOC matches
        → time window: -24h to +4h from report timestamp
        ↓
  [NEW] correlation engine
        → match Wazuh agent IDs → employee email/device mapping
        → deduplicate against known reporter
        ↓
  [EXISTING + EXTEND] incident creation
        → attach affected_entities[] to incident
        → create child tickets for each additional affected user
        ↓
  [EXISTING] SOC dashboard
        → show original report + correlated entities
        ↓
  [NEW] reporter feedback
        → POST to Telegram: "Your report helped identify 3 other affected users"
```

### What to build (in order)

| # | Component | Effort | Depends on |
|---|-----------|--------|------------|
| 1 | `ioc_extractor.py` — Parse URL into domain, IP, path. Parse file hash. | 1 day | Nothing |
| 2 | `wazuh_client.py` — Query Wazuh REST API `/alerts` by IOC. | 2 days | Running Wazuh instance |
| 3 | `correlation_engine.py` — Match Wazuh results to employee registry. | 2 days | #1, #2 |
| 4 | Extend `incidents` schema — Add `affected_entities JSON`, `correlation_source TEXT` | 0.5 day | Nothing |
| 5 | Extend `create_incident()` — Accept correlated entities, create linked tickets | 1 day | #3, #4 |
| 6 | Reporter feedback Telegram message | 0.5 day | #5 |
| 7 | Synthetic ground truth via GoPhish — Run campaign, collect IOCs, verify correlation recall | 2 days | #1-#6 |

**Total: ~9 working days to minimum testable experiment.**

### What NOT to build for this experiment

- New dashboard pages (existing SOC dashboard can show incidents)
- PostgreSQL migration for main app
- FastAPI rewrite
- Kubernetes
- New AI features
- Frontend redesign

---

## 6. METRICS

| Metric | How to measure | Baseline |
|--------|---------------|----------|
| Additional affected entities discovered per report | Count of `affected_entities` with status `new_discovery` per incident | 0 (not implemented yet) |
| Correlation recall | (IOCs matched by correlation ÷ total IOCs present in Wazuh) using GoPhish synthetic ground truth | Unknown |
| Correlation precision | (True positives ÷ total correlation matches) | Unknown |
| Manual investigation steps saved | A/B: count SOC analyst clicks/queries with vs. without correlated context | Need baseline observation |
| Report → verdict latency | `incidents.created_at - threat_reports.submitted_at` | Already measurable from existing data |
| Report → feedback latency | `feedback_sent_at - threat_reports.submitted_at` | Currently: no structured feedback |
| Report → SOC incident latency | `incidents.created_at - threat_reports.submitted_at` | Already measurable |

### GoPhish as synthetic ground truth

1. Launch campaign targeting 10 employees
2. 3 employees click → logged in `events` table with exact timestamps
3. 1 employee reports the link via Telegram → triggers Flow B
4. IOC extractor pulls domain from reported URL
5. **Expected**: Correlation should find the 3 other clickers in Wazuh logs (if Wazuh agent is monitoring their web traffic)
6. **Measured**: Did correlation find 3? 2? 0?

---

## 7. IMPLEMENTATION PRIORITIES — EXPLICIT DECISIONS

| Decision | Verdict | Rationale |
|----------|---------|-----------|
| **Flask → FastAPI rewrite** | ❌ NO | Flask works. The bottleneck is missing features, not framework overhead. Rewrite buys nothing measurable. |
| **SQLite → PostgreSQL (main app)** | ❌ NOT NOW | SQLite handles current scale. Proxy already uses PostgreSQL. Migrate only when concurrent writes become a measured problem or when Wazuh correlation data volume demands it. |
| **Wazuh integration** | ✅ YES — #1 priority | This is THE missing capability for the differentiation hypothesis. Without it, there is no correlation, and the product is just another phishing dashboard. |
| **Shuffle integration** | ❌ NO | n8n already handles orchestration. Adding Shuffle adds complexity without solving any identified bottleneck. |
| **n8n removal** | ❌ NOT NOW | Flow A and Flow B work. Replacing n8n means rewriting Telegram webhook handling and VT/urlscan orchestration in Python. Do this only if n8n becomes the measured bottleneck for correlation latency. |
| **Frontend rewrite** | ❌ NO | Dashboard exists and works. The experiment needs backend correlation, not new UI. |
| **Additional AI** | ❌ NOT NOW | AI behavioral analysis already exists. The experiment needs data infrastructure, not more LLM calls. Could add AI-generated investigation summaries AFTER correlation works. |
| **Gamification** | ❌ NO | Already extensive. Not related to the correlation hypothesis. |
| **New dashboards** | ❌ NO | Extend existing SOC dashboard with `affected_entities` display instead. |
| **Kubernetes/microservices** | ❌ NO | docker-compose works for this scale. Zero evidence of scaling bottleneck. |
| **Fix the auth bypass bug** | ✅ YES — immediate | [app.py L130-141](file:///c:/Human_Firewall/backend/app.py#L130-L141) — dead code after early return makes service auth and redirect unreachable. Must fix before any production deployment. |
| **Remove committed secrets** | ✅ YES — immediate | Rotate all keys in `.env`, add to `.gitignore` properly, use Docker secrets or env injection. |

---

## 8. EXACT IMPLEMENTATION SEQUENCE

### Phase 0: Fix Critical Bugs (Days 1-2)

1. **Fix auth bypass in `app.py`**: The `return` on L131 makes L133-141 unreachable. The service auth check and redirect-to-login logic is dead code. Restructure the `if` block.
2. **Rotate all committed secrets**: Every key in `.env` is compromised. Regenerate: OpenRouter, Groq, VT, urlscan, Telegram bot, GoPhish, admin password, service API key, SECRET_KEY.
3. **Verify `.gitignore`**: Confirm `.env` is listed and no secrets directory is tracked.

### Phase 1: IOC Extraction + Wazuh Client (Days 3-7)

4. Create `backend/services/ioc_extractor.py`:
   - Input: URL string or file hash
   - Output: `{domains: [], ips: [], hashes: [], urls: []}`
   - Parse with `urllib.parse`, extract domain, resolve IPs
5. Create `backend/services/wazuh_client.py`:
   - Query Wazuh REST API: `GET /alerts?q=data.url:"{domain}"` or `rule.groups:web`
   - Time-bounded search: report_timestamp ± configurable window
   - Return: list of `{agent_id, agent_name, timestamp, rule_id, matched_ioc}`
6. Add `.env` vars: `WAZUH_API_URL`, `WAZUH_API_USER`, `WAZUH_API_PASSWORD`
7. Add Wazuh to `docker-compose.yml` or document external Wazuh connection

### Phase 2: Correlation Engine (Days 8-11)

8. Create `backend/services/correlation_engine.py`:
   - Input: IOCs from step 4 + Wazuh results from step 5
   - Cross-reference `agent_name` / `agent_ip` with `employee_accounts.email` or `user_history.email` via a device mapping table
   - Deduplicate: exclude the original reporter
   - Output: `{affected_entities: [{email, device, evidence_summary, confidence}]}`
9. Extend `incidents` table schema:
   - `ALTER TABLE incidents ADD COLUMN affected_entities TEXT` (JSON)
   - `ALTER TABLE incidents ADD COLUMN correlation_source TEXT`
   - `ALTER TABLE incidents ADD COLUMN parent_ticket_id TEXT`
10. Extend `create_incident()` to accept and store correlated entities

### Phase 3: Wire Into Existing Flows (Days 12-14)

11. Modify `threat_service.analyze_indicator()`:
    - After enrichment, call `ioc_extractor.extract(indicator)`
    - Call `wazuh_client.search(iocs, time_window)`
    - Call `correlation_engine.correlate(wazuh_results, reporter_email)`
    - Pass `affected_entities` to incident creation
12. Add reporter feedback:
    - After incident creation with affected_entities > 0
    - POST to Telegram: structured message showing impact
13. Extend SOC dashboard:
    - Show `affected_entities` count on incident cards
    - Drill-down to see correlated users/devices

### Phase 4: Synthetic Ground Truth Test (Days 15-17)

14. Launch GoPhish campaign with 10 target employees
15. Wait for clicks + at least 1 Telegram report
16. Verify correlation engine discovers the other clickers
17. Measure: recall, precision, latency metrics
18. Document results

---

## 9. WHAT TO KEEP

| Keep | Reason |
|------|--------|
| Flask + SQLite (main app) | Works. No measured bottleneck. |
| PostgreSQL + Redis (proxy) | Correctly separated for high-throughput decision path. |
| n8n (Telegram + VT/urlscan orchestration) | Works. Fragile but functional. |
| GoPhish integration | Essential for simulation + synthetic ground truth. |
| Gamification system | Complete. Good employee engagement mechanism. |
| 2D Policy Engine | Architecturally novel. Can incorporate correlation scores. |
| AI Router (multi-provider failover) | Solid. Well-engineered. |
| RBAC + OTP authentication | Solid. Well-engineered (aside from the bypass bug). |
| Centralized proxy (Squid + decision API) | Ambitious but functional architecture. |

| Remove / Refactor | Reason |
|-------------------|--------|
| `malicious-pdf/` submodule | Unrelated vendored tool. |
| `scratch/` (47 scripts + 3 SQLite DBs) | One-off debugging artifacts. Archive or delete. |
| Legacy tables (link_tokens, dashboard_tokens, registration_otp) | Dead code from retired Telegram auth. |
| `database.py` monolith | Split into modules when touching it for correlation. Not a standalone task. |
| Committed secrets | Immediate rotation required. |

---

## 10. FEATURE EVALUATION FRAMEWORK

For every proposed feature during implementation:

| Question | Must answer |
|----------|-------------|
| What bottleneck does it solve? | Identify the specific gap in the report→correlation→SOC pipeline |
| Who experiences it? | SOC analyst? Employee reporter? CISO? |
| Is it actually real? | Can you reproduce the bottleneck in the test environment? |
| Do existing tools already solve it? | Check Wazuh built-in correlation, Shuffle playbooks, MISP |
| What capability is missing? | Specify the exact function/API/data that doesn't exist |
| How will we measure improvement? | Pick from the metrics table in section 6 |

---

> **Summary**: Afferent is a well-built phishing simulation + employee behavioral scoring platform with a working VT/urlscan enrichment pipeline and an ambitious proxy enforcement architecture. Its strongest hypothesis — correlating employee reports with endpoint telemetry — has **zero implementation**. The minimum experiment requires ~17 working days and exactly 3 new backend modules (IOC extractor, Wazuh client, correlation engine) plus schema extensions. Fix the auth bypass bug and rotate committed secrets before anything else.
