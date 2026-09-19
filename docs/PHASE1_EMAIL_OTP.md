# Fase 1 — Email, OTP, Session, dan RBAC

Dokumen ini menjelaskan konfigurasi autentikasi AFFERENT untuk demo lokal/lab. Data telemetry lama tetap berada di `user_history`; identitas login dipisahkan ke tabel `employee_accounts`, `otp_challenges`, `auth_sessions`, dan `login_audit`.

## Alur login

1. Phishing Administrator membuat akun di menu **Employees** dengan email, password awal, divisi, dan role.
2. Pengguna membuka `/auth`, lalu memasukkan email dan password.
3. Backend memverifikasi hash Argon2id dan mengirim OTP enam digit melalui `EmailService`.
4. OTP diverifikasi sekali pakai. Jika valid, backend membuat opaque session token; hanya hash token yang disimpan di database.
5. Next.js menyimpan token sebagai cookie `HttpOnly`, `SameSite=Lax`, dan `Secure` ketika `AUTH_COOKIE_SECURE=true`.
6. Backend menentukan role dari database pada setiap session, bukan dari pilihan atau payload browser.

Role yang tersedia: `employee`, `phishing_admin`, `soc`, `grc`, dan `ciso`.

## Menjalankan demo lokal

```powershell
docker compose up -d --build mailpit flask_api dashboard
```

- Aplikasi: `http://localhost:3000/auth`
- Inbox OTP Mailpit: `http://127.0.0.1:8025`
- Akun awal: nilai `BOOTSTRAP_ADMIN_EMAIL` (default `admin@humanfirewall.local`)
- Password awal: nilai `ADMIN_PASSWORD` di `.env`; jangan commit atau kirim nilainya melalui chat/log.

Mailpit adalah SMTP lokal untuk demo sehingga tidak perlu membeli layanan SMTP. Email tidak dikirim ke internet; OTP dibaca dari UI Mailpit.

## Variabel konfigurasi

| Variabel | Fungsi | Nilai demo |
| --- | --- | --- |
| `BOOTSTRAP_ADMIN_EMAIL` | Email akun administrator awal | `admin@humanfirewall.local` |
| `ADMIN_PASSWORD` | Password awal administrator; disimpan sebagai Argon2id | secret acak kuat |
| `OTP_PEPPER` | Secret HMAC khusus hash OTP | secret acak, jangan kosong di lab |
| `AUTH_AUDIT_PEPPER` | Secret HMAC untuk menyamarkan IP/user agent audit | secret acak, jangan kosong di lab |
| `OTP_EXPIRY_SECONDS` | Masa berlaku OTP | `300` |
| `OTP_MAX_ATTEMPTS` | Batas salah input OTP | `5` |
| `OTP_RESEND_COOLDOWN_SECONDS` | Jeda kirim ulang OTP | `60` |
| `OTP_RATE_LIMIT_WINDOW_SECONDS` | Jendela rate limit | `900` |
| `OTP_MAX_REQUESTS_PER_WINDOW` | Maksimum request per email dan IP | `5` |
| `AUTH_SESSION_TTL_SECONDS` | Masa berlaku session | `28800` (8 jam) |
| `PASSWORD_MIN_LENGTH` | Panjang minimum password | `12` |
| `SMTP_HOST` / `SMTP_PORT` | Endpoint SMTP | `mailpit` / `1025` |
| `SMTP_SECURITY` | `starttls`, `ssl`, atau `none` | `none` hanya untuk Mailpit lokal |
| `SMTP_USER` / `SMTP_PASSWORD` | Kredensial SMTP eksternal | kosong untuk Mailpit |
| `SMTP_FROM_ADDRESS` | Alamat pengirim | `AFFERENT Security <security@afferent.local>` |
| `AUTH_COOKIE_SECURE` | Wajib `true` jika dashboard memakai HTTPS | `false` hanya untuk HTTP lokal |

Untuk server lab dengan HTTPS/Tailscale, set `AUTH_COOKIE_SECURE=true`. Jangan mengaktifkannya selama masih memakai HTTP biasa karena browser tidak akan mengirim cookie `Secure` melalui HTTP.

## Pemeriksaan keamanan yang tersedia

- Password disimpan dengan Argon2id.
- OTP dibuat dengan CSPRNG, disimpan sebagai HMAC hash, kedaluwarsa lima menit, single-use, dan terkunci setelah batas percobaan.
- Request dan resend dibatasi per kombinasi email dan hash IP.
- Session bersifat opaque, disimpan sebagai hash di database, dapat dicabut saat logout/reset password/nonaktif akun.
- Endpoint nonpublik deny-by-default; RBAC ditentukan backend.
- Alur shared admin password, Telegram auth, dan magic link lama merespons `410 Gone`.

## Uji otomatis

```powershell
docker run --rm -v "${PWD}\backend:/app:ro" -w /app human_firewall-flask_api python -m unittest -v test_local_suite.py
docker run --rm -v "${PWD}\backend:/app:ro" -w /app human_firewall-flask_api python -m unittest -v test_phase1_auth.py
```

Flow A masih dipertahankan agar simulasi phishing yang sudah terverifikasi tidak terputus. Telegram sudah dicabut dari autentikasi. Penggantian notifikasi Flow A dilakukan setelah kanal SOC in-app/SSE tersedia pada fase berikutnya.
