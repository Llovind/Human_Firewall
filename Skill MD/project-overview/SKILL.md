---
name: project-overview
description: 'Human Firewall project architecture map. Use when locating code layers, understanding backend/frontend/services layout, API endpoints, project structure, or onboarding to the repository.'
user-invocable: false
---

# Human Firewall — Project Overview

> Daftar direktori di bawah adalah **peta lokasi-lokasi kunci**, bukan pohon direktori lengkap.
> Jalankan `ls` atau `Get-ChildItem` pada direktori yang sebenarnya untuk melihat daftar terkini.

## Project Description

**Human Firewall** adalah platform simulasi phishing dan pelatihan keamanan siber berbasis AI
yang dirancang untuk meningkatkan kesadaran keamanan (security awareness) karyawan organisasi.

Platform ini mensimulasikan serangan phishing nyata, menangkap respons pengguna secara real-time,
menganalisis pola perilaku dengan AI, dan memberikan pelatihan adaptif.

**Lapisan arsitektur utama:**

- 🎯 **Simulation Layer** — GoPhish (kampanye phishing simulasi)
- 🧠 **Orchestration Layer** — n8n (workflow automation, threat intelligence)
- 🔧 **API Layer** — Flask (backend REST API, database, business logic)
- 📊 **Presentation Layer** — Next.js (dashboard SOC + portal karyawan)

**Repository:** `github.com/flyingsundaman/Human_Firewall`

---

## Complete Tech Stack

### Backend
| Category       | Technology                         |
| -------------- | ---------------------------------- |
| Framework      | Flask 3.0.0 (Python)               |
| CORS           | Flask-Cors 4.0.0                   |
| HTTP Client    | requests 2.31.0                    |
| Database       | SQLite (via Python sqlite3 stdlib) |
| Auth           | Session Cookie + Bearer Token      |
| Containerize   | Docker + Docker Compose            |

### Frontend (Dashboard)
| Category       | Technology                   |
| -------------- | ---------------------------- |
| Framework      | Next.js 16.2.10 + React 19   |
| Language       | TypeScript 5                 |
| Charts         | recharts 3.9.x               |
| Icons          | lucide-react 1.23.x          |
| Styling        | Vanilla CSS (globals.css)    |
| Auth           | Bot-First Magic Link (Telegram) |

### Infrastructure
| Service        | Technology / Port            |
| -------------- | ---------------------------- |
| Workflow Engine| n8n (port 5678)              |
| Phishing Sim   | GoPhish (admin :3333, phishing :8080) |
| Backend API    | Flask (port 5000)            |
| Dashboard      | Next.js (port 3000)          |
| Network        | Docker bridge network `hfl_network` |

---

## Project Layout

