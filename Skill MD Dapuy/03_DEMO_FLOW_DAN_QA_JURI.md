# DEMO FLOW & ANTISIPASI Q&A JURI — Human Firewall

**HackNusa 2026 · Disusun 28 Juli 2026 · Pemilik: Dafa**

---

# BAGIAN A — DEMO YANG RELIABLE

## A.1 Aturan pertama: demo live tidak boleh benar-benar live

Ini nasihat yang paling sering ditolak tim dan paling sering disesali.

Kegagalan demo di hackathon hampir tidak pernah disebabkan oleh bug. Penyebabnya selalu: WiFi venue penuh, rate limit API kena, container belum warm, DNS lambat, laptop masuk sleep, notifikasi WhatsApp muncul di tengah screen share.

**Strategi tiga lapis:**

| Lapis | Isi | Kapan dipakai |
|---|---|---|
| **Lapis 1 — Utama** | Demo live dari lingkungan yang **sudah warm dan sudah di-seed** sebelum masuk ruangan | Kondisi normal |
| **Lapis 2 — Cadangan** | **Rekaman layar** alur lengkap, sudah diedit, tersimpan lokal di laptop | Jaringan bermasalah / layanan tidak merespons |
| **Lapis 3 — Darurat** | Screenshot statis di dalam deck, urut sesuai alur | Semuanya gagal |

**Lapis 2 tidak opsional.** Video cadangan harus sudah dibuka di tab kedua **sebelum** presentasi dimulai — bukan dicari saat panik. Berpindah ke rekaman dalam 3 detik sambil berkata *"jaringan venue-nya penuh, ini rekaman alur yang sama"* terlihat profesional. Menunggu loading 40 detik sambil minta maaf berulang kali merusak seluruh presentasi.

## A.2 Checklist pra-demo (H-1 dan H-0)

**H-1:**
- [ ] Seed database: minimal 5 karyawan bernama Indonesia, riwayat 2 kampanye, 3 laporan (2 malicious 1 safe), skor risiko yang bervariasi
- [ ] Verifikasi kuota API VirusTotal & urlscan masih tersedia — **ini penyebab kegagalan demo nomor satu**
- [ ] Rekam video cadangan alur lengkap, ekspor, simpan lokal
- [ ] Screenshot setiap langkah → masukkan ke slide cadangan
- [ ] Latihan penuh dengan timer minimal 3×

**H-0, 30 menit sebelum:**
- [ ] Jalankan `docker compose up`, buka **setiap** halaman sekali (menghangatkan cache & koneksi)
- [ ] Kirim satu laporan uji ke bot Telegram — pastikan bot merespons
- [ ] Matikan semua notifikasi (Do Not Disturb / Focus mode)
- [ ] Tutup semua tab yang tidak dipakai; bersihkan bookmark bar
- [ ] Naikkan ukuran font browser ke 125–150% — juri duduk jauh
- [ ] Colokkan charger; matikan sleep & screensaver
- [ ] **Tethering hotspot HP sudah siap sebagai jaringan cadangan**
- [ ] Buka video cadangan di tab kedua

## A.3 Storyboard demo — 8 menit (versi tatap muka)

Alur naratif sama dengan video, tapi ada ruang untuk detail.

### Babak 1 — Sinyal *(0:00–2:00)*

**Tampilkan:** Inbox Rina (staf keuangan) → email tagihan QRIS vendor → klik → halaman edukasi tier-1 muncul instan.

**Katakan:**
> "Perhatikan yang **tidak** terjadi. Rina tidak dikirimi email teguran. Tidak ada laporan ke atasannya. Dia langsung melihat tanda yang terlewat, di email yang persis baru dia buka, dalam hitungan detik. Riset perilaku konsisten menunjukkan koreksi yang datang saat kesalahan masih hangat jauh lebih melekat daripada modul training tiga minggu kemudian."

**Lalu tunjukkan diferensiator:** klik lagi dari akun yang sudah punya riwayat → **tier-2 muncul, bukan tier-1.**
> "Ini tier-routing. Materi menyesuaikan riwayat, bukan seragam untuk semua orang."

### Babak 2 — Pelaporan & verifikasi *(2:00–4:00)*

**Tampilkan:** Telegram → forward URL ke bot → verdict kembali dengan skor dan sumber.

**Katakan:**
> "Kenapa Telegram dan bukan plugin email? Karena di Indonesia, hal mencurigakan tidak sampai lewat email korporat — sampainya lewat chat. Laporan lewat chat 3 detik akan dipakai; formulir tiket 5 menit tidak akan pernah dibuka. DBIR 2026 mencatat keberhasilan social engineering lewat mobile naik 40 persen — sementara hampir semua platform awareness masih berpusat di email desktop."

