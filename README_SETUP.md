# AFFERENT — Panduan Setup & Uji Coba Arsitektur (Fase 4: Centralized Proxy & ML Threat Detection)

Dokumen ini ditujukan untuk seluruh anggota tim agar dapat menjalankan, menguji coba, dan mengembangkan platform **AFFERENT** di laptop lokal masing-masing atau skenario multi-device (Host + VM).

---

## 🏗️ 1. Sekilas Arsitektur Sistem

Platform AFFERENT terdiri dari beberapa komponen utama yang berjalan otomatis via Docker Compose:

1. **Centralized Proxy (`hfl-centralized-proxy`)**:
   - Berbasis Squid 6 (dengan OpenSSL SSL-Bump).
   - Memonitor seluruh traffic HTTP/HTTPS yang lewat tanpa perlu sertifikat publik (menggunakan internal CA cert AFFERENT).
   - Memutuskan apakah koneksi **diizinkan (Allow)** atau **diblokir (Block)** langsung di level proxy gateway.
2. **Backend API (`hfl-flask`)**:
   - Otak pengendali kebijakan (Decision Engine).
   - Menghubungkan Squid Proxy, Redis Cache, Database PostgreSQL, dan Model Machine Learning.
3. **Frontend Dashboard (`hfl-dashboard`)**:
   - Next.js 16 user interface untuk:
     - **Employee**: Portal edukasi, registrasi device proxy, dan download CA cert.
     - **SOC Analyst**: Live real-time traffic feed (via SSE), triage alert, dan manual domain blocking.
     - **CISO & GRC**: Analisis risiko dan kepatuhan regulasi (UU PDP & ISO 27001).
4. **Cache & Persistence Layer**:
   - **PostgreSQL (`hfl-proxy-postgres`)**: Database permanen untuk audit log keputusan, event traffic, dan alert SOC.
   - **Redis (`hfl-proxy-redis`)**: Cache ultra-cepat untuk hot verdict dan broadcast live feed real-time (Pub/Sub + Redis Streams).
5. **Simulasi & Notifikasi Tambahan**:
   - **Mailpit (`hfl-mailpit`)**: Server email lokal untuk testing OTP login.
   - **GoPhish (`hfl-gophish`)** & **n8n (`hfl-n8n`)**: Engine simulasi phishing adaptif dan SOAR pipeline.

---

## ⚙️ 2. File Konfigurasi (.env) yang Perlu Disiapkan

Ada dua file konfigurasi utama di root direktori project:

### A. File `.env`
Salin template `.env.example` menjadi `.env` jika belum ada:
```bash
cp .env.example .env
```

Isi variabel-variabel kunci berikut:

```ini
# --- Keamanan Core ---
APP_ENV=development
FLASK_DEBUG=false
DEV_BYPASS_AUTH=false
SECRET_KEY=isi-dengan-string-acak-panjang
ADMIN_PASSWORD=password-admin-anda
SERVICE_API_KEY=kunci-rahasia-internal-service

# --- Pengaturan Network Multi-Mesin (Host & VM Client) ---
# Gunakan 0.0.0.0 agar bisa diakses oleh VM / device lain di jaringan yang sama
WEB_BIND_IP=0.0.0.0
PROXY_BIND_IP=0.0.0.0

# Ganti IP di bawah dengan IP Host LAN / Wi-Fi laptop Anda (misal: 192.168.100.11 atau 127.0.0.1 untuk local-only)
PUBLIC_PROXY_URL=http://192.168.100.11:3128
PUBLIC_PROXY_PROBE_URL=http://proxy-check.afferent.invalid/__afferent_probe__
NEXT_PUBLIC_BASE_URL=http://192.168.100.11:3000
NEXT_PUBLIC_API_URL=http://192.168.100.11:5000

# CORS Whitelist (Wajib sertakan IP yang Anda ketikkan di browser)
ALLOWED_ORIGINS=http://192.168.100.11:3000,http://localhost:3000,http://127.0.0.1:3000,http://localhost:5000

# --- Integrasi Model Machine Learning (Untuk Tim ML) ---
# Kosongkan terlebih dahulu jika service ML belum dinyalakan.
# Ketika service ML teman Anda sudah jalan, arahkan ke URL-nya:
ML_SCANNER_URL=http://192.168.100.11:8000/scan
ML_SCANNER_TIMEOUT_SECONDS=1.5
ML_BLOCK_CONFIDENCE_THRESHOLD=0.85
ML_ALLOW_CONFIDENCE_THRESHOLD=0.80

# --- Provider LLM untuk Analisis AI (Opsional) ---
OPENROUTER_API_KEY=
GROQ_API_KEY=
```

