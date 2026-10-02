# BUSINESS CASE & MARKET ANGLE — Human Firewall

**Untuk:** HackNusa 2026 (kriteria USP + Scalability) · BTP Incubation · Capstone
**Disusun:** 28 Juli 2026 · **Pemilik:** Dafa

> **Cara baca dokumen ini.** Setiap angka diberi label: **[S]** = bersumber & terverifikasi, **[A]** = asumsi model yang bisa didebat, **[V]** = perlu kalian verifikasi sendiri. Jangan pernah menyebut angka **[A]** ke juri tanpa menyebut bahwa itu asumsi — justru menyebutnya sebagai asumsi membuat kalian terdengar lebih kredibel, bukan kurang.

---

## 1. Pertanyaan yang harus dijawab business case ini

Juri hackathon tingkat nasional yang disponsori vendor keamanan akan menanyakan lima hal. Kalau kelima ini terjawab dengan angka, kalian sudah di atas 90% peserta:

1. Siapa yang membayar, dan berapa?
2. Kenapa mereka tidak memakai produk yang sudah ada?
3. Berapa besar pasarnya, dan bagaimana kalian menghitungnya?
4. Berapa biaya kalian menjalankan ini per pelanggan?
5. Apa yang menghalangi orang lain menyalin ini?

---

## 2. Siapa pelanggannya — Ideal Customer Profile

### 2.1 Kesalahan umum yang harus dihindari

Dokumen tim saat ini menulis target segmen sebagai *"UKM, institusi pendidikan, dan instansi dengan anggaran terbatas"*. Itu terlalu luas untuk bisa dijual. "UKM Indonesia" mencakup 60+ juta unit usaha yang sebagian besar adalah warung dan usaha mikro tanpa satu pun akun email korporat. Menyebut mereka sebagai pasar akan langsung terbaca sebagai tim yang belum memikirkan go-to-market.

### 2.2 ICP yang tajam

| Dimensi | Spesifikasi |
|---|---|
| **Ukuran organisasi** | 50–500 karyawan berbasis komputer (punya akun email korporat) |
| **Struktur keamanan** | **Tidak punya CISO. Tidak punya SOC.** Punya 1–3 orang IT generalis |
| **Sektor prioritas** | Keuangan/koperasi/BPR, layanan kesehatan, institusi pendidikan, kontraktor & vendor BUMN, layanan profesional |
| **Pemicu pembelian** | Audit UU PDP · permintaan klien enterprise · baru saja kena insiden · syarat tender |
| **Anggaran keamanan tahunan** | Rp 20–150 juta total (bukan hanya awareness) **[A]** |

### 2.3 Tiga persona — dan siapa yang sebenarnya menandatangani

Ini penting untuk demo dan deck: **produk kalian punya tiga pengguna tapi hanya satu pembeli.**

**A. Pembeli / Economic Buyer — Manajer HR, GA, atau Compliance**
Bukan orang teknis. Terminologi keamanan membuatnya tidak nyaman. Dia mendapat tugas "urus security awareness" karena tidak ada orang lain. Yang dia butuhkan: **bukti bahwa program berjalan** dalam bentuk yang bisa ditunjukkan ke direksi dan auditor.
> Kalimat dia: *"Kalau ditanya direksi 'sudah sejauh mana kesiapan kita?', saya tidak punya jawaban selain 'sudah ada sosialisasi'."*
> **Yang dia beli: bukti, bukan keamanan.**

**B. Pengguna teknis — IT generalis / calon SOC**
Mengurus jaringan, endpoint, dan helpdesk sekaligus. Sudah kebanjiran tiket. Dia akan **menolak** apa pun yang menambah beban kerja.
> Kalimat dia: *"Jangan kasih saya satu dashboard lagi yang harus saya pelototin."*
> **Yang dia beli: pengurangan noise — laporan yang sudah terverifikasi VirusTotal/urlscan sebelum sampai ke dia.**

**C. Pengguna akhir — Karyawan**
Tidak peduli keamanan. Menganggap training sebagai gangguan.
> **Yang dia "beli": tidak merasa sedang dilatih.** Ini fungsi gamifikasi kalian — bukan gimmick, tapi mekanisme kepatuhan.

