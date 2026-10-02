# Afferent: Autonomous AI Human Firewall & Behavioral Security Intelligence

> **AI-Powered Adaptive Phishing Simulation, Multi-LLM Threat Triaging, Gamified Employee Awareness, and Role-Based Cyber Security Analytics Platform**

[![Docker Compose](https://img.shields.io/badge/Docker_Compose-Supported-2496ED?logo=docker&logoColor=white)](docker-compose.yml)
[![Next.js 16](https://img.shields.io/badge/Next.js-16.2.10-000000?logo=next.js&logoColor=white)](dashboard)
[![Python Flask](https://img.shields.io/badge/Flask-3.0.0-000000?logo=flask&logoColor=white)](backend)
[![Multi-LLM Engine](https://img.shields.io/badge/AI_Engine-OpenRouter_|_Groq_|_Gemini-7C3AED?logo=openai&logoColor=white)](backend/ai_router.py)
[![n8n Orchestrator](https://img.shields.io/badge/n8n-Workflow_Automation-FF6D5A?logo=n8n&logoColor=white)](n8n-workflows)
[![GoPhish Engine](https://img.shields.io/badge/GoPhish-Simulation_Engine-00A8E8)](gophish)

**Afferent** is an enterprise cyber security platform designed to strengthen the human defense layer. It combines adaptive phishing simulations, automated incident triage, dynamic gamification, behavioral AI risk intelligence, and regulatory compliance (UU PDP and ISO 27001) across 4 dedicated role-based executive dashboards.

---

## Key Platform Features

### 🧠 1. Multi-Provider AI Behavioral Engine (`ai_router.py`)
* **Multi-LLM Failover Architecture:** Intelligent router providing automatic provider failover across **OpenRouter, Google Gemini, and Groq** with exponential backoff handling.
* **AI Risk Heatmap and Deep-Dive:** Automated risk classification (SAFE, VULNERABLE, DANGER) and individual behavioral evaluations.
* **Agentic AI Investigator:** Multi-step investigation engine tracking click history, department incidents, and employee vulnerability patterns.
* **AI Generative Phishing Templates:** Realistic phishing scenario generator driven by current news topics and threat trends.
* **PII Anonymization Layer (`ai_anonymizer.py`):** Anonymizes sensitive employee data into deterministic pseudonyms (such as `EMP-4E9D2A`) before sending prompts to external LLMs.

### 🎭 2. 4 Role-Based Security Dashboards
* **Phishing Admin Dashboard:** Campaign management for GoPhish, landing page builders, target list synchronization, and mock webmail portals.
* **SOC Dashboard:** Real-time incident triage, threat cache intelligence, policy decision logs, and administrator audit trails.
* **GRC Dashboard:** Regulatory compliance readiness tracking for **UU PDP Clause 46** (72-hour breach notification threshold) and **ISO 27001**, alongside custom risk threshold management.
* **CISO Executive Dashboard:** High-level executive overview combining organization-wide risk distribution, threat trends, and narrative AI report exports.

### ⚡ 3. Automated Incident Response and Telegram Threat Triaging (Flow A and Flow B)
* **Flow A (Phishing Simulation Notification):** Instant detection of simulation clicks or credential submissions via GoPhish webhooks, delivering targeted educational material to employees and escalating chronic clickers to SOC teams.
* **Flow B (Telegram Threat Reporting):** Allows employees to report suspicious URLs or files via a Telegram Bot.
  * **File Inspection:** Downloads raw binaries and scans them via the **VirusTotal API v3** (70+ antivirus engines).
  * **URL Inspection:** Deep-inspection using **VirusTotal** and **urlscan.io API**.
  * **Automated SOC Ticket Creation:** Automatically generates incident tickets in the database and broadcasts real-time alerts to the SOC Telegram chat.

### 🎮 4. Dynamic Gamification and Quiz Revive Mechanics
* **Points and Risk Tier System:** Reputation-based scoring system (Base 100 pt, Max 200 pt). Scores >= 130 earn **Sentinel** status, >= 60 earn **Guardian**, and < 60 fall into **Vulnerable**.
* **Threat Report Achievement Badges:** 4 achievement badges (*Sentinel Troops*, *Front Line Defender*, *The Front Man*, *Cyber Shield Elite*) awarded for verified malicious threat reports.
* **Daily Security Quiz and Streak Revival:** Daily awareness quizzes featuring a **Quiz Revive** mechanic (3 revives monthly allowance) to restore streaks after accidental simulation failures.

---

## Afferent System Architecture

```text
               +-------------------------------------------------------+
               |       Next.js 16 Role-Based Dashboard (:3000)         |
               | (Phishing Admin | SOC Analyst | GRC | CISO Executive) |
               +--------------------------+----------------------------+
                                          |
                                /api/admin/* proxy
                                          |
                                          v
+------------------+           +----------+----------+           +-------------------+
|  n8n Orchestrator| <=======> |   Flask API Backend | <=======> |   GoPhish Engine  |
|   (Port 5678)    |  REST API |      (Port 5000)    |  REST API | (Port 3333/8080)  |
+---------+--------+           +----------+----------+           +-------------------+
          |                               |
          |                               ├──> Multi-LLM Router (OpenRouter / Groq / Gemini)
          v                               ├──> PII Anonymizer Layer
+------------------+                      ├──> Gamification & Quiz Engine
| Telegram Bot API |                      └──> SQLite Database (human_firewall.db)
| VirusTotal API   |
| urlscan.io API   |
+------------------+
```

| Layer | Service | Container Name | Port | Description |
| :--- | :--- | :--- | :--- | :--- |
| **1. Orchestrator** | `n8n` | `hfl-n8n` | `5678` | Workflow automation engine for threat processing (Flow A and Flow B) |
| **2. Simulation** | `gophish` | `hfl-gophish` | `3333`, `8080` | Phishing simulation engine for emails and landing pages |
| **3. Analytics and AI** | `flask_api` | `hfl-flask` | `5000` | Core API, Multi-LLM Router, Gamification Engine, and SQLite DB |
| **4. Presentation** | `dashboard` | `hfl-dashboard` | `3000` | Next.js 16 user portal, 4-role executive dashboards, and API proxies |

---

## Directory Structure

```text
Afferent/
├── backend/                  # Core Flask API & AI Engine Layer
│   ├── app.py                # Flask Application Entrypoint & Auth Guard
│   ├── database.py           # Single Source of Truth & SQLite Data Access
│   ├── ai_router.py          # Multi-LLM Failover Router (OpenRouter/Groq/Gemini)
│   ├── ai_analysis.py        # SQLite Data Aggregator for AI Context
│   ├── ai_cache.py           # AI Analysis SQLite Cache Layer (1 Hour TTL)
│   ├── ai_prompts.py         # System Prompt Engineering for Behavioral LLMs
│   ├── ai_anonymizer.py       # Privacy and PII Pseudonymization Layer
│   ├── gamification_routes.py# Gamification, Quiz, and Leaderboard Endpoints
│   ├── gophish_client.py     # GoPhish API HTTP Client
│   └── routes/               # API Blueprints (admin_api, ai_routes, auth, events, incidents, threat)
├── dashboard/                # Next.js 16 Presentation Layer
│   ├── src/app/dashboard/    # Role-Based Pages (phishing-admin, soc, grc, ciso)
│   ├── src/app/api/          # Next.js Route Handlers and Proxies to Flask API
│   ├── src/components/admin/ # AI Intelligence Section, Heatmaps, and UI Components
│   └── src/lib/              # Session Store, Backend Client, and PDF Exporters
├── docs/                     # Documentation Files
│   └── CURRENT_STATE.md      # Current Codebase Status Verification Report
├── gophish/                  # GoPhish Engine Configurations and Database
├── n8n-workflows/            # Workflow Definitions (flow-a.json, flow-b.json)
├── docker-compose.yml        # Orchestration Manifest for 4 Service Layers
├── .env.example              # Environment Variable Template
└── README.md                 # Official Afferent Documentation
```

---

## Quick Start Guide

### 1. System Requirements
* **Docker** and **Docker Compose** (v2+).
* Python 3.10+ and Node.js 20+ (if running locally without Docker).
* Telegram Bot Token (from `@BotFather`).
* API Keys for **OpenRouter**, **Gemini**, or **Groq**.
* API Keys for **VirusTotal** and **urlscan.io**.

### 2. Configure Environment Variables
Copy `.env.example` to `.env` in the root directory:

```bash
cp .env.example .env
```

Configure essential environment variables:
```ini
# Core Secrets
SECRET_KEY=your-random-secret-key
ADMIN_PASSWORD=your-admin-password
SERVICE_API_KEY=your-service-api-key

# AI LLM Provider Keys
OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxxxxxxx
OPENROUTER_MODEL=openrouter/free

# Telegram and Threat Intel
BOT_USERNAME=HFL_Notif_Bot
SOC_CHAT_ID=-100xxxxxxxxxx
VT_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
URLSCAN_API_KEY=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

### 3. Launch Container Stack
Run Docker Compose to start all services:

```bash
docker compose up -d --build
```

### 4. Access Services
* 🌐 **Afferent Dashboards:** `http://localhost:3000`
* 🔌 **Flask Core and AI API:** `http://localhost:5000`
* ⚙️ **n8n Workflow Orchestrator:** `http://localhost:5678`
* 🎣 **GoPhish Admin Panel:** `https://localhost:3333`

---

## Testing Workflow

1. **AI Risk Heatmap and Executive Reporting:**
   * Navigate to `http://localhost:3000/dashboard/soc` or `/dashboard/grc`, then select the **AI Intelligence** tab.
   * The platform displays department risk heatmaps and executive narrative reports generated by the Multi-LLM Router.
2. **Telegram Threat Reporting (Flow B):**
   * Send a suspicious URL or document to the Telegram Bot.
   * n8n Flow B executes VirusTotal and urlscan.io analysis, logs the incident to SQLite, alerts the SOC team, and awards gamification points.
3. **Phishing Simulation (Flow A):**
   * Access `/dashboard/phishing-admin`, then launch a GoPhish simulation campaign.
   * When target employees click simulation links, the system captures events, updates user risk tiers, and delivers cybersecurity training.

---

## Security and Data Privacy Policies

* **PII Privacy:** Employee personal information is masked by `ai_anonymizer.py` before prompts are sent to external LLM providers.
* **Server-to-Server Authentication:** Internal communications between Next.js, n8n, and Flask backends are secured using `Authorization: Bearer <SERVICE_API_KEY>` headers.
* **Zero Hardcoded Secrets:** All n8n workflows consume environment variables (`{{ $env.TELEGRAM_BOT_TOKEN }}`) to eliminate hardcoded credentials in the repository.

---

## License and Copyright
Copyright (c) 2026 **Afferent Team**. Published for enterprise cybersecurity awareness and defense enhancement.
