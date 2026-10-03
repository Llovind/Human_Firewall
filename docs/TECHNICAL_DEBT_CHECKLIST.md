# Technical debt final submission

Checklist implementasi; bukan bukti testing aplikasi. Daf akan melakukan testing manual.
Future Work (SMTP deployment baru, NAC/sensor baru) tidak termasuk scope.

## Review Daf — 3 Oktober 2026 (menggantikan default sebelumnya)

- [x] Hapus seed fallback behavior/summary; timestamp sumber stabil, polling
      tanpa render ulang jika data identik, chart tanpa animasi per polling.
- [x] Ringkasan telemetry tanpa klaim enforcement/incident buatan.
- [x] Runtime model v3 + abstention hostname generated, invalidasi policy
      model lama tanpa menghapus SOC overrides/audit.
- [x] Pisahkan Unknown monitoring dari queue Critical/laporan employee;
      semua traffic tetap ada di feed dan riwayat lama tetap dapat dilihat.
- [x] urlscan Result API dan status provider VT/urlscan di laporan employee.
- [x] Inbox SOC/GRC: laporan link, employee di bawah baseline, persetujuan
      warning, cooldown dan audit append-only. Default warning kini manual.
- [x] Polish workspace Poppins, responsive form/history dan panel bounded.
- [x] Build backend/worker/dashboard, targeted lint dan regression terisolasi.
- [ ] Dataset kategori judol/adult terverifikasi belum tersedia untuk training;
      OOD judol 0/70 Block, tidak diklaim selesai. Recall keseluruhan v3 21,18%.
- [ ] Uji browser VM + host dan tampilan baru oleh Daf.

Rincian, batas evaluasi dan langkah demo: `REVIEW_FIXES.md`.
Angka/default bagian historis di bawah tidak menggantikan review terbaru ini.

## Implementasi

- [x] Sinkronkan push UI/UX dan model tim (`df7ea97`).
- [x] Fetch commit dataset/training (`6221f13`).
- [x] Tambahkan dependency CPU inference sesuai kalibrator.
- [x] Tambahkan bounded ML inference, cache full URL, dan hasil Unknown saat model belum siap.
- [x] Hilangkan fallback VirusTotal/urlscan dari API scan URL.
- [x] Tambahkan backend report employee berbasis VT/urlscan dan notifikasi SOC lewat SSE.
- [x] Tambahkan backend/BFF change password, audit, dan revoke semua session.
- [x] Integrasikan UI scan/report employee dan status laporan.
- [x] Menu akun employee/admin: logout dan change password.
- [x] Warning edukasi otomatis hanya employee aktif berskor `<60/200` (ENV),
      recheck sebelum pengiriman, cooldown 24 jam, retry persisten, Mailpit saja.
- [x] Label Administrator, mempertahankan identifier RBAC existing.
- [x] Perbaiki AI Heatmap: baseline telemetry berlabel, validasi hasil LLM,
      error provider terlihat; tidak mengklaim LLM aktif tanpa provider.
- [x] Hapus menu Policy dari SOC tanpa menghapus enforcement proxy.
- [x] Rapikan IoC: manual Block/Allow dengan reason/audit, kegagalan tidak
      menghapus form; feed insiden/IoC tidak memakai seed fallback ketika error.
- [x] Cleanup terarah: workflow dan gateway Telegram/n8n diarsipkan, n8n dicabut
      dari Compose, telemetry lama dipertahankan; SMTP eksternal tidak ditambah.
- [x] Runbook demo host + VM bridged: `DEMO_VM_SOC.md`.
- [x] Review dataset, training, serta evaluasi model: domain-only baseline baru;
      bobot DL full-URL existing dipertahankan, batas recall didokumentasikan.

## Verifikasi

