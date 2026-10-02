# 🏛️ PROPOSAL ARSITEKTUR & AUDIT EXHAUSTIVE: ROLE-BASED DASHBOARD REFACTORING
> **Dokumen Perencanaan & Analisis Teknikal Lengkap (Zero Omission Audit)**  
> **Target System:** Human Firewall Lite Platform  
> **Metodologi:** Deep Codebase Audit (`backend/routes/`, `database.py`, `admin/page.tsx`, `/ai`)  
> **Penyusun:** Antigravity AI Coding Assistant  
> **Tanggal:** 3 Agustus 2026  

---

## 📌 Executive Summary

Dokumen ini merupakan proposal perencanaan ulang arsitektur dashboard **Human Firewall** berbasis **Role-Based Access Control (RBAC)**. 

Proposal ini disusun berdasarkan **audit exhaustive (100% komprehensif tanpa ada fitur yang terlewat)** dari seluruh endpoint Flask backend, route handler Next.js API, serta 2.534 baris kode UI monolitik di `admin/page.tsx` dan modul AI `/ai`.

---

## 1. 🔍 Audit Exhaustive Seluruh Fitur Existing & Modul AI Jaldi

Berikut adalah daftar lengkap 8 modul fitur yang ada di platform saat ini:

### 1.1 Modul 1: GoPhish Phishing Simulation Management
* **Fitur UI:**
  * GoPhish Metrics Summary Cards (Total Campaigns, Active Campaigns, Emails Sent, Opened Rate %, Clicked Rate %, Credential Submission Rate %).
  * Active & Past Campaign Table (ID, Nama Campaign, Status `In Progress`/`Completed`, Launch Date, Detail Statistik).
  * Tombol Hapus Campaign (`DELETE`).
  * Modal Launch New Campaign (Nama, Template Email, Landing Page, Sending Profile SMTP, Target Group, Schedule).
  * Site Importer Tool / Modal (Import URL website resmi untuk di-clone jadi GoPhish landing page).
  * GoPhish Resource Manager (View/Create/Update/Delete Template Email, Landing Page, Sending Profile).
* **Endpoint API Backend:**
  * `GET /api/admin/gophish/campaigns`, `GET/DELETE /api/admin/gophish/campaigns/<id>`
  * `POST /api/admin/gophish/launch`
  * `POST /api/admin/gophish/import-site`
  * `GET/POST/PUT/DELETE /api/admin/gophish/templates` & `pages`
  * `GET /api/admin/gophish/resources`

### 1.2 Modul 2: Roster & Employee Management
* **Fitur UI:**
  * Employee Roster Directory Table (Email, Divisi, Poin, Badges, Status Aktif, Jumlah Klik Phishing).
  * Modal Add New Employee (Tambah email & pilih divisi).
  * Modal Edit Employee (Update divisi, reset poin/badge).
  * GoPhish Roster Sync Button (Sinkronisasi SQLite `user_history` ke GoPhish Target Group).
  * Division Manager (Tambah/Edit divisi korporat misal `Network Operations`, `Sales Support`).
  * Admin Login History Audit Log (Tabel audit login admin: IP, Device, Location, Network/VPN status, Risk `LOW`/`MEDIUM`/`HIGH`).
* **Endpoint API Backend:**
  * `GET/POST/PUT /api/admin/employees`
  * `GET/POST /api/admin/divisions`
  * `POST /api/admin/gophish/sync`
  * `GET /api/admin/login-history`

### 1.3 Modul 3: Incident Response & Threat Triage (Flow B)
* **Fitur UI:**
  * Real-Time Incident Feed Table (Ticket ID, Source `simulation` vs `real_world_report`, Target Email/Domain, Severity `critical`/`high`/`medium`/`low`, Status `open`/`closed`).
  * Drawer / Modal Detail Insiden (Visualisasi skor VirusTotal VT, urlscan.io verdict, screenshot bukti, raw report Telegram, tombol ubah status `open` ↔ `closed`).
  * Threat Cache Table (URL yang pernah ditriage, threat type, detection source, score, timestamp).
  * Manual Blocklist Manager (Input URL/Domain terlarang manual, set threat score, manual block override).
* **Endpoint API Backend:**
  * `GET/POST/PATCH /api/incidents`, `/api/incidents/<ticket_id>`
  * `GET/POST /api/admin/threat-cache`
  * `POST /api/threat/analyze`

