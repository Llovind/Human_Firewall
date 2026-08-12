# Afferent (Human Firewall) — Dokumentasi Status Terkini

> **Ringkasan Eksekutif**
>
> Proyek Afferent saat ini berada di **fase prototipe PoC lanjutan** yang sudah memiliki arsitektur end-to-end berjalan. Komponen yang **paling siap didemokan di HackNusa** adalah: (1) simulasi phishing via GoPhish dengan campaign management dari dashboard, (2) sistem gamifikasi lengkap (tier Sentinel/Guardian/Vulnerable, badge berbasis threat report, quiz harian, streak revival), (3) Flow B – Threat Reporting via Telegram Bot (URL + file scan dengan VirusTotal & URLScan.io) dengan notifikasi real-time ke SOC, dan (4) dashboard role-based 4 peran (Phishing Admin, SOC, GRC, CISO) yang sudah terhubung ke backend Flask. **Gap terbesar** adalah modul AI Behavioral Intelligence (endpoint `/api/ai/*`): source code `.py`-nya **hilang dari working tree** dan tidak terdaftar di `app.py` sebagai blueprint — hanya tersisa file `.pyc` cache. Artinya tab AI Heatmap dan Deep-Dive User di dashboard akan mendapat `404 Not Found` dari backend. Selain itu, integrasi SIEM/Wazuh belum diimplementasikan sama sekali. Secara keseluruhan, sekitar **70–75% fitur yang direncanakan sudah berjalan**, dan proyek ini sudah siap sebagai PoC yang meyakinkan untuk skenario cybersecurity awareness & simulation.

---

## 1. Arsitektur Sistem

### 1.1 Stack Teknologi
*(Diverifikasi dari `backend/requirements.txt`, `dashboard/package.json`, `docker-compose.yml`)*

| Layer | Teknologi | Versi |
|---|---|---|
| **Frontend** | Next.js | 16.2 (React 19) |
| **Styling** | Tailwind CSS | v4 |
| **Backend API** | Flask | 3.0.0 |
| **Backend Runtime** | Python | 3.10 / 3.13 (local) |
| **Database** | SQLite 3 | (via `human_firewall.db`) |
| **HTTP Library** | requests | 2.31.0 |
| **CORS** | Flask-Cors | 4.0.0 |
| **Env Management** | python-dotenv | 1.0.1 *(baru ditambahkan)* |
| **Automasi / Orkestrasi** | n8n | docker.n8n.io/n8nio/n8n |
| **Simulation Engine** | GoPhish | Self-built Docker |
| **Threat Intel** | VirusTotal API + URLScan.io | (via HTTP REST) |
| **Notifikasi** | Telegram Bot API | (via n8n node) |
| **Kontainerisasi** | Docker Compose | Bridge network `hfl_network` |

### 1.2 Koneksi Antar Komponen

```
Browser (Karyawan / Admin)
        │
        ▼
 [Next.js Dashboard :3000]
        │ ── /api/admin/* proxy ──► [Flask API :5000] ──► [SQLite DB]
        │                                   │
        │                                   ├──► [GoPhish :3333] (campaign mgmt)
        │                                   └──► [n8n :5678] (webhook trigger)
        │
[Telegram Bot]
        │ trigger
        ▼
    [n8n :5678]
        │── VirusTotal API ──► scan URL/file
        │── URLScan.io ──────► scan URL
        └── POST /api/incident ──► [Flask :5000] ──► [SQLite DB]
```

**Aturan penting arsitektur (dari komentar kode):**
- n8n **tidak pernah** menyentuh SQLite langsung — semua via Flask API
- Next.js Dashboard **tidak punya business logic** — murni Presentation Layer
- Auth Next.js → Flask: selalu `Authorization: Bearer <SERVICE_API_KEY>` (server-to-server)
- Auth Browser → Next.js Admin: cookie HTTP-Only `hf_admin_session` (dikelola `src/lib/adminSession.ts` dan `src/proxy.ts`)

### 1.3 Struktur Folder Utama

