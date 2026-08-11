# Dokumentasi Handoff (Addendum): Flow B & Vishing Simulation

Dokumen ini merupakan **lampiran/lanjutan** dari `Handoff.MD` (dokumentasi utama Human Firewall Lite). Berisi keputusan desain, skema, dan rencana implementasi untuk dua inisiatif baru yang dibahas setelah dokumen utama: **Flow B (Crowdsourced Threat Reporting)** dan **Vishing Simulation (Simulated/Non-Real-Time)**.

Status Vishing Simulation: **di-hold sementara**, didokumentasikan untuk dilanjutkan kapan saja. Status Flow B: **aktif, dalam tahap desain menuju implementasi.**

---

## 1. Vishing Simulation — Status: On Hold

### 1.1 Konteks & Keputusan Pivot

Rencana awal (lihat `Handoff.MD` Roadmap B) adalah implementasi vishing menggunakan platform conversational AI real-time (Vapi atau Bland.ai) yang menelepon nomor karyawan sungguhan. Setelah riset biaya, pendekatan ini **tidak dilanjutkan** karena alasan berikut:

- **Biaya Vapi**: Platform fee $0.05/menit belum termasuk LLM, STT, TTS, dan telephony — biaya riil $0.15–0.40/menit.
- **Biaya Twilio ke nomor Indonesia**: $0.1066/menit untuk panggilan ke nomor mobile Indonesia — jauh lebih mahal dibanding tarif domestik US ($0.014/menit), dan tidak ditanggung oleh kredit gratis Vapi.
- **Estimasi total**: Sekitar $0.26–0.31/menit all-in (Twilio + Vapi + AI stack), dengan kebutuhan kartu kredit/debit aktif untuk verifikasi akun Twilio.
- **Keputusan**: Tidak proporsional untuk dibiayai pribadi sebagai proyek internship tanpa kompensasi. Pivot ke pendekatan **simulasi gratis** (non-real-time, pre-recorded, decision-tree based) yang tetap menghasilkan data perilaku yang kaya tanpa biaya infrastruktur eksternal.

### 1.2 Konsep Desain: Branching Pre-Recorded Audio

Alih-alih AI conversational real-time, vishing disimulasikan melalui:

1. Notifikasi (Telegram/email) berisi tautan ke halaman simulasi "panggilan masuk".
2. Halaman web menampilkan UI yang meniru *incoming call screen*, lalu memutar audio TTS yang sudah digenerate sebelumnya (bukan real-time).
3. Di titik-titik tertentu, pengguna memilih respons dari opsi yang tersedia (tombol), bukan berbicara bebas.
4. Setiap pilihan menentukan audio/node selanjutnya — membentuk *decision tree* bercabang.

**Kelebihan pendekatan ini:**
- Tanpa biaya (tidak ada API call real-time, tidak ada biaya telepon).
- Data tetap terstruktur dan kaya, karena setiap pilihan adalah event diskrit (bukan teks bebas yang perlu diparse/diklasifikasi).
- Kualitas audio bisa dioptimalkan tanpa batasan latency (karena tidak real-time), menggunakan TTS gratis kualitas tinggi seperti `edge-tts` (Microsoft Edge TTS, gratis, tanpa API key).

**Keterbatasan yang disadari:**
- Tidak menangkap respons spontan/di luar skrip dari pengguna — hanya menangkap pola keputusan dalam skenario yang sudah distrukturkan, bukan respons sosial-engineering yang benar-benar spontan seperti pada AI conversational real-time.

### 1.3 Skenario Pretext: HR/Payroll — Update Data Rekening

Dipilih karena urgensi finansial adalah salah satu trigger psikologis terkuat dalam social engineering.

#### Decision Tree

