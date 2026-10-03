# AFFERENT — Human-Centric Telemetry Security

Lab/demo platform for 5–8 users: email/password + OTP, phishing awareness,
employee reporting, and SOC-controlled proxy monitoring. This checkout is not
a claim of production readiness or regulatory certification.

## Start here

- [Fresh-clone setup](README_SETUP.md)
- [Final submission readiness](docs/FINAL_SUBMISSION.md)
- [Host + bridged Kali VM demo](docs/DEMO_VM_SOC.md)
- [Technical debt checklist](docs/TECHNICAL_DEBT_CHECKLIST.md)
- [Centralized proxy](docs/CENTRALIZED_PROXY.md)
- [Selective TLS blocking limitations](docs/SELECTIVE_TLS_DEMO.md)
- [Measured domain-model evaluation](docs/DOMAIN_ML_EVALUATION.md)
- [ML integration contract](docs/ML_INTEGRATION_SPEC.md)
- [Private file scanning and local SOC advice](docs/LOCAL_LLM_AND_REPORTS.md)
- [Pitch deck handoff](docs/PITCH_DECK_HANDOFF.md)

## Current stack

Next.js dashboard/BFF → Flask/gunicorn. SQLite preserves accounts, sessions,
phishing telemetry, quizzes, gamification, reports and the email outbox.
PostgreSQL stores proxy traffic/verdicts/SOC alerts/audit; Redis caches verdicts
and transports live events. Squid + opaque tunnel relay enforce domain policy.
GoPhish remains the simulation engine. Mailpit captures OTP and education mail;
a small worker sends education only to active employees below the score threshold.

Proxy inference uses a local **domain-only** calibrated ML model. Employee URL
scans and link reports use VirusTotal/urlscan evidence, never the proxy ML model.
Private file scans use VirusTotal only and create no SOC report or score event.
These providers are never on the proxy hot path. Local LLM advice is SOC-only
and advisory; it cannot automatically blacklist a domain.

Allowed HTTPS is spliced, not decrypted. Denied connections alone use the lab CA
to show `BLOCKED BY AFFERENT`. Manual SOC Block/Allow takes precedence. Genuine
ML Unknown is allowed for review; pending/unavailable inference is denied
temporarily, not saved as a malicious verdict.

n8n and Telegram are retired from the active Compose/notification flow. Exports
and old setup documents are recoverable under [archive](archive/README.md);
historical telemetry is retained. External SMTP deployment and new NAC sensors
are Future Work, intentionally not implemented.

## Repository layout

| Directory | Purpose |
| --- | --- |
| `dashboard/` | Employee, SOC, GRC, CISO and campaign workspaces; authenticated BFF |
| `backend/` | Flask services, durable application data and isolated regression checks |
| `proxy/`, `gophish/` | Domain-policy enforcement and authorized phishing simulations |
| `docs/`, `scripts/` | Demo runbooks, measured evidence, bootstrap and submission guard |
| `dataset/`, `notebooks/`, `ml/` | Training sources, offline experiments and evaluation tools |
| `archive/` | Historical plans and retired integrations; not part of the active demo |

Training data and experiment results are not automatically trusted or promoted.
Runtime model manifests identify the active artifact and operating point.

Copy `.env.example` only for a new setup; preserve existing `.env`,
`.env.proxy.local`, certificates and Docker volumes. Never run `down -v` on a
checkout containing demo data. Do not commit credentials or CA private keys.