```
(repo root)
├── backend/                    # Flask REST API (Business Logic Layer)
│   ├── app.py                  # Entrypoint Flask, blueprint registration, auth guard
│   ├── database.py             # SQLite schema + semua fungsi DB (init_db, query, insert)
│   ├── gophish_client.py       # GoPhish API client wrapper
│   ├── gamification_routes.py  # Blueprint: gamifikasi (badge, quiz, streak, lives)
│   ├── integrations.py         # Integrasi eksternal (Telegram bot, n8n webhook)
│   ├── incident.py             # Incident model / helper
│   ├── policy.py               # Policy enforcement helper
│   ├── badges.json             # Definisi badge gamifikasi
│   ├── requirements.txt        # Python dependencies
│   ├── Dockerfile              # Container build untuk Flask
│   ├── seed_data.py            # Script seed data awal
│   ├── restore_from_gophish.py # Script sinkronisasi data dari GoPhish
│   ├── run_local.py            # Runner untuk development lokal
│   ├── routes/                 # Blueprint API endpoints
│   │   ├── auth.py             # /login, /logout, /api/auth/*, Telegram token validation
│   │   ├── events.py           # /r/<rid> redirect, /fake-login, /api/event/*, OTP, training pages
│   │   ├── incidents.py        # /api/incident (terima incident dari n8n)
│   │   ├── admin_api.py        # /api/admin/* (campaign management, user mgmt, stats)
│   │   ├── proxy.py            # /visit, /go, /blocked (URL proxy & safe redirect)
│   │   └── threat.py           # /api/threat (threat intelligence endpoint)
│   ├── services/
│   │   └── threat_service.py   # VirusTotal + URLScan.io integration logic
│   └── templates/              # Jinja2 HTML templates (phishing landing pages)
│       ├── tier1.html          # Halaman edukasi utama (setelah klik phishing)
│       ├── tier2.html          # Halaman edukasi lanjutan
│       ├── spot_the_fake_real.html  # Kuis interaktif "spot the fake"
│       ├── blocked.html        # Halaman blokir URL berbahaya
│       └── visit.html          # Halaman redirect aman
│
├── dashboard/                  # Next.js Dashboard (Presentation Layer)
│   ├── src/
│   │   ├── app/                # Next.js App Router root
│   │   │   ├── page.tsx        # Halaman utama dashboard SOC & employee portal
│   │   │   ├── layout.tsx      # Root layout (font, metadata)
│   │   │   ├── admin/          # Admin panel pages
│   │   │   │   └── page.tsx    # Halaman admin (campaign mgmt, user mgmt)
│   │   │   ├── auth/           # Auth flow pages (magic link callback)
│   │   │   ├── blocked/        # Halaman blocked URL (Next.js side)
│   │   │   └── api/            # Next.js Route Handlers (server-side proxy ke Flask)
│   │   │       ├── auth/       # Token validation, magic link
│   │   │       ├── admin/      # Admin API proxy
│   │   │       ├── incident/   # Terima incident dari n8n, cache di memory
│   │   │       ├── summary/    # Summary data endpoint
│   │   │       ├── cache/      # Cache data management
│   │   │       ├── event/      # Event tracking
│   │   │       ├── employee/   # Employee data
│   │   │       ├── behavior/   # AI behavioral analysis results
│   │   │       ├── quiz/       # Gamification quiz endpoints
│   │   │       ├── policy/     # Policy data
│   │   │       ├── config/     # Config endpoint
│   │   │       ├── user-activity/    # User activity tracking
│   │   │       └── user-eligibility/ # User eligibility check
│   │   ├── components/         # Shared React components
│   │   │   ├── AnimatedLogo.tsx      # Logo animasi Human Firewall
│   │   │   ├── Logo.tsx              # Logo statis
│   │   │   ├── ReportingBadgesWidget.tsx # Widget badge & gamifikasi
│   │   │   └── SidebarNav.tsx        # Navigasi sidebar
│   │   ├── context/
│   │   │   └── AuthContext.tsx       # React Context untuk auth state
│   │   ├── hooks/
│   │   │   └── usePolling.ts         # Hook polling real-time data
│   │   ├── lib/                # Utility / helper functions
│   │   └── proxy.ts            # Server-side proxy helper
│   ├── package.json
│   ├── next.config.ts
│   ├── Dockerfile              # Container build untuk Next.js
│   └── tsconfig.json
│
├── gophish/                    # GoPhish Phishing Simulation Engine
│   ├── Dockerfile              # Custom GoPhish container
│   ├── config.json             # GoPhish runtime config (ports, DB path, TLS)
│   └── config.json.example     # Template konfigurasi
│
├── n8n-workflows/              # n8n Automation Workflows
│   ├── flow-a.json             # Flow A: GoPhish event → Flask API (click tracking)
│   └── Flow B — Threat Reporting (Fully Configured).json
│                               # Flow B: URL submission → VirusTotal/URLScan → Telegram alert
│
├── .env                        # Environment variables (SECRET, API KEYS) — JANGAN di-commit!
├── .env.example                # Template .env untuk onboarding
├── docker-compose.yml          # Orkestrasi semua service Docker
├── README.md                   # Dokumentasi utama
└── DEVELOPER_GUIDE.md          # Panduan untuk developer
```

---

## Environment Variables Wajib