**Tunjukkan cache:** URL yang sama dilaporkan kedua kali → hasil instan dari cache.
> "Laporan kedua tidak memakan kuota API. Ini yang membuat model biayanya masuk akal di skala kecil."

### Babak 3 — Triase SOC *(4:00–5:30)*

**Tampilkan:** Dashboard SOC → antrean laporan **sudah terverifikasi** → klasifikasi True Positive → block.

**Katakan:**
> "Yang sampai ke analis bukan laporan mentah. Sudah diverifikasi silang ke dua sumber sebelum masuk antrean. Untuk organisasi yang analis-nya adalah satu orang IT generalis yang juga mengurus printer, pengurangan noise itu adalah keseluruhan produknya."

### Babak 4 — Loop menutup *(5:30–6:45)*

**Tampilkan:** Skor risiko Rina berubah setelah klasifikasi SOC → konten edukasi berikutnya berubah. Badge & streak Budi bertambah.

**Katakan:**
> "Ini bagian yang tidak dimiliki platform awareness konvensional. Keputusan analis tadi bukan berakhir di tiket — ia mengalir kembali ke skor risiko individu, dan mengubah materi yang orang itu terima berikutnya. Data mengalir dua arah. Itu sebabnya kami menyebutnya closed loop, dan itu diferensiator kami yang sesungguhnya — bukan harga."

### Babak 5 — Tampilan pembeli *(6:45–8:00)*

**Tampilkan:** Dashboard HR/GRC → risiko per divisi → AI Threat Summary → estimasi ARO/ALE/SLE.

**Katakan:**
> "Dan ini yang dilihat orang yang menandatangani pembelian: manajer HR tanpa latar belakang teknis. Divisi mana yang paling rentan. Apa yang terjadi, dalam bahasa manusia. Berapa perkiraan biayanya — dengan setiap asumsi bisa dia klik dan ubah sendiri. Kami tidak memberi dia angka untuk dipercaya. Kami memberi dia aritmetika untuk diaudit."

**Berhenti di sini.** Jangan tambahkan "dan masih banyak fitur lain".

## A.4 Detail kecil yang berdampak besar

- **Pakai nama Indonesia.** Rina, Budi, Siti. Data dummy berisi "John Doe" merusak klaim lokalisasi kalian sendiri di slide berikutnya.
- **Pakai skenario Indonesia yang benar-benar terjadi.** Tagihan QRIS, verifikasi BPJS, penipuan rekrutmen, WA Business palsu. Bukan "Nigerian prince".
- **Rupiah, bukan dolar,** di semua tampilan biaya.
- **Timestamp yang masuk akal** — jangan ada laporan bertanggal 2023 di demo.
- **Tunjukkan satu skor risiko yang sedang, bukan semuanya merah.** Dashboard yang semuanya merah terlihat seperti data karangan.

---

# BAGIAN B — ANTISIPASI Q&A JURI

Disusun berdasarkan apa yang biasa ditanyakan praktisi keamanan, dan secara khusus disesuaikan dengan fakta bahwa **jurinya adalah Kaspersky**.

## B.1 Sepuluh pertanyaan paling mungkin — dan paling berbahaya

---

### ⚠️ Q1. "Kaspersky punya ASAP. KnowBe4 sudah 15 tahun di pasar. Apa sebenarnya yang baru di sini?"

**Ini pertanyaan yang paling mungkin muncul, dan yang paling mudah menjatuhkan tim yang tidak siap.**

**Jawaban:**
> "Kalau kami menjawab 'kami lebih murah', jawaban itu pantas ditolak — harga bukan produk. Ada dua hal yang benar-benar berbeda.
>
> Pertama, arah aliran data. Platform awareness mengalir satu arah: sistem mengirim training ke karyawan. Pada kami, keputusan analis SOC mengalir **kembali** ke skor risiko individu dan mengubah materi berikutnya. Perilaku nyata dan respons teknis terhubung dalam satu loop.
>
> Kedua, segmen. ASAP dan KnowBe4 melayani organisasi yang sudah punya anggaran keamanan. Kami menargetkan organisasi Indonesia berisi 50 sampai 500 orang yang hari ini tidak memakai platform apa pun. Kompetitor kami bukan ASAP — kompetitor kami adalah nol.
>
> Dan kami memandang ini komplementer, bukan bersaing. Kalau pelanggan kami tumbuh sampai butuh ASAP, data human risk yang sudah mereka kumpulkan bersama kami membuat mereka lebih siap membelinya."