```
C:\Human_Firewall\
├── backend/
│   ├── app.py                      # Entry point Flask; blueprint registration; auth guard global
│   ├── database.py                 # SEMUA operasi SQLite (single source of truth)
│   ├── gamification_routes.py      # Blueprint: /api/gamification, /api/quiz, /api/employee
│   ├── gophish_client.py           # HTTP client ke GoPhish API
│   ├── ai_anonymizer.py            # PII anonymizer sebelum data dikirim ke LLM ✅ (ada source)
│   ├── routes/
│   │   ├── admin_api.py            # /api/admin/* (employees, leaderboard, GoPhish mgmt)
│   │   ├── auth.py                 # /api/auth/* (admin login, magic link, Telegram OTP)
│   │   ├── events.py               # /api/event, /api/user-history, redirect handler
│   │   ├── incidents.py            # /api/incident (CRUD triage insiden)
│   │   ├── threat.py               # /api/cache (threat intelligence cache)
│   │   └── proxy.py                # /go, /visit (phishing landing page proxy)
│   ├── __pycache__/
│   │   ├── ai_router.cpython-313.pyc    # ⚠️ Source .py HILANG
│   │   ├── ai_analysis.cpython-313.pyc  # ⚠️ Source .py HILANG
│   │   ├── ai_cache.cpython-313.pyc     # ⚠️ Source .py HILANG
│   │   └── ai_prompts.cpython-313.pyc   # ⚠️ Source .py HILANG
│   └── routes/__pycache__/
│       └── ai_routes.cpython-310.pyc    # ⚠️ Source .py HILANG, tidak di-register di app.py
├── dashboard/
│   ├── src/app/
│   │   ├── admin/login/             # Halaman login admin (role selector)
│   │   ├── dashboard/
│   │   │   ├── phishing-admin/     # Dashboard Phishing Admin
│   │   │   ├── soc/                # Dashboard SOC
│   │   │   ├── grc/                # Dashboard GRC
│   │   │   └── ciso/               # Dashboard CISO (read-only aggregation)
│   │   └── api/admin/              # Next.js Route Handlers (proxy ke Flask)
│   ├── src/components/admin/        # Komponen UI dashboard (bisa reusable)
│   ├── src/lib/
│   │   ├── backendClient.ts         # Helper fetch ke Flask dengan fallback URL
│   │   ├── adminSession.ts          # In-memory admin session store
│   │   └── ExecutivePdfExporter.ts  # PDF export via jsPDF + html2canvas
│   └── src/proxy.ts                 # Middleware Next.js (gate /api/admin/*)
├── n8n-workflows/
│   ├── flow-a.json                  # Flow A: simulasi phishing (6 nodes)
│   └── flow-b.json                  # Flow B: threat reporting (32 nodes)
├── gophish/
│   └── config.json                  # Override config GoPhish (db_path, TLS, ports)
├── instance/
│   └── human_firewall.db            # SQLite database (persistensi data)
└── docker-compose.yml               # Orchestration: n8n, gophish, flask_api, dashboard
```

---

## 2. Flow End-to-End

### 2.1 Simulasi Phishing (GoPhish Campaign)
*(Diverifikasi: `backend/gophish_client.py`, `backend/routes/admin_api.py`, `dashboard/src/app/dashboard/phishing-admin/page.tsx`)*

1. Admin membuka tab **GoPhish** di Phishing Admin Dashboard
2. Frontend `fetch('/api/admin/gophish/resources')` → Next.js proxy → `fetchFlaskBackend('/api/admin/gophish/resources')` → Flask `admin_api.py:gophish_resources()` → `gophish_client.get_templates()`, `get_pages()`, `get_sending_profiles()`
3. Admin memilih template + landing page + SMTP profile, isi nama campaign & grup target
4. Frontend `POST /api/admin/gophish/launch` → Flask `admin_api.py:gophish_launch()` → `gophish_client.launch_campaign()`
5. GoPhish mengirim email phishing ke target sesuai jadwal

**Status:** ✅ Terhubung end-to-end ke GoPhish API (saat GoPhish container running).
**Catatan:** Saat GoPhish container tidak berjalan (dev mode tanpa Docker), endpoint mengembalikan `[]` secara graceful.

### 2.2 Event Capture (Klik Link / Submit Form)
*(Diverifikasi: `backend/routes/events.py`, `n8n-workflows/flow-a.json`)*

1. Target klik link phishing → browser redirect ke `/go/<token>` atau `/visit/<token>` (Flask `proxy.py`)
2. Flask `proxy.py` meneruskan ke landing page GoPhish (port 8080)
3. GoPhish mendeteksi event (klik/submit form) → trigger webhook ke n8n
4. n8n **Flow A** (6 nodes):
   - `Webhook` → `Switch` (tentukan tier: first-timer/repeat/chronic)
   - `HTTP Request` ke Flask `POST /api/event` → simpan ke `events` table
   - `Telegram: User Click Alert` → kirim peringatan edukasi ke pengguna via Telegram
   - Jika chronic clicker → `Send a text message` ke SOC Chat ID
