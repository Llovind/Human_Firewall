# 🛡️ Afferent — Autonomous AI Human Firewall & Behavioral Security Intelligence

> **AI-Powered Adaptive Phishing Simulation, Multi-LLM Threat Triaging, Gamified Employee Awareness, & Role-Based Cyber Security Analytics Platform**

[![Docker Compose](https://img.shields.io/badge/Docker_Compose-Supported-2496ED?logo=docker&logoColor=white)](docker-compose.yml)
[![Next.js 16](https://img.shields.io/badge/Next.js-16.2.10-000000?logo=next.js&logoColor=white)](dashboard)
[![Python Flask](https://img.shields.io/badge/Flask-3.0.0-000000?logo=flask&logoColor=white)](backend)
[![Multi--LLM Engine](https://img.shields.io/badge/AI_Engine-OpenRouter_|_Groq_|_Gemini-7C3AED?logo=openai&logoColor=white)](backend/ai_router.py)
[![n8n Orchestrator](https://img.shields.io/badge/n8n-Workflow_Automation-FF6D5A?logo=n8n&logoColor=white)](n8n-workflows)
[![GoPhish Engine](https://img.shields.io/badge/GoPhish-Simulation_Engine-00A8E8)](gophish)

**Afferent** adalah platform pertahanan keamanan siber enterprise (*Human Firewall Layer*) yang menggabungkan **Behavioral AI Intelligence**, simulasi phishing adaptif, otomatisasi penanganan insiden (*Incident Response*), sistem gamifikasi dinamis, serta kepatuhan regulasi (UU PDP & ISO 27001) dalam **4 Role-Based Executive Dashboards**.

---

## 🌟 Fitur Utama Afferent

### 🧠 1. Multi-Provider AI Behavioral Engine (`ai_router.py`)
* **Multi-LLM Failover Architecture:** Router LLM dengan sistem failover otomatis lintas provider (**OpenRouter → Google Gemini → Groq**) dengan exponential backoff.
* **AI Risk Heatmap & Deep-Dive:** Penilaian tingkat risiko (*SAFE, VULNERABLE, DANGER*) dan evaluasi pola perilaku individu secara otomatis.
* **Agentic AI Investigator:** Investigasi multi-step cerdas untuk melacak riwayat klik, insiden divisi, dan kecenderungan kelemahan spesifik karyawan.
* **AI Generative Phishing Template:** Pembuatan skenario email phishing realistis berbasis konteks berita/isu terkini menggunakan AI.
* **PII Anonymization Layer (`ai_anonymizer.py`):** Menyamarkan data sensitif karyawan menjadi token pseudonim deterministik (`EMP-4E9D2A`) sebelum dikirim ke LLM eksternal.

### 🎭 2. 4 Role-Based Security Dashboards
* **Phishing Admin Dashboard:** Manajemen kampanye GoPhish, landing page builder, sinkronisasi target grup, dan portal Mock Webmail.
* **SOC Dashboard:** Triage insiden real-time, threat cache intelligence, log keputusan kebijakan (*policy log*), dan audit log administrator.
* **GRC Dashboard:** Kesiapan regulasi (*Compliance Readiness*) terhadap **UU PDP Pasal 46** (ambang batas notifikasi 72 jam) dan **ISO 27001**, serta manajemen ambang batas batas risiko.
* **CISO Executive Dashboard:** Agregasi eksekutif secara *Read-Only* yang menggabungkan tren ancaman, distribusi risiko organisasi, dan ekspor laporan naratif.

### ⚡ 3. Automated Incident Response & Telegram Threat Triaging (Flow A & Flow B)
* **Flow A (Phishing Simulation Notification):** Deteksi klik/submit kredensial simulasi secara instan via webhook GoPhish, pengiriman materi edukasi interaktif ke pengguna, dan eskalasi otomatis ke tim SOC untuk *chronic clickers*.
* **Flow B (Telegram Threat Reporting):** Karyawan dapat melaporkan URL atau file mencurigakan via Telegram Bot. 
  * **File Inspection:** Pemindaian biner mentah via **VirusTotal API v3** (70+ engine antivirus).
  * **URL Inspection:** Deep-inspection via **VirusTotal** & **urlscan.io API**.
  * **Automated SOC Ticket:** Pembuatan tiket otomatis di database dan notifikasi real-time ke SOC Chat.

### 🎮 4. Dynamic Gamification & Quiz Revive Mechanics
* **Poin & Risk Tier System:** Penilaian berbasis reputasi (Netral 100 pt, Max 200 pt). Skor ≥130 menduduki **Sentinel**, ≥60 sebagai **Guardian**, dan <60 dikategorikan **Vulnerable**.
* **Threat Report Achievement Badges:** 4 tingkatan badge pencapaian (*Sentinel Troops*, *Front Line Defender*, *The Front Man*, *Cyber Shield Elite*) berdasarkan laporan *malicious* yang terverifikasi.
* **Daily Quiz & Streak Revival:** Kuis harian kesadaran siber dengan fitur **Quiz Revive** (kuota 3x per bulan) untuk pemulihan poin akibat insiden kelalaian.

---

## 🏗️ Arsitektur Sistem Afferent

```text
               +-----------------------------------------------------+
               |       Next.js 16 Role-Based Dashboard (:3000)        |
               | (Phishing Admin | SOC Analyst | GRC | CISO Executive) |
               +--------------------------+--------------------------+
                                          |
                                /api/admin/* proxy
                                          |
                                          v
+------------------+           +----------+----------+           +-------------------+
|  n8n Orchestrator| <=======> |   Flask API Backend  | <=======> |   GoPhish Engine  |
|   (Port 5678)    |  REST API |      (Port 5000)    |  REST API | (Port 3333/8080)  |
+---------+--------+           +----------+----------+           +-------------------+
          |                               |
          |                               ├──► Multi-LLM Router (OpenRouter / Groq / Gemini)
          v                               ├──► PII Anonymizer Layer
+------------------+                      ├──► Gamification & Quiz Engine
| Telegram Bot API |                      └──► SQLite Database (human_firewall.db)
| VirusTotal API   |
| urlscan.io API   |
+------------------+
```

| Layer | Service | Container Name | Port | Deskripsi |
| :--- | :--- | :--- | :--- | :--- |
| **1. Orchestrator** | `n8n` | `hfl-n8n` | `5678` | Otomatisasi workflow alur ancaman (Flow A & Flow B) |
| **2. Simulation** | `gophish` | `hfl-gophish` | `3333`, `8080` | Mesin simulasi phishing (Admin Panel & Phishing Server) |
| **3. Analytics & AI** | `flask_api` | `hfl-flask` | `5000` | Core API, Multi-LLM Router, Gamifikasi, & SQLite DB |
| **4. Presentation** | `dashboard` | `hfl-dashboard` | `3000` | Portal Next.js 16 4-Role Dashboards & Client Proxy |

---

## 📁 Struktur Folder Utama

```text
Afferent/
├── backend/                  # Core Flask API & AI Engine Layer
│   ├── app.py                # Flask Application Entrypoint & Auth Guard
│   ├── database.py           # Single Source of Truth & SQLite Data Access
│   ├── ai_router.py          # Multi-LLM Failover Router (OpenRouter/Groq/Gemini)
│   ├── ai_analysis.py        # SQLite Data Aggregator untuk AI Context
│   ├── ai_cache.py           # Layer Caching Hasil AI ke SQLite (TTL 1 Jam)
│   ├── ai_prompts.py         # System Prompt Engineering untuk Behavioral LLM
│   ├── ai_anonymizer.py       # Privacy & PII Pseudonymization Layer
│   ├── gamification_routes.py# Endpoints Gamifikasi, Quiz, & Leaderboard
│   ├── gophish_client.py     # GoPhish API HTTP Client
│   └── routes/               # API Blueprints (admin_api, ai_routes, auth, events, incidents, threat)
├── dashboard/                # Next.js 16 Web Presentation Layer
│   ├── src/app/dashboard/    # Role-Based Pages (phishing-admin, soc, grc, ciso)
│   ├── src/app/api/          # Next.js Route Handlers / Proxies ke Flask API
│   ├── src/components/admin/ # AI Intelligence Section, Heatmaps, & UI Components
│   └── src/lib/              # Session Store, Backend Client, & PDF Exporters
├── docs/                     # Dokumentasi Proyek
│   └── CURRENT_STATE.md      # Laporan Verifikasi Status Terkini Codebase
├── gophish/                  # Konfigurasi & Persistence Database GoPhish
├── n8n-workflows/            # Workflow Definitions JSON (flow-a.json, flow-b.json)
├── docker-compose.yml        # Orchestration Manifest untuk 4 Service Layer
├── .env.example              # Template Environment Variables
└── README.md                 # Dokumentasi Resmi Afferent
```

---

## 🚀 Panduan Memulai (Quick Start)

### 1. Prasyarat System
* **Docker** & **Docker Compose** (v2+) terinstal.
* Python 3.10+ / Node.js 20+ (jika ingin running manual tanpa Docker).
* Token Bot Telegram (dari `@BotFather`).
* API Key **OpenRouter** / **Gemini** / **Groq**.
* API Key **VirusTotal** dan **urlscan.io**.

### 2. Konfigurasi Environment Variables
Salin file `.env.example` menjadi `.env` di folder root project:

```bash
cp .env.example .env
```

Lengkapi variabel lingkungan penting:
```ini
# Core Secrets
SECRET_KEY=isi-dengan-random-secret-key
ADMIN_PASSWORD=isi-dengan-password-admin
SERVICE_API_KEY=isi-dengan-service-key

# AI LLM Provider Keys
OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxxxxxxx
OPENROUTER_MODEL=openrouter/free

# Telegram & Threat Intel
BOT_USERNAME=HFL_Notif_Bot
SOC_CHAT_ID=-100xxxxxxxxxx
VT_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
URLSCAN_API_KEY=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

### 3. Jalankan Seluruh Stack Service
Jalankan perintah berikut untuk menyalakan seluruh container:

```bash
docker compose up -d --build
```

### 4. Akses Aplikasi
* 🌐 **Afferent Dashboards:** `http://localhost:3000`
* 🔌 **Flask Core & AI API:** `http://localhost:5000`
* ⚙️ **n8n Workflow Orchestrator:** `http://localhost:5678`
* 🎣 **GoPhish Admin Panel:** `https://localhost:3333`

---

## 🧪 Workflow Testing

1. **Uji Coba AI Risk Heatmap & Narrative Report:**
   * Buka `http://localhost:3000/dashboard/soc` atau `/dashboard/grc`, masuk ke tab **AI Intelligence**.
   * Sistem akan menampilkan Heatmap Risiko Perdivisi dan Laporan Naratif Eksekutif yang di-generate langsung oleh Multi-LLM Router.
2. **Uji Coba Laporan Ancaman Telegram (Flow B):**
   * Kirimkan URL atau dokumen file mencurigakan ke Telegram Bot.
   * n8n Flow B akan mengeksekusi analisis via VirusTotal + urlscan.io, mencatat insiden ke SQLite, mengirim peringatan ke SOC, dan mengupdate poin gamifikasi pengguna.
3. **Uji Coba Simulasi Phishing (Flow A):**
   * Buka `/dashboard/phishing-admin`, buat dan luncurkan kampanye phishing GoPhish.
   * Saat target mengklik tautan simulasi, sistem akan menangkap event, mengupdate tier risiko pengguna, dan memberikan edukasi kesadaran siber.

---

## 🔒 Kebijakan Keamanan & Privasi Data

* **Privasi PII:** Data pribadi karyawan (email/nama) disamarkan oleh `ai_anonymizer.py` sebelum dikirim ke penyedia LLM publik.
* **Server-to-Server Authentication:** Komunikasi antar Next.js, n8n, dan Flask backend dilindungi oleh header `Authorization: Bearer <SERVICE_API_KEY>`.
* **Zero Hardcoded Secrets:** Seluruh workflow n8n menggunakan variabel lingkungan dinamis (`{{ $env.TELEGRAM_BOT_TOKEN }}`) untuk mencegah kebocoran kredensial di repositori.

---

## 📄 Lisensi & Hak Cipta
Hak Cipta © 2026 **Afferent (Human Firewall Team)**. Diterbitkan untuk peningkatan kesadaran dan pertahanan siber enterprise.
