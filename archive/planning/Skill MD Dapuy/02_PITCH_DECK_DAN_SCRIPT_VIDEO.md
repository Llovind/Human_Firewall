# PITCH DECK & SCRIPT VIDEO 3 MENIT — Human Firewall

**HackNusa 2026 · Track: Human-Centric Security** *(verifikasi nama track — lihat Briefing Kritis)*
**Disusun:** 28 Juli 2026 · **Pemilik:** Dafa

---

# BAGIAN A — PRINSIP NARASI

## A.1 Satu kalimat yang harus diingat juri

Kalau juri hanya mengingat satu kalimat dari kalian, kalimat itu harus:

> **"Semua alat keamanan memantau mesin. Tidak ada yang memantau manusia — dan di sanalah 62% kebocoran dimulai."**

Semua slide adalah pendukung kalimat ini. Kalau satu slide tidak memperkuatnya, buang.

## A.2 Kesalahan naratif paling umum di hackathon keamanan

| Kesalahan | Kenapa mematikan | Yang harus dilakukan |
|---|---|---|
| Menghabiskan 60% waktu di arsitektur | Juri menilai dampak, bukan diagram | Arsitektur maksimal 1 slide, ≤15 detik |
| Membuka dengan "kami adalah tim X dari kampus Y" | Membuang 15 detik pertama — detik paling berharga | Buka dengan masalah. Perkenalan di akhir |
| Klaim "AI-powered adaptive intelligent" | Juri Kaspersky langsung menguji | Sebut spesifik apa yang AI lakukan dan tidak lakukan |
| Demo yang menunjukkan fitur satu per satu | Terasa seperti tur produk, bukan cerita | Demo mengikuti **satu insiden dari awal sampai selesai** |
| Menutup dengan "terima kasih" | Membuang kesempatan terakhir | Tutup dengan satu kalimat pernyataan posisi |

## A.3 Aturan emas demo: ikuti satu karyawan, bukan satu produk

Ini keputusan paling penting di seluruh dokumen ini.

**Jangan** demo begini: "ini fitur simulasi phishing… ini fitur pelaporan… ini fitur gamifikasi…"

**Demo begini:** Rina, staf keuangan, menerima satu email. Ikuti apa yang terjadi setelahnya sampai tuntas.

Alur yang sama menampilkan seluruh fitur kalian, tapi juri mengalaminya sebagai **cerita**, bukan daftar. Orang mengingat cerita dan melupakan daftar — dan juri menonton puluhan video berturut-turut. Cerita adalah cara kalian tidak terlupakan.

---

# BAGIAN B — SCRIPT VIDEO 3 MENIT

**Total: 180 detik · ± 410 kata · tempo ± 145 kata/menit**

> Rekam narasi terpisah dari tangkapan layar, lalu gabungkan. Narasi langsung sambil demo hampir selalu berantakan dan kehabisan waktu.

---

### `0:00 – 0:18` — HOOK *(18 detik)*

**VISUAL:** Layar hitam → satu angka besar muncul: **62%** → berubah jadi ikon orang, bukan ikon server.

**NARASI:**
> "Enam puluh dua persen kebocoran data melibatkan manusia. Bukan firewall yang jebol — orangnya. Tapi hampir setiap alat keamanan yang dibeli organisasi hari ini memantau mesin. Tidak ada satu pun yang memantau lapisan manusia."

**Sumber di layar (kecil, pojok bawah):** *Verizon DBIR 2026 — 22.000+ breach terkonfirmasi, 145 negara*

> **Kenapa efektif:** angka besar + pembalikan ekspektasi + sumber terbaru yang terlihat. Mencantumkan sumber di layar dalam 18 detik pertama langsung memposisikan kalian sebagai tim yang teliti.

---

### `0:18 – 0:33` — MASALAH *(15 detik)*

**VISUAL:** Diagram sederhana. Kiri: SIEM, EDR, Firewall — semua terhubung ke ikon server. Kanan: ikon karyawan, **tidak terhubung ke apa pun.** Ruang kosong di sekitarnya.