**Implikasi untuk pitch:** demo kalian harus menunjukkan ketiganya dalam satu alur — dan menutup dengan tampilan **persona A**, karena dialah yang membayar. Banyak tim menutup demo dengan tampilan teknis paling keren; itu kesalahan, karena orang yang tanda tangan tidak mengerti tampilan itu.

---

## 3. Lanskap kompetitif — dengan angka

### 3.1 Perbandingan harga

> Asumsi kurs: **USD 1 = Rp 16.300** **[A]** — sesuaikan sebelum presentasi.

| Produk | Model harga | Harga list | Untuk org 100 orang/tahun |
|---|---|---|---|
| **KnowBe4** | Per user/tahun | USD 7,50 – 30,50 **[S]** | **Rp 12,2 – 49,7 juta** |
| **Hoxhunt** | Lisensi flat tahunan | mulai USD 10.000/tahun **[S]** | **± Rp 163 juta** |
| **Kaspersky ASAP** | Per user, volume-based | tidak dipublikasikan **[S]** | — |
| **Proofpoint SAT** | Per user, bundling suite | tidak dipublikasikan | — |
| **Human Firewall** | Tier flat per organisasi | lihat §4 | **Rp 4,9 juta** |

**Catatan kejujuran yang wajib kalian bawa:** harga list KnowBe4 hampir tidak pernah menjadi harga transaksi. Diskon negosiasi lazimnya 22–55% di bawah list **[S]**. Jadi klaim yang aman dan tetap kuat adalah **"3–5× lebih murah pada harga transaksi realistis"**, bukan "10× lebih murah". Kalau kalian melebih-lebihkan dan juri tahu harga asli KnowBe4 — dan juri Kaspersky *pasti* tahu — kredibilitas seluruh deck ikut jatuh.

### 3.2 Perbandingan kapabilitas

| Kapabilitas | KnowBe4 | Hoxhunt | Kaspersky ASAP | **Human Firewall** |
|---|---|---|---|---|
| Simulasi phishing | ✅ | ✅ | ✅ | ✅ |
| Training bertingkat | ✅ | ✅ (adaptif) | ✅ | ✅ (tier-routing) |
| **Pelaporan crowdsource via chat (Telegram/WA)** | ⚠️ plugin email | ⚠️ plugin email | ⚠️ | ✅ **native** |
| **Verifikasi otomatis laporan (VirusTotal/urlscan)** | ❌ | ❌ | ❌ | ✅ |
| **Loop umpan balik SOC → skor risiko individu** | ❌ | ⚠️ parsial | ❌ | ✅ |
| **Konten & skenario asli Indonesia (QRIS, BPJS, WA scam)** | ❌ | ❌ | ⚠️ terjemahan | ✅ |
| **Forward event human-layer ke SIEM (CEF/JSON)** | ⚠️ terbatas | ⚠️ | ⚠️ | ✅ (roadmap) |
| Konten library besar & sertifikasi compliance | ✅ | ✅ | ✅ | ❌ |
| Kematangan produk & dukungan enterprise | ✅ | ✅ | ✅ | ❌ |

**Baris dua terakhir sengaja saya masukkan.** Tabel kompetitor yang semua kolomnya ✅ untuk produk sendiri adalah sinyal ketidakjujuran, dan juri berpengalaman langsung mencurigainya. Tabel yang menunjukkan dua kelemahan nyata justru membuat sembilan baris lainnya dipercaya.

### 3.3 Celah pasar yang nyata (bukan yang kalian karang)

Riset terhadap keluhan pengguna platform mapan menunjukkan tiga pola yang konsisten **[S]**:

1. **Template terasa generik dan mudah dikenali** — pola lama, realisme terbatas.
2. **Lokalisasi terbatas** — menggulirkan training spesifik per region dalam banyak bahasa itu sulit; lokalisasi diperlakukan sebagai penerjemahan antarmuka, bukan pemodelan ancaman lokal.
3. **Beban admin tinggi** — kalau ingin simulasi berkembang, admin harus merancangnya sendiri.

