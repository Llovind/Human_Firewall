# Role-Based Dashboard Separation & Behavioral Gamification — Walkthrough

We have successfully migrated the Presentation Layer to Next.js (`dashboard/`) and separated access routes based on role (SOC Admin vs Employee). We also ported the old Flask admin dashboard tabs (GoPhish Integration & Mock Webmail) into the Next.js Admin page, and added dynamic behavioral locking to the employee mini-game.

---

## 1. Architectural Highlights

```
+-------------------------------------------------------------+
|              PRESENTATION LAYER (Next.js)                   |
|                                                             |
|   / (Employee Portal)                 /admin (SOC Admin)     |
|   - Personal Stats                    - Threat Overview      |
|   - Activity Feed                     - Active Threat Cache  |
|   - Retraining Game                   - Behavior Leaderboard |
|     (Behavioral Lock)                 - Policy Decisions     |
|                                       - GoPhish Control      |
|                                       - Mock Webmail Inbox   |
+------------------------------+------------------------------+
                               |
                   Secure API Proxy (JWT/Bearer)
                               |
                               v
+-------------------------------------------------------------+
|          THREAT INTEL & BEHAVIOR LAYER (Flask Backend)      |
|                                                             |
|   - SQLite (Auth, Token Registry, Events logs)              |
|   - API webhook handlers (/api/incident, /api/behavior)     |
|   - GoPhish API client wrapper                              |
+-------------------------------------------------------------+
```

---

## 2. Completed Features

### 👤 Employee Personal Dashboard & Retraining (`/`)
- **What was built**: A dedicated dashboard for employees authenticated via Telegram Magic Links.
- **My Dashboard tab**: Displays employee points progress ring, streak, division rank, badges, and their personal security activity log (simulated clicks, reports, training completions).
- **Spot the Fake game tab**:
  - **Behavioral Lock (Safe)**: If an employee's behavior score is `>= 70` (points `>= 140`) and they have never clicked a phishing link, the game is **locked** since they are already verified secure.
  - **retraining Unlock**: If their score drops below `70` (points `< 140`) or they get compromised by phishing, the game **unlocks** as a mandatory retraining exercise.
  - **Farming Protection**: Limit of **1 attempt per 24 hours**. If played today, a countdown timer is displayed.
  - **Interactive Inspect Tool**: Users can hover over the mock portals to inspect security indicators (e.g. comparing `sso.infranexia-portal.xyz` vs `sso.infranexia.co.id`, copyright text, secure checkmarks) before selecting the fake one.
  - **Educational Moment**: Upon answering, a detailed breakdown popup highlights the phishing indicators. A background call is sent to Flask `/api/event` to award `+5 points` (correct) or log the event (incorrect) so the Behavior Engine can react.

### 🛡️ SOC Admin Dashboard (`/admin`)
- **What was built**: A unified operations command center restricted strictly to admins.
- **Admin Login (`/admin/login`)**: A cyberpunk glassmorphism screen verifying the admin password (`hfl-admin-2026`) via Flask.
- **Tab Layout**:
  1. **📊 Overview**: Incidents summary, AI narrative summaries (LLM), and recent alerts list.
  2. **🔍 Threats**: Active Threat Intelligence cache table (URLs scanned, Threat scores, Virustotal/urlscan verdicts).
  3. **👤 Behavior**: List of all employees and their scores/risk ratings.
  4. **⚖️ Policy**: Combined scores and final gateway actions (Allow, Warning, Block, Notify SOC).
  5. **🎣 GoPhish**: Command Center to sync target groups and launch simulation campaigns.
  6. **📬 Webmail**: Mock Webmail inbox sidebar and reader to inspect simulation emails.

### 📡 Secure API Proxying
- Next.js API route handlers act as a proxy layer. When Next.js communicates server-to-server with Flask, it attaches the secure token `Authorization: Bearer <SECRET_KEY>` to authorize admin actions (GoPhish sync/launch, email lists).
- The Flask `require_admin_for_protected_routes` guard was updated to allow requests carrying the correct shared secret bearer token and to return a standard JSON `401 Unauthorized` error on API endpoints rather than redirecting.

---

## 3. How to Verify

1. **Open nextjs application**:
   - Visit [http://localhost:3000](http://localhost:3000). You should be redirected to `/auth` because you are unauthenticated.
2. **Access Admin Panel**:
   - Visit [http://localhost:3000/admin](http://localhost:3000/admin). You should be redirected to `/admin/login`.
   - Submit password `hfl-admin-2026` -> Verify successful authentication and access to the SOC dashboard.
3. **Check GoPhish & Webmail**:
   - On the Admin panel, check the "GoPhish" tab and click "Sync Target Group" or "Launch Simulation" (pulls resource options dynamically).
   - Check the "Webmail" tab to view sent emails.
4. **Access Employee Dashboard**:
   - Visit [http://localhost:3000/auth?token=demo-magic-link-2026](http://localhost:3000/auth?token=demo-magic-link-2026).
   - Verify redirect to `/` showing personal stats for user *Lovind*.
   - Check the **Spot the Fake** tab. Since *Lovind* is seeded with points `105` (score `52.5`), the game should be **unlocked**.
   - Hover over the portals to see inspect tips. Click "PORTAL A adalah Palsu" -> verify **Educational Moment** bedah taktik popup, points increment, and daily cooldown activation on return to dashboard.