5. Flask `events.py:save_event()` mencatat ke tabel `events` dan update `user_history`

**Status:** ✅ Flow A terdefinisi di `flow-a.json`. Endpoint Flask tersedia. Namun **belum bisa diverifikasi end-to-end tanpa test live** karena tergantung webhook GoPhish aktif dan Telegram Bot configured.

### 2.3 Behavioral Scoring
*(Diverifikasi: `backend/database.py` — `update_behavior_score()`, `complete_quiz_for_today()`)*

Poin dihitung oleh Flask Backend saat menerima event:

| Event | Delta Poin |
|---|---|
| Quiz harian benar (`spot_the_fake_correct`) | +5 |
| Laporan ancaman terkonfirmasi malicious | +15 |
| Klik link phishing simulasi (`clicked_link`) | -10 |
| Submit kredensial simulasi (`submitted_data`) | -20 |
| Streak bonus (dari quiz) | +10 |

- Poin awal: `100` (netral)
- Batas: min `0`, max `200`
- Tier dihitung dari poin: ≥130 → `Sentinel`, ≥60 → `Guardian`, <60 → `Vulnerable`
- Badge diberikan berdasarkan total `reports_count_malicious` (dari `badges.json`)

**Status:** ✅ Logic ada di `database.py`. Gamification routes ada di `gamification_routes.py`. **Terhubung ke n8n via endpoint `/api/gamification/post_threat_report`** (dipanggil saat Flow B selesai memverifikasi ancaman).

### 2.4 Alur Data ke Dashboard
*(Diverifikasi: `dashboard/src/app/dashboard/*/page.tsx`, `src/hooks/usePolling.ts`)*

- Dashboard menggunakan **custom hook `usePolling`** yang melakukan `fetch` ke endpoint Flask setiap 3 detik
- Endpoint yang di-poll: `/api/incident`, `/api/cache`, `/api/summary`, `/api/behavior`, `/api/policy`, `/api/admin/leaderboard`, `/api/admin/compliance-summary`
- Data karyawan dan divisi di-load **sekali saat mount** via `useEffect` (`/api/admin/employees`, `/api/admin/divisions`)
- GoPhish data di-load **sekali saat mount** via `useEffect` (`/api/admin/gophish/campaigns`, `/api/admin/gophish/resources`)

**Catatan penting:** Polling dilakukan dari **browser client** langsung ke `/api/*` yang merupakan Next.js Route Handlers (proxy), bukan langsung ke Flask.

### 2.5 Keterlibatan n8n
*(Diverifikasi: `n8n-workflows/flow-a.json`, `n8n-workflows/flow-b.json`)*

**Flow A — Simulasi Phishing (6 nodes):**
- Trigger: Webhook dari GoPhish
- Routing berdasarkan tier user (first-timer / repeat / chronic)
- Output: Telegram notification ke user + HTTP request ke Flask backend
- **Status:** File definisi ada, belum bisa konfirmasi apakah sudah di-import ke n8n instance

**Flow B — Threat Reporting (32 nodes):**
- Trigger: Telegram message dari karyawan (teks URL atau dokumen file)
- URL flow: `Parse Input` → `VT Submit URL` → `wait polling` → `urlscan Submit` → `wait polling` → `Evaluate URL` → `IF Dangerous` → `Create URL Incident (POST /api/incident)` → `SOC Alert (Telegram)` → `Reply to User (Telegram)`
- File flow: `Get TG File Path` → `Download File` → `VT Submit File` → `wait polling` → `Evaluate File` → `IF Dangerous` → `Create File Incident` → `SOC Alert` → `Reply to User`
- **Status:** File definisi ada dan sangat lengkap (32 nodes). Ada file versi "Fully Configured" terpisah.

**⚠️ Perlu Verifikasi Manual:** Apakah workflow ini sudah di-import dan diaktifkan di n8n container yang berjalan.

### 2.6 SIEM / Wazuh Telemetry
**Status: ❌ Belum Diimplementasikan.**
Tidak ditemukan kode integrasi ke Wazuh atau SIEM eksternal manapun di seluruh codebase. Data keamanan disimpan di SQLite internal dan ditampilkan di dashboard. Tidak ada file connector, agent, atau syslog forwarder.

