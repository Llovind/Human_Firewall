# 🤝 Project Handoff — Human Firewall (Superteam Hackathon)

This document provides a detailed context of the project's goals, current codebase state, active files, troubleshooting history (what failed and how it was fixed), and the immediate next steps. Designed for developers, AI assistants, and team members (@dafaaputera & @Mas jaldi).

---

## 🎯 1. The Goal We're Working Toward
We are building **Human Firewall**, an interactive Security Awareness and Automated Incident Response platform for the **Superteam Hackathon**. 

The platform turns the human element (employees) from the weakest link in cybersecurity into the strongest line of defense ("Human Firewall").
*   **Flow A (Simulation)**: Tracks corporate employees' phishing simulation behaviors and triggers real-time direct message warnings ("Teachable Moments") on Telegram, with automated SOC escalations for chronic clickers.
*   **Flow B (Threat Reporting)**: Automates threat intelligence analysis (VirusTotal reputational checks + urlscan.io headless sandbox renders) when employees forward suspicious links/files to our Telegram Bot, creating tickets in the Flask SOC Dashboard and alert logs in the SOC Group.
*   **Gamification**: Integrates a security point scoring system (Sentinel, Guardian, Vulnerable badges) to motivate employees to report threats and complete training.

---

## 💻 2. Current State of the Code
*   **Backend (Flask)**: The server (`app.py`) hosts routes for logging incident tickets, handling OTP email generation, verifying Telegram Chat IDs, and rendering the SOC dashboard.
*   **Database (SQLite)**: Schema (`database.py`) consists of tables for `user_history`, `events`, `incidents`, and `registration_otp`. Pre-populated with 30 days of mock history using `seed_data.py`.
*   **Automation (n8n)**: Mapped workflows are located in the `n8n-workflows/` folder. They handle Telegram regex parsing (for emails, /start, and OTP), interact with Flask endpoints, query security scanner APIs, and route SOC alerts to the supergroup ID `-1003979650342`.
*   **Network (Tunnels)**: Due to ISP port-blocking policies, webhook traffic is successfully proxied from the local n8n instance to the Telegram API using a **Pinggy HTTPS tunnel over port 443**.

---

## 📁 3. Files Actively Being Edited/Modified
*   **`backend/database.py`**: Managing SQL queries, database initialization, and prepared statements.
*   **`backend/app.py`**: Handles API endpoints and routes clicks to the Teachable Moment training page.
*   **`backend/templates/dashboard.html`**: Handles the administrator's interface, incorporating a Live SOC Analytics view and a Mock Webmail client tab for offline demonstrations.
*   **`n8n-workflows/flow-a.json`** & **`n8n-workflows/Flow B — Threat Reporting (Fully Configured).json`**: Active configuration files for the n8n automations.
*   **`.gitignore`**: Excludes private data, local databases, word documents, and backup files.

---

## ❌ 4. Everything We've Tried That Failed (Lessons Learned)
*   **Localtunnel / SSH Port 22 Block**: Direct localtunnel commands and SSH connections failed because the local ISP blocked port 22. 
    *   *Solution*: Bypassed by tunneling via **Pinggy over HTTPS Port 443** (`ssh -p 443 -R 0:localhost:5678 qr@a.pinggy.io`), which is open on all ISPs.
*   **SQLite Datetime Seeding Errors**: Executing seeding queries with raw string interpolation of datetime caused operational SQL syntax errors.
    *   *Solution*: Switched to parameterized SQL execution `?` passing values as a tuple, which runs cleanly.
*   **Telegram Web Page Content Error (400)**: The `SOC Alert URL` node in Flow B threw a 400 Bad Request error when using `sendPhoto` to transmit urlscan.io screenshots because urlscan.io's bot protection redirected Telegram's fetching agent to an HTML Cloudflare page.
    *   *Solution*: Converted the node from `sendPhoto` to `sendMessage` (text-based report with analysis links), which is 100% stable and supports automatic link preview.
*   **PowerShell Dollar Symbol Leak**: Running `git rm --cached` using double quotes (`"~$er_Guide..."`) failed to untrack temporary files because PowerShell parsed the `$` symbol as a variable expansion and stripped it.
    *   *Solution*: Switched to single quotes (`'~$er_Guide...'`) to escape variable expansion and successfully untracked the file.

---

## ➡️ 5. The Next Steps We Would Take

### Step A: Implement Security Gamification (Assigned to: Llovind & AI)
1.  Add `points` and `badges` columns to the `user_history` table.
2.  Update `/redirect-handler` to deduct points on clicks (`-10`) or credential leaks (`-20`).
3.  Update `POST /api/incidents` to award points (`+15`) when a user reports a confirmed malicious URL.
4.  Build the **Leaderboard UI Tab** in `dashboard.html` showing division rankings and top employee champions.

### Step B: Integrate Behavioral Analytics (Assigned to: Mas Jaldi)
1.  Analyze `events` table data for patterns (e.g., peak click hours, most vulnerable department).
2.  Produce risk calculation scores and save them to a new table (`behavioral_insights`).
3.  Inject those insights into the dashboard via Chart.js.

### Step C: Secure Configuration & Infrastructure (Assigned to: Dafa)
1.  Move sensitive API keys (VirusTotal, urlscan, Telegram bot tokens) from n8n JSON nodes to environment variables in `docker-compose.yml`.
2.  Secure Docker bridge networks for Flask and n8n communication.
