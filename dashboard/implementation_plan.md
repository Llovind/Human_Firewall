# Goal: Implement Phishing Result (Campaign Metrics) in Next.js Dashboard

We will implement the **Phishing Result (Campaign Metrics)** panel inside the **Next.js Web Dashboard (Presentation Layer)** at port 3000. 

This will add a new tab to the dashboard, providing employees with a gamified view of simulated phishing campaigns, organizational metrics (open rate, click rate, report rate), and division-level performance.

## User Review Required

> [!NOTE]
> **Data Flow Strategy:**
> Just like incidents and threat cache, the dashboard will remain a "dumb-UI". The Phishing metrics will be received via webhooks (`POST /api/phishing`) from the backend (or GoPhish connector) and served in-memory. We will seed realistic campaign data for the initial demo.

---

## Proposed Changes

### Next.js Presentation Layer

#### [MODIFY] [store.ts](file:///C:/Human_Firewall/dashboard/src/lib/store.ts)
- Add `PhishingCampaign` and `PhishingStats` types.
- Extend `DataStore` to save and retrieve phishing campaigns and global phishing stats.

#### [NEW] [route.ts](file:///C:/Human_Firewall/dashboard/src/app/api/phishing/route.ts)
- Implement `POST /api/phishing` to receive campaign updates.
- Implement `GET /api/phishing` for client polling.

#### [MODIFY] [seed.ts](file:///C:/Human_Firewall/dashboard/src/lib/seed.ts)
- Add realistic seed data for phishing campaigns (e.g., "Invoice Midtrans Palsu", "Zoom Upgrade Account Link") and division rates (Network Engineering vs Sales Support).

#### [MODIFY] [page.tsx](file:///C:/Human_Firewall/dashboard/src/app/page.tsx)
- Add `'phishing'` to the list of tabs.
- Render beautiful UI blocks:
  - **Overall Campaign Statistics**: Cards showing Open Rate, Click Rate, and Report Rate with visual indicator bars.
  - **Active & Historical Campaigns List**: Table showing campaign names, status, date sent, and performance numbers.
  - **Division Gamification Leaderboard**: Comparison showing which divisions are the safest (highest report rate, lowest click rate).

#### [MODIFY] [dashboard.css](file:///C:/Human_Firewall/dashboard/src/app/dashboard.css)
- Add dark/neon styles for progress rings/bars, stats grids, and alignment for the new phishing metrics view.

---

## Verification Plan

### Automated/Manual Verification
1. Open the dashboard in browser (`http://localhost:3000`).
2. Navigate to the new **🎣 Phishing** tab.
3. Verify that stats (Open Rate, Click Rate, Report Rate) and division standings display correctly and dynamically.
4. Send a mock `POST /api/phishing` payload to verify that new campaigns appear in real-time.
