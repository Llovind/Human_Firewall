# 📘 ARSITEKTUR & PENJELASAN INTEGRASI MODUL AI BEHAVIORAL ANALYSIS

> **Dokumen Single Source of Truth**  
> Penjelasan lengkap mengenai arsitektur, alur data, komponen baru, dan dampak integrasi branch `AI-Behavioral-New` (buatan Jaldi) terhadap infrastruktur **Human Firewall**.

---

## 📖 1. Ringkasan Eksekutif: Sebelum vs Sesudah Integrasi

Sebelum integrasi modul AI, **Human Firewall** berfokus pada **Pengumpulan Data Operasional (Operational Layer)**:
- Mengirim simulasi phishing via GoPhish.
- Menerima laporan ancaman karyawan via Telegram Bot (`n8n`).
- Menghitung poin gamifikasi dan menampilkan log aktivitas di database SQLite.

Dengan masuknya **Modul AI Behavioral Analysis**, kita menambahkan **Layer Kecerdasan Eksekutif (Intelligence Layer)** di atas data operasional yang sudah ada.

```
┌─────────────────────────────────────────────────────────────────┐
│                 BEFORE (Layer Data Operasional)                 │
│  SQLite DB: "Dewi klik 6 link phishing, skip 4 kali training"   │
└────────────────────────────────────────┬────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────┐
│              AFTER (Layer Kecerdasan AI / Intelligence)         │
│  LLM Engine: "Dewi berada pada RISIKO TINGGI (Vulnerable).      │
│  Vektor Kerentanan: Credential Harvesting.                      │
│  Tindakan Mendesak: Wajibkan Retraining Kredensial hari ini."   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🗺️ 2. Arsitektur Infrastruktur & Dual Failover Chain

Integrasi ini **TIDAK MENGUBAH ATAU MERUSAK** arsitektur dasar projek. Modul AI ditambahkan sebagai *blueprint & halaman terpisah* yang mengonsumsi data SQLite yang sudah ada.

### 2.1 Peta Komponen Infrastruktur

```text
 💻 PRESENTATION LAYER (Next.js - Port 3000)
 ├── /admin                   <-- Dashboard Utama (Flow A, Flow B, Incidents, Gamification)
 └── /ai                      <-- [MODUL AI] Dashboard Analisis Perilaku AI & Export PDF
      │
      │ HTTP REST API (Port 5000)
      ▼
 🐍 ANALYTICS & API LAYER (Flask Backend - Port 5000)
 ├── database.py              <-- Database Utama SQLite (Single Source of Truth) [UTUH!]
 ├── ai_analysis.py           <-- Aggregator data SQLite untuk disuap ke AI
 ├── ai_anonymizer.py         <-- Layer Privasi: Sensor email/PII sebelum dikirim ke LLM
 ├── ai_cache.py              <-- Cache SQLite (TTL 1 jam) agar hemat kuota API LLM
 ├── ai_router.py             <-- Router Failover Multi-LLM (Eksplisit 2 Chain Terpisah)
 └── routes/ai_routes.py      <-- Blueprint Endpoint API AI (/api/ai/*)
      │
      │ HTTPS External API Calls
      ▼
 🌐 EXTERNAL LLM PROVIDER LAYER (Dual Failover Chains)
 ├── Chain A (Text Generation): OpenRouter ➔ Gemini Native ➔ Groq
 └── Chain B (Agentic Tool-Calling): OpenRouter ➔ Groq
```

---

### 2.2 Spesifikasi Dua (2) Failover Chain yang Berbeda

Sistem ini memiliki **dua alur (chain) failover yang terpisah** secara eksplisit berdasarkan tipe kebutuhan LLM:

```
[ CHAIN A: Standard Text Generation ]
  (classify-all, user/<email>, report)
  
  ┌─────────────────┐       Fail       ┌─────────────────────┐       Fail       ┌─────────────────┐
  │ 1. OpenRouter   │ ───────────────► │ 2. Gemini Flash     │ ───────────────► │ 3. Groq API     │
  │ (Llama 3.3, etc)│                  │    Native SDK       │                  │ (Llama 3.3 70B) │
  └─────────────────┘                  └─────────────────────┘                  └─────────────────┘


[ CHAIN B: Agentic Tool-Calling / Function Calling ]
  (agentic/investigate)
  
  ┌─────────────────┐       Fail       ┌─────────────────┐
  │ 1. OpenRouter   │ ───────────────► │ 2. Groq API     │  (Note: Gemini Native SDK di-exclude
  │ (OpenAI Schema) │                  │ (OpenAI Schema) │   karena tidak mendukung OpenAI
  └─────────────────┘                  └─────────────────┘   tool_call_id format natively)
```

1. **Chain A — Standard Text Generation (`ai_router.call_llm`):**
   - **Guna:** Untuk endpoint yang menghasilkan respons teks JSON statis (`classify-all`, `analyze_user`, `generate_org_report`).
   - **Alur (3 Provider):** `OpenRouter` ➔ `Google Gemini Native SDK` ➔ `Groq API`.
   - **Backoff Math:** Total delay retry maks `1.0s + 2.0s = 3.0 detik` sebelum 503.

2. **Chain B — Agentic Tool-Calling (`ai_router.get_tool_calling_providers`):**
   - **Guna:** Untuk endpoint `agentic/investigate` yang membutuhkan *multi-turn OpenAI function calling* (LLM mengeksekusi fungsi database secara otonom).
   - **Alur (2 Provider):** `OpenRouter` ➔ `Groq API`.
   - **Mengapa Gemini Native Di-exclude?** SDK resmi `google.generativeai` menggunakan format DDL/Protobuf yang berbeda dan tidak mendukung skema OpenAI `tools`, `tool_choice="auto"`, serta `tool_call_id` secara langsung tanpa adapter eksternal. (Namun model Gemini di dalam OpenRouter tetap bisa dipakai via Chain B).

---

## ⚙️ 3. Penjelasan 4 Fitur Utama Modul AI

### 1. 📊 AI Behavioral Risk Dashboard (`/ai`)
* **Fungsi:** Menampilkan *Risk Heatmap* seluruh karyawan dalam 3 tingkatan risiko:
  * 🟢 **SAFE:** Poin tinggi, klik phishing 0-1 kali, aktif training.
  * 🟡 **VULNERABLE:** Klik 2-3 kali, training tidak konsisten.
  * 🔴 **DANGER (Chronic Clicker):** Klik 4+ kali, sering mengabaikan edukasi.
* **Fitur Drill-Down:** Klik salah satu kartu karyawan untuk melihat diagnosa spesifik (*vulnerable_to*, *risk_factors*, *priority_action*, dan pesan edukasi personal).

### 2. 📄 Executive PDF Report Generator (`jsPDF`)
* **Fungsi:** Membuat laporan naratif resmi tingkat organisasi dalam format **PDF A4**.
* **Keunggulan:** Dibuat menggunakan manipulasi vektor `jsPDF` (*content-based rendering*, bukan screenshot gambar `html2canvas`), sehingga teks rapi, ada nomor halaman otomatis, tabel divisi interaktif, serta watermark **`CONFIDENTIAL`**. Siap diserahkan ke CISO / Dosen Pembimbing.

### 3. 🎯 GoPhish AI Template Generator (`POST /api/ai/gophish/generate`)
* **Fungsi:** Generator email phishing otomatis berbasis AI.
* **Cara Kerja:** Admin memasukkan tema (misal: `"BPJS Ketenagakerjaan"`), AI merancang HTML email phishing yang meyakinkan dalam Bahasa Indonesia formal, lalu otomatis mengirimkan (*push*) template tersebut ke server GoPhish.

### 4. 🕵️ Agentic Investigator (`POST /api/ai/agentic/investigate`)
* **Fungsi:** Asisten analis keamanan virtual.
* **Cara Kerja:** Menggunakan *Chain B Tool-Calling*. AI bertindak secara otonom menentukan query database mana yang perlu dipanggil (histori klik, ranking divisi, insiden aktif) untuk menjawab pertanyaan investigasi admin.

---

## 🔒 4. Scope & Proteksi Privasi Data (Anonymization Layer)

Untuk mematuhi prinsip perlindungan data pribadi (UU PDP / GDPR), seluruh data yang dikirim ke LLM eksternal melalui skema penapisan berikut:

```text
[ Admin Request ] ➔ [ Flask Fetch SQLite Data ] ➔ [ ai_anonymizer.py ]
                                                           │
                                                           ▼ (Email diganti Token Hash)
                                                    "EMP-C06101"
                                                           │
                                                           ▼ (Kirim Prompt ke LLM)
                                                    [ External LLM API ]
                                                           │
                                                           ▼ (Terima Respons JSON)
                                                    [ ai_anonymizer.py ]
                                                           │
                                                           ▼ (Restorasi Email Asli)
[ Response Ke Client ] ◄─────────────────────────── "dewi.lestari@netops-dummy.local"
```

### 4.1 Tabel Audit Scope Penanganan Field Data

| Field Data | Status Proteksi | Alasan / Justifikasi Keamanan |
|---|---|---|
| **`email`** | 🔴 **Anonymized** | Diganti dengan Token Pseudonim Deterministik (misal: `EMP-C06101` via SHA-256 hash). Email asli **TIDAK PERNAH** keluar ke LLM. |
| **`divisi`** | 🟢 **Retained** | Kategori umum divisi (misal: `Sales Support`, `Network Operations`). Tidak berisi PII individu dan dibutuhkan AI untuk analisis tren divisi. |
| **`ticket_id`** | 🟢 **Retained** | Identifier acak insiden (misal: `INC-SIMCRED`). Tidak mengandung data sensitif. |
| **`severity` / `verdict`** | 🟢 **Retained** | Indikator agregat statistik (`low`, `high`, `malicious`, `clean`). |
| **`reported_url`** | 🟡 **Sanitized** | URL internal atau jalur sensitif dipangkas/dikeluarkan dari prompt untuk mencegah *data leakage*. |

---

## 📁 5. Sitemap File Project (Lama vs Baru)

### 🔹 File Backend (`/backend`)
* 🟢 `database.py` — **[LAMA - UTUH]** Database SQLite single source of truth.
* 🟢 `app.py` — **[DIUPDATE]** Menambahkan pendaftaran blueprint `ai_bp` & inisialisasi `ai_cache` + Production Safety Guard.
* 🆕 `ai_analysis.py` — Aggregator query SQL dari SQLite untuk format konteks AI.
* 🆕 `ai_anonymizer.py` — Engine penyamaraaan email PII (anonymizer & deanonymizer).
* 🆕 `ai_cache.py` — Sistem caching hasil LLM di SQLite (TTL 1 jam).
* 🆕 `ai_router.py` — Engine failover multi-provider (Dual Chain: Chain A 3-provider, Chain B 2-provider).
* 🆕 `ai_telegram.py` — Integrasi notifikasi alert AI ke Telegram.
* 🆕 `routes/ai_routes.py` — Blueprint endpoint REST API (`/api/ai/*`).

### 🔹 File Frontend (`/dashboard`)
* 🟢 `src/app/admin/page.tsx` — **[LAMA - UTUH]** SOC Admin Dashboard utama.
* 🆕 `src/app/ai/page.tsx` — Halaman UI Analisis Perilaku AI & Report Generator.
* 🆕 `src/app/ai/ai.css` — Styling CSS khusus untuk halaman AI & PDF preview.
* 🆕 `src/app/api/ai/*` — Proxy route handler Next.js ke Flask backend.

---

## 📑 6. Tabel Ringkasan Komponen & Status

| Komponen | Status Integrasi | Failover Chain | Fungsi Utama |
|---|---|---|---|
| **Flow A (Simulation)** | Active | N/A | Campaign GoPhish & Auto-Retraining |
| **Flow B (Telegram Incident)** | Active | N/A | Triaging URL/File via VT + urlscan.io |
| **Gamification & Leaderboard** | Active | N/A | Badges, Poin, & Streaks |
| **AI Risk Heatmap** | Integrated | **Chain A (3 Providers)** | Visualisasi risiko karyawan berbasis LLM |
| **Executive PDF Export** | Integrated | Client-Side (`jsPDF`) | Cetak laporan formal A4 untuk CISO |
| **GoPhish AI Gen** | Integrated | **Chain A (3 Providers)** | Generator template phishing otomatis |
| **Agentic Investigator** | Integrated | **Chain B (2 Providers)** | Otonom tool-calling investigasi DB |
| **PII Anonymizer** | Integrated | Internal Engine | Sensor privasi email karyawan (SHA-256 token) |

---

## 🧪 7. Status Pengujian & Kesiapan Publikasi

* **Arsitektur & Kode:** **100% Terintegrasi, Di-audit, & Bebas Error Structural.**
* **Error Handling (503 Exception):** **Terverifikasi (Handled Cleanly tanpa NameError/Crash).**
* **Pengujian End-to-End Live LLM Call (HTTP 200):** **Menunggu Injeksi API Key Aktif dari User.**

> **Status Akhir:** Infrastruktur router multi-provider dan layer privasi telah teruji secara aman. Setelah API Key aktif dimasukkan oleh user, pengujian HTTP 200 end-to-end dapat dijalankan untuk memverifikasi respons aktual dari LLM.