| Variable           | Digunakan oleh         | Keterangan                              |
| ------------------ | ---------------------- | --------------------------------------- |
| `ADMIN_PASSWORD`   | Flask                  | Password admin dashboard                |
| `SECRET_KEY`       | Flask, n8n             | Flask session secret + shared HMAC key  |
| `SERVICE_API_KEY`  | Flask, Next.js, n8n    | Bearer token server-to-server           |
| `GOPHISH_API_KEY`  | Flask                  | API key untuk GoPhish client            |
| `GOPHISH_API_URL`  | Flask                  | URL GoPhish API (http://gophish:3333)   |
| `VT_API_KEY`       | n8n (Flow B)           | VirusTotal API key                      |
| `URLSCAN_API_KEY`  | n8n (Flow B)           | URLScan.io API key                      |
| `BOT_USERNAME`     | Flask, Next.js         | Telegram bot username (magic link auth) |
| `SOC_CHAT_ID`      | Flask, n8n             | Telegram chat ID untuk SOC alert        |
| `WEBHOOK_URL`      | n8n                    | Public URL untuk n8n webhook            |
| `ALLOWED_ORIGINS`  | Flask CORS             | Whitelist origin (e.g. http://localhost:3000) |

---

## Where to Find Things

| Task | Lokasi |
|------|--------|
| Tambah API endpoint baru | `backend/routes/<nama>.py` + register di `backend/app.py` |
| Modifikasi landing page phishing | `backend/templates/tier1.html` atau `tier2.html` |
| Modifikasi threat intelligence | `backend/services/threat_service.py` |
| Modifikasi GoPhish API client | `backend/gophish_client.py` |
| Modifikasi schema database | `backend/database.py` |
| Tambah fitur gamifikasi | `backend/gamification_routes.py` + `backend/badges.json` |
| Modifikasi halaman dashboard SOC | `dashboard/src/app/page.tsx` |
| Modifikasi halaman admin | `dashboard/src/app/admin/page.tsx` |
| Tambah Next.js API route | `dashboard/src/app/api/<nama>/route.ts` |
| Modifikasi shared component | `dashboard/src/components/` |
| Tambah n8n workflow | `n8n-workflows/<nama>.json` |
| Konfigurasi GoPhish | `gophish/config.json` |
| Tambah service Docker baru | `docker-compose.yml` |
| Seed data awal | `backend/seed_data.py` |

---

## Business Layer Stubs

> Entry points utama untuk setiap domain fungsional:

- **Phishing Simulation** — `backend/routes/events.py` (redirect handler, fake login, training delivery)
- **Threat Intelligence** — `backend/services/threat_service.py`, `n8n-workflows/Flow B`
- **Gamification** — `backend/gamification_routes.py`, `backend/badges.json`
- **SOC Dashboard** — `dashboard/src/app/page.tsx`, `dashboard/src/app/api/incident/`
- **Auth (Admin)** — `backend/routes/auth.py` (session + bearer token)
- **Auth (Employee)** — Bot-First Magic Link via Telegram → `backend/routes/auth.py` → `dashboard/src/context/AuthContext.tsx`
- **Campaign Management** — `backend/routes/admin_api.py` + `backend/gophish_client.py`
- **Incident Alerting** — `n8n-workflows/Flow B` → Telegram SOC channel
- **Database** — `backend/database.py` (SQLite, semua operasi CRUD ada di satu file ini)

---

## Data Flow

```
Karyawan klik link phishing
  └→ GoPhish :8080 (landing page redirect)
       └→ Flask /r/<rid> (events.py — catat klik, set cookie)
            └→ n8n Flow A (webhook: kirim event ke Flask DB)
                 └→ Flask DB (simpan event)
                      └→ Dashboard Next.js (polling /api/summary)

Karyawan laporkan URL mencurigakan
  └→ Dashboard Next.js (form submit)
       └→ Flask /api/threat
            └→ n8n Flow B (VirusTotal + URLScan.io analysis)
                 └→ Telegram SOC Alert
                      └→ Flask /api/incident (simpan hasil)
                           └→ Dashboard (real-time update via polling)
```