**NARASI:**
> "Di Indonesia, BSSN mencatat 5,5 miliar serangan siber sepanjang 2025. Tapi organisasi menengah — 100, 200 karyawan, tanpa SOC, tanpa CISO — tidak punya cara mengetahui divisi mana yang paling rentan. Sinyalnya ada. Tempat menampungnya tidak ada."

> **Kenapa efektif:** ruang kosong di visual itu *adalah* masalahnya. Jangan diisi. Biarkan juri melihatnya.

---

### `0:33 – 0:48` — SOLUSI *(15 detik)*

**VISUAL:** Loop tiga pihak beranimasi — Employee → Sistem → HR/GRC → SOC → kembali ke Employee. Panah terakhir (SOC kembali ke Employee) diberi sorotan warna berbeda.

**NARASI:**
> "Human Firewall mengisi ruang kosong itu. Kami mengubah perilaku manusia menjadi data terstruktur — dan mengembalikannya sebagai edukasi. Karyawan menghasilkan sinyal. HR melihat risikonya. SOC melakukan triase. Lalu keputusan SOC mengubah skor risiko karyawan tadi. Loop-nya tertutup."

> **Kenapa efektif:** panah terakhir adalah USP asli kalian. Beri warna berbeda. Sebut secara eksplisit bahwa loop-nya tertutup — itu kata yang akan diingat juri.

---

### `0:48 – 2:04` — DEMO *(76 detik — porsi terbesar, sesuai PoC Guideline)*

**Ikuti Rina. Jangan tur fitur.**

| Waktu | Visual | Narasi |
|---|---|---|
| `0:48–1:00` | Inbox Rina. Email "Konfirmasi Pembayaran QRIS Vendor". Kursor bergerak, klik. | *"Rina, staf keuangan. Dia menerima email tagihan QRIS dari vendor. Terlihat wajar. Dia klik."* |
| `1:00–1:12` | Halaman edukasi tier-1 muncul instan. Sorot 2–3 tanda bahaya di email yang tadi. | *"Klik itu simulasi kami. Rina tidak dimarahi — dia langsung diperlihatkan tanda yang terlewat, di email yang persis baru saja dia buka. Kalau ini bukan kali pertama, materinya naik ke tier berikutnya secara otomatis."* |
| `1:12–1:24` | Chat Telegram. Rekan Rina, Budi, mem-forward sebuah URL ke bot. Bot membalas dengan verdict + skor. | *"Sementara itu Budi menerima link mencurigakan. Dia forward ke bot Telegram. Sistem memverifikasi silang ke VirusTotal dan urlscan — verdict kembali dalam hitungan detik."* |
| `1:24–1:38` | Dashboard SOC. Laporan Budi muncul sudah terverifikasi. Analis klik **True Positive** → **Block**. | *"Laporan itu masuk ke antrean SOC — sudah terverifikasi, bukan mentah. Analis mengklasifikasikan sebagai True Positive dan memblokirnya. Satu keputusan, satu klik."* |
| `1:38–1:52` | Split screen: kiri — skor risiko Rina naik, konten edukasi berikutnya berubah; kanan — badge pelaporan Budi bertambah, streak naik. | *"Di sinilah loop-nya menutup. Keputusan SOC tadi memperbarui skor risiko Rina, dan menentukan materi apa yang dia terima berikutnya. Budi, yang melaporkan, mendapat badge. Perilaku yang benar dihargai — perilaku berisiko dilatih."* |
| `1:52–2:04` | **Dashboard HR/GRC.** Risiko per divisi. Ringkasan insiden berbahasa natural. Estimasi biaya ARO/ALE/SLE. | *"Dan untuk manajer HR yang tidak berlatar teknis — ini yang dia lihat. Divisi mana yang paling rentan, apa yang terjadi dalam bahasa manusia, dan berapa perkiraan biayanya. Semua asumsi biayanya bisa dia ubah sendiri."* |