---

## 3. Fitur per Dashboard

### 3.1 Phishing Admin Dashboard
*File: `dashboard/src/app/dashboard/phishing-admin/page.tsx`*
*Tabs: `gophish` (default), `employees`, `webmail`, `leaderboard`, `ai`*

| Fitur | Status | Detail |
|---|---|---|
| Lihat daftar kampanye GoPhish | ✅ Terhubung | Fetch `/api/admin/gophish/campaigns` |
| Create/launch campaign baru | ✅ Terhubung | POST `/api/admin/gophish/launch` via modal |
| Delete campaign | ✅ Terhubung | DELETE `/api/admin/gophish/campaigns/<id>` |
| Template manager (create/edit/delete) | ✅ Terhubung | `/api/admin/gophish/templates/*` |
| Landing page builder | ✅ Terhubung | `/api/admin/gophish/pages/*` |
| Clone/import site untuk landing page | ✅ Terhubung | POST `/api/admin/gophish/import-site` |
| Sinkronisasi grup target GoPhish | ✅ Terhubung | POST `/api/admin/gophish/sync` |
| Roster Karyawan (lihat/tambah/edit) | ✅ Terhubung | `/api/admin/employees`, `/api/admin/divisions` |
| Mock Webmail (inbox tiruan) | ✅ Terhubung | Fetch `/api/admin/emails`, render inbox |
| Leaderboard divisi & individu | ✅ Terhubung | Fetch `/api/admin/leaderboard` |
| Tab AI Intelligence (Heatmap) | ⚠️ UI ada, Backend HILANG | Fetch `/api/ai/classify` → 404. Backend `ai_routes.py` tidak ada di working tree |
| Export PDF (Report tab) | ⚠️ Bergantung data AI | `markdownReport` prop harus diisi dari `/api/ai/report` yang juga hilang |

### 3.2 SOC Dashboard
*File: `dashboard/src/app/dashboard/soc/page.tsx`*
*Tabs: `overview`, `threats`, `incidents`, `cache`, `policy`, `ai`*

| Fitur | Status | Detail |
|---|---|---|
| Incident Triage (lihat, resolve) | ✅ Terhubung | Poll `/api/incident`, PATCH untuk resolve |
| Threat Cache (daftar URL berbahaya yang di-cache) | ✅ Terhubung | Poll `/api/cache` |
| Behavior Scores (skor risiko per user) | ✅ Terhubung | Poll `/api/behavior` |
| AI Summaries (ringkasan insiden singkat) | ✅ Terhubung | Poll `/api/summary` |
| Policy Decisions (log keputusan kebijakan otomatis) | ✅ Terhubung | Poll `/api/policy` |
| Login History Admin | ✅ Terhubung | Fetch `/api/admin/login-history` |
| Filter incident per jenis/tipe | ✅ Fungsional | State filter client-side |
| Tab AI Intelligence (Heatmap) | ⚠️ UI ada, Backend HILANG | Sama dengan Phishing Admin |

### 3.3 GRC Dashboard
*File: `dashboard/src/app/dashboard/grc/page.tsx`*
*Tabs: `overview`, `employees`, `leaderboard`, `compliance`, `ai`*

| Fitur | Status | Detail |
|---|---|---|
| Overview statistik insiden | ✅ Terhubung | Poll `/api/incident` |
| Roster Karyawan | ✅ Terhubung | Fetch `/api/admin/employees` |
| Leaderboard Gamifikasi | ✅ Terhubung | Poll `/api/admin/leaderboard` |
| Compliance Readiness (ISO 27001 + UU PDP) | ✅ Terhubung | Poll `/api/admin/compliance-summary` |
| Edit threshold kesiapan (non-mandatory) | ✅ Terhubung | POST `/api/admin/readiness-thresholds` (hanya clause tanpa `is_legally_mandated=1`) |
| Clause UU PDP 46 (72 jam notif pelanggaran) | ✅ Ada, terkunci | `is_legally_mandated=1`, tidak bisa diubah |
| Tab AI Intelligence | ⚠️ UI ada, Backend HILANG | Sama dengan dashboard lain |

### 3.4 CISO Dashboard
*File: `dashboard/src/app/dashboard/ciso/page.tsx`*
*Mode: Read-Only, agregasi seluruh fitur*

