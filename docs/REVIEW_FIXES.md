# Review fixes — 3 October 2026

Scope: stable SOC telemetry, conservative model enforcement, employee reports,
SOC/GRC warning inbox and layout polish. Auth, campaign/gamification scoring,
proxy ON/OFF probe, allowed-TLS splicing and manual SOC policy are preserved.
Ponytail approach: reuse the existing report, outbox, proxy and polling paths.

## What changed

- SOC data never switches to seed/demo data when the backend fails. Source
  timestamps and deterministic ranking are used; unchanged polls do not
  rerender data. The division chart no longer animates every poll.
- Risk synthesis is a deterministic, labelled snapshot. It does not invent
  incident IDs, successful exfiltration prevention or DNS/firewall actions.
- Domain model v3 uses a stricter validation-selected operating point plus
  conservative Unknown for long generated subdomain IDs. Old local ML policy
  versions no longer enforce; SOC overrides are unaffected. Old alerts remain
  in history. Fresh inference can correct an open ML observation via SSE.
- Live traffic remains complete (200 recent events), with a bounded panel.
  The alert queue defaults to Critical/current predictions and employee reports;
  Unknown monitoring and historical observations are available via the filter.
- Employee report uses existing provider evidence, not proxy scanning. One
  urlscan Search hit is followed by a fixed-origin UUID Result lookup; search
  hits and absent/malformed data do not become fake safe/malicious verdicts.
- Provider 401/403/429/no-record/errors are visible. Provider failure still
  persists an Unknown report and SOC alert. Existing reports are historical;
  Refresh reloads SOC status, not a new provider scan/reward.
- Security Inbox is available to SOC/GRC only: link reports, active employees
  below the points baseline and manual warning approval. GRC does not gain
  proxy Block/Allow privileges. Inbox refreshes every 10 seconds.
- Warning approval is audited atomically with its outbox entry; cooldown and
  pending-message checks prevent repeated sends. The worker rechecks role,
  account status and points before delivery. Audit is append-only.
- Manual approval is default (`EDUCATION_AUTO_ENABLED=false`). Delivery stays
  enabled (`EDUCATION_EMAIL_ENABLED=true`) to drain approved warnings. Only
  Mailpit lab is used. Threshold is **strictly points <60/200**, ENV-configurable;
  this is not the dashboard chart's normalized 0–100 score.
- Poppins retained; URL tools split into form/history columns, with responsive
  collapse, clearer provider states, bounded lists and native dialog behavior.

Provider contracts: [urlscan API](https://urlscan.io/docs/api/),
[urlscan Result API](https://urlscan.io/docs/result/),
[VirusTotal URL report](https://docs.virustotal.com/reference/url-info).
Lookups query existing reports; no new public scans are submitted silently.

## Dataset still needed — do not mark category detection complete

The existing data trains benign/phishing/malware/other, not reliable judol or
adult-content classification. The 299-row Indonesian OOD file is an internal
seed case study, kept out of training. Runtime evaluation finds 0/70 labelled
judol domains autoblocked. There are no verified adult-content labels.

Please supply domain-level records with `domain, category, source, observed_at,
reviewed`, including substantial recent benign infrastructure/CDN/cloud traffic
and verified gambling/adult/phishing/malware categories. Include innocent
look-alikes, long-ID hosts and Indonesian legitimate organizations. Do not
include passwords, cookies, query tokens or browser histories tied to people.
Labels need independent review, varied registered domains and temporal
holdout. A few example URLs are regression cases, not an accuracy benchmark.

Category enforcement should be separate from phishing/malware classification:
adult/gambling labels describe an organizational policy, not automatically
malware. SOC decisions already adapt policy immediately; model weights are
not silently retrained from every click/Block (which would invite poisoning).
For the demo, use explicit audited SOC blocks pending proper category data.

## Manual demo checks

Automated checks in this review: 34 regressions across review fixes, existing
auth/gamification, reward cap, proxy gate and isolated Squid/TLS. A separate
Mailpit smoke check delivered one clearly labelled synthetic warning using a
temporary database; no real employee score/account was changed. VT and urlscan
read-only lookups both returned HTTP 200. UI appearance and browser/VM flows
still require Daf's manual review; automated checks do not prove visual QA.

1. Login SOC/GRC, open **Security Inbox**. Submit a link as employee; report
   appears with sender and verdict/status. SOC reviews Block/Allow in Threats.
2. Warning tab only lists real active employees below baseline. Current data
   may have none; an empty list is correct. Use a dedicated demo account and
   legitimate scoring actions; do not alter real employees just for testing.
3. Approve warning with a reason. It first reads Queued; after worker delivery,
   Sent to Mailpit. View the email at host `http://127.0.0.1:8025`. Duplicate
   sends within cooldown are rejected. Recovered/inactive accounts are skipped.
4. Report a public URL with no credentials. Expand provider status. Unknown
   remains reviewable; it is not a guarantee of safety. API quota errors are
   not disguised as a broken form or a safe verdict.
5. In SOC, watch the division chart with no underlying score updates: values
   and source timestamp should remain steady. Browser/backend failure should
   show last snapshot/error, never randomly switch to fabricated employees.
6. Repeat proxy ON/OFF from the VM and audited SOC blocking with CA installed.
   Generated/cloud hostnames are Unknown unless SOC blocks them. Unknown is
   allowed; pending/unavailable ML still temporarily denies the request.

## API keys

`VT_API_KEY`, `URLSCAN_API_KEY` are report-only. `FIRECRAWL_API_KEY` is for
phishing campaign reference scraping; Gemini is an optional campaign LLM
via `GEMINI_API_KEY`. Compose already forwards these names. Empty keys are
not invented. Keep values in untracked `.env`, never in chat or screenshots.
After changes recreate the backend service (a restart does not reload ENV).
No Firecrawl/Gemini call is added to the security-critical proxy gate.
