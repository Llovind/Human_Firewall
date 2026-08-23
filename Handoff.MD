# 🛡️ MASTER PROJECT HANDOFF — AFFERENT PLATFORM
**Project Name:** Afferent (*2D Adaptive Human Risk Management & Defense Platform*)  
**Target Event:** HackNusa 2026 (Telkom University × Kaspersky)  
**Repository Path:** `c:\Human_Firewall`  
**Generated Date:** August 18, 2026

---

## 📌 1. EXECUTIVE SUMMARY & CORE MISSION
**Afferent** transforms employees from passive security vulnerabilities into active, real-time cyber defense sensors (*The True Human Firewall*).
- **The Core Problem:** 82% of enterprise breaches involve human error (spear-phishing, credential leaks), but traditional security stacks (SIEM, EDR, Firewall) treat human risk as an unmonitored blind spot, relying on ineffective annual training.
- **The Core Innovation (2D Adaptive Policy Convergence):**
  - **Dimension 1 (Human Risk Telemetry):** Continuous real-time behavioral scoring (`Sentinel`, `Guardian`, `Vulnerable`) derived from simulation responses, threat reports, and quiz completions.
  - **Dimension 2 (Threat Intelligence):** Live correlation with VirusTotal, urlscan.io, and enterprise threat feeds.
  - **Adaptive Decision:** Automatically triggers gateway blocking, step-up 2FA, deep proxy inspection, or just-in-time micro-training based on the convergence matrix.

---