> **Aturan wajib:** demo diakhiri di **dashboard HR**, bukan dashboard SOC. Dialah yang membayar produk ini. Godaan untuk menutup di tampilan paling teknis itu kuat — lawan.

---

### `2:04 – 2:28` — DIFERENSIASI *(24 detik)*

**VISUAL:** Tabel 4 baris. Kolom: KnowBe4 · Hoxhunt · **Human Firewall**. Pastikan ada baris di mana kalian **tidak** unggul.

**NARASI:**
> "Kami bukan platform training kelas enterprise yang lebih murah. Segmen yang kami layani — organisasi 50 sampai 500 orang di Indonesia — hari ini tidak memakai platform apa pun. Kompetitor kami bukan KnowBe4 atau Kaspersky ASAP. Kompetitor kami adalah nol. Yang kami tambahkan: skenario yang benar-benar Indonesia, verifikasi laporan otomatis, dan loop tertutup yang tidak dimiliki produk training konvensional."

> **Ini paragraf terpenting di seluruh video.** Ia menghormati produk juri, mengklaim segmen yang tidak mereka layani, dan memindahkan kompetisi dari perang harga ke kategori baru. Latih paragraf ini sampai hafal.

---

### `2:28 – 2:48` — NILAI & ROADMAP *(20 detik)*

**VISUAL:** Timeline sederhana: **PoC (sekarang) → MVP (September) → Capstone & BTP Incubation.** Di bawahnya 3 ikon: role-based IAM · forward-to-SIEM · threat intel adaptif.

**NARASI:**
> "Yang kalian lihat barusan berjalan hari ini, di lingkungan lab terkontrol. Berikutnya: dashboard berbasis peran, dan penerusan event human-layer ke SIEM organisasi dalam format terstruktur — supaya sinyal manusia akhirnya bisa dikorelasikan dengan log jaringan. Kami tidak membangun ulang SIEM. Kami memberinya data yang selama ini tidak pernah dia terima."

> **Kalimat terakhir itu adalah positioning seluruh produk dalam satu kalimat.** Kalau harus memotong sesuatu, jangan yang ini.

---

### `2:48 – 3:00` — PENUTUP *(12 detik)*

**VISUAL:** Logo Human Firewall. Tiga nama tim. Satu baris tagline.

**NARASI:**
> "Kami tidak mencoba membuat manusia berhenti melakukan kesalahan. Kami membuat kesalahan itu terlihat, terukur, dan bisa dipelajari — sebelum berubah menjadi insiden. Human Firewall. Building human resilience against social engineering."

> **Jangan ucapkan "terima kasih sudah menonton."** Buang 3 detik dan melemahkan penutup. Berhenti di tagline.

---

## B.2 Verifikasi tempo — script ini sudah dihitung

Narasi di atas sudah dihitung kata per segmen terhadap alokasi waktunya. Tempo aman untuk narasi bahasa Indonesia adalah **130–155 kata/menit**; di atas itu terdengar terburu-buru dan sulit diikuti.

| Segmen | Kata | Detik | Kata/detik | Status |
|---|---:|---:|---:|---|
| Hook | 34 | 18 | 1,89 | Longgar — beri jeda dramatis setelah "62%" |
| Masalah | 37 | 15 | 2,47 | Pas |
| Solusi | 37 | 15 | 2,47 | Pas |
| Demo | 161 | 76 | 2,12 | Pas — sengaja longgar agar visual bernapas |
| Diferensiasi | 59 | 24 | 2,46 | Pas |
| Nilai & roadmap | 50 | 20 | 2,50 | Pas |
| Penutup | 30 | 12 | 2,50 | Pas |
| **Total** | **408** | **180** | **2,27** | **≈ 136 kata/menit — aman** |

> Segmen Diferensiasi awalnya dialokasikan 20 detik dan terhitung 2,95 kata/detik — terlalu padat untuk paragraf terpenting di video. Waktunya sudah ditambah menjadi 24 detik dengan mengambil 4 detik dari demo.

