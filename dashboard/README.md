# AFFERENT dashboard

Next.js 16 / React 19, TypeScript, Poppins, shared workspace theme. The dashboard
is a same-origin BFF; Flask owns authentication, RBAC and durable application data.
Opaque sessions use HTTP-only cookies. Never put credentials or session tokens
in browser storage or `NEXT_PUBLIC_*` variables.

## Run and verify

The recommended demo starts from the root [setup guide](../README_SETUP.md).
For frontend development, provide local ignored `.env.local` with `API_URL`,
`SERVICE_API_KEY`, `APP_ENV=development` and `DEV_BYPASS_AUTH=false`; use the
matching server configuration. `SERVICE_API_KEY` is server-only.

```sh
npm ci
npm run dev
npm run lint
npm test
npm run build
```

SOC live telemetry uses SSE. Employee reports/scans use authenticated BFF routes;
file upload checks include actual size, consent and same-origin validation.
Backend failures remain visible rather than replaced with fake incidents/policy.

The source lives in `src/app`, `src/components`, `src/context`, `src/hooks` and
`src/lib`; runnable contract checks are in `scripts`. See
[submission readiness](../docs/FINAL_SUBMISSION.md) for the current verification
record and [pitch deck handoff](../docs/PITCH_DECK_HANDOFF.md) for presentation scope.
