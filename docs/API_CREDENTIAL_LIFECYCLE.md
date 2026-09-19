# AFFERENT API and Credential Lifecycle

This document is the source of truth for which integrations remain in the
staging and production architecture. Secret values must never be committed or
placed in a `NEXT_PUBLIC_*` variable.

## Production integration boundary

| Integration | Purpose | Staging | Production | Security boundary |
| --- | --- | --- | --- | --- |
| AFFERENT internal API | Next.js/n8n to Flask | Required | Required | `SERVICE_API_KEY` during transition; use a distinct value per environment |
| GoPhish Admin API | Campaign, template, page, and result management | Required | Required | TLS verification plus `GOPHISH_API_KEY`; never expose port 3333 publicly |
| SMTP | Email OTP and future notifications | Required from Phase 1 | Required | Dedicated service account, STARTTLS/TLS, least privilege |
| VirusTotal API v3 | Threat-intelligence evidence | Required from Phase 3 if approved | Optional but recommended | Advisory evidence only; never performs automatic blocking |
| urlscan.io API | URL-observation evidence | Required from Phase 3 if approved | Optional | URLs leave the institution; requires privacy/data-sharing approval |
| Groq API | Primary optional LLM for summaries and simulation content | Optional | Optional | Non-authoritative assistance only; never controls blocking |
| OpenRouter API | Optional LLM fallback | Optional | Optional | Use one environment-specific key, not a comma-separated pool |
| ML/DL verdict webhook | Receive evidence from the separate detection team | Required from Phase 4 | Required from Phase 4 | Inbound HMAC, timestamp, idempotency key, and schema version |
| Squid decision API | Domain-level enforcement lookup | Required from Phase 4 | Required from Phase 4 | Only an explicit SOC Block decision may enforce a block |
| n8n | Non-critical async work | Optional | Optional | Notifications, campaign automation, external sync, scheduled reports only |

Tailscale is a network transport for the lab, not an application API. Squid is
the forward proxy; its backend decision lookup is an internal AFFERENT API.

## Integrations to retire

| Integration | Decision | Removal phase |
| --- | --- | --- |
| Telegram Bot API | Remove from authentication and threat reporting | Phase 1 auth, Phase 3 reporting |
| Telegram SOC chat destination | Remove together with Telegram notifications | Phase 3 |
| Pinggy/trycloudflare development tunnel | Never use as a production dependency | Phase 5 |
| Google Gemini API | Do not provision for the target architecture; Groq/OpenRouter are sufficient | Phase 5 config cleanup |
| Firecrawl API | Keep disabled unless a reviewed scraping requirement exists | Phase 5 config cleanup |

## Credential disposition

| Secret/configuration | Current Phase 0 status | Target handling |
| --- | --- | --- |
| `SECRET_KEY` | Rotated locally | Separate value for staging and production; secret manager |
| `SERVICE_API_KEY` | Rotated locally and verified | Separate value per environment; later split by calling service |
| `ADMIN_PASSWORD` | Rotated locally | Transitional only; remove after Phase 1 SSO/RBAC |
| `TELEGRAM_WEBHOOK_SECRET` | Rotated locally | Remove in Phase 3 |
| `GOPHISH_API_KEY` | Rotated through GoPhish and verified | Secret manager; rotate on personnel/exposure events |
| `GOPHISH_ADMIN_PASSWORD` | Rotated through GoPhish | Human break-glass secret; not passed to containers |
| `N8N_ENCRYPTION_KEY` | Existing key persisted, not rotated | Back up securely; changing it requires a controlled credential migration |
| GoPhish server certificate/key | Lab CA certificate installed and verified | Replace with institutional PKI/secret-mounted certificate in staging/production |
| `VT_API_KEY` | Provider rotation still required | Separate provider key/project per environment where possible |
| `URLSCAN_API_KEY` | Provider rotation still required | Separate provider key/project per environment where possible |
| `GROQ_API_KEY` | Provider rotation required if the current key is real | Optional production AI primary |
| `OPENROUTER_API_KEY` | Provider rotation required if the current key is real | Optional production fallback |
| `GEMINI_API_KEY` | Revoke if real | Do not deploy in the target configuration |
| `FIRECRAWL_API_KEY` | Revoke if real and scraping is not approved | Do not deploy by default |
| SMTP password/token | Not provisioned yet | Create a dedicated account during Phase 1 |
| `ML_WEBHOOK_SECRET` | Not created yet | Create independently for staging and production in Phase 4 |

## Environment separation

1. Development, staging, and production must use different internal secrets,
   GoPhish API keys, SMTP credentials, and ML webhook secrets.
2. Production secrets belong in the deployment secret store, not `.env` files
   copied from a developer workstation.
3. `NEXT_PUBLIC_*` variables may contain public base URLs only. They must never
   contain API keys, passwords, session secrets, or webhook secrets.
4. VirusTotal/urlscan results are evidence. They must not bypass the SOC
   Block/Allow decision and its append-only audit log.
5. AI provider output is explanatory or assistive and must never be treated as
   an enforcement verdict.

## Remaining provider-account actions

These actions cannot be completed from the repository because they require the
owner account at each provider:

1. Revoke the exposed Telegram bot tokens in BotFather. If Telegram must remain
   temporarily available before Phase 3, create one replacement token and
   update the single retained n8n credential only.
2. Regenerate VirusTotal and urlscan.io keys, then update `.env` and recreate
   Flask/n8n. Do not reactivate any Flow B duplicate.
3. Rotate the n8n owner password and sign out existing editor sessions.
4. Rotate Groq/OpenRouter keys if those optional AI integrations are retained;
   revoke Gemini and Firecrawl keys if they are not retained.
5. Create the dedicated SMTP account only when Phase 1 EmailService is ready.

After any provider rotation, verify that the replacement works and that the old
credential returns an authentication error before marking the rotation done.