```
[NODE 1] Opening
  ├─ [A] "Baik, saya bantu verifikasi"        → NODE 2 (compliant)
  └─ [B] "Ini dari ekstensi/nomor mana?"      → NODE 1b (skeptical)

[NODE 1b] Persuasion (attacker meyakinkan)
  ├─ [A] "Oh oke, kalau standar gak masalah"  → NODE 2 (compliant, via friction)
  └─ [B] "Saya konfirmasi ke HR langsung dulu" → ENDING: resisted_early

[NODE 2] Request Data
  ├─ [A] [User "menyebutkan" data dummy]       → ENDING: info_leaked
  └─ [B] "Saya cek dulu ke sistem resmi HRIS"  → ENDING: resisted_late
```

#### 3 Ending yang Dimodelkan

| Ending | Jalur | Makna |
|---|---|---|
| `info_leaked` | 1→A→2→A, atau 1→B→1b→A→2→A | User memberikan data, baik langsung percaya maupun setelah diyakinkan ulang |
| `resisted_late` | 1→A→2→B | User awalnya percaya, namun sadar sebelum memberikan data sensitif |
| `resisted_early` | 1→B→1b→B | User curiga dari awal dan tidak goyah meski "diyakinkan" |

#### Skrip Audio (7 File)

| File | Isi Ringkas | Trigger |
|---|---|---|
| `node1_opening.mp3` | Pretext pembuka HR/Payroll soal migrasi sistem penggajian | Saat user mengklik link/notifikasi |
| `node1b_persuasion.mp3` | Attacker meyakinkan dengan menyebut ekstensi & alasan "semua karyawan kena" | User memilih opsi skeptis di Node 1 |
| `node2_request_data.mp3` | Meminta nomor rekening + 3 digit kode konfirmasi | User memilih opsi compliant di Node 1 atau 1b |
| `closing_leaked.mp3` | Penutup setelah data "diberikan" | Ending: `info_leaked` |
| `closing_resisted_late.mp3` | Penutup setelah user minta verifikasi mandiri | Ending: `resisted_late` |
| `closing_resisted_early.mp3` | Penutup singkat, sedikit defensif (attacker buru-buru menutup) | Ending: `resisted_early` |

Naskah lengkap tiap audio telah didiskusikan dan disetujui — tersimpan dalam riwayat diskusi desain, siap digenerate menggunakan `edge-tts` ketika implementasi dilanjutkan.

### 1.4 Strategi Kualitas Tanpa Biaya

| Komponen | Solusi Gratis | Catatan |
|---|---|---|
| TTS suara | `edge-tts` (Python, tanpa API key) | Kualitas natural, jauh di atas `SpeechSynthesis` API browser default |
| Ambience/background | Freesound.org (royalty-free) | Menambah realisme suasana "call center" |
| Skrip pretext | Ditulis manual, kontekstual ke struktur dummy HFL | Faktor paling berpengaruh terhadap kredibilitas simulasi — lebih penting daripada teknologi audio |
| Decision tree | Audio pre-recorded bercabang + routing di Flask | Interaktif tanpa kebutuhan AI real-time |
| UI panggilan | HTML/CSS custom, selaras dengan desain dashboard yang direncanakan | — |
| Delivery | Telegram bot / tautan email, konsisten dengan Flow A & B | — |

### 1.5 Skema Data yang Dihasilkan

Event baru yang akan ditambahkan ke tabel `events` (lihat `Handoff.MD` §3.2) ketika implementasi dilanjutkan:

| `event_type` baru | Kapan Tercatat |
|---|---|
| `vishing_call_answered` | User mengklik tautan/notifikasi simulasi panggilan |
| `vishing_call_ignored` | User tidak pernah mengklik dalam batas waktu tertentu |
| `vishing_resisted` | User memilih opsi skeptis di node manapun dan berakhir tanpa membocorkan data |
| `vishing_info_leaked` | User mencapai node akhir yang "memberikan" data sensitif dummy |

Data tambahan yang dapat disimpan per attempt (format JSON, lokasi penyimpanan menyusul keputusan implementasi): `path_taken` (urutan node), `time_to_respond` per node, `final_outcome`.