## 🏗️ 2. SYSTEM ARCHITECTURE & TECH STACK

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                             AFFERENT CLOSED-LOOP SYSTEM                           │
└──────────────────────────────────────────────────────────────────────────────────┘
   │
   ├─► 1. FRONTEND DASHBOARD (Next.js 16 • React 19 • TypeScript • Vanilla CSS)
   │     • Port: http://localhost:3000
   │     • Role-Based Views:
   │       - SOC Command Center (/dashboard/soc): Incident Triage, 2D Policy Engine, Live Heatmap
   │       - CISO Executive View (/dashboard/ciso): Risk trends, ROI metrics, Department health
   │       - GRC Compliance Portal (/dashboard/grc): ISO 27001:2022 Annex A.6.3 & UU PDP mapper
   │       - Phishing Admin (/dashboard/phishing-admin): GoPhish campaign launcher, Mock Webmail
   │       - Unified Admin (/admin): Command Center overview & employee rosters
   │
   ├─► 2. BACKEND API & TELEMETRY ENGINE (Python Flask • SQLite)
   │     • Port: http://localhost:5000
   │     • Database: instance/human_firewall.db (Single Source of Truth)
   │     • Core Routes:
   │       - /api/event & /api/fake-login-submit: Captures phishing clicks, credential leaks (strips password)
   │       - /api/ai/classify-all & /api/ai/user/<email>: Pure LLM behavioral risk classifier (OpenRouter/Gemini/Groq)
   │       - /api/policy: 2D Adaptive Policy Evaluator (Decision Matrix)
   │       - /api/admin/threats/*: Incident feed, threat actions, and gateway sync
   │
   ├─► 3. SIMULATION & INTERCEPTION LAYER (GoPhish Engine)
   │     • Ports: 3333 (Admin HTTPS) • 8080 (Phishing Landing Pages)
   │     • Templates:
   │       - tier1.html: Just-in-Time Teachable Moment (Instant micro-education on click)
   │       - tier2.html: Fake SSO Login simulation (Privacy-first credential interception)
   │
   └─► 4. ORCHESTRATION & THREAT INTEL (n8n • Telegram Bot • External Scanners)
         • Port: http://localhost:5678
         • Telegram Bot: @HFL_Notif_Bot (Chat ID & webhook triage)
         • External APIs: VirusTotal API, urlscan.io API
         • Webhook Tunnel: https://disparity-stonework-shortness.ngrok-free.dev
```

---

## 🎨 3. UI/UX & DESIGN SYSTEM STANDARDS
- **Palette Guidelines:**
  - **Yellow / Warning:** `#F7D87F` (Strictly applied across light/dark themes).
  - **Red / Danger:** `#D0311E` (Strictly applied across light/dark themes).
  - **Accent / Cyber Blue:** `#2196F3` / `#90CAF9`.
  - **Dark Base:** `#050c1a` / `#0d234d`.
- **Zero Placeholder / Zero Hardcoded Data Rule:**
  - Every component, chart, table, and telemetry score MUST pull directly from SQLite or live backend endpoints. No hardcoded fallback arrays.
- **Rebranding:**
  - Overview panel is named **🛡️ Threat Intelligence & Risk Synthesis** with badge **Live Telemetry** (no "Powered by LLM" labels).

---

## 🔑 4. ENVIRONMENT CONFIGURATION (`.env`)

```env
# Flask Core
SECRET_KEY=e0945a8ad7cd378c50da4060303e76bcf5a9d1bdff32afc31b2b72d9e3fcb742
ADMIN_PASSWORD=hfl-admin-2026
SERVICE_API_KEY=5f2970d4e3376a7e842e5f7f0f6df224cb01a50e3d8a60b75656de4372977036
DEV_BYPASS_AUTH=true

# AI Providers (Pure LLM Router in backend/ai_router.py)
OPENROUTER_API_KEY=
GEMINI_API_KEY=
GROQ_API_KEY=

# Telegram Bot & Scanners
TELEGRAM_BOT_TOKEN=8771953552:AAEV6BLdhjLp0IBXunrQ5k_4FHh9WwXuSCU
SOC_CHAT_ID=-1003979650342
VT_API_KEY=fbfdaaa618dc7446a3e8417c08cd53d6d818e51d7d733dc2208de64e2902cb08
URLSCAN_API_KEY=019f0841-2c4c-74ba-a7b7-d057f9a70cdd

# Webhook Tunnel (Active Cloudflare Tunnel)
WEBHOOK_URL=https://objective-lived-travel-operating.trycloudflare.com

# GoPhish
GOPHISH_API_KEY=b4b0ca9969e56d5b1bd2680790b0eae1a01796b7e5f7e18762ee8e0c10975676
GOPHISH_API_URL=https://gophish:3333
```

---

## 🎬 5. HACKATHON POC PRESENTATION SCRIPT (3 MINUTES)
*The complete word-for-word timed presentation script for HackNusa 2026:*

- **[0:00–0:35] Problem Statement:**
  *"Enterprise-grade defenses can monitor a firewall, an EDR, a server — every log, every alert, correlated in real time. But the moment human error enters the picture, it's invisible. Not monitored. Not logged. Sixty-two percent of data breaches involve a human element — yet that's the one thing security stacks were never built to see. And in Indonesia, that blind spot is already being exploited: 5.5 billion cyberattacks hit Indonesian businesses in 2025. I watched it happen firsthand: a major telecom infrastructure company, full SOC, enterprise-grade tools — breached by a single phishing click. No malware. No exploit. Just one distracted employee. If that's enough to bypass enterprise defenses... SMEs with no dedicated team stand no chance. This isn't one company's problem. It's an industry-wide blind spot."*
- **[0:35–1:05] Proposed Solution:**
  *"This is Afferent. We turn employee cyber-risk behavior into real-time threat telemetry. The name comes from neurology — afferent nerves carry signals from the body's senses to the central brain. Every employee becomes a sensory nerve, streaming threat signals straight to the security command center. It runs on three pillars: Simulate (realistic phishing tests), Detect (instant threat triage), and Engage (gamified awareness). It's a closed loop feeding the Afferent Telemetry Engine, updating SOC and HR/GRC in real time."*
- **[1:05–2:15] Live Demonstration (4-Stage Loop):**
  *"Here's how it actually works. First — Simulate: The Phishing Admin launches a campaign via GoPhish. Every click and credential submission is captured as a behavioral event. That simulation trains a reflex — so when a real threat shows up, the employee reports it directly through our Telegram bot. VirusTotal and urlscan.io verify the threat in seconds without manual triage. Confirmed threats trigger a real-time SOC alert, GRC sees compliance readiness update against ISO 27001 and UU PDP, and the CISO gets organization-wide visibility."*
- **[2:15–2:40] Pathway to MVP & Scalability:**
  *"What you just saw is a working proof of concept — not a mockup. To reach MVP by September, we are hardening real-time dashboard synchronization, authentication security, and scaling the data pipeline for multi-tenant deployment to onboard our first real SME."*
- **[2:40–3:00] Impactful Closing:**
  *"Every enterprise defense in the world can't stop a threat it can't see. Afferent makes the human layer visible — logged, scored, and defended. Because the next breach won't come from a firewall failing. It'll come from a person no one was watching. Afferent is watching. Thank you."*

---

## ⚡ 6. OPERATIONAL RUNBOOK FOR NEXT AGENT

### A. How to Start All Services
```powershell
# 1. Start all Docker containers
docker compose up -d

# 2. Start the static Ngrok tunnel for Telegram Webhook & n8n
ngrok http --domain=disparity-stonework-shortness.ngrok-free.dev 5678
```

### B. Health Check Verification Commands
```powershell
# Check running containers (Must show dashboard, flask_api, gophish, n8n)
docker compose ps

# Check Telegram Webhook status
python -c "import requests; print(requests.get('https://api.telegram.org/bot8771953552:AAEV6BLdhjLp0IBXunrQ5k_4FHh9WwXuSCU/getWebhookInfo').json())"

# Check Flask API status
curl http://localhost:5000/api/summary

# Check Dashboard build correctness
cd dashboard; npm run build
```

### C. Immediate Priorities / Open Items
1. **AI API Key Insertion:** When the user supplies an active LLM key (`GROQ_API_KEY` or `GEMINI_API_KEY`), insert it into `.env` so `GET /api/ai/classify-all` generates fresh LLM narrative reports.
2. **Video Pitch Presentation Recording:** User is finalizing their pitch slides on Canva to accompany the live screen recording demo of the 4 dashboards.
