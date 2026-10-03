# Workspace UI refresh

Updated: 2026-10-03. Target: desktop lab/demo.

## Changes

- Retained Poppins, with a restrained navy/blue/teal palette and shared light/dark surface tokens.
- Standardized navigation, page headings, controls, spacing, cards, tables, and keyboard focus styles.
- Shortened English interface copy across sign-in, employee tools, SOC/GRC inbox, traffic, accounts, campaigns, and risk summaries. Historical reports and server-generated content remain unchanged.
- Moved extended risk analysis into an expandable section and compacted the traffic feed.
- Replaced browser prompts for SOC decisions with an accessible native confirmation dialog. Reasons remain required; API failures retain the dialog and input.
- Kept the education and proxy block pages consistent, with English copy and offline Poppins for Squid.
- No new dependencies. Existing overlapping theme overrides were removed in favor of shared CSS tokens.

## Boundaries

Authentication/RBAC, OTP, scoring calculations, ML inference, campaign operations, SSE ingestion, proxy connection detection, certificate trust, and Windows proxy settings were not redesigned. Decision requests still use the same audited backend endpoints.

## Verification

- Dashboard production build and TypeScript: passed (60 routes).
- Targeted lint of the updated shared components: passed.
- `node scripts/test-proxy-decision-ui.cjs` from `dashboard/`: passed with mocked HTTP. Covers confirmation-only opening, blank reason rejection, error retention, and alert/traffic Block/Allow requests. No live policies are changed by this check.
- Existing Squid denial-page regression check: passed. Offline font, safe portal links, and no raw request-header exposure remain intact.
- Desktop browser checks: English sign-in, education, and block-page preview reviewed. Screenshots are in `docs/visual-checks/workspace-*-desktop-en.jpg`.
- Dashboard and proxy images rebuilt and activated in the current Docker lab.

Authenticated SOC/GRC/CISO/administrator/employee screens still require visual review with the corresponding accounts. No authentication bypass or artificial production data was added for screenshots. Mobile screen testing was intentionally skipped.

Repository-wide lint is not claimed clean. The existing `ProxyConnectionCard` synchronous effect-state lint issue was left untouched to preserve the verified connection-status mechanism.

## Manual review

Hard-refresh the browser, then review both themes with employee and SOC accounts. Check navigation, long domains, report history, the inbox warning dialog, and the Block/Allow confirmation. Cancel dialogs during visual-only review to avoid changing live policy or sending warnings.
