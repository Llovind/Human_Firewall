# Phase 0 Credential Rotation Record

No secret values are included in this document. Local replacement values are
stored only in the ignored `.env` file or ignored PKI directory.

## Completed by Phase 0

- `SECRET_KEY` regenerated with a CSPRNG and activated in Flask/dashboard.
- `SERVICE_API_KEY` regenerated, activated, and verified: valid key returns
  success while an invalid key returns HTTP 401.
- Transitional `ADMIN_PASSWORD` regenerated and verified through the dashboard
  login flow.
- `TELEGRAM_WEBHOOK_SECRET` generated for the remaining transition period.
- GoPhish API key reset through the TLS-verified API; the previous key was
  confirmed rejected and the replacement client call succeeded.
- GoPhish admin password changed through the local administrative API.
- Existing n8n encryption key preserved and persisted as
  `N8N_ENCRYPTION_KEY`; it was deliberately not rotated.
- Lab CA and GoPhish server certificate created with SAN entries for
  `gophish`, `localhost`, and `127.0.0.1`. GoPhish and Flask mount only the
  required files read-only. Verified GoPhish API response: HTTP 200.
- Literal credentials removed from repository helper scripts, handoff
  documentation, and the checked-in Flow B JSON. The Flow B file now refers to
  environment variables and remains inactive.

The local admin passwords can be retrieved by the workstation owner from the
ignored `.env` file. Do not paste them into chat, commits, screenshots, or issue
trackers.

## Provider-account rotation still required

The following secrets cannot be revoked by repository code. The provider owner
must perform these actions in the corresponding account:

1. Telegram bot tokens: revoke all historical tokens through BotFather.
2. VirusTotal API key: regenerate it in the VirusTotal account.
3. urlscan.io API key: regenerate it in the urlscan.io account.
4. n8n owner password: change it in the n8n editor and invalidate other
   sessions.
5. Groq and OpenRouter keys: rotate only if those optional integrations will be
   retained.
6. Gemini and Firecrawl keys: revoke them if real; the target architecture does
   not require them by default.
7. SMTP credential: create a new dedicated credential in Phase 1; do not reuse
   a personal mailbox password.

## n8n workflow inventory after restart

The persistent n8n database was successfully decrypted after pinning the same
encryption key. Five workflows were exported for a metadata-only check. The
verified Flow A was republished after restart; every Flow B and duplicate
remains inactive:

| Workflow | Trigger | Credential/reference risk | Disposition |
| --- | --- | --- | --- |
| `WORKFLOW A TERBAIK` | Webhook | Telegram credential reference | Active and preserved |
| `Flow B fix` | Telegram trigger | Direct Telegram/provider configuration | Archive in Phase 3 |
| `Flow B — Threat Reporting (Fully Configured)` | Telegram trigger | Exposed Telegram, VirusTotal, and urlscan values | Archive in Phase 3 |
| `Flow B — Threat Reporting (Fully Configured) THREAT INTELLIGENCE` | Telegram trigger | Telegram credential plus provider values | Archive in Phase 3 |
| `Workflow A` | Webhook | Inactive duplicate with Telegram routing | Archive duplicate in Phase 3 |

Do not reactivate a Flow B workflow. Historical values may still exist inside
the inactive workflow revisions in the persistent n8n database; provider-side
revocation is therefore still mandatory. Phase 3 will archive/delete those
inactive database copies after the backend reporting path replaces them.

## Important n8n encryption-key rule

Do not generate a different `N8N_ENCRYPTION_KEY` against the existing volume.
The persisted key is the same key that encrypted the current credentials. A
future key change requires exporting/recreating every encrypted credential in a
controlled maintenance window.

## Non-secret routing metadata

`SOC_CHAT_ID` is not an authentication credential, but it is sensitive routing
metadata. It is retired with the Telegram integration in Phase 3.

For the final integration selection and environment policy, see
`docs/API_CREDENTIAL_LIFECYCLE.md`.