**Kenapa berhasil:** menolak jawaban yang lemah sebelum juri menolaknya, memberi dua diferensiator substantif, menghormati produk juri, dan mengubah hubungan dari ancaman menjadi funnel.

---

### ⚠️ Q2. "Kalian sebut 'AI Threat Summary'. Modelnya apa? Dilatih dengan data apa?"

**Ini jebakan. Jawaban jujur adalah jawaban yang benar.**

**Jawaban:**
> "Itu bukan model yang kami latih, dan kami memang tidak mengklaimnya begitu. Itu LLM yang menerima data insiden terstruktur yang sudah terdeteksi sistem kami, lalu menuliskannya sebagai narasi yang bisa dibaca manajer HR non-teknis, beserta rekomendasi tindakan.
>
> Deteksinya tidak dilakukan LLM. Deteksi berasal dari data simulasi, laporan karyawan, dan verifikasi VirusTotal/urlscan. LLM adalah lapisan komunikasi, bukan lapisan deteksi. Kami sengaja tidak menyebut produk ini 'AI-powered security' karena istilah itu akan menyesatkan."

**Efeknya:** juri hampir pasti mengangguk. Kalian baru saja lulus tes yang menjatuhkan sebagian besar tim.

---

### ⚠️ Q3. "Threat Intelligence Cache kalian hanyalah wrapper VirusTotal. Di mana intelijennya?"

**Jawaban:**
> "Betul, dan kami menuliskannya sendiri sebagai batasan. Hari ini itu wrapper dengan caching — kami tidak punya intelijen proprietary.
>
> Tapi ada satu jenis data yang kami hasilkan dan tidak dimiliki VirusTotal: **URL apa yang benar-benar dilaporkan karyawan Indonesia, dan mana yang benar-benar diklik.** VirusTotal tahu sebuah URL berbahaya. Kami tahu URL itu berhasil menipu tiga orang di divisi keuangan pada hari Selasa. Itu telemetri human-layer, dan seiring akumulasi, itulah aset intelijen yang benar-benar milik kami."

---

### ⚠️ Q4. "Berapa biaya API VirusTotal kalau ini dijual secara komersial? Apakah tier gratisnya mengizinkan penggunaan komersial?"

**Ini pertanyaan pembunuh unit economics. Kalian HARUS punya jawabannya sebelum 21 Agustus.**

Riset ini belum kalian lakukan. **Ini adalah item aksi P1 — jangan masuk ruang juri tanpa jawaban.**

Kerangka jawaban setelah riset selesai:
> "Tier publik VirusTotal punya batas rate dan pembatasan penggunaan komersial, jadi model produksi kami adalah [X]. Untuk menjaga biaya per pelanggan tetap masuk akal, kami menggunakan caching agresif — URL yang sama tidak pernah diverifikasi dua kali — ditambah sumber gratis untuk komersial seperti PhishTank dan OpenPhish sebagai lapisan pertama, dengan VirusTotal sebagai bring-your-own-license untuk pelanggan Enterprise."

**Kalau belum sempat riset dan tetap ditanya**, jawaban yang bisa diterima:
> "Kami belum menyelesaikan analisis lisensi komersialnya, dan itu memang risiko unit economics terbesar kami saat ini. Mitigasi arsitekturalnya sudah ada — caching agresif dan desain sumber intel yang bisa ditukar — tapi angka pastinya belum kami punya."

Mengakui satu celah spesifik dengan mitigasi yang jelas jauh lebih baik daripada mengarang angka. Juri Kaspersky akan tahu kalau kalian mengarang.

---

### Q5. "Bagaimana kalau karyawan tahu ini simulasi dan hanya bermain untuk skor?"

**Jawaban:**
> "Itu risiko nyata di setiap platform yang memakai gamifikasi, dan ada tiga hal yang kami lakukan.
>
> Pertama, skor terikat pada perilaku nyata — tingkat klik, tingkat pelaporan — bukan penyelesaian modul video. Tidak ada cara mengumpulkan poin dengan menonton sesuatu sampai selesai.
>
> Kedua, gaming sistem dengan cara melaporkan segala hal justru menghasilkan sinyal yang kami inginkan: klasifikasi False Positive oleh SOC menurunkan bobot pelapor tersebut, jadi spam tidak menguntungkan.
>
> Ketiga — dan ini yang paling penting — kalau karyawan menjadi terlalu waspada terhadap phishing sampai melaporkan berlebihan, itu bukan kegagalan. Itu hasil yang kami tuju."

