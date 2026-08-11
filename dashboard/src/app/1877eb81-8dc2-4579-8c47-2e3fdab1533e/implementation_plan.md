# Rencana Implementasi: Gamifikasi Duolingo-Style & Kuis Keamanan

Rencana ini bertujuan untuk memetakan penambahan fitur gamifikasi baru pada Dashboard Karyawan, termasuk **Daily Streak** ala Duolingo, **Kuis Keamanan 5-Pertanyaan**, dan **Lencana Khusus Pelaporan** (Sentinel Troops, Front Line Defender, dll.) untuk memotivasi karyawan berkontribusi aktif melindungi perusahaan.

---

## Perubahan yang Diusulkan

### 1. Penyempurnaan Tipe Data & Seed Data (Next.js Store)
Kita akan menambahkan properti `reportsCount` (jumlah laporan) dan `dailyStreak` (streak harian) ke dalam skema perilaku karyawan.

#### [MODIFY] [store.ts](file:///C:/Human_Firewall/dashboard/src/lib/store.ts)
*   Modifikasi interface `BehaviorScore` untuk mendukung:
    ```typescript
    reportsCount: number;
    dailyStreak: number;
    lastQuizCompleted?: string; // Tanggal terakhir kuis selesai (format YYYY-MM-DD)
    ```

#### [MODIFY] [seed.ts](file:///C:/Human_Firewall/dashboard/src/lib/seed.ts)
*   Update data seed untuk memasukkan properti `reportsCount` dan `dailyStreak` default bagi seluruh karyawan:
    *   **Lovind:** `reportsCount: 6` (Badges: *Sentinel Troops*, *Front Line Defender*, *The Front Man*), `dailyStreak: 4`
    *   **Rina Kusuma:** `reportsCount: 0`, `dailyStreak: 0`
    *   **Budi Santoso:** `reportsCount: 3`, `dailyStreak: 2`
    *   *Karyawan lainnya disesuaikan.*

---

### 2. Dashboard Karyawan (Tampilan KPI Grid & Lencana Baru)

#### [MODIFY] [page.tsx](file:///C:/Human_Firewall/dashboard/src/app/page.tsx)
*   **KPI Grid (Kartu Statistik):**
    *   Ubah kartu **"Bebas Klik"** menjadi **"Daily Streak"** (menampilkan ikon 🔥 dan teks `X Hari`).
    *   Ubah kartu **"Latihan"** menjadi **"Laporan Phishing"** (menampilkan ikon 🛡️ dan teks `X Laporan`).
*   **Logika Lencana Dinamis (Badges):**
    *   Lencana sekarang didasarkan pada dua hal: **Skor Perilaku** (Sentinel/Guardian) dan **Jumlah Laporan**:
        *   `Sentinel Troops` (Melaporkan >= 1 email mencurigakan)
        *   `Front Line Defender` (Melaporkan >= 3 email mencurigakan)
        *   `The Front Man` (Melaporkan >= 5 email mencurigakan)
        *   `Cyber Shield Elite` (Melaporkan >= 10 email mencurigakan)
    *   Badges ini akan dirender di bagian bawah Hero Card dengan chip yang bersinar (glowing).

---

### 3. Modul Kuis Keamanan Baru (Tab "Spot the Fake & Quiz")
Kita akan memperluas tab kedua untuk menampung dua jenis latihan interaktif:
1.  **Spot the Fake (Mini-game Identifikasi Phishing)** - latihan visual tautan tiruan.
2.  **Daily Security Quiz (Kuis Interaktif 5-Pertanyaan)** - kuis pilihan ganda harian.

#### Konten Kuis (5 Pertanyaan Acak/Statik):
Setiap hari kuis akan menampilkan 5 pertanyaan pilihan ganda edukatif seputar keamanan siber, misalnya:
1.  **Skenario:** Menerima email HR dengan link eksternal pembaruan nomor rekening.
2.  **Skenario:** Menemukan USB drive tak bertuan di lobi kantor.
3.  **Skenario:** Pesan WhatsApp berisi kode OTP dari nomor tidak dikenal.
4.  **Skenario:** Email mendesak dari direktur meminta transfer dana darurat di luar sistem.
5.  **Skenario:** Ajakan memasang ekstensi browser tidak dikenal untuk menunjang produktivitas.

#### Aturan & Reward:
*   Jika menyelesaikan kuis harian, user mendapatkan **+10 Poin** dan **+1 Streak Harian 🔥**.
*   Menyelesaikan kuis akan mencatat event `daily_quiz_completed` di database.
*   Jika kuis sudah selesai hari ini, tab kuis akan menunjukkan layar sukses *"Sudah Menyelesaikan Latihan Hari Ini - Streak Terjaga!"*.

---

## Rencana Verifikasi

### Manual Verification
1.  Membuka dashboard karyawan dan memastikan KPI Grid berubah menjadi **Daily Streak (🔥)** dan **Laporan Phishing (🛡️)**.
2.  Memastikan lencana (Sentinel Troops, Front Line Defender, dll.) muncul secara otomatis sesuai jumlah laporan dari database seed.
3.  Mencoba menyelesaikan **Daily Security Quiz** baru, memverifikasi penambahan skor +10 secara langsung di progress ring, dan pertambahan streak menjadi +1.
4.  Memastikan kuis masuk status *cooldown* setelah selesai hari ini.
