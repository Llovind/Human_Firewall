# TRACKER LOGISTIK & KOORDINASI TIM — Human Firewall

**Disusun 28 Juli 2026 · Pemilik proses: Dafa**
**Deadline riil: 21 Agustus 2026 · Target submit internal: 19 Agustus 2026**

---

## 1. Papan status cepat

| | |
|---|---|
| **Hari tersisa sampai deadline resmi** | **24 hari** (21 Agustus) |
| **Hari tersisa sampai target submit internal** | **22 hari** (19 Agustus) |
| **Hari kerja efektif** | **± 15 hari** (dipotong akhir pekan & libur panjang 15–17 Agustus) |
| **Risiko tertinggi saat ini** | Nama track belum terverifikasi · format submisi belum diketahui |
| **Blocker aktif** | Guideline PDF resmi belum di tangan |

---

## 2. Timeline resmi HackNusa 2026

| Tanggal | Agenda | Aksi tim |
|---|---|---|
| 18 Jun – 21 Agu | Pendaftaran + submisi PoC | **Daftar sekarang, jangan tunggu PoC selesai** |
| **6–7 Agustus** | Webinar peserta | **Minimal 2 orang hadir. Bawa daftar pertanyaan.** |
| **21 Agustus** | Batas akhir pra-submisi | Target internal kita: **19 Agustus** |
| 24 Agu – 4 Sep | Evaluasi & seleksi | Periode tenang — mulai kerjakan MVP |
| ≤ 7 September | Pengumuman 30 tim lolos | — |
| 7 Sep – 3 Okt | Pengembangan proyek lanjutan | **Ini window roadmap Bagian 6** |
| **3 Oktober** | Hackathon tatap muka, final 10 tim, penjurian | Bandung, Telkom University |

**Catatan:** Kaspersky KIPS (Interactive Protection Simulation) diselenggarakan berbarengan 3 Oktober. **[V]** Cek apakah tim bisa/perlu ikut.

**Hadiah:** Rp 13.000.000 + pelatihan Kaspersky senilai hingga USD 2.500.

---

## 3. Rencana per minggu

### Minggu 1 — 28 Juli s/d 3 Agustus · *Verifikasi & fondasi*

| Tugas | Pemilik | Selesai | Status |
|---|---|---|---|
| Unduh guideline PoC resmi, verifikasi nama track | Dafa | 29 Jul | ☐ |
| Konfirmasi format submisi (video? dokumen? repo? batas durasi/ukuran?) | Dafa | 29 Jul | ☐ |
| Daftarkan tim di situs resmi | Dafa | 30 Jul | ☐ |
| Sepakati reframing positioning vs Kaspersky (Briefing §Temuan 3) | Dafa + Lovind + Jaldi | 30 Jul | ☐ |
| Riset lisensi & harga API VirusTotal/urlscan untuk komersial | Dafa | 31 Jul | ☐ |
| Update seluruh statistik ke DBIR 2026 + tambah data BSSN | Dafa | 31 Jul | ☐ |
| Kumpulkan angka penggunaan nyata dari lingkungan PSS Infranexia | Lovind | 1 Agu | ☐ |
| Bekukan scope PoC — **tidak ada fitur baru setelah tanggal ini** | Lovind | 2 Agu | ☐ |
| Kumpulkan/rapikan aset visual (logo, screenshot, palet warna) | Jaldi | 3 Agu | ☐ |

> **Pembekuan scope di 2 Agustus adalah keputusan paling penting minggu ini.** Penyebab kegagalan submisi hackathon yang paling umum bukan kekurangan fitur — melainkan fitur baru yang ditambahkan di H-3 dan merusak demo. Setelah 2 Agustus, kerjaan Lovind adalah **stabilisasi**, bukan penambahan.

### Minggu 2 — 4 s/d 10 Agustus · *Produksi materi*