| Fitur | Status | Detail |
|---|---|---|
| Semua fitur SOC (read-only) | ✅ Terhubung | Poll endpoint yang sama dengan SOC |
| Compliance Readiness (read-only) | ✅ Terhubung | Poll `/api/admin/compliance-summary` |
| Leaderboard | ✅ Terhubung | Poll `/api/admin/leaderboard` |
| GoPhish campaign overview | ✅ Terhubung | Fetch `/api/admin/gophish/campaigns` |
| Tab AI Intelligence | ⚠️ UI ada, Backend HILANG | Sama |

---

## 4. Keamanan & Technical Debt

### 4.1 Status Debt Items

**2.1 — Unprotected API Routes**
- **Status: ✅ Closed (sebagian besar)**
- Flask `app.py` memiliki `@app.before_request` guard yang memerlukan `Bearer <SERVICE_API_KEY>` atau session admin untuk semua endpoint non-public
- Next.js `src/proxy.ts` mem-gate semua route `/api/admin/*` dengan cookie `hf_admin_session`
- **Sisa risiko:** `DEV_BYPASS_AUTH=true` di `.env` menonaktifkan seluruh auth guard. Harus dipastikan `false` di produksi.

**2.2 — Shared Password Lintas Role**
- **Status: ✅ Partially Closed**
- Login admin kini berbasis role-selector di halaman `/admin/login`
- Role yang dipilih disimpan di AuthContext dan menentukan redirect ke dashboard mana
- **Sisa masalah:** Backend hanya memeriksa satu `ADMIN_PASSWORD` (dari env var). Tidak ada pemisahan credential per role di level backend. Siapapun yang tahu `ADMIN_PASSWORD` bisa login sebagai role manapun.

**2.3 — Hardcoded Credentials di n8n Workflow**
- **Status: ⚠️ Belum Closed**
- Di `flow-a.json` dan `flow-b.json` terdapat nilai-nilai yang di-hardcode (chat IDs, Telegram credentials)
- Perlu diganti dengan environment variable n8n yang proper

**2.4 — Async LLM Calls**
- **Status: N/A (modul AI hilang dari working tree)**
- `ai_router.pyc` menunjukkan ada retry logic, backoff, dan failover antar provider (OpenRouter → Groq → Gemini), namun source `.py`-nya hilang sehingga tidak bisa dijalankan

**2.5 — SQLite WAL Mode**
- **Status: ⚠️ Belum Terverifikasi**
- Kode `database.py` tidak ditemukan baris `PRAGMA journal_mode=WAL` secara eksplisit. Dengan polling 3 detik dari multiple dashboard + n8n webhook bersamaan, ini potensi bottleneck di skala lebih besar.

**2.6 — Response Schema Mismatch**
- **Status: ✅ Closed**
- Frontend sudah menggunakan defensive parsing `Array.isArray(data) ? data : data?.employees || []` untuk semua endpoint yang mungkin return array langsung atau object wrapper

### 4.2 Celah Keamanan Baru (Ditemukan Selama Audit)

1. **`DEV_BYPASS_AUTH=true` di `.env` lokal:** Jika sistem naik ke produksi tanpa mengubah ini, seluruh auth guard dinonaktifkan. Tidak ada mekanisme otomatis yang memaksa nilai ini menjadi `false` di lingkungan produksi.
2. **`SERVICE_API_KEY` di `dashboard/.env.local`:** Nilai `SERVICE_API_KEY` sekarang ada di file `.env.local` yang seharusnya tidak di-commit ke Git. Perlu dipastikan file ini ada di `.gitignore`.
3. **Single shared admin password:** Tidak ada mekanisme multi-factor atau pembatasan scope per role di backend.

---

## 5. Gamification System

### 5.1 Tier & Badge System
*(Diverifikasi: `backend/database.py`, `backend/badges.json`)*

**Risk Tier (berbasis poin):**
- `Sentinel`: poin ≥ 130
- `Guardian`: poin ≥ 60 (default awal semua user)
- `Vulnerable`: poin < 60

**Achievement Badge (berbasis laporan ancaman malicious):**
Diambil dari `badges.json` — 4 tier badge:
1. `sentinel_troops` — threshold 1 laporan malicious
2. `front_line_defender` — threshold 3
3. `the_front_man` — threshold 5
4. `cyber_shield_elite` — threshold 10

Badge dihitung dinamis dari kolom `reports_count_malicious` di `user_history`.

**Status:** ✅ Logic terpusat di `database.py`. Badge config terpusat di `badges.json`. Tidak ada hardcoded badge di aplikasi.

