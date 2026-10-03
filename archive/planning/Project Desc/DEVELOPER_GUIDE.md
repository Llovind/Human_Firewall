# 🛠️ Developer & Development Guide — Human Firewall

Panduan teknis ini dirancang untuk membantu pengembang (rekan satu tim Anda) memahami struktur database, integrasi API, dan cara memelihara serta mengembangkan platform **Human Firewall**.

---

## 1. Skema Database SQLite (`human_firewall.db`)

Database SQLite terletak di folder `backend/instance/human_firewall.db`. Database ini terdiri dari 4 tabel utama:

### A. Tabel `user_history` (Data Pelatihan Karyawan)
Menyimpan data performa simulasi phishing untuk setiap karyawan.
*   `id` (INTEGER, Primary Key): ID unik baris.
*   `email` (TEXT, Unique): Alamat email korporat karyawan.
*   `divisi` (TEXT): Divisi karyawan (HR, Finance, IT, dll).
*   `click_count` (INTEGER): Jumlah kumulatif karyawan mengklik link phishing.
*   `viewed_training_count` (INTEGER): Jumlah karyawan membuka halaman pelatihan setelah mengklik.
*   `skipped_training_count` (INTEGER): Jumlah karyawan melewatkan halaman pelatihan.
*   `telegram_chat_id` (TEXT): ID unik chat Telegram privat karyawan (terhubung lewat verifikasi OTP).
*   `last_clicked` (TIMESTAMP): Waktu terakhir karyawan mengklik link simulasi.
*   `created_at` / `updated_at` (TIMESTAMP): Log audit waktu.

### B. Tabel `events` (Log Aktivitas Simulasi)
Mencatat riwayat aktivitas terperinci untuk analisis statistik.
*   `id` (INTEGER, Primary Key): ID unik event.
*   `email` (TEXT): Email pelaku aktivitas.
*   `divisi` (TEXT): Divisi pelaku.
*   `event_type` (TEXT): Jenis aktivitas (`clicked_link`, `submitted_data`, `viewed_training`, `skipped_training`).
*   `campaign_id` (TEXT): ID Kampanye GoPhish terkait (jika ada).
*   `created_at` (TIMESTAMP): Waktu kejadian.

### C. Tabel `incidents` (Tiket Ancaman SOC)
Menggabungkan data tiket bahaya dari Flow A (simulasi) dan Flow B (laporan riil user).
*   `ticket_id` (TEXT, Primary Key): Format `INC-XXXXXX` (acak/unik).
*   `source_type` (TEXT): Sumber tiket (`simulation` atau `real_world_report`).
*   `reported_url` (TEXT): URL berbahaya yang dilaporkan user.
*   `divisi` (TEXT): Divisi pelapor/karyawan terkait.
*   `severity` (TEXT): Tingkat bahaya (`low`, `medium`, `high`).
*   `vt_verdict` (TEXT): Hasil deteksi VirusTotal (e.g., `10/92 engines malicious`).
*   `urlscan_verdict` (TEXT): Hasil deteksi urlscan.io (e.g., `malicious`).
*   `file_hash` (TEXT): SHA256 dari file berbahaya yang dilaporkan.
*   `original_filename` (TEXT): Nama file yang dilampirkan.
*   `status` (TEXT): Status penanganan tiket (`open` atau `closed`).
*   `created_at` / `closed_at` (TIMESTAMP): Log waktu pembuatan & penyelesaian tiket.

### D. Tabel `registration_otp` (Pendaftaran OTP)
Menampung kode verifikasi OTP sementara sebelum karyawan terverifikasi.
*   `email` (TEXT): Email yang didaftarkan.
*   `telegram_chat_id` (TEXT): ID Telegram pendaftar.
*   `otp_code` (TEXT): 6-digit kode OTP acak.
*   `created_at` (TIMESTAMP): Waktu pembuatan kode (dapat dibatasi kedaluwarsa 15 menit).

---

## 2. Dokumentasi API Flask (`app.py`)

Berikut adalah endpoint utama yang dipanggil oleh n8n atau dashboard frontend:

### A. Mencatat Tiket Insiden
*   **Endpoint**: `POST /api/incidents`
*   **Request Body (JSON)**:
    ```json
    {
      "source_type": "real_world_report",
      "divisi": "Sales Support",
      "severity": "high",
      "reported_url": "http://malware-site.com",
      "vt_verdict": "8/90 engines malicious",
      "urlscan_verdict": "malicious"
    }
    ```
*   **Response (201 Created)**:
    ```json
    {
      "message": "Incident ticket created successfully",
      "ticket_id": "INC-A1B2C3D4"
    }
    ```

### B. Membuat OTP Pendaftaran
*   **Endpoint**: `POST /api/otp/create`
*   **Request Body (JSON)**:
    ```json
    {
      "email": "rina.kusuma@netengineering-dummy.local",
      "telegram_chat_id": "877195355",
      "otp_code": "482910"
    }
    ```
*   **Response (201 Created)**:
    *   *Selain menyimpan ke database, endpoint ini otomatis mengirim email OTP tiruan ke Mock Webmail.*
    ```json
    {
      "message": "OTP created and email logged successfully"
    }
    ```

### C. Verifikasi OTP
*   **Endpoint**: `POST /api/otp/verify`
*   **Request Body (JSON)**:
    ```json
    {
      "telegram_chat_id": "877195355",
      "otp_code": "482910"
    }
    ```
*   **Response (200 OK - Sukses)**:
    *   *Otomatis mengupdate kolom telegram_chat_id di tabel user_history milik email terdaftar.*
    ```json
    {
      "status": "success",
      "message": "Verification successful",
      "email": "rina.kusuma@netengineering-dummy.local"
    }
    ```
*   **Response (400 Bad Request - Gagal)**:
    ```json
    {
      "status": "fail",
      "error": "Kode OTP salah atau kedaluwarsa"
    }
    ```

---

## 3. Cara Mengekspor Workflow n8n Terbaru ke Git

Jika Anda telah melakukan modifikasi alur kerja (seperti memposisikan ulang node, menambahkan kondisi, atau mengubah teks bot) secara visual di editor browser n8n (`http://localhost:5678`), pastikan Anda mengekspornya kembali ke folder lokal sebelum melakukan push git baru:

1.  Di editor n8n, klik tombol **Menu 3 Titik** di pojok kanan atas layar.
2.  Pilih opsi **`Export workflow`**.
3.  Simpan file JSON tersebut ke folder proyek Anda di harddisk:
    *   Untuk Flow A: Simpan ke `C:\Human_Firewall\n8n-workflows\flow-a.json`.
    *   Untuk Flow B: Simpan ke `C:\Human_Firewall\n8n-workflows\Flow B — Threat Reporting (Fully Configured).json`.
4.  Jalankan perintah Git:
    ```powershell
    git add .
    git commit -m "update: n8n workflow adjustments"
    git push origin main
    ```

---

## 4. Tips Pengujian Lokal Cepat (Cheat Sheet)

### Simulasikan Input Event Simulasi secara Manual (Bypass GoPhish)
Anda bisa menggunakan terminal PowerShell untuk langsung memicu simulasi klik tanpa perlu masuk ke GoPhish:

```powershell
# Simulasikan klik link phishing untuk Rina Kusuma
Invoke-RestMethod -Uri "http://localhost:5000/redirect-handler?email=rina.kusuma@netengineering-dummy.local" -Method Get
```