| Tugas | Pemilik | Selesai | Status |
|---|---|---|---|
| **Ikut webinar peserta** | Dafa + Lovind | 6–7 Agu | ☐ |
| Tanyakan di webinar: bobot kriteria, format submisi, apakah demo live diperlukan | Dafa | 7 Agu | ☐ |
| Draf 1 deck (12 slide) berdasarkan struktur di dokumen 02 | Dafa | 8 Agu | ☐ |
| Seed data demo (nama Indonesia, skenario lokal, timestamp masuk akal) | Lovind | 8 Agu | ☐ |
| Rekam narasi video 3 menit (audio dulu, ukur durasi) | Dafa | 9 Agu | ☐ |
| Perbaikan hardening & stabilisasi PoC | Lovind | 10 Agu | ☐ |
| Finalisasi model ARO/ALE/SLE dengan asumsi bisa diaudit | Jaldi | 10 Agu | ☐ |

### Minggu 3 — 11 s/d 17 Agustus · *Rakit & uji*

> ⚠️ **15–17 Agustus adalah libur panjang.** Sabtu 15, Minggu 16, dan Senin 17 Agustus (Hari Kemerdekaan RI). Praktis kalian kehilangan tiga hari berturut-turut. **Semua pekerjaan kritis harus selesai Jumat 14 Agustus.** Jangan menjadwalkan apa pun yang menentukan di jendela ini — asumsikan tidak ada yang membalas chat.

| Tugas | Hari | Pemilik | Selesai | Status |
|---|---|---|---|---|
| Rekam screen capture demo (alur Rina, bukan tur fitur) | Sel | Lovind | 11 Agu | ☐ |
| **Rekam video cadangan alur lengkap** (untuk demo tatap muka nanti) | Sel | Lovind | 11 Agu | ☐ |
| Gabung video: narasi + screen capture + subtitle EN | Rab | Jaldi | 12 Agu | ☐ |
| Deck final + slide cadangan B1–B6 | Kam | Dafa | 13 Agu | ☐ |
| **Review silang penuh — semua orang menonton & mengoreksi semua** | Kam | Semua | 13 Agu | ☐ |
| Verifikasi ulang setiap angka terhadap sumber aslinya | Jum | Dafa | 14 Agu | ☐ |
| Latihan Q&A: satu orang berperan sebagai juri yang keras | Jum | Semua | 14 Agu | ☐ |
| *(Libur panjang — buffer, jangan diandalkan)* | Sab–Sen | — | 15–17 Agu | — |

### Minggu 4 — 18 s/d 21 Agustus · *Submit & buffer*

| Tugas | Hari | Pemilik | Selesai | Status |
|---|---|---|---|---|
| Perbaikan akhir berdasarkan hasil review & latihan Q&A | Sel | Semua | 18 Agu | ☐ |
| **SUBMIT** | Rab | Dafa | **19 Agu** | ☐ |
| Verifikasi submisi terkirim (screenshot konfirmasi, simpan) | Rab | Dafa | 19 Agu | ☐ |
| Buffer bila ada masalah teknis upload | Kam–Jum | Semua | 20–21 Agu | ☐ |

---

## 4. Pembagian peran (RACI)

**R** = mengerjakan · **A** = bertanggung jawab akhir · **C** = dikonsultasi · **I** = diberi tahu

| Area kerja | Dafa | Lovind | Jaldi |
|---|---|---|---|
| Narasi & pitch deck | **A/R** | C | C |
| Business case & riset pasar | **A/R** | I | C |
| Script video & storytelling | **A/R** | C | C |
| Riset kompetitor & data | **A/R** | I | I |
| Logistik, deadline, submisi | **A/R** | I | I |
| Q&A prep & koordinasi | **A/R** | C | C |
| Stabilitas PoC & demo environment | C | **A/R** | C |
| Arsitektur & keputusan teknis | I | **A/R** | C |
| Behavior risk engine & model skor | C | C | **A/R** |
| Model ARO/ALE/SLE | C | C | **A/R** |
| Aset visual & editing video | C | I | **A/R** |
| Seed data demo | C | **A/R** | C |

