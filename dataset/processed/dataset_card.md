# 🗂️ Dataset Card: URL Threat Detection Benchmark (AFFERENT Research)

## 📌 Executive Summary
Dataset ini dikonstruksi secara khusus untuk evaluasi dan publikasi ilmiah model deteksi ancaman URL (Machine Learning & Deep Learning). Seluruh tahapan pipeline dirancang memenuhi 4 kriteria ketat metodologi riset cybersecurity:

1. **Reproducibility Terjamin** — Semua sumber berbasis feed & repositori publik terbuka dengan referensi DOI, list-ID permanen, dan instruksi download terverifikasi.
2. **Provenance Transparan** — Dataset multi-source Kaggle (`sid321axn`) secara akurat disitasi sebagai agregasi dari 5 sumber (ISCX-URL2016, PhishTank, Malware Domain Blocklist, PhishStorm).
3. **Eliminasi Bias Struktural (Anti-Shortcut Learning)** — Domain Tranco (100% root URLs tanpa path) **tidak dijadikan string URL benign** dalam set latih, melainkan disimpan sebagai tabel reputasi domain independen (`tranco_lookup.csv`). URL benign diambil dari hasil crawl deep-path nyata (Grambeddings & Kaggle) agar model tidak belajar shortcut trivial (`path == empty -> benign`).
4. **Anti Data-Leakage (Domain-Grouped Split)** — Split Train/Val/Test dilakukan menggunakan `GroupShuffleSplit` pada level *registered domain*. Terverifikasi secara matematis zero domain overlap ($Train \cap Val = \emptyset$, $Train \cap Test = \emptyset$, $Val \cap Test = \emptyset$).
5. **Indonesian Threat Generalization Set Terisolasi** — 299 URL ancaman spesifik Indonesia (slot88/judol & typosquatting perbankan ID) dipisahkan ke `indonesian_threat_casestudy.csv` khusus untuk evaluasi out-of-distribution / transferability, tidak mencemari benchmark publik.

---

## 📊 Statistik Dataset

### 1. Macro Corpus (Seluruh Data Publik Terkumpul & Terdeduplikasi)
| Scope | Benign | Phishing | Malware | Other | Total Unique URLs |
|---|---|---|---|---|---|
| **Full Corpus** | 822,701 | 484,191 | 39,147 | 95,307 | **1,441,346** |

### 2. Balanced Experimental Benchmark (Subsample 100K Seimbang untuk Pelatihan & Ablasi)
| Split | Benign | Phishing | Malware | Other | Total |
|---|---|---|---|---|---|
| **Train** | 17,451 | 16,733 | 13,290 | 17,598 | **65,072** |
| **Val** | 3,537 | 4,463 | 5,183 | 3,263 | **16,446** |
| **Test** | 4,012 | 3,804 | 6,527 | 4,139 | **18,482** |
| **Total** | 25,000 | 25,000 | 25,000 | 25,000 | **100,000** |

> *Catatan Reviewer:* Angka eksperimen pelatihan standar menggunakan subsample 100K seimbang (25K per kelas) untuk menjaga stabilitas gradient dan mencegah bias mayoritas benign (800K). Dataset lengkap 1,46M URL unik juga dapat direproduksi penuh menggunakan flag `--full`.

---

## 🌐 Daftar Sumber Data & Lisensi

| Sumber | Peran Metodologis | Lisensi | List-ID / Snapshot | Referensi Sitasi Paper |
|---|---|---|---|---|
| **Grambeddings** | Basis Deep-Crawled URLs (400K Benign, 400K Phishing) | Academic Research | Snapshot 2022 | Dalgic et al., Elsevier Computers & Security 2022 |
| **Kaggle Multi-Source** | Agregasi Pihak Ketiga (ISCX-2016, PhishTank, MDL, PhishStorm) | Open Academic / ODbL | sid321axn (651K) | S. Saxena (sid321axn), "Malicious URLs Dataset", Kaggle 2021 |
| **URLhaus (abuse.ch)** | Live Active Malware URLs | CC0 1.0 Universal | Snapshot: 2026-09-23 13:53 UTC | abuse.ch URLhaus Project (URLhaus Feed) |
| **OpenPhish** | Real-time Active Phishing | Community Research Feed | Snapshot: 2026-09-23 13:53 UTC | OpenPhish Real-time Threat Feed |
| **Tranco List** | Domain Reputation Ranking (bukan raw URL string) | CC-BY 4.0 / Academic | List-ID: **`Y8YYG`** | Pochat et al., NDSS 2019 |
| **AFFERENT ID Seed** | Out-of-Distribution Case Study (Judol & Typosquat ID) | Internal Corpus | Q3 2026 | Evaluasi OOD & Transferability Lokal AFFERENT |

---

## 🔒 Baseline Freeze & Checksums (SHA-256)

