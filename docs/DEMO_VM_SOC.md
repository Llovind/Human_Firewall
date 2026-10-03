# Demo final: host sebagai server/SOC, Kali bridged sebagai employee

Scope: lab 5–8 user, bukan deployment production. Browser demo diuji manual oleh
Daf. Gunakan jaringan pribadi; jangan expose port ke Internet atau port-forward
router. Seluruh identitas jaringan dikonfigurasi lewat ENV, bukan IP VM di kode.

## 1. Persiapan server

Pertahankan `.env`, `.env.proxy.local`, sertifikat dan named volumes yang ada.
Untuk instalasi baru, ikuti [fresh-clone setup](../README_SETUP.md).
`.env.proxy.local` juga harus berisi konfigurasi PostgreSQL/Redis sesuai
`docs/CENTRALIZED_PROXY.md`. Jangan mengganti password database existing tanpa
migrasi/rotasi yang benar.

Pada pemeriksaan 2 Oktober 2026, Wi-Fi host memakai `192.168.100.11/24`. Ini
bukan IP permanen: periksa kembali dengan `ipconfig` saat pindah ke lab. Contoh
konfigurasi saat ini:

```dotenv
WEB_BIND_IP=0.0.0.0
PROXY_BIND_IP=0.0.0.0
PUBLIC_PROXY_URL=http://192.168.100.11:3128
NEXT_PUBLIC_BASE_URL=http://192.168.100.11:3000
NEXT_PUBLIC_API_URL=http://192.168.100.11:5000
SERVER_BASE_URL=http://192.168.100.11:5000
SIMULATION_BASE_URL=http://192.168.100.11:8080
ALLOWED_ORIGINS=http://192.168.100.11:3000,http://localhost:3000,http://127.0.0.1:3000
DEV_BYPASS_AUTH=false
FLASK_DEBUG=false
REAL_SMTP_ENABLED=false
EDUCATION_EMAIL_ENABLED=true
EDUCATION_SCORE_THRESHOLD=60
EDUCATION_COOLDOWN_SECONDS=86400
```

Untuk permukaan akses lebih kecil, ganti bind `0.0.0.0` dengan IP interface lab.
Compose demo memaksa OTP/worker ke `mailpit:1025` tanpa relay eksternal. SMTP
provider, n8n dan Telegram tidak diperlukan. Mailpit inbox default hanya tersedia
di host: `http://127.0.0.1:8025`; jangan membuka inbox tanpa autentikasi ke Internet.
Email berhenti di Mailpit, **tidak masuk inbox Gmail**. Backend API internal BFF
tetap `http://flask_api:5000`; jangan menggantinya dengan IP employee.

Jalankan dari root repo:

```powershell
docker compose build
docker compose up -d
docker compose ps
```

Sembilan service harus healthy: dashboard, flask_api, centralized_proxy,
notification_worker, review_worker, proxy_postgres, proxy_redis, mailpit, gophish.
`local_llm` adalah service kesepuluh jika profile `llm` diaktifkan. Saat ENV berubah,
jalankan `docker compose up -d` untuk recreate container; `restart` saja tidak
memuat ENV baru. GoPhish admin dan Mailpit hanya host; PostgreSQL/Redis tidak
dipublikasikan. GoPhish CA verification harus tetap aktif.

Jika Windows Firewall menolak akses VM, di jaringan lab yang **memang tepercaya**
buat satu rule Private terbatas subnet lab. Contoh, PowerShell Administrator:

```powershell
New-NetFirewallRule -DisplayName 'AFFERENT private lab demo' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 3000,5000,3128,8080 -Profile Private -RemoteAddress 192.168.100.0/24
```

Ganti subnet dengan subnet lab aktual. Jangan gunakan `Any`/Public atau mematikan
firewall. Rule ini belum dibuat otomatis. Untuk menghapusnya setelah demo:

```powershell
Remove-NetFirewallRule -DisplayName 'AFFERENT private lab demo'
```

HTTP session cookies sengaja untuk lab terisolasi. HTTPS application gateway +
secure cookies diperlukan sebelum penggunaan di jaringan tak tepercaya; CA
proxy tidak otomatis membuat dashboard menjadi HTTPS.

## 2. Identitas dan employee VM

1. Login Administrator di host, buat akun `employee` dan `soc` terpisah. Gunakan
   password kuat dan akun demo, bukan akun orang lain. Identifier Administrator
   tetap `phishing_admin` di backend; perubahan label bukan eskalasi role.
2. Mode network Kali: bridged ke interface host yang aktif. Pastikan IP guest
   berada di subnet lab yang sama; IP guest boleh berubah tanpa ubah kode.
3. Di kedua mesin buka URL server **yang sama**, misalnya
   `http://192.168.100.11:3000`. Employee login password + OTP; Daf mengambil OTP
   email employee dari Mailpit di host. Jangan mencampur URL localhost/IP ketika
   menilai session, karena cookie berbeda per hostname.
4. Set proxy sistem Kali HTTP dan HTTPS ke host `192.168.100.11`, port `3128`.
   Bypass proxy untuk IP/hostname server AFFERENT (dashboard, API, simulasi) dan
   localhost. **Jangan bypass `proxy-check.afferent.invalid`**; itu probe asli.
   Firefox mungkin memakai konfigurasi proxy sendiri: pilih system proxy atau
   konfigurasi manual yang sama. ENV public proxy harus menunjuk ke **server**,
   tidak pernah ke `127.0.0.1` di VM.