**Aturan satu pemilik:** setiap baris hanya boleh punya satu **A**. Kalau dua orang merasa bertanggung jawab atas hal yang sama, yang terjadi adalah tidak ada yang mengerjakannya sampai H-2.

---

## 5. Checklist submisi

> **Ini kerangka. Isi ulang setelah kalian pegang guideline PDF resmi — jangan asumsikan.**

### Administratif
- [ ] Pendaftaran tim selesai & terkonfirmasi
- [ ] Data seluruh anggota lengkap (NIM, email, kontak)
- [ ] Bukti status mahasiswa (kalau disyaratkan) **[V]**
- [ ] Nama tim konsisten di seluruh dokumen
- [ ] **Nama track ditulis persis seperti di guideline resmi** ⚠️

### Materi PoC
- [ ] Video presentasi (durasi & format sesuai guideline) **[V]**
- [ ] Dokumen PoC / proposal (format & batas halaman) **[V]**
- [ ] Deck presentasi (kalau diminta terpisah)
- [ ] Repositori kode / tautan demo (kalau diminta) **[V]**
- [ ] Dokumentasi teknis / README

### Kualitas — periksa sebelum kirim
- [ ] Setiap statistik punya sumber tercantum
- [ ] Semua data DBIR memakai **edisi 2026**, bukan 2025
- [ ] Ada minimal 3 data konteks Indonesia (BSSN, sektor target, belanja keamanan)
- [ ] Tidak ada klaim "AI-powered" tanpa penjelasan spesifik
- [ ] Slide "Batas Klaim Kami" ada di deck
- [ ] Tabel kompetitor memuat baris di mana Human Firewall **tidak** unggul
- [ ] Data demo memakai nama & skenario Indonesia
- [ ] Tidak ada informasi sensitif nyata (kredensial, IP internal, data karyawan asli) di screenshot ⚠️
- [ ] Semua tautan bisa dibuka dari perangkat lain (bukan hanya laptop kalian)
- [ ] Video ditonton sampai habis oleh minimal 2 orang dengan volume mati **dan** menyala

---

## 6. Daftar pertanyaan untuk webinar 6–7 Agustus

Siapkan ini sebelum webinar. Kesempatan bertanya langsung ke panitia adalah aset yang jarang dimanfaatkan tim.

1. Apa nama track resmi yang harus dicantumkan di materi? *(memverifikasi Temuan 1)*
2. Berapa bobot masing-masing dari enam kriteria penilaian?
3. Format & batas durasi video presentasi?
4. Apakah kode sumber harus diserahkan? Apakah dinilai?
5. Apakah demo live diperlukan saat babak tatap muka 3 Oktober, atau cukup rekaman?
6. Berapa lama slot presentasi dan Q&A di final?
7. Apakah PoC boleh berupa produk yang sudah ada sebelum kompetisi (asal-usul dari internal project)? ⚠️ **Penting** — pastikan asal-usul Infranexia tidak melanggar aturan orisinalitas
8. Apakah tim boleh memperbarui submisi setelah dikirim, sebelum deadline?
9. Apakah anggota tim wajib mahasiswa aktif seluruhnya?
10. Bagaimana mekanisme keikutsertaan Kaspersky KIPS di 3 Oktober?

> **Pertanyaan nomor 7 adalah yang paling penting untuk ditanyakan.** Produk kalian berasal dari internal project di Infranexia. Sebagian besar hackathon punya aturan tentang orisinalitas atau karya yang sudah ada sebelumnya. Lebih baik mengetahui ini di 6 Agustus daripada di 3 Oktober.

---

## 7. Register risiko