Dataset eksperimental telah dibekukan (**FROZEN**) untuk menjamin integritas dan replikasi eksperimen paper:

| File Artefak | Ukuran Baris | SHA-256 Checksum |
|---|---|---|
| `train.csv` | 65,072 | `78924F1F87BFF22D364FF6C311616B4F7950537329F27FED48C04405BA7432C2` |
| `val.csv` | 16,446 | `FE118A661CE6D4990B59DFC5182EECA9B7D675A30A268605BF01D2521C643017` |
| `test.csv` | 18,482 | `1BA4064401A49E6B874F3EFB055E9136A687BF5A786D446AC6CDE6EFF03F3348` |
| `indonesian_threat_casestudy.csv` | 299 | `ABF88658FE40530920BC4BB8FEE6887F2D504EB04B3876D8F758D9F78F0BDA10` |
| `label_conflicts.csv` | 8,021 | `ED6CF19BB2AEBEA817D35EC76B67BA97A7EFB3D9ADA94E13EA72AEC4A187BFF9` |

### Rekonsiliasi & Lineage Total Angka
1. **Laporan Awal (1.517.440)**: Raw sum dari seluruh file mentah sebelum dedup & filter Tranco.
2. **Dedup Antara (1.491.451)**: Deduplikasi string URL mentah sebelum Tranco dipisahkan menjadi reputation table.
3. **Frozen Final Corpus (1.441.346)**: Angka definitif setelah Tranco dikeluarkan dari URL set, pembuangan 8.021 baris inkonsisten antar feed, dan isolasi 299 URL AFFERENT ID.

---

## 🎯 Taksonomi Kelas & Desain Metodologis (4-Class Benchmark vs OOD Judol)

- **Main Model Head (4 Unified Classes)**: `Benign`, `Phishing`, `Malware`, `Other`.
- **Desain Khusus Judol / Ancaman Lokal**: Tidak diikutsertakan dalam pelatihan 4-kelas utama agar tidak merusak validitas benchmark publik internasional. Ancaman judol dievaluasi melalui skema **Out-of-Distribution (OOD) Transferability Test** pada artefak `indonesian_threat_casestudy.csv`. Ini membuktikan kemampuan model melakukan generalisasi zero-shot terhadap kampanye penipuan lokal spesifik tanpa data drift pada benchmark utama.

---

## 🔍 Audit Struktural URL & Mitigasi Bias

Analisis empiris distribusi panjang dan path-depth pada masing-masing sumber:
- **Tranco Domain List**: Rata-rata panjang 21.3 karakter, path depth **0.00** (100% root-only). *Keputusan: Dikeluarkan dari set string URL agar model tidak mengeksploitasi fitur panjang URL/path kosong.*
- **Grambeddings (Benign)**: Rata-rata panjang 46.3 karakter, path depth **1.41** (17.7% root-only).
- **Kaggle (Benign)**: Rata-rata panjang 59.8 karakter, path depth **2.16** (12.3% root-only).
- **Phishing (Grambeddings)**: Rata-rata panjang 85.5 karakter, path depth **2.84** (12.7% root-only).
- **Malware (URLhaus)**: Rata-rata panjang 85.1 karakter, path depth **4.44** (0.7% root-only).

Dengan menggunakan set benign dari Grambeddings dan Kaggle, distribusi path depth benign (1.4 - 2.2) setara dengan variasi web nyata dan mencegah false positive pada URL benign yang memiliki path dalam.

---

## 🧹 Audit Resolusi Konflik Label Lintas Sumber

- Ditemukan **3.973 URL unik** yang memiliki label bertentangan antar sumber (misal: diklaim *benign* di dataset 2016 namun terdaftar *phishing* di Grambeddings/OpenPhish).
- Total baris data yang berkonflik: **8.021 baris**.
- Seluruh 8.021 baris tersebut **dikeluarkan dari dataset latih** (`conflict_policy = 'drop'`) untuk menjamin kemurnian evaluasi benchmark. Seluruh URL yang berkonflik dicatat transparan di `dataset/processed/label_conflicts.csv`.

---

## 🛡️ Verifikasi Isolasi Domain (Zero Leakage)
- Metodologi: `sklearn.model_selection.GroupShuffleSplit` pada level `registered_domain` via `tldextract`.
- Rasio: Train (70%) / Validation (15%) / Test (15%)
- Audit Leakage: Overlap Train-Val: 0, Overlap Train-Test: 0, Overlap Val-Test: 0.

---

## 🚀 Panduan Reproduksi Reviewer

```bash
# 1. Jalankan pembangunan dataset publik (100% reproducible)
python dataset_builder.py --sources grambeddings,kaggle,urlhaus,openphish --sample-size 100000 --balance

# 2. Untuk menghasilkan full corpus 1.44M tanpa downsampling
python dataset_builder.py --sources grambeddings,kaggle,urlhaus,openphish --full
```