5. Aktifkan perangkat melalui dashboard employee. Pastikan kartu koneksi berubah
   sesuai proxy OFF/ON. Mekanisme probe existing tidak diubah.
6. Download **public CA saja** dari tombol dashboard/API `/api/proxy/ca.crt`;
   trust di browser test (Firefox dapat memakai trust store sendiri). Jangan
   menyalin `afferent-proxy-ca.key` ke VM. CA diperlukan untuk halaman denial
   HTTPS, bukan untuk membaca isi HTTPS allowed.

## 3. Urutan demonstrasi

- [ ] OTP employee/SOC tiba di Mailpit; login role benar, employee tidak dapat
      mengakses API SOC. Logout bekerja; change password memutus semua session
      lama dan OTP lama, kemudian password baru dapat login.
- [ ] Proxy ON → connected; OFF → failed to connect. Uji di VM, bukan dua browser
      yang berbagi proxy sistem/IP host. Traffic yang sungguh masih melewati
      proxy bisa tetap tercatat; dashboard bukan sensor seluruh koneksi OS.
- [ ] Buka domain aman/new domain di VM. SOC live feed menerima request nyata
      lewat SSE. Verdict sesuai hasil ML (termasuk Unknown), bukan semua traffic
      dianggap malicious. Unknown allowed; provider/model belum siap berbeda:
      temporary deny tanpa permanent blacklist.
- [ ] SOC manual Block domain yang benar, misalnya `example.org`, beserta reason.
      Audit merekam actor, before/after, source alert dan request ID. Root block
      juga berlaku pada subdomain; typo `yotube.com` tidak sama `youtube.com`.
- [ ] Employee melakukan fresh navigation HTTPS ke domain blocked →
      `BLOCKED BY AFFERENT` tanpa certificate warning jika CA trusted. Existing
      allowed tunnel dicabut setelah propagation controller; tidak ada jaminan
      nol milidetik atau halaman AJAX otomatis mengganti seluruh tab.
- [ ] SOC Allow domain yang sama dengan reason; fresh connection dapat mengakses
      kembali. Browser certificate domain allowed tetap original site.
- [ ] Employee tab Scan URL memakai VT/urlscan, tanpa report/reward. Report a link
      memakai VT/urlscan evidence dan menghasilkan alert untuk review SOC;
      report tidak otomatis melakukan enforcement. URLscan search hit saja bukan
      verdict berbahaya. API key kosong/rate limit/no evidence → Unknown, bukan
      data safe palsu. Hindari URL berisi credential/PII karena laporan mengirim
      URL ke provider eksternal.
- [ ] Scan file menerima PDF/format lain sampai 10 MB dengan consent. Hasil
      dangerous memberi peringatan employee; tidak masuk SOC/reward/blocklist.
      Pending dipoll hingga terminal; Unknown bukan jaminan aman.
- [ ] Status report sendiri: submitted/under review → resolved setelah Block,
      false positive setelah Allow. Report duplikat tidak menggandakan reward;
      reward malicious/suspicious tetap dibatasi 3/hari WIB.
- [ ] Heatmap memuat baseline telemetry yang berlabel (default), bukan menjanjikan
      LLM jika key tidak aktif; deep-dive/report AI memberi error jelas jika
      provider tidak tersedia. IoC Block/Allow menangani error tanpa sukses palsu.
- [ ] SOC/GRC memilih employee aktif dengan score `<60/200` di Security Inbox,
      menyetujui warning edukasi, lalu email tiba di Mailpit. Default manual,
      bukan email otomatis. Score `60` atau lebih, SOC/Admin, akun
      nonaktif, atau score pulih sebelum pengiriman **tidak** menerima warning.
      Cooldown default 24 jam, retry tersimpan. Tidak ada warning hanya karena
      satu klik jika score masih di atas ambang batas. Untuk menghasilkan score
      rendah gunakan akun demo khusus dan event simulasi normal; jangan mengubah
      data employee nyata sekadar demonstrasi.

## 4. Batas klaim dan diagnostik

Evaluasi domain model beserta runtime guard ada di `DOMAIN_ML_EVALUATION.md`.
Gunakan angka untuk versi dan cakupan evaluasi yang sama; jangan mencampur v2
dengan model v3 aktif. Bukan bukti
deteksi sempurna, klasifikasi pornografi, atau akurasi seluruh browsing.
Konten browser yang sudah buffered/cached tidak dapat dihapus lewat proxy;
certificate-pinned apps dapat menolak certificate denial. Proxy manual bukan
NAC: employee bisa bypass dengan mematikannya, dan aplikasi yang mengabaikan
system proxy tidak terpantau.

Jika sebuah service unhealthy, baca log service itu secara lokal (log OTP/key
jangan dibagikan). Periksa hostname ENV, firewall, CA dan account authorization
sebelum mencoba whitelist luas. Tidak ada bypass blanket `.com`. Jangan run
`docker compose down -v`, reinstall dataset/bobot, atau mematikan TLS verification.

Future Work yang dikecualikan: deployment SMTP eksternal, NAC/sensor tambahan,
dan janji production/compliance readiness. Test manual browser tetap harus
dilakukan Daf; build/unit/protocol checks bukan penggantinya.