---

### Q6. "Bukankah memantau perilaku karyawan bermasalah secara privasi? Bagaimana dengan UU PDP?"

**Ini pertanyaan yang sangat mungkin muncul dari juri Indonesia, dan kalian punya jawaban kuat.**

**Jawaban:**
> "Justru itu alasan kami menolak arsitektur installed agent. Kami sempat mempertimbangkan model agent-manager seperti EDR, dan menolaknya — sebagian karena kompleksitas, tapi terutama karena implikasi consent dan UU PDP pada perangkat BYOD.
>
> Yang kami kumpulkan hanya berasal dari sesi terautentikasi di layer aplikasi: waktu login, IP, user-agent, interaksi dengan simulasi kami sendiri. Tidak ada yang berjalan di perangkat karyawan. Kami tidak membaca email pribadi, tidak memantau aktivitas di luar sistem kami.
>
> Kami menerima trade-off-nya: perangkat BYOD di luar jaringan kantor tidak tercakup enforcement kami. Kami memilih batas jangkauan yang lebih sempit daripada masalah kepercayaan yang lebih besar."

---

### Q7. "Kenapa Telegram? Perusahaan Indonesia pakai WhatsApp."

**Jawaban jujur — jangan berpura-pura ini keputusan strategis:**
> "Telegram kami pilih untuk PoC karena Bot API-nya terbuka, gratis, dan bisa kami implementasikan cepat. Untuk produksi, WhatsApp Business API memang kanal yang benar untuk pasar Indonesia, dan itu ada di roadmap kami.
>
> Yang penting untuk dicatat: arsitektur pelaporan kami agnostik terhadap kanal. Bot hanya mengirim ke endpoint yang sama. Menambah WhatsApp adalah pekerjaan adapter, bukan perombakan."

Menjawab "kami memilih yang tercepat untuk membuktikan konsep, dan kami tahu kanal yang benar untuk produksi" adalah jawaban engineer. Berpura-pura Telegram lebih unggul adalah jawaban marketing, dan juri akan mendengarnya.

---

### Q8. "Bagaimana ini menskala? SQLite untuk aplikasi multi-tenant?"

**Jawaban:**
> "SQLite adalah keputusan tahap PoC yang disengaja — nol overhead operasional, mudah direproduksi dalam container, cepat untuk iterasi.
>
> Untuk MVP, jalurnya adalah PostgreSQL dengan isolasi per-tenant, dan itu sudah masuk sequencing kami di urutan pertama bersama dashboard role-based dan IAM. Lapisan akses data kami sudah terabstraksi, jadi ini migrasi, bukan penulisan ulang.
>
> Kami juga tidak menargetkan tenant berisi 50.000 pengguna. ICP kami adalah 50 sampai 500 karyawan — beban tulisnya kecil. Kami lebih memilih mengoptimalkan biaya per tenant daripada throughput yang tidak akan pernah kami butuhkan."

---

### Q9. "Apakah ada yang benar-benar memakai ini? Berapa penggunanya?"

**Ini pertanyaan traksi, dan kalian punya jawaban yang belum kalian pakai.**

Produk ini lahir dari internal project di unit **Performance and Support (PSS) Infranexia (Telkom Infra)**. Itu asal-usul nyata di lingkungan korporat nyata, dan sama sekali tidak dipakai dalam dokumen kalian sebagai bukti.

**[V] Sebelum submisi, kumpulkan minimal satu angka nyata dari Lovind:**
- Berapa orang yang menerima simulasi?
- Berapa yang klik? Berapa yang melapor?
- Berapa laporan masuk lewat Telegram?

**Kerangka jawaban:**
> "Produk ini bukan dimulai sebagai proyek hackathon. Ini lahir dari internal project di unit Performance and Support Infranexia, di bawah Telkom Infra. PoC-nya berjalan di lingkungan lab terkontrol dengan [N] pengguna, dan kami mencatat [angka nyata]."

**Satu angka nyata mengalahkan sepuluh slide arsitektur.** Kalau angkanya kecil, tetap sebutkan — kecil tapi nyata mengalahkan besar tapi hipotetis.

---

### Q10. "Kalau ini bagus, kenapa KnowBe4 tidak membuatnya besok?"