- [x] Pemeriksaan syntax Python backend (44 file pada pemeriksaan awal).
- [x] TypeScript/build frontend.
- [x] Targeted lint komponen akun/employee dan BFF yang dirapikan.
- [x] Targeted lint AI Heatmap, IoC dan halaman SOC.
- [x] 6 regression checks report/low-score warning/password/RBAC lulus.
- [x] 11 checks fitur legacy/auth/gamification/proxy preflight lulus.
- [x] 3 checks reward cap/dedupe, tanggal WIB dan retirement gateway lama lulus.
- [x] Semua image Compose berhasil dibangun; delapan service healthy.
- [x] Halaman login HTTP 200 pada IP LAN host; GoPhish authenticated API HTTP
      200 dengan verifikasi CA aktif (read-only, tanpa mengubah campaign).
- [x] Worker runtime memakai `mailpit:1025`, security none di network Docker;
      warning threshold 60. Pemeriksaan warning menggunakan akun/DB test,
      bukan menurunkan skor employee existing.
- [x] Evaluasi offline baseline domain pada split holdout; batas hasil dicatat.
- [ ] Testing manual oleh Daf: login/OTP, change password, email, report, ML scan,
      SSE, SOC Block/Allow, serta proxy ON/OFF dari mesin employee yang terpisah.

Mekanisme probe koneksi proxy dan transport SSE existing dipertahankan.

## Review Phishing Administrator (3 Oktober 2026)

- [x] Launch memakai GoPhish nyata; Mock Webmail/menu/polling dicabut dari UI.
- [x] Tidak ada ID resource palsu; error API terlihat, TLS tetap verified.
- [x] Collection endpoint memakai trailing slash, resource launch memakai nama.
- [x] Profile Mailpit dibuat dengan mailbox From yang diterima GoPhish; hanya
      penerima employee aktif yang dipilih, bukan semua user/admin/SOC.
- [x] Campaign lokal dan GoPhish dipisah namespace untuk detail/stop/delete.
- [x] Telemetry GoPhish disinkron ke scoring existing dengan receipt atomik;
      worker tetap berjalan ketika dashboard ditutup.
- [x] UI campaign dirapikan: penerima, materi collapsible, monitoring, dialog,
      error/notice; Poppins dan token tema existing dipertahankan.
- [x] Lima regression checks campaign + 16 checks terkait lulus; SMTP Mailpit,
      click tracking dan scoring diuji dengan penerima/DB sintetis.
- [x] Dashboard/worker dibuild dan diaktifkan; delapan service healthy.
- [ ] Uji browser/VM dan visual review oleh Daf.
- [x] Dua opsi materi: template perubahan password + clone statis Firecrawl v2;
      form tanpa credential, redirect edukasi dan scoring click/submit deduped.
- [x] Delapan checks campaign + sebelas checks terkait, build/lint dan real
      Mailpit smoke lulus; score akun/DB uji 100 → 90 → 70.
- [x] Firecrawl key terbaca runtime setelah Flask direcreate (nilai tidak dibuka).
- [ ] Scrape Firecrawl nyata menunggu URL publik yang diizinkan; API key/kredit
      provider belum diverifikasi. AI generation Gemini tidak diuji pada tambahan ini.

Runbook: `PHISHING_CAMPAIGN_DEMO.md`. Data campaign/telemetry lama tidak dihapus.

## Tambahan scope: selective TLS dan gate ML (2 Oktober 2026)

- [x] Allowed HTTPS di-splice; hanya koneksi ditolak memakai CA untuk block page.
- [x] Request pending/timeout tidak lolos lebih dahulu dan tidak meracuni blacklist.
- [x] Relay TCP memutus tunnel aktif berdasarkan domain, tanpa blok IP/CDN bersama.
- [x] Controller membaca kebijakan committed, tanpa membuat traffic palsu di SSE.
- [x] Domain-only ML baseline dilatih, dikalibrasi, dan dievaluasi offline.
- [x] 5 regression checks gate backend + 4 checks protokol TLS/Squid/relay lulus.
- [x] Runbook manual dan hasil evaluasi dengan batas recall/akurasi ditulis.
- [ ] Verifikasi browser nyata oleh Daf (CA trust, fresh navigation, SOC review).
- [ ] Target deteksi menyeluruh/high recall belum tercapai: recall Block 30,99%.
- [x] Pencabutan runtime n8n/Telegram dan warning Mailpit selesai dalam checkout.