**Kalau kalian mengubah narasi, hitung ulang.** Melewati 2,7 kata/detik pada segmen mana pun berarti segmen itu akan terdengar terburu-buru.

## B.3 Checklist produksi video

- [ ] Verifikasi durasi maksimum & format file di guideline resmi **[P0]**
- [ ] Rekam narasi terpisah dulu, ukur durasinya, baru rekam layar menyesuaikan
- [ ] Screen capture 1080p minimum, sembunyikan bookmark bar & notifikasi
- [ ] Gunakan data dummy yang **terlihat realistis Indonesia** — nama Indonesia, rupiah, nama vendor lokal. Data dummy bernama "John Doe" merusak klaim lokalisasi kalian sendiri
- [ ] Subtitle bahasa Inggris (juri Kaspersky bisa saja non-Indonesia — Kepala Kaspersky Academy adalah Evgeniya Russkikh)
- [ ] Cantumkan sumber di layar untuk setiap statistik
- [ ] Musik latar pelan, jangan menutupi narasi
- [ ] Tonton ulang dengan volume mati — apakah alurnya masih terbaca? Kalau tidak, visualnya terlalu lemah

---

# BAGIAN C — PITCH DECK (untuk babak presentasi 3 Oktober)

Deck ini untuk presentasi tatap muka, bukan video. Lebih panjang, ada Q&A.

## C.1 Struktur inti — 12 slide

| # | Slide | Isi utama | Sumber di dokumen tim |
|---|---|---|---|
| 1 | **Judul & posisi** | Nama, track, satu baris positioning. **Bukan** perkenalan tim | Hal. 1 |
| 2 | **Masalah — dalam angka** | 62% human element (DBIR 2026) · 5,5 M serangan Indonesia 2025 (BSSN) · 0,02% GDP belanja keamanan | Bag. 2.1 + riset baru |
| 3 | **Blind spot** | Visual: semua tooling → mesin. Lapisan manusia → kosong | Bag. 2.2, 2.3 |
| 4 | **Solusi: Three-Party Loop** | ⭐ Slide terpenting. Sorot panah umpan balik SOC → skor risiko | Bag. 3.2 |
| 5 | **Apa yang berjalan hari ini** | 7 fitur PoC. Sertakan screenshot, bukan bullet | Bag. 4.2 |
| 6 | **Apa yang BELUM kami klaim** | ⭐ Slide pembeda. Batasan yang disadari, dinyatakan sendiri | Bag. 4.3, 5.2 |
| 7 | **Diferensiasi** | Tabel vs KnowBe4/Hoxhunt/ASAP — termasuk baris di mana kalian kalah | Bag. 5.1 + Business Case §3.2 |
| 8 | **Siapa yang membayar** | Tiga persona, satu pembeli. ICP spesifik | Business Case §2 |
| 9 | **Model bisnis** | Tier harga + perbandingan biaya org 100 orang | Business Case §4 |
| 10 | **Ukuran pasar** | Top-down & bottom-up. Tunjukkan kesenjangannya, jangan sembunyikan | Business Case §5 |
| 11 | **Keputusan arsitektur** | Proxy vs agent — beserta trade-off jujurnya | Bag. 6.2 |
| 12 | **Roadmap & penutup** | PoC → MVP Sept → Capstone/BTP. Satu kalimat penutup | Bag. 6.4 |

## C.2 Slide cadangan (jangan ditampilkan, siapkan untuk Q&A)

| # | Slide cadangan | Dipakai saat juri bertanya |
|---|---|---|
| B1 | Diagram arsitektur teknis lengkap | "Bagaimana ini sebenarnya bekerja?" |
| B2 | Model biaya ARO/ALE/SLE dengan rumusnya | "Dari mana angka penghematan itu?" |
| B3 | Ringkasan hasil hardening keamanan | "Apakah produk keamanan kalian sendiri aman?" |
| B4 | Analisis biaya API threat intel | "Berapa biaya operasional kalian per pelanggan?" |
| B5 | Kepatuhan UU PDP & penanganan data | "Bagaimana soal privasi karyawan?" |
| B6 | Peta jalan integrasi SIEM (format CEF/JSON) | "Bagaimana ini masuk ke tumpukan yang sudah ada?" |