### 1.4 Modul 4: Policy Engine & Adaptive Blocklist
* **Fitur UI:**
  * Policy Decision Engine Audit Log (Tabel keputusan otomatis: Decision ID, Timestamp, Threat Score, Behavior Score, Final Action `BLOCK`/`WARNING`/`ALLOW`/`NOTIFY_SOC`, Reason).
  * Adaptive Blocklist Viewer (Daftar URL terblokir otomatis akibat kombinasi threat score + penalty perilaku karyawan).
* **Endpoint API Backend:**
  * `GET /api/policy`
  * `GET /blocked`, `/go`, `/visit` (Proxy Enforcement Handler)

### 1.5 Modul 5: Gamification, Leaderboard, & Compliance
* **Fitur UI:**
  * Individual Leaderboard Table (Peringkat #1-N, Email, Divisi, Poin, Badges `Sentinel`/`Guardian`/`Vulnerable`, Streak Bebas Insiden).
  * Division Leaderboard Table (Nama Divisi, Rata-rata Poin, Jumlah Anggota, Tier Risiko).
  * Badge Manager & Threshold Matrix.
  * Compliance Progress Card (Estimasi penghematan finansial IDR, % kepatuhan UU PDP/ISO27001).
* **Endpoint API Backend:**
  * `GET /api/admin/leaderboard`
  * `GET /api/admin/compliance-summary`
  * `GET /api/employee/<id>/reports-summary`
  * `POST /api/quiz/complete`, `/quiz/revive`, `/quiz/today`

### 1.6 Modul 6: Mock Webmail Viewer (Demo Tool)
* **Fitur UI:**
  * Mock Mailbox Viewer (Tabel email masuk simulasi phishing untuk testing penerimaan email karyawan).
  * Preview Pane (Melihat tampilan HTML email simulasi).
* **Endpoint API Backend:**
  * `GET /api/emails`

### 1.7 Modul 7: AI Behavioral Analysis & Executive PDF Export (Fitur Jaldi)
* **Fitur UI (`/ai` Page):**
  * Org Risk Heatmap Grid (Visualisasi kartu risiko karyawan: `SAFE`, `VULNERABLE`, `DANGER`).
  * Individual User AI Drill-Down (Detail kerentanan `phishing_email`, `credential_harvesting`, pesan edukasi personal, priority action).
  * Timeframe Filter (1, 7, 14, 30 Hari) & Force Refresh Cache Button.
  * Executive Narrative Report View (Executive summary, color-coded key findings, division risk table, trend analysis, SOC recommendations).
  * **jsPDF Professional Exporter:** Generator PDF A4 resmi dengan Cover Page, Running Headers/Footers, Nomor Halaman, Tabel Divisi, & Watermark `CONFIDENTIAL`.
* **Endpoint API Backend:**
  * `GET /api/ai/classify-all`
  * `GET /api/ai/user/<email>`
  * `GET /api/ai/report`
  * `POST /api/ai/cache/invalidate`, `GET /api/ai/cache/stats`

### 1.8 Modul 8: Generative & Agentic AI Tools (Fitur Jaldi)
* **Fitur & Endpoint API:**
  * **GoPhish AI Email Generator (`POST /api/ai/gophish/generate`):** Input tema (misal "BPJS Ketenagakerjaan"), scrape website referensi via Firecrawl API (opsional), buat HTML phishing realistis, & otomatis push ke GoPhish API.
  * **Agentic AI Investigator (`POST /api/ai/agentic/investigate`):** Input email & free-text query, LLM menjalankan *OpenAI-Style Tool Calling* secara otonom (query user history, ranking divisi, insiden aktif) untuk memberikan rekomendasi investigasi.
  * **AI Router Status (`GET /api/ai/router/status`):** Endpoint pemantau status API Key (OpenRouter, Gemini, Groq).

---

## 🎯 2. Evaluasi 3 Opsi Strategi Scope (Persiapan September MVP)

Mengingat **backend saat ini bersifat All-or-Nothing** (belum ada tabel role DB atau middleware RBAC granular), berikut 3 opsi strategi yang dianalisis:

```text
┌──────────────────────────────────────────────────────────────────────────┐
│                          3 OPSI STRATEGI SCOPE                           │
├──────────────────────────────────────────────────────────────────────────┤
│  [ OPSI 1: MINIMAL ]      [ OPSI 2: MENENGAH (REKOMENDASI) ] [ OPSI 3: PENUH ]  │
│  2 Role (Admin vs Exec)   4 Role UI Workspace Filtering     4 Role End-to-End  │
│  Effort: 1-2 Hari         Effort: 3-4 Hari                  Effort: 8-10 Hari │
│  Risk: Sangat Rendah      Risk: Rendah (Aman Demo)          Risk: Tinggi (Core)│
└──────────────────────────────────────────────────────────────────────────┘
```

| Parameter | Opsi 1: Minimal Scope (2 Role) | Opsi 2: Menengah / Balanced (4 Role UI Filtering) ⭐ REKOMENDASI | Opsi 3: Penuh / Full Scope (4 Role End-to-End) |
|---|---|---|---|
| **Role yang Dibangun** | 2 Role (`Super Admin` vs `Exec`) | **4 Role (`Phishing Admin`, `SOC`, `GRC`, `CISO`)** | 4 Role (`Phishing Admin`, `SOC`, `GRC`, `CISO`) |
| **Tampilan Frontend** | Filter Tab dasar | **Workspace Filter per Role** di Topbar & Sidebar `admin/page.tsx` | 4 Folder Halaman Next.js Terpisah (`/dashboard/*`) |
| **Backend Enforcement** | Basic `session['is_admin']` | All-or-Nothing (Frontend Role Hiding + **Security Debt Note**) | Granular `@require_role('soc')` Decorators di Flask |
| **Database Schema** | Tidak ada perubahan | Tidak ada perubahan | Tambah tabel `users` & `user_roles` di SQLite |
| **Estimasi Effort** | 1 - 2 Hari Kerja | **3 - 4 Hari Kerja** | 8 - 10 Hari Kerja |
| **Tingkat Risiko** | 🟢 Sangat Rendah | 🟢 **Rendah (Aman untuk Demo & Pitching)** | 🔴 Tinggi (Risiko Break di Routing Utama) |
| **Kesesuaian Target** | Kurang menjual saat demo | **SANGAT IDEAL UNTUK MVP SEPTEMBER** | Ideal untuk Post-MVP / Production Phase |

---

## 📋 3. Matriks Mapping Exhaustive (Seluruh 8 Modul vs 4 Role)

Berikut adalah pemetaan **100% seluruh fitur** ke 4 peran untuk **Opsi 2 (Balanced Scope)**:

| Modul & Fitur Spesifik | Phishing Admin | SOC Analyst | GRC Specialist | CISO Executive | Backend Endpoint |
|---|:---:|:---:|:---:|:---:|---|
| **1. GoPhish Campaign Launch & Delete** | 🟢 **Write** | ❌ No | ❌ No | ❌ No | `/api/admin/gophish/launch`, `/campaigns` |
| **1. GoPhish Site Importer (Clone)** | 🟢 **Write** | ❌ No | ❌ No | ❌ No | `/api/admin/gophish/import-site` |
| **1. GoPhish Resource Manager** | 🟢 **Write** | ❌ No | ❌ No | ❌ No | `/api/admin/gophish/templates`, `/pages` |
| **2. Tambah / Edit Karyawan & Divisi** | 🟢 **Write** | ❌ No | 👁️ Read | ❌ No | `/api/admin/employees`, `/divisions` |
| **2. Sync Roster Karyawan ke GoPhish** | 🟢 **Write** | ❌ No | ❌ No | ❌ No | `/api/admin/gophish/sync` |
| **2. Admin Login History Audit Log** | ❌ No | 🟢 **Audit** | 👁️ Read | 👁️ Read | `/api/admin/login-history` |
| **3. Real-Time Incident Feed & Triage**| ❌ No | 🟢 **Write (Close/Open)** | 👁️ Read | 👁️ Read | `/api/incidents` |
| **3. Manual Threat Cache & URL Block** | ❌ No | 🟢 **Write** | ❌ No | ❌ No | `/api/admin/threat-cache` |
| **4. Policy Engine Decision Audit Log**| ❌ No | 🟢 **Write** | 👁️ Read | 👁️ Read | `/api/policy` |
| **5. Leaderboard & Badge Manager** | 👁️ Read | 👁️ Read | 🟢 **Manage** | 👁️ Read | `/api/admin/leaderboard` |
| **5. Compliance & Financial Savings**| ❌ No | 👁️ Read | 🟢 **Manage** | 👁️ Read | `/api/admin/compliance-summary` |
| **6. Mock Webmail Viewer (Demo Tool)**| 🟢 **Write** | ❌ No | ❌ No | ❌ No | `/api/emails` |
| **7. AI Risk Heatmap (User Drill-Down)**| ❌ No | 🟢 **Interactive** | 👁️ Read | ❌ No | `/api/ai/user/<email>` |
| **7. AI Risk Heatmap (Org Aggregate)** | ❌ No | 👁️ Read | 🟢 **Interactive** | 👁️ **Read-Only** | `/api/ai/classify-all` |
| **7. Executive PDF Export (`jsPDF`)** | ❌ No | ❌ No | 🟢 **Generate** | 👁️ **View/Download** | `/api/ai/report` |
| **8. GoPhish AI Email Generator** | 🟢 **Write** | ❌ No | ❌ No | ❌ No | `/api/ai/gophish/generate` |
| **8. Agentic AI Investigator (Trigger)**| ❌ No | 🟢 **Trigger** | 👁️ Audit Trail | 👁️ Audit Trail | `/api/ai/agentic/investigate` |

---

## 🛠️ 4. Solusi Terhadap 3 Isu Teknis Utama

### ❓ Isu 1: AI Risk Heatmap Dipakai 3 Role (SOC, GRC, CISO)
* **Solusi Teknikal:** Gunakan **1 Komponen Reusable (`AIRiskHeatmap.tsx`) dengan `viewMode` prop**:
  ```tsx
  interface AIRiskHeatmapProps {
    viewMode: 'soc_interactive' | 'grc_aggregate' | 'ciso_readonly';
  }
  ```
* **Keunggulan:** Menghindarkan duplikasi 85% kode rendering visual UI. CISO mendapat tampilan statistik makro bersih tanpa tombol interaktif, GRC mendapat filter divisi, dan SOC mendapat tombol drill-down individu.

---

### ❓ Isu 2: Mencegah Spaming Quota LLM (`/api/ai/classify-all`)
* **Solusi 3-Lapis:**
  1. **Leverage `ai_cache.py` (TTL 1 Jam):** Respons disajikan instan dari SQLite cache jika belum expired.
  2. **Role-Gated Force Refresh:** Tombol *Force Refresh* disembunyikan dari CISO. Hanya GRC & SOC yang memiliki izin memicu pembaruan cache.
  3. **Single-Flight Lock (Backend Mutex):** Di `ai_routes.py`, pasang lock sederhana agar 2 request bersamaan dari pengguna yang berbeda tidak memicu pemanggilan API LLM ganda.

---

### ❓ Isu 3: Audit Trail untuk Agentic Investigator
* **Solusi Skema Database:**
  Tambahkan tabel `agentic_investigations` di SQLite (`database.py`):
  ```sql
  CREATE TABLE IF NOT EXISTS agentic_investigations (
      id           TEXT PRIMARY KEY,
      target_email TEXT NOT NULL,
      operator_email TEXT NOT NULL,
      query_text   TEXT NOT NULL,
      steps_json   TEXT NOT NULL,
      report_json  TEXT NOT NULL,
      created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
  ```
* **Pemisahan Akses:** SOC Analyst memicu investigasi baru (`POST`), sementara GRC & CISO dapat meninjau riwayat investigasi (`GET /api/ai/agentic/history`) untuk keperluan audit kepatuhan.

---

## ⚠️ 5. Berkas Berpotensi Conflict & Rekomendasi Akhir

### Berkas yang Harus Hati-hati Disentuh:
1. 🛑 `dashboard/src/app/admin/page.tsx` — Saring tab via state `userRole` tanpa membongkar komponen utama.
2. 🛑 `backend/database.py` — Pertahankan query `UNION ALL` activity feed. Penambahan tabel baru wajib menggunakan `CREATE TABLE IF NOT EXISTS`.
3. 🛑 `backend/app.py` — Jaga middleware agar `SERVICE_API_KEY` tetap berfungsi untuk n8n & Next.js proxy.

---

### 🛑 KESIMPULAN

> **Rekomendasi Akhir:** Ambil **Opsi 2 (Balanced Scope — 4 Role UI Workspace Filtering)**.  
> Opsi ini secara visual menghadirkan **pembagian 4 role enterprise yang sempurna saat demo/pitching** (Phishing Admin, SOC, GRC, CISO), dikerjakan secara aman dalam **3-4 hari kerja**, tanpa risiko merusak backend atau routing mendekati deadline September.