### 5.2 Poin & Streak Logic
*(Diverifikasi: `backend/database.py` — `update_behavior_score()`, `complete_quiz_for_today()`)*

- Poin awal: `100` (bukan 0, supaya user baru terasa netral bukan sudah bermasalah)
- `daily_streak` naik saat user menyelesaikan quiz tanpa melewatkan hari
- Streak broken jika user melewatkan quiz hari ini (cek `last_quiz_completed_at`)
- `streak_before_break` disimpan untuk riwayat

**Status:** ✅ Logic ada dan lengkap di `database.py`. Endpoint tersedia di `gamification_routes.py`.

### 5.3 Quiz Revive Mechanic
*(Diverifikasi: `backend/gamification_routes.py`)*

- Endpoint: `POST /api/quiz/revive`
- Kuota revive per bulan: default `3` (tersimpan di kolom `quiz_revives_remaining` di `user_history`)
- Reset bulanan: kolom `quiz_revives_month` menyimpan format `YYYY-MM`; jika bulan berubah, kuota di-reset ke `3`
- Saat revive digunakan: streak dipulihkan, poin dikembalikan sebagian

**Status:** ✅ Implementasi ada dan lengkap. Endpoint terdaftar di `PUBLIC_ROUTES` di `app.py`.

---

## 6. Known Gaps & Mock Data

### 6.1 Fitur Belum Diimplementasikan / Source Code Hilang

| Fitur | Status | Keterangan |
|---|---|---|
| **AI Behavioral Intelligence** (`/api/ai/*`) | ❌ Backend hilang | File `.py` untuk `ai_router`, `ai_analysis`, `ai_cache`, `ai_prompts`, `ai_routes` **tidak ada di working tree**. Hanya ada `.pyc` tersisa. Blueprint tidak di-register di `app.py`. Endpoint akan 404. |
| **AI Phishing Template Generator** (`/api/ai/gophish/generate`) | ❌ Backend hilang | Endpoint yang generate email phishing + push ke GoPhish via LLM — ada di pyc, tidak ada source |
| **Agentic AI Investigator** (`/api/ai/agentic/investigate`) | ❌ Backend hilang | Multi-step reasoning agent untuk investigasi mendalam per user — ada di pyc, tidak ada source |
| **SIEM / Wazuh Integration** | ❌ Tidak ada | Tidak ada kode integrasi ke Wazuh, Elasticsearch, atau SIEM manapun |
| **Multi-factor / Per-role Password** | ❌ Tidak ada | Backend hanya punya satu `ADMIN_PASSWORD` untuk semua role |
| **Real Telegram Bot Registration Flow** | ⚠️ Partial | OTP registration flow ada di backend, belum bisa verifikasi apakah berjalan end-to-end tanpa live test |

### 6.2 Bagian yang Masih Mock / Demo Data

| Komponen | Kondisi | Detail |
|---|---|---|
| **Data Karyawan Awal** | Mock (seed) | 10 user fiktif (budi.santoso@, citra.dewi@, dsb.) di-seed via `database.init_db()` jika tabel kosong |
| **Mock Webmail** | Mock mandiri | Inbox karyawan berjalan pada tabel `inbox_emails` yang berisi email tiruan, tanpa mail server sungguhan |
| **GRC Threshold Seed** | Demo defaults | Nilai ambang batas ISO 27001 & UU PDP di-seed dengan nilai default dari riset industri (KnowBe4, Proofpoint), bisa diedit dari UI |
| **Leaderboard Fallback** | Hardcoded fallback | `LeaderboardSection.tsx` memiliki fallback data dummy jika fetch `/api/admin/leaderboard` gagal — ini tampil sebagai "demo data" |
| **AI Heatmap** | UI kosong / error | Komponen `AIIntelligenceSection.tsx` fetch `/api/ai/classify?role=...` yang akan return 404. UI akan menampilkan state loading tanpa data |
| **Executive Report (Markdown)** | Tidak ada konten | Props `markdownReport` dikirim kosong (`''`) ke `AIIntelligenceSection` karena endpoint report juga hilang |

---

*Dokumen ini dihasilkan dari verifikasi langsung terhadap source code di `C:\Human_Firewall` pada 12 Agustus 2026.*
*Setiap klaim yang tidak bisa diverifikasi secara langsung dari kode telah ditandai dengan ⚠️ atau [Perlu Verifikasi Manual].*