| Risiko | Dampak | Kemungkinan | Mitigasi | Pemilik |
|---|---|---|---|---|
| Nama track salah di materi | Tinggi | Sedang | Verifikasi dari guideline resmi, P0 | Dafa |
| Aturan orisinalitas melarang karya yang sudah ada | **Sangat tinggi** | Rendah–sedang | Tanyakan di webinar (pertanyaan #7) | Dafa |
| Lisensi VirusTotal tidak mengizinkan komersial | Tinggi | Sedang | Riset minggu 1 + rencana B multi-sumber | Dafa |
| Demo gagal saat presentasi | Tinggi | **Tinggi** | Video cadangan + screenshot statis (dok. 03 §A.1) | Lovind |
| Fitur baru ditambahkan mepet deadline | Tinggi | **Tinggi** | Pembekuan scope 2 Agustus, ditegakkan | Lovind |
| Konflik jadwal magang / kuliah anggota | Sedang | Tinggi | Selesaikan pekerjaan berat di minggu 1–2 | Semua |
| Kegagalan teknis saat upload submisi | Tinggi | Rendah | Submit 19 Agu, buffer 2 hari | Dafa |
| Angka statistik salah kutip ditemukan juri | Tinggi | Sedang | Verifikasi ulang seluruh angka 14 Agu | Dafa |
| 17 Agustus menghapus 2 hari kerja | Rendah | Pasti | Sudah diperhitungkan di jadwal | Dafa |

---

## 8. Ritme koordinasi

| Kapan | Format | Durasi | Isi |
|---|---|---|---|
| Setiap Senin & Kamis | Sinkron singkat (bisa via chat) | 15 menit | Selesai apa · kerjakan apa · terhambat apa |
| Setiap Sabtu | Review mingguan | 45 menit | Tinjau tracker ini, geser tanggal kalau perlu |
| 14 Agustus | Review silang penuh | 2 jam | Semua orang mereview semua deliverable |
| 15 Agustus | Simulasi Q&A | 1 jam | Satu orang berperan sebagai juri yang keras |

**Aturan blocker:** apa pun yang menghambat lebih dari 24 jam langsung diangkat ke grup — jangan tunggu sinkron berikutnya.

---

## 9. Setelah HackNusa — jalur berikutnya

| Jalur | Waktu | Yang dibutuhkan tambahan |
|---|---|---|
| **MVP** | Target September 2026 | Sequencing Bagian 6.4: IAM role-based dulu |
| **Capstone / Tugas Akhir** | Mengikuti kalender akademik | Landasan akademik, metodologi penelitian, evaluasi terukur |
| **BTP Incubation** | **[V]** cek jadwal batch | Business case lebih dalam: validasi pelanggan, surat niat, unit economics tervalidasi |

**Yang perlu diperkuat khusus untuk BTP Incubation** (di luar kebutuhan HackNusa):

- **Bukti validasi pelanggan** — minimal 10 wawancara dengan HR/GRC di organisasi target. Ini yang paling sering hilang dari aplikasi inkubasi mahasiswa, dan yang paling dicari penilai.
- **Validasi harga** — apakah ada yang benar-benar bersedia membayar Rp 4,9 juta/tahun? Tanyakan langsung.
- **Struktur tim & komitmen** — siapa yang lanjut penuh waktu setelah lulus?
- **Kejelasan HAKI** — produk lahir di dalam Telkom Infra. **Siapa pemilik kekayaan intelektualnya?** ⚠️ Ini harus diselesaikan sebelum masuk inkubasi mana pun, dan menyelesaikannya lebih awal jauh lebih murah daripada nanti.

> Poin terakhir itu bukan formalitas. Kepemilikan HAKI atas produk yang lahir dari proyek internal perusahaan adalah pertanyaan pertama yang diajukan setiap program inkubasi yang serius. Selesaikan sekarang selagi hubungannya masih baik dan taruhannya masih kecil.

---

## Sumber

- [Jadwal & ketentuan HackNusa 2026 — ItWorks](https://www.itworks.id/81984/buka-pendaftaran-hacknusa-universitas-telkom-kaspersky-luncurkan-hackathon-keamanan-siber-nasional.html)
- [Telkom University and Kaspersky Hold HackNusa — VOI](https://voi.id/en/amp/585626)
- [Situs resmi HackNusa](https://hackathon.telkomuniversity.ac.id/)
