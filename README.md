# 🛡️ Human Firewall Platform

> **Adaptive AI Phishing Simulator, Automated Incident Response, & Employee Cyber Awareness Platform**

[![Docker Compose](https://img.shields.io/badge/Docker_Compose-Supported-2496ED?logo=docker&logoColor=white)](docker-compose.yml)
[![Next.js 16](https://img.shields.io/badge/Next.js-16.2.10-000000?logo=next.js&logoColor=white)](dashboard)
[![Python Flask](https://img.shields.io/badge/Flask-3.x-000000?logo=flask&logoColor=white)](backend)
[![n8n Orchestrator](https://img.shields.io/badge/n8n-2.26.9-FF6D5A?logo=n8n&logoColor=white)](n8n-workflows)
[![GoPhish Engine](https://img.shields.io/badge/GoPhish-Supported-00A8E8)](gophish)

**Human Firewall** adalah platform keamanan siber komprehensif yang dirancang untuk melatih kesadaran keamanan karyawan (*human defense layer*) melalui simulasi phishing adaptif, otomatisasi penanganan insiden (*Incident Response*), serta gamifikasi interaktif real-time.

---

### 🌟 Fitur Utama Platform

#### 1. 🎯 Flow A: Adaptive Phishing Simulation & Retraining
* **Integrasi GoPhish:** Peluncuran kampanye simulasi phishing otomatis ke berbagai divisi perusahaan.
* **Tiered Retraining System:** Karyawan yang terjebak link phishing akan secara otomatis diarahkan ke modul edukasi kesadaran siber berbasis tingkat risiko (*Tier 1 / Tier 2 Retraining*).
* **Automatic Event Tracking:** Mencatat setiap event klik, *data submission*, hingga penyelesaian pelatihan.

#### 2. ⚡ Flow B: Telegram Bot Incident Response & Threat Triaging
* **Laporan Ancaman Instan (Telegram Bot):** Karyawan dapat melaporkan URL atau file mencurigakan langsung melalui obrolan bot Telegram.
* **Multi-Engine Threat Intelligence:**
  * **File Scan:** Mengunduh biner mentah dan memindainya via **VirusTotal API v3** (70+ engine antivirus).
  * **URL Scan:** Memindai reputasi dan *deep inspection* via **VirusTotal** & **urlscan.io API**.
* **Automated SOC Ticket Creation:** Secara otomatis membuat tiket insiden di SOC Dashboard dan mengirim notifikasi bahaya ke grup obrolan Telegram SOC.

#### 3. 🎮 Gamification & Employee Engagement (Pencapaian Keamanan)
* **Point & Reputation System:** Memberikan poin reputasi untuk laporan valid (+15 pts), kuis harian (+10 pts), dan kemenangan mini-game (+5 pts), serta penalti untuk jebakan simulasi.
* **Dynamic Badges & Ranks:** Membuka lencana pencapaian secara otomatis (`Guardian`, `Sentinel`, `First Report`, `Streak Master`, `Sentinel Troops`, `Front Line Defender`, dll.).
* **Daily Security Quiz & Streak Recovery:** Kuis kesadaran siber harian dengan sistem *Streak Recovery* untuk menjaga keterlibatan karyawan.

#### 4. 📊 SOC Admin Dashboard & Employee Portal
* **Next.js 16 Real-Time UI:** Tampilan modern berbasis Glassmorphism dengan polling data otomatis.
* **Divisional Risk Mapping:** Grafik pemetaan risiko per divisi perusahaan untuk membantu tim SOC mengidentifikasi area yang membutuhkan pelatihan khusus.
* **Threat Intelligence Cache:** Cache terpusat untuk mempercepat analisis ancaman berulang dan menghemat kuota API.

---

### 🏗️ Arsitektur & Service Layer

Platform dijalankan menggunakan **Docker Compose** multi-container yang terbagi menjadi 4 lapisan utama:

```text
                  +-----------------------------------+
                  |   Next.js 16 Presentation Layer   | (Port 3000)
                  +-----------------+-----------------+
                                    |
                                    v
+------------------+     +----------+----------+     +-------------------+
|  n8n Orchestrator| <-> |   Flask API Backend  | <-> |  GoPhish Engine   |
|   (Port 5678)    |     |      (Port 5000)    |     | (Port 3333/8080)  |
+---------+--------+     +----------+----------+     +-------------------+
          |                         |
          v                         v
+---------+--------+     +----------+----------+
| Telegram Bot API |     |  SQLite Persistence |
| VirusTotal API   |     |  (Docker Named Vol) |
| urlscan.io API   |     +---------------------+
+------------------+
```

| Layer | Service | Container Name | Port | Deskripsi |
| :--- | :--- | :--- | :--- | :--- |
| **1. Orchestrator** | `n8n` | `hfl-n8n` | `5678` | Otomatisasi workflow alur ancaman (Flow A & Flow B) |
| **2. Simulation** | `gophish` | `hfl-gophish` | `3333`, `8080` | Mesin pengirim email & landing page simulasi phishing |
| **3. Analytics & API** | `flask_api` | `hfl-flask` | `5000` | Core API business logic, gamifikasi, & SQLite database |
| **4. Presentation** | `dashboard` | `hfl-dashboard` | `3000` | Portal pengguna & SOC Admin Dashboard (Next.js) |

---

### 📁 Struktur Direktori Project

```text
Human_Firewall/
├── backend/                  # Core Flask API & Database Layer
│   ├── app.py                # Flask Application Entrypoint
│   ├── database.py           # Single Source of Truth & Gamification Engine
│   ├── gamification_routes.py# Endpoints Summary, Quiz, & Leaderboard
│   ├── routes/               # API Sub-modules (incidents, threat, auth, events)
│   └── templates/            # HTML Retraining Pages (Tier 1 & Tier 2)
├── dashboard/                # Next.js 16 Web Dashboard
│   ├── src/app/              # App Router (User Portal & Admin Dashboard)
│   ├── src/components/       # Reusable UI Components & Badges Widget
│   └── src/lib/              # State Store & Session Management
├── docker-compose.yml        # Multi-container Docker Deployment Manifest
├── gophish/                  # Configuration & Dockerfile for GoPhish Engine
├── n8n-workflows/            # Workflow JSON Definitions (Flow A & Flow B)
├── .env.example              # Template Environment Variable
└── README.md                 # Project Documentation
```

---

### 🚀 Panduan Memulai (Quick Start)

#### 1. Prasyarat System
* **Docker** & **Docker Compose** terinstal.
* Token Bot Telegram (dari `@BotFather`).
* API Key **VirusTotal** dan **urlscan.io**.

#### 2. Konfigurasi Environment Variable
Salin file `.env.example` menjadi `.env` dan lengkapi nilainya:

```bash
cp .env.example .env
```

Isi nilai-nilai penting seperti `SECRET_KEY`, `SERVICE_API_KEY`, `BOT_TOKEN`, `VT_API_KEY`, `URLSCAN_API_KEY`, dan `SOC_CHAT_ID`.

#### 3. Jalankan Seluruh Container
Jalankan perintah berikut untuk menyalakan seluruh stack service:

```bash
docker compose up -d
```

#### 4. Akses Service
* 🌐 **Dashboard User & Admin:** `http://localhost:3000`
* ⚙️ **n8n Orchestrator:** `http://localhost:5678`
* 🎣 **GoPhish Admin Panel:** `https://localhost:3333`
* 🔌 **Flask API:** `http://localhost:5000`

---

### 🧪 Workflow Pengujian (Testing Guide)

1. **Uji Coba Pengiriman File EICAR / PDF Malicious (Flow B):**
   * Kirimkan file `test_eicar.txt` atau file PDF ke Telegram Bot.
   * Workflow n8n akan mengunduh biner mentah, memindainya via VirusTotal API, dan melaporkan hasilnya ke Telegram SOC & Dashboard.
2. **Uji Coba Pengiriman URL Phishing (Flow B):**
   * Kirimkan URL tes seperti `http://testsafebrowsing.appspot.com/s/phishing.html` ke Telegram Bot.
   * Sistem akan memicu triase VirusTotal + urlscan.io, mencatat *threat cache*, dan menambah poin pencapaian pengguna.
3. **Uji Coba Kuis Harian & Badge (Gamifikasi):**
   * Buka Dashboard User di `http://localhost:3000`, jawab Kuis Harian.
   * Poin, *daily streak*, dan lencana pencapaian (`Guardian`, `Sentinel`, `First Report`, dll.) akan diperbarui secara real-time.

---

### 🔒 Keamanan & Kebijakan Data

* File `.env` dan database SQLite (`*.db`) secara ketat diabaikan dari repositori melalui `.gitignore`.
* Komunikasi antar service internal diamanahkan menggunakan `SERVICE_API_KEY` berbasis header Authorization.
* Password pengguna dan token sesi di-hash dan dikelola secara terpusat oleh Flask Single Source of Truth.

---

### 📄 Lisensi & Hak Cipta
Hak Cipta © 2026 **Human Firewall Team**. Diterbitkan untuk tujuan peningkatan kesadaran dan pertahanan keamanan siber.