Implementasi technical debt di atas siap untuk uji manual, bukan bukti semua
fitur sudah lulus pengujian browser nyata. Tidak dilakukan deploy production,
SMTP provider baru, NAC/sensor baru, atau trust CA otomatis di mesin employee.
Hanya dua export workflow ada di checkout saat arsip; tiga duplikat pada
instance n8n eksternal tidak diklaim terhapus. Volume Docker lama tidak dihapus.

## Employee reports and local SOC advice (3 October 2026)

### Current file-scan scope (supersedes the PDF reporting items below)

- [x] Report a PDF replaced by private **Scan file**: PDF and other non-empty formats, maximum 10 MB, explicit VT-sharing consent.
- [x] Separate owned scan records/jobs; no SOC/GRC inbox entry, SOC SSE event, reward or proxy-policy write.
- [x] Employee threat/suspicious warnings, no-known-threat and Unknown states; pending results refresh automatically and remain available in private history.
- [x] Legacy PDF metadata/jobs migrated idempotently without deleting historical telemetry; the old report endpoint is retired (410).
- [x] Same-origin LAN upload fix preserved; backend employee RBAC, bounded upload and quota/retention protections reused.
- [x] 13 isolated file/report/LLM checks, 6 auth/link-score/Mailpit checks, file-warning UI and BFF checks pass; scoped lint and production builds pass.
- [ ] Manual two-laptop review of real VT results and the updated UI by Daf.

Historical implementation (before this scope change):

- [x] Employee Scan URL uses the same VT v3/urlscan lookup as Report a link, without ML/DL, report creation or rewards.
- [x] Report a PDF: employee RBAC, same-origin bounded upload, explicit non-confidential consent, SHA-256 dedupe, durable VT hash/upload/poll jobs and quota handling.
- [x] PDF metadata/evidence appear in SOC/GRC Security inbox; no PDF preview/download, automatic domain policy or new scoring event.
- [x] Separate review worker keeps PDF/local advice out of OTP, notification and proxy request processing.
- [x] SOC-only local second opinion is cached, schema-validated and advisory-only; it cannot write Block/Allow.
- [x] Dataset labels confirmed: 0 benign, 1 gambling, 2 adult; 1,100 streaming rows excluded. Registered-domain overlap between fine-tuning splits is zero.
- [x] 9 new security report/local-advice checks, 9 campaign checks, 3 auth checks and 16 proxy/review/technical-debt checks pass when their isolated suites run separately.
- [x] Dashboard production build, scoped lint, BFF upload regression and SOC decision UI regression pass.
- [x] Actual 0.6B QLoRA experiment completed and frozen holdout evaluated; candidate rejected (14.33% benign false flags, above 1% gate), not activated.
- [x] Additional SFT JSONL audited offline: no new valid hostnames, unknown provenance, fixed scores and existing holdout overlap; not mixed into training.
- [x] Replace rule-generated SFT with offline hostname-only exports: training-source-only labels, historical holdout domain exclusion, path-scope abstention and no fake DL/risk/liveness fields.
- [x] Five offline checks pass, including tampering, duplicate/subdomain leakage, prompt consistency and statistical/recall quality gates before weight loading.
- [x] V2 QLoRA run completed (215 steps/900 training seconds); candidate rejected: 11.50% benign false flags, 0% malware recall. Original artifacts retained; review worker restarted.
- [ ] Low-false-positive fine-tuned model and quantized runtime latency target remain unmet. Native INT4 generation fails; the application retains the unmodified advisory-only 4B baseline.
- [ ] Daf's desktop/VM manual review and real non-confidential VT PDF submission.

Runbook and privacy/model boundaries: `LOCAL_LLM_AND_REPORTS.md`; measured results and additional dataset review: `LOCAL_LLM_EVALUATION.md`. Earlier ML-scan checklist items refer to the previous employee UI, which is superseded by provider-only Scan URL.
