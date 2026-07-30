# 🛡️ HUMAN FIREWALL PLATFORM
## Technical Execution & Demo Specification (Capstone & Hackathon Track)

> **Fokus Dokumen:** Eksekusi Teknis, Arsitektur Sistem, Flow Demo Live, & Pembuktian Solusi  
> **Versi:** 2.0 (Technical Release)  
> **Target Audience:** Penguji Capstone Design, Juri Teknikal Hackathon, & Team SOC  

---

## 📌 DAFTAR ISI
1. [Ringkasan Teknis & Problem-Solution Fit](#1-ringkasan-teknis--problem-solution-fit)
2. [Spesifikasi Arsitektur Sistem (4-Layer Stack)](#2-spesifikasi-arsitektur-sistem-4-layer-stack)
3. [Alur Eksekusi Teknis (Flow A & Flow B Implementation)](#3-alur-eksekusi-teknis-flow-a--flow-b-implementation)
4. [Mesin Gamifikasi & Unified Data Pipeline](#4-mesin-gamifikasi--unified-data-pipeline)
5. [Panduan Langkah Skenario Live Demo](#5-panduan-langkah-skenario-live-demo)
6. [Lingkup Batasan Masalah & Spesifikasi Lingkungan (Environment)](#6-lingkup-batasan-masalah--spesifikasi-lingkungan-environment)

---

## 1. RINGKASAN TEKNIS & PROBLEM-SOLUTION FIT

**Human Firewall** adalah platform *Human Risk Management (HRM)* yang dirancang untuk mengatasi kerentanan perilaku keamanan manusia (*human vulnerability*) melalui **simulasi phishing adaptif** dan **triase ancaman instan berbasis bot chat**.

### 🎯 Pembuktian Solusi via Demo (Demonstrable Value):
* **Problem:** Karyawan sering menjadi sasaran phishing dan tidak memiliki saluran cepat untuk melaporkan ancaman ke tim SOC.
* **Solution:** Saluran pelaporan instan via Telegram Bot yang memindai biner & URL secara otomatis menggunakan VirusTotal v3 & urlscan.io dalam waktu `< 30 detik`.

---

## 2. SPESIFIKASI ARSITEKTUR SISTEM (4-LAYER STACK)

Seluruh ekosistem berjalan di atas arsitektur containerized **Docker Compose**:

```text
                  +---------------------------------------------------+
                  |   Next.js 16 Presentation Layer (App Router)      | (Port 3000)
                  |   • User Portal & Dynamic Badges Widget           |
                  |   • Multi-Role SOC Admin Dashboard                |
                  +-------------------------+-------------------------+
                                            |
                                            v
+------------------+     +------------------+------------------+     +-------------------+
|  n8n Orchestrator| <-> |    Flask API Analytics & Database   | <-> |  GoPhish Engine   |
|   (Port 5678)    |     |      (Port 5000) - Single Source   |     | (Port 3333/8080)  |
|  • Flow A & B    |     |      of Truth (database.py)       |     | • Email Campaigns |
+---------+--------+     +------------------+------------------+     +-------------------+
          |                                 |
          v                                 v
+---------+--------+             +----------+----------+
| Telegram Bot API |             |  SQLite Persistence |
| VirusTotal API   |             |  (Docker Named Vol) |
| urlscan.io API   |             +---------------------+
+------------------+
```

### ⚙️ Komponen Rinci:
1. **Presentation Layer (Next.js 16):** Dashboard interaktif berbasis React 19, Lucide Icons, dan custom polling hooks untuk update statistik tanpa beban server yang berlebihan.
2. **Core Analytics & Persistence (Flask 3.x + SQLite):** Memegang *Single Source of Truth* (`database.py`) untuk skor poin pengguna, re-klasifikasi lencana dinamis, dan pencatatan insiden.
3. **Orchestration Layer (n8n 2.26):** Menangani *workflow logic* penerimaan webhook Telegram Bot, pengunduhan biner mentah, pemanggilan API VirusTotal v3 & urlscan.io, serta pengiriman alert SOC.
4. **Simulation Engine (GoPhish):** Mesin peluncur email simulasi phishing massal dan pengumpul data respon landing page.

---

## 3. ALUR EKSEKUSI TEKNIS (FLOW A & FLOW B IMPLEMENTATION)

### 🌊 Flow A: Adaptive Phishing Simulation & Retraining
* Admin memicu kampanye dari GoPhish.
* Kejadian klik atau pengisian data ditangkap via webhook dan memicu penyesuaian poin (`POINTS_CLICK_LINK = -10`, `POINTS_CREDENTIAL_LEAK = -20`).
* Karyawan secara otomatis diarahkan ke modul **Tier 1 (Basic Phishing)** atau **Tier 2 (Advanced Credentials & URL Analysis)**.

### 🛡️ Flow B: Telegram Bot Threat Triaging
* Karyawan mengirimkan file atau link ke Telegram Bot.
* Workflow n8n mengunduh file biner mentah dan memindai hash SHA-256 via VirusTotal API v3. Untuk URL, n8n memicu pemindaian VirusTotal + urlscan.io.
* **Hasil Malicious:** Karyawan menerima notifikasi konfirmasi bahaya + **+15 Poin Reputasi**, tiket insiden dibuat di database (`threat_reports`), dan notifikasi darurat dikirim ke grup Telegram SOC.

---

## 4. MESIN GAMIFIKASI & UNIFIED DATA PIPELINE

### 🎮 Sistem Poin & Klasifikasi Lencana
* Poin awal netral: `100 Pts` (Clamping Min: `0`, Max: `200`).
* **Klasifikasi Tier Tier Utama:**
  * `>= 130 Pts` ➔ **Sentinel**
  * `60 - 129 Pts` ➔ **Guardian**
  * `< 60 Pts` ➔ **Vulnerable**
* **Achievement Badges:** `First Report`, `Streak Master`, `Sentinel Troops`, `Front Line Defender`.

### 🔄 Unified Activity Feed SQL Query
Menggabungkan 3 tabel utama secara kronologis real-time:
```sql
SELECT event_type, tier_assigned, campaign_id, created_at FROM events WHERE email = ?
UNION ALL
SELECT 
    CASE WHEN verdict IN ('malicious', 'suspicious') THEN 'report_malicious' ELSE 'report_safe' END as event_type,
    verdict as tier_assigned, target as campaign_id, created_at FROM threat_reports WHERE email = ?
UNION ALL
SELECT event_type, 'quiz' as tier_assigned, NULL as campaign_id, created_at FROM daily_events WHERE email = ?
ORDER BY created_at DESC LIMIT 20;
```

---

## 5. PANDUAN LANGKAH SKENARIO LIVE DEMO

### 🧪 Langkah 1: Uji Laporan File Malware EICAR (Flow B)
1. Kirimkan file `eicar_test.txt` ke Telegram Bot `@HumanFirewallBot`.
2. Amati balasan Telegram Bot (< 15 detik): Laporan terkonfirmasi berbahaya.
3. Buka Dashboard User (`http://localhost:3000`): Log Aktivitas bertambah **"🛡️ Melaporkan Ancaman Berbahaya (+15 pts)"** dan poin reputasi bertambah.
4. Buka Dashboard Admin (`http://localhost:3000/admin`): Tiket insiden baru otomatis muncul di daftar SOC.

### 🧪 Langkah 2: Uji Kuis Harian & Dynamic Badges
1. Buka Dashboard User, klik **"Jawab Kuis Hari Ini"**.
2. Jawab pertanyaan kuis dengan benar.
3. Poin bertambah **+10 pts**, *daily streak* bertambah, dan lencana baru (`Streak Master`) terbuka secara real-time.

---

## 6. LINGKUP BATASAN MASALAH & SPESIFIKASI LINGKUNGAN (ENVIRONMENT)

1. **Bot Interface:** Implementasi PoC menggunakan **Telegram Bot API**, arsitektur backend siap dihubungkan ke webhook MS Teams/Slack.
2. **Quota Handling:** Menggunakan **Threat Intelligence Cache Layer** untuk mencegah pemanggilan berulang ke API VirusTotal v3.
3. **Environment:** Diuji pada Docker Desktop 27.x (Windows/Linux) dengan container `hfl-flask`, `hfl-dashboard`, `hfl-n8n`, dan `hfl-gophish`.