> Slide cadangan yang muncul tepat saat ditanya adalah salah satu momen paling meyakinkan dalam presentasi apa pun. Efeknya jauh lebih besar dari usahanya.

## C.3 Slide 6 — mengapa "Apa yang belum kami klaim" adalah slide terkuat kalian

Ini bertentangan dengan naluri, jadi saya jelaskan alasannya.

Juri hackathon keamanan menghabiskan seharian menonton tim mengklaim "AI-powered adaptive threat intelligence" untuk produk yang isinya adalah wrapper API. Mereka sampai pada tahap curiga secara default, dan pekerjaan mereka berubah menjadi mencari overclaim.

Ketika kalian menampilkan slide berjudul **"Yang belum kami klaim"** dan menulis:

- *"AI Threat Summary" adalah lapisan komunikasi berbasis LLM di atas data yang sudah terdeteksi — bukan mesin deteksi baru.*
- *"Threat Intelligence Cache" saat ini adalah wrapper atas VirusTotal dan urlscan — kami belum punya intelijen proprietary.*
- *Keputusan block/allow masih human-in-the-loop, dan itu pilihan desain yang disengaja.*

…kalian mematikan seluruh mode pencarian itu. Sisa presentasi kalian didengar dengan asumsi jujur. Ini adalah pertukaran yang sangat menguntungkan: kalian menyerahkan tiga klaim yang toh tidak akan bertahan diuji, dan mendapat kredibilitas atas semua klaim lainnya.

Dokumen tim menandai bagian ini *"bukan untuk pitch deck secara verbatim"*. Saran saya tegas: **masukkan, dengan pembingkaian yang percaya diri — bukan permintaan maaf.** Judulnya bukan "Kelemahan Kami" tapi **"Batas Klaim Kami"**.

## C.4 Aturan desain visual

- **Satu gagasan per slide.** Kalau butuh dua kalimat menjelaskan sebuah slide, itu dua slide.
- **Teks maksimal 15 kata per slide.** Sisanya kalian ucapkan.
- **Screenshot produk nyata > diagram.** Bukti mengalahkan ilustrasi.
- **Setiap statistik mencantumkan sumbernya di slide itu juga**, ukuran kecil. Ini kebiasaan yang membedakan tim serius.
- **Satu warna aksen saja.** Deck dengan lima warna terlihat seperti kerja mahasiswa; deck dengan satu warna aksen terlihat seperti kerja perusahaan.
- **Jangan pernah menaruh diagram arsitektur di slide 2.** Itu tanda paling umum tim yang jatuh cinta pada teknologinya sendiri, bukan pada masalahnya.

---

# BAGIAN D — PEMBAGIAN BICARA (presentasi tatap muka)

| Segmen | Pembicara | Alasan |
|---|---|---|
| Slide 1–4 (masalah & solusi) | **Dafa** | Ini narasi & business — bagian kamu |
| Slide 5–6 (demo & batas klaim) | **Lovind** | Yang membangun harus menunjukkan; kredibilitas teknis |
| Slide 7–10 (diferensiasi & bisnis) | **Dafa** | Bagian kamu |
| Slide 11 (arsitektur) | **Lovind atau Jaldi** | Pertanyaan teknis akan menyusul |
| Slide 12 (penutup) | **Dafa** | Penutup harus dari orang yang membuka — memberi rasa lengkap |
| Q&A | Semua, **tapi satu orang mengarahkan** | Dafa mendengar pertanyaan, memutuskan siapa menjawab, lalu merangkum |

> **Peran "pengarah Q&A" itu nyata dan sering diabaikan.** Tanpa itu, tiga orang menjawab pertanyaan yang sama secara bertumpuk dan terdengar tidak terkoordinasi. Dengan itu, tim terlihat seperti sudah pernah melakukan ini.
