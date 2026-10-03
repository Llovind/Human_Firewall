# AFFERENT — pitch deck handoff

Updated: 3 October 2026. Audience: academic evaluators and the demo team.
Deliverable for the teammate: an 8-slide English pitch deck, plus a short live
demo. This is a lab prototype for approximately 5–8 users, not a production or
regulatory-certification claim.

## The story

**AFFERENT connects employee awareness, security evidence and SOC action in one workspace.**

People can recognize and report suspicious links, learn from controlled phishing
simulations, check files before opening them, and improve their awareness score.
SOC analysts receive link reports and proxy traffic context, make Block/Allow
decisions, and coordinate targeted education with GRC.

Designed for SME and institutional lab scenarios; do not imply that OJK compliance
or commercial deployment has been independently validated.

## Important product change: Scan file is NOT a SOC report

Employee dashboard → **URL & file security** → **Scan file**.

1. Select a non-confidential PDF or another file format, up to 10 MB.
2. Explicitly consent to sharing the file with VirusTotal/security partners.
3. AFFERENT checks the SHA-256 first. A known result is reused; an unknown hash
   is uploaded with a generic filename and analyzed asynchronously.
4. Results update in the employee's private **File scans** history.
5. **Threat detected** warns the employee not to open or run the file.
   **Suspicious file** is a separate caution. **No known threats detected** is
   not proof of safety. Errors or missing evidence remain **Unknown**.

No SOC inbox entry, live SOC alert, score reward, automatic file removal or domain
block is created by a file scan. AFFERENT does not open, execute, decompress or
preview the uploaded bytes. Queued originals are logically deleted after VT
submission/completion or expiry; metadata/results remain. VT may retain/share
submitted files, so do not use confidential documents in the demo.

**Report a link remains a different feature:** it sends VT/urlscan evidence to
the SOC/GRC inbox. Existing link-report scoring remains unchanged.

## Slide plan

| Slide | Title | Main message | Suggested visual |
| --- | --- | --- | --- |
| 1 | Security starts with people | AFFERENT links awareness, evidence and response. | Product name and one clean dashboard screenshot. |
| 2 | From a suspicious click to an informed decision | Awareness and response need a connected workflow, not separate screens. | A small employee → evidence → SOC flow; label this as the design problem, not a measured market statistic. |
| 3 | One workspace, clear responsibilities | Employee checks/learning; Administrator manages accounts/campaigns; SOC manages traffic policies; GRC approves education; CISO reviews posture. | Five role cards. |
| 4 | Learn through controlled simulation | GoPhish campaigns, built-in password-change materials or an authorized Firecrawl clone, education page and awareness scoring. | Campaign → interaction → education flow; no real credentials in screenshots. |
| 5 | Check first. Report when needed. | Scan URL = VT/urlscan check; Scan file = private VT check; Report a link = SOC review. | Three concise cards and one file-warning screenshot. |
| 6 | Visibility with accountable action | Centralized explicit proxy, live SOC traffic, manual Block/Allow and decision audit. | Employee laptop → Squid → backend → SOC, with the policy returning to the proxy. |
| 7 | What the prototype demonstrates | Integrated, role-separated workflows and a two-device network demo; model limitations are explicit. | A demo checklist and real screenshots, not invented accuracy or latency numbers. |
| 8 | Next validation, not inflated promises | More verified model data, independent evaluation and broader user testing before deployment. | Three milestones, clearly marked future work. |

Keep each slide to one main idea and about 3–4 short bullets. Use Poppins,
the existing navy/blue/cyan palette, restrained gradients and generous spacing.
Avoid walls of text, generic AI graphics and fabricated market metrics.

## Architecture labels to use

- **Next.js dashboard/BFF:** same-origin requests and HTTP-only session cookies.
- **Flask/gunicorn:** backend authentication, role checks and application logic.
- **SQLite:** accounts, sessions, awareness data, link reports, private file
  scans/jobs and the mail outbox.