Ketiganya adalah persis di mana Human Firewall bisa menang, dan semuanya **bukan tentang harga**. Ini yang harus jadi diferensiator utama kalian, menggantikan argumen "lebih murah".

### 3.4 Kompetitor sebenarnya: tidak ada apa-apa

Untuk ICP kalian, kompetitor bukan KnowBe4. Kompetitornya adalah:

- Sosialisasi keamanan sekali setahun lewat slide PowerPoint
- Grup WhatsApp berisi peringatan "hati-hati link penipuan"
- Tidak ada apa pun

**Indonesia hanya mengalokasikan sekitar 0,02% dari GDP untuk keamanan siber [S]** — bukti kuantitatif bahwa segmen ini memang belum terlayani. Ini bukan pasar rebutan, ini pasar yang belum terbentuk. Katakan itu di depan juri; itu argumen yang jauh lebih menarik daripada perang harga.

---

## 4. Model bisnis & pricing

### 4.1 Struktur tier (usulan)

| Tier | Harga | Batas | Isi | Tujuan strategis |
|---|---|---|---|---|
| **Community** | **Gratis** | ≤ 25 pengguna | Simulasi phishing, kuis harian, gamifikasi, pelaporan Telegram | Akuisisi + kampus + basis data konten lokal |
| **Growth** | **Rp 4,9 juta/tahun** | ≤ 100 pengguna | + dashboard HR/GRC, laporan risiko per divisi, model ARO/ALE/SLE, ekspor PDF | Ini tier utama untuk ICP |
| **Business** | **Rp 14,9 juta/tahun** | ≤ 500 pengguna | + dashboard SOC role-based, threat intel cache adaptif, audit login/device, forward ke SIEM | Naik kelas |
| **Enterprise / On-Prem** | mulai **Rp 60 juta/tahun** | kustom | + deployment on-premise, data residency, SSO, dukungan | Angle UU PDP — data tidak keluar organisasi |

**Semua angka di atas adalah [A] — usulan, bukan hasil riset harga.** Kalian belum melakukan wawancara harga dengan calon pelanggan. Katakan itu apa adanya kalau ditanya, lalu tambahkan bahwa validasi harga adalah bagian dari fase MVP.

### 4.2 Mengapa flat per organisasi, bukan per user

Ini keputusan yang harus bisa kalian pertahankan, karena juri kemungkinan akan menanyakannya:

1. **ICP kalian benci ketidakpastian anggaran.** Manajer HR di perusahaan 120 orang butuh satu angka untuk diajukan ke direksi, bukan formula yang berubah tiap ada karyawan masuk.
2. **Per-user menghukum adopsi.** Kalau harga naik tiap karyawan ditambahkan, HR akan mendaftarkan sebagian saja — dan produk kalian kehilangan justru data perilaku yang menjadi inti nilainya.
3. **Menghindari perbandingan langsung dengan KnowBe4.** Begitu kalian memakai unit harga yang sama, kalian menjadi baris di spreadsheet perbandingan. Unit harga berbeda memaksa evaluasi berbeda.

### 4.3 Jalur pendapatan tambahan (fase pasca-MVP)

- **Konten lokal sebagai produk terpisah** — pustaka skenario Indonesia (QRIS, BPJS, penipuan rekrutmen, WA business scam) dilisensikan ke platform lain. Ini memonetisasi aset yang paling sulit ditiru.
- **Laporan human risk untuk kepatuhan UU PDP** — output terformat untuk auditor.
- **Program kesadaran terkelola (managed)** untuk organisasi tanpa staf sama sekali.

---

## 5. Ukuran pasar — dihitung dua arah

> Menghitung dua arah (top-down dan bottom-up) lalu menunjukkan hasilnya berada di rentang yang sama adalah teknik yang sangat dihargai juri. Kalau hasilnya jauh berbeda, itu sendiri informasi berharga.

### 5.1 Top-down

