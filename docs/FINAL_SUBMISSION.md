# Hackathon submission readiness

Release scope: private lab/demo for 5–8 users. This document is the current
submission entry point; earlier audit/debt milestones are historical, not a
promise that every proposed feature is active.

## What judges can demonstrate

- Email/password + OTP through Mailpit; server-derived roles and HTTP-only session cookies.
- Administrator creates employee/SOC/GRC/CISO accounts and launches authorized
  GoPhish simulations. Built-in credential-free awareness material or optional
  Firecrawl static clone; education redirect and deduplicated scoring.
- Employee connects an OS/browser explicit proxy. Genuine traversing traffic is
  visible to SOC through SSE; manual domain Block/Allow is enforced and audited.
- Allowed HTTPS remains opaque. Denied HTTPS can display the branded page when
  the employee trusts the lab CA. Cached content and AJAX are not magically replaced.
- Employee Scan URL and Report a link use VT/urlscan evidence; only link reports
  enter the SOC inbox. Provider failures/quotas are reported, not called safe.
- Private Scan file accepts any nonempty format up to 10 MB with upload consent;
  VT warnings appear to the employee, never SOC, scores or proxy blocklist.
- SOC/GRC approve educational email only for eligible low-score active employees.
  Mailpit is the destination, not an external SMTP/Gmail delivery service.
- Optional local LLM advice stays advisory; it cannot write enforcement policy.

## Repository hygiene

- Local ENV, databases, CA material, caches, merged LLM weights and training
  scratch outputs are excluded from Git. Existing local files/volumes are preserved.
- Removed unused debug page/scanner/sidebar/mock seed store, fake policy fallback, obsolete
  tool bundles, duplicate Tranco cache and tracked machine-specific proxy CA.
  Tool bundles/one-off scripts are out of the working tree and locally recoverable
  in ignored `secrets/submission-recovery/unused-local-files/`; Git retains prior source.
  Superseded planning and readiness documents are grouped under `archive/planning/`.
- Credential-bearing handoffs were replaced with safe pointers. Ignored recovery
  copies are server-owner-only and must not be distributed.
- Runtime `backend/models/domain_v3` and original dataset/model evidence are kept.
  At Daf's request, the final local code is authoritative. The team's last offline
  experiment push is retained in Git history, not added to the final working tree.
- `node scripts/check_submission.cjs` rejects known token formats, matching local
  credentials, generated/private paths and GitHub-oversized files. It is a bounded
  guard, not proof of a secret-free history or a penetration test.

## Repeatable checks

From the repo root:

```sh
node scripts/check_submission.cjs
python scripts/test_setup_lab.py
docker compose config --quiet
docker compose build
```

For backend checks, use the built image and mount the current source read-only.
Each command uses temporary SQLite data and mocked providers, with networking off:

```sh
docker run --rm --network none --entrypoint python --mount "type=bind,src=ABSOLUTE_REPO_PATH/backend,dst=/checks,readonly" --workdir /checks -e PYTHONDONTWRITEBYTECODE=1 human_firewall-flask_api -m unittest test_security_reports test_technical_debt test_mailpit_warning test_review_fixes test_proxy_gate
docker run --rm --network none --entrypoint python --mount "type=bind,src=ABSOLUTE_REPO_PATH/backend,dst=/checks,readonly" --workdir /checks -e PYTHONDONTWRITEBYTECODE=1 human_firewall-flask_api -m unittest test_campaign_fixes
docker run --rm --network none --entrypoint python --mount "type=bind,src=ABSOLUTE_REPO_PATH/backend,dst=/checks,readonly" --workdir /checks -e PYTHONDONTWRITEBYTECODE=1 human_firewall-flask_api -m unittest test_phase1_auth
docker run --rm --network none --entrypoint python --mount "type=bind,src=ABSOLUTE_REPO_PATH/backend,dst=/checks,readonly" --workdir /checks -e PYTHONDONTWRITEBYTECODE=1 human_firewall-flask_api -m unittest test_local_suite
docker run --rm --network none --entrypoint python --mount "type=bind,src=ABSOLUTE_REPO_PATH/backend,dst=/checks,readonly" --workdir /checks -e PYTHONDONTWRITEBYTECODE=1 human_firewall-flask_api -m unittest test_threat_scan_daily_cap
```