- **PostgreSQL + Redis:** proxy traffic/policies/audit and live-event transport.
- **Squid + tunnel relay:** explicit device proxy and domain-level enforcement.
- **GoPhish + Firecrawl:** controlled simulation engine and optional authorized
  landing-page preparation; Firecrawl is not the file/traffic detection engine.
- **VirusTotal + urlscan:** employee URL evidence; **VirusTotal only** for files.
- **Mailpit:** captures OTP and approved education-warning email in the lab.
- **Local models:** domain-only proxy ML; optional SOC-only local LLM advice.

Telegram and n8n are retired from the active flow. Do not put them in the current
architecture diagram. External SMTP and production deployment are out of scope.

## Model and HTTPS claims: say this accurately

- The local LLM is a **second opinion for SOC**, not an autonomous blocker.
  It is not used to scan uploaded files or decrypt permitted HTTPS traffic.
- Fine-tuning was attempted and evaluated, but the 0.6B candidate failed its
  quality gates and was **not promoted**. The active advisory baseline remains
  the unmodified 4B model. Do not say the deployed LLM is successfully fine-tuned.
- Do not claim perfect phishing/pornography/gambling detection, zero false
  positives or a guaranteed sub-second verdict. Refer to the measured model
  evaluation documents if an evaluator requests numbers.
- Permitted HTTPS is spliced, not decrypted. A trusted lab CA is required on the
  employee device for AFFERENT's branded page on selectively blocked HTTPS
  connections. This is not full TLS inspection, and browser retries/caches can
  affect the visible transition.
- File results depend on VT availability, supported formats, queue and quota.
  A warning is provider evidence, not endpoint antivirus enforcement.

## Suggested live demo (two laptops, one network)

Use the server's configurable LAN address; do not hardcode an employee IP into
slides or code. Hide secrets and use demo identities in screenshots.

1. Employee logs in with email/password + OTP captured in Mailpit.
2. Employee enables the OS proxy; show the existing connection-status card.
3. Employee visits a site; host/SOC shows traffic and a manual Block decision.
   Reopen the blocked domain and show the AFFERENT page with the lab CA trusted.
4. Employee submits a suspicious **link**; show its evidence in the SOC inbox.
5. Employee runs **Scan file** with a harmless, non-confidential PDF or text file.
   Show the private result and confirm that no new SOC inbox/alert item appeared.
6. Show the threat banner with an already-consented VT result, or clearly label
   an isolated mocked fixture as **Simulated provider response**. Never download
   or execute malware merely to obtain a screenshot.
7. If a demo employee is below the configured baseline, SOC/GRC approves an
   education warning and the team verifies delivery in Mailpit.

Prepare a known-hash result or a labelled fallback recording for the file step:
provider quota can delay fresh scans. Do not present pending/Unknown as safe.

## Evidence and final handoff checklist

- [ ] Obtain fresh desktop screenshots from the latest running build.
- [ ] Separate **implemented**, **automated checks passed**, and **manually
  demonstrated** claims. A build passing is not proof of two-laptop behavior.
- [ ] Verify Scan file does not appear in SOC/GRC inbox or live alerts.
- [ ] Confirm link reporting and awareness scoring still work independently.
- [ ] Redact email addresses, API keys, session values, passwords and CA keys.
- [ ] Keep demo results and future work on separate slides.

Reference material: [file scans and local advice](LOCAL_LLM_AND_REPORTS.md),
[two-device runbook](DEMO_VM_SOC.md), [campaign demo](PHISHING_CAMPAIGN_DEMO.md),
[selective TLS limits](SELECTIVE_TLS_DEMO.md),
[domain model evaluation](DOMAIN_ML_EVALUATION.md),
[local LLM evaluation](LOCAL_LLM_EVALUATION.md).

Provider references: [VT file submission](https://docs.virustotal.com/reference/files-scan),
[analysis status](https://docs.virustotal.com/reference/analysis),
[data-sharing policy](https://docs.virustotal.com/docs/how-it-works).