### B. File `.env.proxy.local`
File ini menampung kredensial internal database proxy dan shared secret HMAC dengan ML:

```ini
PROXY_DB_NAME=afferent_proxy
PROXY_DB_USER=afferent_proxy_app
PROXY_DB_PASSWORD=buat-password-db-bebas
POSTGRES_DB=afferent_proxy
POSTGRES_USER=afferent_proxy_app
POSTGRES_PASSWORD=buat-password-db-bebas
REDIS_PASSWORD=buat-password-redis-bebas

# Secret kunci HMAC-SHA256 yang dibagikan ke tim Machine Learning
ML_WEBHOOK_SECRET=Rq8Zx3Lm7Pn2Vy6Ks9Hd4WcF
PROXY_IDENTITY_PEPPER=kunci-acak-untuk-hashing-ip
```

---

## 🚀 3. Langkah Menjalankan Sistem (Step-by-Step)

### Langkah 1: Clone Repository & Persiapan File
```bash
git clone <url-repo-afferent>
cd Human_Firewall
```
Pastikan file `.env` dan `.env.proxy.local` sudah dibuat dan diisi.

### Langkah 2: Build & Start Container Docker
Jalankan satu perintah Docker Compose:
```bash
docker compose up -d --build
```
Tunggu sekitar 1–2 menit hingga semua container running dan berstatus `healthy`:
```bash
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```
Semua container berikut harus berstatus **Up (healthy)**:
* `hfl-dashboard` (Port 3000)
* `hfl-flask` (Port 5000)
* `hfl-centralized-proxy` (Port 3128)
* `hfl-proxy-postgres`
* `hfl-proxy-redis`
* `hfl-mailpit` (Port 8025)

---

## 🧪 4. Panduan Pengujian & Skenario Uji Coba

### Skenario 1: Verifikasi Live Feed SOC Dashboard
1. Buka browser di Host: `http://localhost:3000/dashboard/soc` (atau `http://<IP_HOST>:3000`).
2. Masuk ke tab **Threats**.
3. Di panel **Centralized Proxy Operations**, pastikan indikator di pojok kanan berstatus `● SSE live` (hijau).
4. Buka terminal baru, buat traffic uji coba melalui proxy Squid:
   ```powershell
   # Windows PowerShell
   Invoke-WebRequest -Uri "http://example.com" -Proxy "http://localhost:3128" -UseBasicParsing
   ```
   ```bash
   # Linux / macOS
   curl -x http://localhost:3128 http://example.com
   ```
5. Lihat di layar SOC Dashboard: Request tersebut **langsung muncul secara real-time** tanpa perlu refresh browser!

---

### Skenario 2: Konfigurasi di Mesin Karyawan / VM Client (e.g. Kali Linux)

Untuk menguji multi-device di mana VM bertindak sebagai laptop karyawan:

#### 1. Download & Pasang Sertifikat CA AFFERENT
Agar browser client tidak menampilkan peringatan SSL saat membuka HTTPS:
* Unduh file CA:
  ```bash
  curl -o ~/afferent-proxy-ca.crt http://<IP_HOST>:3000/api/proxy/ca.crt
  ```
  *(Atau klik tombol **"Download CA Cert"** langsung di Dashboard Karyawan).*