| Langkah | Nilai | Label |
|---|---|---|
| Pasar keamanan siber Indonesia 2026 | USD 1,62 miliar | **[S]** Mordor Intelligence |
| Proyeksi 2031 | USD 4,06 miliar (CAGR 20,12%) | **[S]** |
| Porsi segmen security awareness training | 2–4% dari belanja keamanan | **[A]** rule of thumb industri — **belum diverifikasi, sebut sebagai asumsi** |
| **TAM Indonesia 2026** | **USD 32–65 juta ≈ Rp 528 miliar – 1,06 triliun** | **[A]** |
| SAM — segmen 50–500 karyawan, non-enterprise | ± 25% dari TAM ≈ **Rp 132–265 miliar** | **[A]** |

### 5.2 Bottom-up (lebih dipercaya untuk tahap awal)

| Langkah | Nilai | Label |
|---|---|---|
| Angkatan kerja Indonesia (Feb 2025) | 145,77 juta bekerja | **[S]** BPS |
| Porsi pekerja formal | ± 44% ≈ 64 juta | **[S]** BPS (data 2019, perlu update) **[V]** |
| Porsi pekerja formal berbasis komputer/email | ± 15% ≈ 9,6 juta | **[A]** |
| Berada di organisasi 50–500 orang | ± 30% ≈ 2,9 juta pengguna | **[A]** |
| Setara jumlah organisasi (rata-rata 150 orang) | ± 19.000 organisasi | **[A]** |
| Bersedia membayar untuk awareness dalam 5 tahun | 10% ≈ 1.900 organisasi | **[A]** |
| Rata-rata kontrak Rp 10 juta/tahun | **≈ Rp 19 miliar SAM realistis** | **[A]** |

**Perbedaan hasil kedua metode itu besar, dan itu bukan kesalahan — itu temuan.** Metode top-down mengukur *potensi belanja*; bottom-up mengukur *kesediaan membayar hari ini*. Kesenjangan di antaranya adalah persis peluang yang kalian kejar: pasarnya ada, tapi belum dikonversi menjadi anggaran. **Katakan kalimat ini ke juri.** Tim yang menunjukkan kesadaran atas keterbatasan modelnya sendiri terdengar jauh lebih matang daripada tim yang menyebut satu angka besar dengan percaya diri.

### 5.3 SOM — target 3 tahun (konservatif, dan itu disengaja)

| Tahun | Pelanggan berbayar | Rata-rata kontrak | ARR |
|---|---|---|---|
| Tahun 1 (pasca-MVP) | 15 | Rp 6 juta | Rp 90 juta |
| Tahun 2 | 60 | Rp 9 juta | Rp 540 juta |
| Tahun 3 | 150 | Rp 12 juta | **Rp 1,8 miliar** |

**Jangan tergoda membesarkan angka ini.** Tim mahasiswa yang memproyeksikan ARR Rp 50 miliar di tahun 3 langsung kehilangan kredibilitas. Angka Rp 1,8 miliar dengan asumsi yang terlihat jelas jauh lebih meyakinkan — terutama untuk BTP Incubation, di mana yang dinilai adalah kualitas penalaran, bukan besarnya angka.

---

## 6. Unit economics & struktur biaya

### 6.1 Pendorong biaya per pelanggan

| Komponen | Perkiraan/tahun | Catatan |
|---|---|---|
| Infrastruktur (VPS multi-tenant, terbagi) | Rp 200–500 rb **[A]** | Stack ringan: Flask/SQLite/n8n/GoPhish dalam container |
| **API threat intelligence (VirusTotal / urlscan)** | **⚠️ RISIKO — belum divalidasi [V]** | Lihat §6.2 |
| API LLM (AI Threat Summary) | Rp 100–300 rb **[A]** | Volume rendah, hanya saat ada insiden |
| Bot Telegram | Rp 0 | Gratis |
| Dukungan & onboarding | Rp 1–2 juta **[A]** | Ini biaya terbesar di tahap awal |

**Gross margin kasar pada tier Growth (Rp 4,9 juta): ± 60–70% [A]** — sehat, tapi angka ini akan berubah setelah §6.2 diverifikasi.

### 6.2 Risiko unit economics yang harus kalian cek minggu ini

Ini bagian yang paling mungkin membuat business case kalian bocor, dan juri teknis dari vendor keamanan sangat mungkin menanyakannya:

> **VirusTotal dan urlscan.io tier gratis punya batas rate yang ketat dan lisensi yang membatasi penggunaan komersial.**

Kalau produk kalian dijual, kalian kemungkinan besar memerlukan lisensi berbayar VirusTotal — dan harga API premium VirusTotal secara historis sangat mahal, sering kali jauh melebihi harga tier Growth yang kalian usulkan. Kalau itu benar, seluruh model harga di §4 tidak berlaku.

**Aksi yang harus dilakukan (P1, tugas Dafa):**
1. Baca Terms of Service VirusTotal Public API — apakah penggunaan dalam produk komersial diizinkan?
2. Minta penawaran harga VirusTotal Premium API / urlscan Pro.
3. Siapkan rencana B: sumber intelijen yang lebih murah atau gratis untuk penggunaan komersial (mis. feed reputasi terbuka, PhishTank, OpenPhish, atau agregator lain), dengan VirusTotal sebagai opsi bawa-lisensi-sendiri (BYOL) untuk pelanggan Enterprise.

**Kalau juri menanyakan ini dan kalian sudah punya jawabannya, itu momen yang memenangkan kredibilitas.** Kalau ditanya dan kalian tidak tahu, itu momen yang paling merusak. Ini pertanyaan yang saya perkirakan punya probabilitas tinggi ditanyakan, karena ini persis jenis detail yang diperiksa praktisi.

---

## 7. Model ARO / ALE / SLE — cara membuatnya defensible

Bagian 6.1 dokumen tim menargetkan penggantian estimasi penghematan sepihak dengan metodologi FAIR-lite. Ini rancangan konkretnya.

### 7.1 Prinsip yang membuatnya tak terbantahkan

**Produk tidak boleh mengarang asumsi. Produk hanya menghitung.** Semua input berasal dari pelanggan, dan setiap angka yang ditampilkan wajib bisa diklik untuk melihat asumsinya.

Ini bukan sekadar desain yang baik — ini pertahanan retoris. Ketika juri bertanya *"dari mana angka penghematan Rp 17 juta ini?"*, jawaban terbaik bukan membela angkanya, tapi: **"Itu angka pelanggan, bukan angka kami. Kami hanya menunjukkan aritmetikanya, dan setiap asumsi bisa mereka ubah sendiri."** Pertanyaan itu langsung padam.

### 7.2 Contoh perhitungan — org 100 orang

**SLE (Single Loss Expectancy) — biaya satu insiden phishing/BEC yang berhasil**

| Komponen | Perhitungan | Nilai |
|---|---|---|
| Respons insiden | 40 jam × Rp 250.000/jam | Rp 10.000.000 |
| Kehilangan produktivitas | 8 jam × 50 orang × Rp 60.000/jam | Rp 24.000.000 |
| Notifikasi, hukum, kepatuhan UU PDP | estimasi | Rp 25.000.000 |
| Kerugian penipuan langsung | sangat bervariasi | *diisi pelanggan* |
| **SLE** | | **± Rp 59.000.000** |

**ARO (Annualized Rate of Occurrence)** — di sinilah letak keunggulan produk kalian. Platform lain memakai benchmark industri. **Human Firewall bisa mengukurnya secara empiris dari data simulasi organisasi itu sendiri** — tingkat klik nyata, tingkat pelaporan nyata, per divisi. Ini keunggulan metodologis yang sah dan sangat layak dijual.

Contoh: ARO = 0,5 insiden berhasil/tahun **[A, sebelum program berjalan]**

**ALE (Annualized Loss Expectancy) = SLE × ARO = Rp 59 juta × 0,5 = Rp 29,5 juta/tahun**

**Setelah program berjalan:** apabila tingkat klik simulasi turun dari 18% ke 7% (penurunan relatif ± 60%), dan diasumsikan ARO turun proporsional:

- ALE baru ≈ Rp 11,8 juta/tahun
- **Pengurangan risiko tahunan ≈ Rp 17,7 juta**
- Biaya Human Firewall Growth = Rp 4,9 juta
- **ROI ≈ 3,6×** **[A]**

### 7.3 Kalimat pengaman yang wajib diucapkan