If your Compose project name changes, substitute its Flask image name. Run these
groups separately: several older suites set module-level test environments.
Do not run runtime PostgreSQL tests against the live demo database; use a separate
test database. Historical DL classifier tests are experimental model checks, not
the current VT/urlscan employee API contract.

From `dashboard/`: `npm ci`, `npm run lint`, `npm test`, `npm run build`.
Proxy protocol checks and synthetic hostname mappings are in
[selective TLS runbook](SELECTIVE_TLS_DEMO.md).

## Verification record — 3 October 2026

- Full dashboard ESLint: zero errors/warnings. Intentional browser hydration and
  request-initialization effects have narrow, explained exceptions, not global rule disabling.
- Three frontend regression scripts: private file UI/BFF and manual SOC decisions,
  including retired policy writes and honest backend-unavailable policy response.
- 55 backend checks passed: 29 report/warning/review/proxy-gate, 9 campaign,
  3 OTP/auth, 11 legacy/RBAC/telemetry and 3 daily reward-limit checks.
- Fresh-clone ENV tests: 2 passed; existing configuration is never overwritten.
  Disposable Docker PKI generation and GoPhish chain/hostname verification passed.
- Four selective-TLS protocol checks and the offline block-page renderer passed.
- Production-only npm audit: zero reported vulnerabilities after the Next.js patch.
- All buildable Compose images built successfully. The patched dashboard production
  build passed with TypeScript checks; the unused debug route is absent.
- All 10 running services, including the optional local LLM, reported healthy after
  the final image activation. Existing database volumes and CA material were preserved.

The dashboard uses Next.js 16.3.8, including the fix for the critical
[ImageResponse advisory](https://github.com/advisories/GHSA-vcvr-r3jv-pc5j).
Build-time lint tooling still has the unpatched
[braces recursion advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm);
development dependencies are pruned from the running dashboard image. This is
not a claim that every dependency has passed a comprehensive security audit.

These are automated checks, not a replacement for Daf's two-device browser demo.
Real cloud scans consume quota and share submitted files/URLs with providers;
automated tests do not upload confidential files or contact malicious sample sites.

## Must verify manually before presenting

- Follow [host + VM runbook](DEMO_VM_SOC.md): role-separated OTP login, proxy ON/OFF,
  genuine SSE traffic, SOC Block/Allow, trusted-CA fresh HTTPS denial and audit.
- Launch a demo campaign to Mailpit, follow its harmless form to education, and
  confirm one-time scoring. No genuine passwords should be entered or captured.
- Check link-report review and private file warnings with non-confidential samples.
  Unknown is inconclusive. Check approved low-score warnings in Mailpit.
- Rotate exposed historical provider credentials. The active VT and urlscan keys
  matched an old tracked handoff during this cleanup; deleting the latest file
  does not revoke the keys or erase old commits. Revoke Telegram tokens and any
  other exposed optional-provider keys as well. No Git history rewrite/force push
  is performed by this release.
- Review dataset origin/license and pitch claims. A supplied label is not verified
  ground truth. Do not claim category completeness, regulatory certification,
  zero false positives or production readiness. Local fine-tune candidates failed
  their promotion gates; the active baseline is described in the evaluation docs.

Pitch preparation: [PITCH_DECK_HANDOFF.md](PITCH_DECK_HANDOFF.md).
Local credentials, CA private keys and captured Mailpit inboxes never belong in
screenshots, the video, shared ZIP files or the hackathon portal.