* Pasang di browser Firefox Client:
  1. Buka **Settings** (`about:preferences`) → cari **Certificates** → klik **View Certificates...**
  2. Tab **Authorities** → klik **Import...** → pilih file `~/afferent-proxy-ca.crt`.
  3. Centang opsi: **"Trust this CA to identify websites"** → Klik **OK**.

#### 2. Pasang Proxy di Browser Client
Di menu Settings Firefox client:
1. Cari **Network Settings** → pilih **Manual proxy configuration**.
2. Isi:
   * **HTTP Proxy**: `<IP_HOST>` | **Port**: `3128`
   * Centang: **"Also use this proxy for HTTPS"**
   * Di kolom **No proxy for**, masukkan: `<IP_HOST>, localhost, 127.0.0.1` (agar dashboard tidak ikut lewat proxy).
3. Simpan setting.

#### 3. Buka Website Apapun dari VM
Buka `https://github.com` atau `http://testphp.vulnweb.com` di browser VM.
* Situs akan terbuka dengan normal.
* Jika dilihat sertifikatnya di gembok URL bar, sertifikat ditandatangani oleh **AFFERENT Proxy CA**.
* Seluruh log aktivitas browsing dari VM langsung terkirim dan muncul di SOC Dashboard Host!

---

### Skenario 3: Uji Coba Pemblokiran Domain (SOC Manual Override)
1. Dari SOC Dashboard di mesin Host (tab **Threats**):
   * Pada entry traffic yang baru masuk, klik tombol **"Block domain"** (atau masukkan nama domain secara manual di panel *Manual domain policy* di sebelah kanan).
   * Isi alasan pemblokiran, klik Simpan.
2. Kembali ke browser VM Client:
   * Buka kembali domain yang baru saja diblokir tersebut.
   * Browser **seketika menampilkan halaman blokir resmi AFFERENT** (`ERR_AFFERENT_BLOCK`):
     > *"Akses ke situs ini dihentikan — Domain terdeteksi berbahaya atau diblokir oleh kebijakan manual SOC."*

---

## 🤖 5. Panduan untuk Tim Machine Learning (ML Developer)

Bagi rekan yang bertugas membangun model deteksi ancaman URL phishing/malicious:

1. Baca panduan spesifikasi kontrak API lengkap di:
   👉 [`docs/ML_INTEGRATION_SPEC.md`](docs/ML_INTEGRATION_SPEC.md)
2. Gunakan template mock service berbasis FastAPI yang sudah siap pakai di root:
   ```bash
   pip install fastapi uvicorn
   python mock_ml_service.py
   ```
3. Ketika service ML Anda berjalan (misal di port 8000), backend AFFERENT akan otomatis:
   * Mengirim setiap URL yang belum pernah dilihat ke endpoint ML Anda.
   * Jika model memprediksi `malicious` dengan confidence $\ge 0.85$, **sistem langsung memblokir pengguna seketika (Auto-Block)** dan memunculkan alert kritis di SOC.
   * Jika model memprediksi `safe`, sistem mengizinkan traffic dan menyimpannya di Redis Cache agar request berikutnya tidak membebani model lagi.
   * Jika model menjawab `unknown`, sistem mengizinkan sementara dan menyerahkan keputusan ke analis SOC.

---

## ❓ FAQ & Troubleshooting Cepat

* **Status SSE di SOC menunjukkan `Reconnecting`?**
  Pastikan container `hfl-proxy-redis` berjalan normal dan port Redis dapat diakses oleh container backend.
* **Tidak bisa connect dari VM ke Host?**
  Pastikan firewall Windows di Host mengizinkan traffic masuk ke port `3000`, `5000`, dan `3128`, atau nonaktifkan sementara Windows Defender Firewall selama pengetesan di lab.
* **Perlu reset data testing?**
  Jalankan:
  ```bash
  docker compose down -v
  docker compose up -d
  ```
  *(Perhatian: flag `-v` akan mengosongkan volume database dan cache ke kondisi awal).*