**Catatan desain penting:** karena setiap respons dibatasi pilihan (bukan ucapan bebas), data yang didapat adalah *pola keputusan dalam skenario terstruktur* — bukan respons sosial-engineering spontan yang sesungguhnya. Perbedaan ini perlu disampaikan secara jujur jika ditanyakan, untuk menghindari overclaim soal apa yang sebenarnya diukur.

---

## 2. Flow B — Crowdsourced Threat Reporting

### 2.1 Ikhtisar

Flow B memungkinkan karyawan melaporkan ancaman dunia nyata (bukan simulasi) — baik berupa URL mencurigakan maupun file lampiran (misal PDF) yang dicurigai berbahaya — melalui Telegram Bot. Sistem secara otomatis menganalisis laporan menggunakan API eksternal (VirusTotal, urlscan.io), menentukan tingkat keparahan, dan membuat tiket insiden jika terbukti berbahaya.

Ini melengkapi Flow A (simulasi internal) dengan kemampuan menangani ancaman nyata yang dilaporkan langsung oleh karyawan — sesuai filosofi *teachable moment* dan partisipasi aktif karyawan dalam *human firewall*.

### 2.2 Keputusan Desain

| Keputusan | Pilihan Final | Alasan |
|---|---|---|
| Channel pelaporan | Telegram Bot | Reuse infrastruktur bot yang sudah ada dari Flow A (notifikasi SOC) |
| Scope laporan | **Dual path** — URL dan file attachment | Mencakup skenario nyata seperti "menerima PDF mencurigakan dan takut membuka" |
| Skema penyimpanan data file | **Kolom baru** di tabel `incidents` (bukan disimpan dalam `checklist` sebagai JSON) | Mendukung query langsung berdasarkan hash file (misalnya untuk deteksi ancaman berulang di masa depan) tanpa perlu parsing JSON |
| Severity dari hasil scan | **Threshold otomatis** berdasarkan jumlah engine VirusTotal yang menandai malicious | Tidak memerlukan review manual SOC untuk setiap laporan masuk pada MVP |
| Resolusi konflik verdict (VT vs urlscan) | **Worst-case wins** — severity final = nilai tertinggi di antara kedua sumber | VT (signature-based) dan urlscan.io (behavioral/sandbox) mendeteksi jenis ancaman yang berbeda dan bersifat saling melengkapi, bukan redundan; risiko false-negative dinilai lebih mahal daripada risiko false-positive untuk kasus ini |

### 2.3 Arsitektur Alur

```
Karyawan forward/kirim pesan ke Telegram Bot
         │
         ▼
n8n: Telegram Trigger node menangkap message
         │
         ▼
   [Switch/IF Node] — Deteksi tipe konten (URL teks vs attachment)
         │
    ┌────┴─────┐
    ▼          ▼
 [URL path]  [File path]
    │          │
    ▼          ▼
urlscan.io   Download file dari Telegram
submit URL   → Upload ke VirusTotal File Upload endpoint
    │          │
    ▼          ▼
VirusTotal   Poll hasil analysis
URL lookup   (file scan tidak instan,
    │         berbeda dari URL lookup)
    │          │
    └────┬─────┘
         ▼
   Evaluasi & bandingkan severity (worst-case wins)
         │
    ┌────┴─────┐
    ▼          ▼
Berbahaya    Bersih/Clean
    │          │
    ▼          ▼
POST /api/incidents    Reply ke user:
(source_type:           "Aman, silakan dibuka"
 real_world_report)
    │
    ▼
Notify SOC Telegram
```

### 2.4 Perbedaan Teknis Antar Jalur