> "Ini bukan janji penghematan. Ini pengurangan ekspektasi kerugian berdasarkan asumsi yang bisa diaudit dan diubah pelanggan sendiri. Yang kami klaim bukan angkanya — yang kami klaim adalah bahwa organisasi ini, untuk pertama kalinya, punya cara menghitungnya."

Kalimat itu mengubah klaim yang rapuh menjadi klaim yang kokoh, tanpa mengurangi kekuatannya.

---

## 8. Moat — apa yang menghalangi orang menyalin ini

Pertanyaan paling tajam yang bisa diajukan juri adalah: *"KnowBe4 punya 1.000 engineer. Kalau ini bagus, kenapa mereka tidak membuatnya besok?"*

Jawaban jujur: **sebagian besar fitur kalian memang bisa disalin.** Yang tidak bisa disalin cepat ada tiga:

| Moat | Kekuatan | Alasan |
|---|---|---|
| **Pustaka skenario asli Indonesia** | Sedang–kuat | Bukan penerjemahan. Butuh pemahaman pola penipuan lokal (QRIS, BPJS, penipuan rekrutmen, WA business scam) yang tidak dimiliki vendor global. Semakin lama dibangun, semakin dalam. |
| **Data closed-loop yang terakumulasi** | Kuat seiring waktu | Setiap klasifikasi TP/FP memperbaiki model risiko. Vendor baru mulai dari nol. Ini efek data yang nyata, bukan retorika. |
| **Distribusi via ekosistem Telkom** | Kuat, dan sering diremehkan | Lahir dari unit PSS Infranexia (Telkom Infra). Akses ke rantai vendor Telkom Group adalah keunggulan distribusi yang nyata dan sulit ditiru pemain global. |

**Yang bukan moat:** harga, gamifikasi, integrasi Telegram, ringkasan LLM. Semuanya bisa direplikasi dalam hitungan bulan. Jangan menjualnya sebagai moat — juri akan tahu.

**Menyebut sendiri apa yang bukan moat adalah gerakan yang kuat.** Itu menunjukkan kalian memahami produk sendiri lebih dalam daripada yang bisa mereka uji.

---

## 9. Sumber

- [Verizon 2026 Data Breach Investigations Report](https://www.verizon.com/business/resources/reports/dbir/)
- [KnowBe4 Software Pricing & Plans 2026 — Vendr](https://www.vendr.com/marketplace/knowbe4)
- [Deciphering KnowBe4's pricing per user in 2026 — Securan](https://www.securan.io/blog/knowbe4-pricing-per-user)
- [Hoxhunt vs. KnowBe4: Which Is Best for 2026 — Adaptive Security](https://www.adaptivesecurity.com/blog/hoxhunt-vs-knowbe4-which-is-best-for-2026)
- [Hoxhunt vs KnowBe4 Pricing Compared — SaaS Battle](https://trysaasbattle.com/hoxhunt-vs-knowbe4/)
- [Kaspersky Automated Security Awareness Platform](https://www.kaspersky.com/small-to-medium-business-security/security-awareness-platform)
- [Indonesia Cybersecurity Market Size, Growth Trends & Forecast — Mordor Intelligence](https://www.mordorintelligence.com/industry-reports/indonesia-cybersecurity-market)
- [Indonesia's Cybersecurity Market Outlook to 2030 — IndoSec Summit](https://indosecsummit.com/blog/why-indosec-matters-indonesias-cybersecurity-market-outlook-to-2030)
- [Keadaan Ketenagakerjaan Indonesia Februari 2025 — BPS](https://www.bps.go.id/en/infographic?id=1113)
- [Persentase Tenaga Kerja Formal — BPS](https://www.bps.go.id/id/statistics-table/2/MTE3MCMy/persentase-tenaga-kerja-formal-menurut-jenis-kelamin.html)
- [Indonesia UU PDP Compliance Guide 2026 — Recording Law](https://www.recordinglaw.com/world-laws/world-data-privacy-laws/indonesia-data-privacy-laws/)
- [SOCRadar 2025 Indonesia Threat Landscape Report](https://socradar.io/resources/report/indonesia-threat-landscape-report-2025/)