**Jawaban:**
> "Sebagian besar memang bisa mereka buat. Yang tidak bisa dibuat cepat ada tiga.
>
> Pustaka skenario Indonesia yang asli — bukan terjemahan antarmuka, tapi pemodelan pola penipuan lokal. Vendor global secara konsisten memperlakukan lokalisasi sebagai pekerjaan penerjemahan, dan itu terlihat dari produknya.
>
> Data closed-loop yang terakumulasi — setiap klasifikasi TP/FP mempertajam model risiko. Pemain baru mulai dari nol.
>
> Dan distribusi. Kami lahir di dalam ekosistem Telkom. Untuk menjangkau UKM dan vendor Indonesia, itu jalur yang sulit ditiru vendor global.
>
> Yang jelas **bukan** moat kami: harga, gamifikasi, integrasi Telegram, ringkasan LLM. Semuanya bisa direplikasi dalam hitungan bulan, dan kami tidak akan berpura-pura sebaliknya."

**Baris terakhir itu yang memenangkan pertanyaan ini.** Menyebut sendiri apa yang bukan keunggulan menunjukkan kalian memahami produk kalian lebih dalam daripada yang bisa mereka uji dalam 5 menit.

---

## B.2 Pertanyaan tambahan yang perlu disiapkan singkat

| Pertanyaan | Inti jawaban |
|---|---|
| "Produk keamanan kalian sendiri aman?" | Audit sudah dilakukan: perbaikan reflected XSS, migrasi API key ke server-side, auth gate di seluruh endpoint admin. **Slide cadangan B3.** |
| "Bisa integrasi dengan SIEM kami?" | Roadmap: forward event human-layer via webhook/syslog format CEF/JSON ke Wazuh. Kami tidak membangun ulang correlation engine. |
| "Siapa yang memutuskan block?" | Manusia — SOC/admin. Human-in-the-loop disengaja, bukan keterbatasan. Auto-block pada sinyal human-layer berisiko tinggi false positive. |
| "Bagaimana model bisnisnya?" | Tier flat per organisasi. Growth Rp 4,9 jt/tahun ≤100 pengguna. **Slide cadangan, Business Case §4.** |
| "Berapa besar pasarnya?" | Dua metode perhitungan, tunjukkan kesenjangannya. **Business Case §5.** |
| "Apa yang akan kalian bangun kalau menang?" | Sequencing Bagian 6.4: IAM role-based dulu (enabler), lalu threat intel adaptif, lalu pelaporan insider. |
| "Bedanya dengan Wazuh?" | Wazuh memantau mesin. Kami memantau manusia lalu memberi makan Wazuh. Kategori berbeda, bukan pesaing. |
| "Berapa lama implementasinya?" | Docker Compose, semua layanan terkontainerisasi. Target onboarding di bawah satu hari untuk tier Growth. |

## B.3 Aturan menjawab yang berlaku untuk semua pertanyaan

1. **Kalau tidak tahu, katakan tidak tahu — lalu katakan bagaimana kalian akan mencari tahunya.** Mengarang di depan praktisi Kaspersky adalah cara tercepat kehilangan seluruh presentasi, bukan hanya satu pertanyaan.
2. **Jawab dalam 30–45 detik.** Jawaban dua menit terdengar defensif dan memakan jatah pertanyaan lain.
3. **Satu orang menjawab satu pertanyaan.** Kalau perlu tambahan, pengarah Q&A yang meminta: *"Lovind, tambahkan sisi teknisnya."*
4. **Jangan pernah membantah premis pertanyaan juri secara langsung.** Katakan "itu pertanyaan yang tepat, dan jawabannya lebih rumit dari yang terlihat" lalu jelaskan.
5. **Kalau juri menemukan kelemahan nyata, akui dan sebutkan bahwa itu sudah ada di roadmap kalian.** Kalau memang belum ada, katakan "itu belum kami pikirkan, dan itu masukan yang berguna" — lalu benar-benar catat. Juri melihat siapa yang mencatat.

---

## Sumber

- [Verizon 2026 DBIR — Social Engineering Findings](https://breacher.ai/blog/verizon-dbir-2026-social-engineering/)
- [62% of Breaches Involved the Human Element — Abnormal AI](https://abnormal.ai/blog/blog-verizon-2026-dbir-key-takeaways)
- [Kaspersky Automated Security Awareness Platform](https://www.kaspersky.com/small-to-medium-business-security/security-awareness-platform)
- [Hoxhunt vs. KnowBe4 2026 — Adaptive Security](https://www.adaptivesecurity.com/blog/hoxhunt-vs-knowbe4-which-is-best-for-2026)