| Aspek | URL Path | File Path |
|---|---|---|
| Deteksi tipe konten | Regex match URL pada teks pesan Telegram | Cek keberadaan field `document`/`photo` pada message Telegram |
| API yang dipanggil | urlscan.io (submit + screenshot) + VirusTotal URL endpoint | VirusTotal File Upload endpoint (berbeda dari URL endpoint) |
| Kecepatan hasil | Relatif cepat (detik–menit) | Dapat lebih lambat; kemungkinan memerlukan polling karena analisis file butuh waktu |
| Data tambahan yang tersimpan | `screenshot_url` (dari urlscan.io — kolom sudah ada di skema) | `file_hash`, `original_filename` (kolom baru) |
| Node n8n kunci | HTTP Request ke API | Telegram **Download File** node → HTTP Request upload ke VirusTotal |

### 2.5 Skema Database — Perubahan pada Tabel `incidents`

Menambahkan dua kolom baru pada tabel `incidents` yang telah didefinisikan di `Handoff.MD` §3.3:

| Nama Kolom | Tipe Data | Constraint | Deskripsi |
|---|---|---|---|
| `file_hash` | TEXT | NULLABLE | Hash (SHA256) dari file yang dilaporkan. NULL apabila laporan berupa URL. |
| `original_filename` | TEXT | NULLABLE | Nama file asli sebagaimana dikirim oleh pelapor. NULL apabila laporan berupa URL. |

Kedua kolom bersifat nullable dan konsisten dengan pola kolom lain pada tabel ini (misalnya `vt_verdict`, `urlscan_verdict` yang juga NULL untuk insiden bersumber `simulation`).

### 2.6 Logika Penentuan Severity

#### Threshold VirusTotal (berdasarkan jumlah engine yang menandai malicious)

| Jumlah Engine Flag | Severity |
|---|---|
| 0 | Tidak membuat insiden — balas user "Aman, silakan dibuka" |
| 1–3 | `low` |
| 4–7 | `medium` |
| 8+ | `high` |

#### Verdict urlscan.io

Digunakan sebagai sinyal tambahan (kategorikal: `clean` / `suspicious` / `malicious`), dipetakan ke tingkat severity yang sebanding (`suspicious` ≈ `low`–`medium`, `malicious` ≈ `high`) untuk keperluan perbandingan pada langkah berikutnya.

#### Resolusi Akhir: Worst-Case Wins

```
severity_final = MAX(severity_dari_VirusTotal, severity_dari_urlscan)
```

Jika kedua sumber memberi verdict yang berbeda tingkat, severity yang lebih tinggi yang digunakan untuk membuat tiket insiden. Keputusan ini diambil dengan pertimbangan bahwa kedua tools memiliki mekanisme deteksi yang saling melengkapi (signature-based vs behavioral/sandbox), sehingga sinyal dari salah satu sumber tidak boleh diabaikan hanya karena sumber lain menyatakan bersih.

**Catatan untuk iterasi berikutnya:** apabila pendekatan ini menghasilkan terlalu banyak false-positive (umumnya berasal dari urlscan.io yang bersifat behavioral), threshold atau bobot masing-masing sumber dapat ditinjau ulang. Ini bukan masalah yang perlu dipecahkan pada tahap MVP.

### 2.7 Status Implementasi

Desain logika dan skema sudah final. Belum dimulai:
- Implementasi node-by-node workflow n8n (Switch node, percabangan URL/file, polling untuk hasil VirusTotal file scan).
- Endpoint Flask baru untuk menerima hasil dari n8n dan membuat insiden dengan kolom `file_hash`/`original_filename`.
- Pengujian end-to-end dengan Telegram Bot yang sudah ada dari Flow A.

---

## 3. Catatan Penutup

Dokumen ini bersifat suplemen — rujuk `Handoff.MD` untuk arsitektur inti, skema database lengkap (tabel `user_history`, `events`, `incidents` sebelum penambahan kolom Flow B), serta Flow A yang sudah berjalan end-to-end. Bagian Vishing Simulation di atas sengaja didokumentasikan secara rinci meski berstatus *on hold*, agar implementasi dapat dilanjutkan tanpa perlu mengulang proses desain dari awal.
