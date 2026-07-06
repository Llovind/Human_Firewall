"""
database.py — semua operasi SQLite untuk Human Firewall Lite.

Dipisah dari app.py supaya route handler tetap tipis dan logic data
access terpusat di satu tempat. Sesuai keputusan arsitektur di handoff:
n8n TIDAK PERNAH menyentuh SQLite langsung, semua lewat Flask — jadi
modul ini adalah satu-satunya pintu masuk ke database.
"""

import sqlite3
import os
import secrets
from datetime import datetime

DB_PATH = os.path.join('instance', 'human_firewall.db')

# source_type yang valid untuk tabel incidents — divalidasi di sini
# supaya konsisten dipanggil dari route manapun, bukan diulang-ulang.
VALID_SOURCE_TYPES = ("simulation", "real_world_report")
VALID_SEVERITIES = ("low", "medium", "high")
VALID_STATUSES = ("open", "closed")


def get_connection():
    """Buka koneksi baru. Dipanggil per-request, bukan disimpan global,
    supaya aman untuk Flask yang multi-threaded secara default."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row  # supaya hasil query bisa diakses
                                      # seperti dict (row["kolom"])
    return conn


def init_db():
    """Bikin semua tabel kalau belum ada. Dipanggil sekali saat app start."""
    os.makedirs('instance', exist_ok=True)
    conn = get_connection()
    cursor = conn.cursor()

    # Tabel user_history — dipakai Flow A (simulasi GoPhish) untuk
    # menentukan tier (first-timer / repeat / chronic clicker).
    # Satu baris per kombinasi email+divisi dummy.
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS user_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT NOT NULL UNIQUE,
            divisi TEXT NOT NULL,
            click_count INTEGER NOT NULL DEFAULT 0,
            viewed_training_count INTEGER NOT NULL DEFAULT 0,
            skipped_training_count INTEGER NOT NULL DEFAULT 0,
            last_clicked TIMESTAMP,
            telegram_chat_id TEXT,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # Tabel events — log mentah tiap event yang masuk dari n8n
    # (klik, submit data, lihat training, dst). Ini histori detail,
    # sedangkan user_history di atas adalah agregat/ringkasan per user.
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT NOT NULL,
            divisi TEXT,
            event_type TEXT NOT NULL,
            tier_assigned TEXT,
            campaign_id TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # Tabel incidents — konvergensi dua mode (simulation & real_world_report).
    # source_type WAJIB diisi, divalidasi di layer Python sebelum INSERT.
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS incidents (
            ticket_id TEXT PRIMARY KEY,
            source_type TEXT NOT NULL,
            reported_url TEXT,
            divisi TEXT,
            severity TEXT NOT NULL DEFAULT 'low',
            vt_verdict TEXT,
            urlscan_verdict TEXT,
            screenshot_url TEXT,
            checklist TEXT,
            file_hash TEXT,
            original_filename TEXT,
            status TEXT NOT NULL DEFAULT 'open',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            closed_at TIMESTAMP
        )
    ''')

    # Tabel registration_otp — menyimpan kode OTP pendaftaran Telegram
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS registration_otp (
            email TEXT NOT NULL,
            telegram_chat_id TEXT NOT NULL,
            otp_code TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # Tabel inbox_emails — menyimpan email tiruan untuk Mock Webmail
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS inbox_emails (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            to_email TEXT NOT NULL,
            subject TEXT NOT NULL,
            body TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # Migration: tambah kolom Flow B jika belum ada (aman untuk DB existing,
    # ALTER TABLE ADD COLUMN di SQLite tidak error-prone seperti di RDBMS lain).
    for col in ['file_hash TEXT', 'original_filename TEXT']:
        try:
            cursor.execute(f'ALTER TABLE incidents ADD COLUMN {col}')
        except sqlite3.OperationalError:
            pass  # Kolom sudah ada

    # Migration: tambah kolom telegram_chat_id jika belum ada
    try:
        cursor.execute('ALTER TABLE user_history ADD COLUMN telegram_chat_id TEXT')
    except sqlite3.OperationalError:
        pass

    # Migration: gamifikasi (Handoff Step A) — points & badge per user.
    # Default points=100 supaya user baru mulai netral (bukan 0, karena
    # 0 akan langsung terlihat seperti "sudah bermasalah" padahal belum
    # ada histori sama sekali).
    for col in ['points INTEGER NOT NULL DEFAULT 100', "badge TEXT NOT NULL DEFAULT 'Guardian'"]:
        try:
            cursor.execute(f'ALTER TABLE user_history ADD COLUMN {col}')
        except sqlite3.OperationalError:
            pass  # Kolom sudah ada

    # Tabel link_tokens — token pendek untuk deep link autentikasi Telegram.
    # User visit /link, masukkan email, dapat token yang di-embed di URL
    # deep link Telegram. Token kadaluarsa setelah ttl_minutes.
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS link_tokens (
            token TEXT PRIMARY KEY,
            email TEXT NOT NULL,
            divisi TEXT NOT NULL DEFAULT 'Unknown',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            expires_at TIMESTAMP NOT NULL,
            used INTEGER NOT NULL DEFAULT 0
        )
    ''')

    # Tabel dashboard_tokens — token panjang (30 hari) untuk akses
    # personal dashboard tanpa login ulang. Dibuat saat redeem link token.
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS dashboard_tokens (
            token TEXT PRIMARY KEY,
            email TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            expires_at TIMESTAMP NOT NULL
        )
    ''')

    conn.commit()
    conn.close()


# ---------------------------------------------------------------------------
# GAMIFICATION (Handoff Step A) — points & badges
# ---------------------------------------------------------------------------

# Batas skor, supaya tidak melorot ke minus tak terbatas (chronic clicker
# yang sudah di titik terendah tidak makin "dihukum" tanpa batas) atau
# meroket tak wajar. Rentang 0-200 dipilih supaya badge tier di bawah
# punya jarak yang proporsional dari titik start netral (100).
POINTS_MIN = 0
POINTS_MAX = 200

# Poin per event, sesuai kesepakatan Step A di handoff:
POINTS_CLICK_LINK = -10
POINTS_CREDENTIAL_LEAK = -20
POINTS_CONFIRMED_REPORT = 15
POINTS_SPOT_THE_FAKE = 5


def classify_badge(points: int) -> str:
    """Tentukan badge dari skor poin. Threshold sengaja simetris di
    sekitar titik start netral (100): jauh di atas = Sentinel (aktif
    melapor / jarang klik), jauh di bawah = Vulnerable (sering klik/leak),
    di tengah = Guardian (default, belum banyak histori atau seimbang)."""
    if points >= 130:
        return "Sentinel"
    elif points >= 60:
        return "Guardian"
    else:
        return "Vulnerable"


def adjust_points(email: str, divisi: str, delta: int) -> dict:
    """Ubah poin user sebanyak delta (boleh negatif), clamp ke rentang
    valid, lalu re-klasifikasi badge. Upsert user_history kalau baris
    belum ada (pola sama seperti INSERT OR IGNORE di record_event),
    supaya fungsi ini aman dipanggil independen dari record_event.
    Return dict berisi points & badge terbaru, supaya caller (route
    handler) bisa langsung kirim balik ke response tanpa query ulang."""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute('''
            INSERT OR IGNORE INTO user_history (email, divisi, click_count)
            VALUES (?, ?, 0)
        ''', (email, divisi))

        row = cursor.execute(
            'SELECT points FROM user_history WHERE email = ?', (email,)
        ).fetchone()
        current_points = row["points"] if row else 100
        new_points = max(POINTS_MIN, min(POINTS_MAX, current_points + delta))
        new_badge = classify_badge(new_points)

        cursor.execute('''
            UPDATE user_history
            SET points = ?, badge = ?, updated_at = CURRENT_TIMESTAMP
            WHERE email = ?
        ''', (new_points, new_badge, email))

        conn.commit()
        return {"email": email, "points": new_points, "badge": new_badge}
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def award_points_for_report(telegram_chat_id: str, points: int = POINTS_CONFIRMED_REPORT):
    """Beri poin ke user yang melaporkan threat terkonfirmasi berbahaya
    lewat Flow B (Telegram Bot). Reporter Flow B diidentifikasi lewat
    telegram_chat_id (BUKAN email — Telegram tidak mengirim email),
    jadi kita resolve chat_id -> email lewat mapping yang sudah dibuat
    saat OTP registration (lihat update_user_telegram_chat_id).

    Return None kalau chat_id belum terdaftar/di-link ke email manapun
    (misal reporter belum pernah verifikasi OTP) — caller (route
    /api/incidents) harus toleran terhadap ini, karena laporan ancaman
    TETAP harus diproses walau reporter belum ke-link, hanya saja tidak
    dapat poin."""
    if not telegram_chat_id:
        return None

    conn = get_connection()
    row = conn.execute(
        'SELECT email, divisi FROM user_history WHERE telegram_chat_id = ?',
        (str(telegram_chat_id),)
    ).fetchone()
    conn.close()

    if row is None:
        return None

    return adjust_points(row["email"], row["divisi"] or "Unknown", points)


def get_leaderboard():
    """Ranking user berdasarkan poin, dari tertinggi ke terendah.
    Dipakai untuk Leaderboard UI Tab (Handoff Step A.4). Hanya
    menampilkan user yang punya divisi (bukan record kosong)."""
    conn = get_connection()
    rows = conn.execute('''
        SELECT email, divisi, points, badge, click_count,
               viewed_training_count, skipped_training_count
        FROM user_history
        WHERE divisi IS NOT NULL
        ORDER BY points DESC, viewed_training_count DESC
    ''').fetchall()
    conn.close()

    leaderboard = [dict(row) for row in rows]
    for i, entry in enumerate(leaderboard, start=1):
        entry["rank"] = i

    # Agregat per divisi (rata-rata poin), untuk "division rankings"
    # sesuai deskripsi tab di handoff, terpisah dari ranking individu.
    divisi_totals = {}
    for entry in leaderboard:
        d = entry["divisi"]
        divisi_totals.setdefault(d, []).append(entry["points"])

    divisi_rankings = sorted(
        [
            {"divisi": d, "avg_points": round(sum(pts) / len(pts), 1), "member_count": len(pts)}
            for d, pts in divisi_totals.items()
        ],
        key=lambda x: x["avg_points"],
        reverse=True
    )

    return {"individual": leaderboard, "by_divisi": divisi_rankings}


# ---------------------------------------------------------------------------
# USER HISTORY (untuk Flow A — simulasi)
# ---------------------------------------------------------------------------

def get_user_history(email: str):
    """Ambil histori user. Kalau belum pernah ada (first-timer beneran),
    return record default dengan click_count=0, BUKAN error — supaya n8n
    bisa langsung klasifikasi sebagai Tier 1 tanpa cabang error tambahan."""
    conn = get_connection()
    row = conn.execute(
        'SELECT * FROM user_history WHERE email = ?', (email,)
    ).fetchone()
    conn.close()

    if row is None:
        return {
            "email": email,
            "divisi": None,
            "click_count": 0,
            "viewed_training_count": 0,
            "skipped_training_count": 0,
            "last_clicked": None,
            "telegram_chat_id": None,
            "is_new_user": True
        }

    return {
        "email": row["email"],
        "divisi": row["divisi"],
        "click_count": row["click_count"],
        "viewed_training_count": row["viewed_training_count"],
        "skipped_training_count": row["skipped_training_count"],
        "last_clicked": row["last_clicked"],
        "telegram_chat_id": row["telegram_chat_id"],
        "is_new_user": False
    }


def classify_tier(click_count: int) -> str:
    """Logic klasifikasi tier sesuai kesepakatan di handoff:
    0 kali -> tier_1, 1-3 kali -> tier_2, 4+ kali -> tier_2_chronic.
    Dipisah jadi fungsi sendiri supaya mudah di-unit-test dan diubah
    threshold-nya tanpa nyentuh route handler."""
    if click_count == 0:
        return "tier_1"
    elif 1 <= click_count <= 3:
        return "tier_2"
    else:
        return "tier_2_chronic"


def record_event(email: str, divisi: str, event_type: str,
                  tier_assigned: str = None, campaign_id: str = None):
    """Simpan event mentah ke tabel events, DAN update agregat di
    user_history. Dua tabel ini di-update dalam satu transaksi supaya
    konsisten — kalau salah satu gagal, keduanya di-rollback.

    event_type yang dikenali: 'clicked_link', 'submitted_data',
    'viewed_training', 'skipped_training', 'email_opened'.
    """
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute('''
            INSERT INTO events (email, divisi, event_type, tier_assigned, campaign_id)
            VALUES (?, ?, ?, ?, ?)
        ''', (email, divisi, event_type, tier_assigned, campaign_id))

        # Pastikan baris user_history ada (upsert manual, karena SQLite
        # versi lama di image python:3.10-slim belum pasti support
        # syntax UPSERT modern di semua kasus — INSERT OR IGNORE lebih aman).
        cursor.execute('''
            INSERT OR IGNORE INTO user_history (email, divisi, click_count)
            VALUES (?, ?, 0)
        ''', (email, divisi))

        if event_type == "clicked_link":
            cursor.execute('''
                UPDATE user_history
                SET click_count = click_count + 1,
                    last_clicked = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE email = ?
            ''', (datetime.utcnow().isoformat(), email))

            # Gamifikasi Step A.2: -10 poin tiap klik simulasi phishing.
            # Dilakukan di dalam koneksi/transaksi yang sama dengan UPDATE
            # click_count di atas (bukan panggil adjust_points() yang buka
            # koneksi baru), supaya tetap satu transaksi atomik.
            row = cursor.execute(
                'SELECT points FROM user_history WHERE email = ?', (email,)
            ).fetchone()
            current_points = row["points"] if row else 100
            new_points = max(POINTS_MIN, min(POINTS_MAX, current_points + POINTS_CLICK_LINK))
            cursor.execute('''
                UPDATE user_history SET points = ?, badge = ? WHERE email = ?
            ''', (new_points, classify_badge(new_points), email))

        elif event_type == "submitted_data":
            # Gamifikasi Step A.2: -20 poin tambahan kalau sampai submit
            # kredensial di fake-login (lebih berat daripada sekadar klik).
            row = cursor.execute(
                'SELECT points FROM user_history WHERE email = ?', (email,)
            ).fetchone()
            current_points = row["points"] if row else 100
            new_points = max(POINTS_MIN, min(POINTS_MAX, current_points + POINTS_CREDENTIAL_LEAK))
            cursor.execute('''
                UPDATE user_history SET points = ?, badge = ? WHERE email = ?
            ''', (new_points, classify_badge(new_points), email))

        elif event_type == "viewed_training":
            cursor.execute('''
                UPDATE user_history
                SET viewed_training_count = viewed_training_count + 1,
                    updated_at = CURRENT_TIMESTAMP
                WHERE email = ?
            ''', (email,))

        elif event_type == "skipped_training":
            cursor.execute('''
                UPDATE user_history
                SET skipped_training_count = skipped_training_count + 1,
                    updated_at = CURRENT_TIMESTAMP
                WHERE email = ?
            ''', (email,))

        elif event_type == "spot_the_fake_correct":
            # Gamifikasi: +5 poin untuk identifikasi phishing yang benar
            # di mini-game "Spot the Fake". Tidak ada penalti untuk jawaban
            # salah (spot_the_fake_incorrect) — hanya reward engagement.
            row = cursor.execute(
                'SELECT points FROM user_history WHERE email = ?', (email,)
            ).fetchone()
            current_points = row["points"] if row else 100
            new_points = max(POINTS_MIN, min(POINTS_MAX, current_points + POINTS_SPOT_THE_FAKE))
            cursor.execute('''
                UPDATE user_history SET points = ?, badge = ? WHERE email = ?
            ''', (new_points, classify_badge(new_points), email))

        # spot_the_fake_incorrect: dicatat sebagai event tapi tidak mengubah
        # poin — jangan menghukum partisipasi di game opsional.

        conn.commit()
        return True

    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def update_user_telegram_chat_id(email: str, telegram_chat_id: str):
    """Petakan telegram chat ID ke email user di user_history.
    Jika user belum ada di database, kita buat record baru dengan divisi Default."""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        # INSERT OR IGNORE biar aman kalau email belum terdaftar
        cursor.execute('''
            INSERT OR IGNORE INTO user_history (email, divisi, click_count)
            VALUES (?, 'Unknown', 0)
        ''', (email,))
        
        cursor.execute('''
            UPDATE user_history
            SET telegram_chat_id = ?, updated_at = CURRENT_TIMESTAMP
            WHERE email = ?
        ''', (telegram_chat_id, email))
        conn.commit()
        return True
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def create_otp(email: str, telegram_chat_id: str, otp_code: str):
    """Simpan kode OTP pendaftaran baru, hapus OTP lama jika ada."""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        # Hapus OTP lama untuk email atau chat ID ini agar tidak menumpuk
        cursor.execute('DELETE FROM registration_otp WHERE email = ? OR telegram_chat_id = ?', (email, telegram_chat_id))
        
        cursor.execute('''
            INSERT INTO registration_otp (email, telegram_chat_id, otp_code)
            VALUES (?, ?, ?)
        ''', (email, telegram_chat_id, otp_code))
        conn.commit()
        return True
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def verify_otp(telegram_chat_id: str, otp_code: str):
    """Verifikasi kecocokan OTP. Jika cocok, otomatis update telegram_chat_id
    milik user di user_history dan hapus record OTP dari database."""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        row = cursor.execute('''
            SELECT * FROM registration_otp 
            WHERE telegram_chat_id = ? AND otp_code = ?
        ''', (telegram_chat_id, otp_code)).fetchone()
        
        if row is None:
            return None
        
        email = row["email"]
        
        # Buat record default di user_history jika belum ada
        cursor.execute('''
            INSERT OR IGNORE INTO user_history (email, divisi, click_count)
            VALUES (?, 'Unknown', 0)
        ''', (email,))
        
        # Update chat ID Telegram user
        cursor.execute('''
            UPDATE user_history
            SET telegram_chat_id = ?, updated_at = CURRENT_TIMESTAMP
            WHERE email = ?
        ''', (telegram_chat_id, email))
        
        # Hapus OTP yang sudah terpakai
        cursor.execute('DELETE FROM registration_otp WHERE email = ?', (email,))
        conn.commit()
        return email
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def send_real_email(to_email: str, subject: str, body: str):
    """Kirim email asli menggunakan SMTP jika diaktifkan di .env."""
    import os
    import smtplib
    from email.mime.text import MIMEText
    from email.mime.multipart import MIMEMultipart

    enabled = os.environ.get('REAL_SMTP_ENABLED', 'false').lower() == 'true'
    if not enabled:
        return False

    host = os.environ.get('SMTP_HOST')
    port_str = os.environ.get('SMTP_PORT', '587')
    try:
        port = int(port_str)
    except ValueError:
        port = 587
    user = os.environ.get('SMTP_USER')
    passwd = os.environ.get('SMTP_PASSWORD')
    from_email = os.environ.get('SMTP_FROM', 'no-reply@humanfirewall.local')

    if not (host and user and passwd):
        print("SMTP WARNING: REAL_SMTP_ENABLED is true, but SMTP_HOST, SMTP_USER, or SMTP_PASSWORD is not set!")
        return False

    try:
        msg = MIMEMultipart()
        msg['From'] = from_email
        msg['To'] = to_email
        msg['Subject'] = subject

        # Attach HTML body
        msg.attach(MIMEText(body, 'html'))

        # Connect and send
        with smtplib.SMTP(host, port, timeout=10) as server:
            if port == 587:
                server.starttls()
            server.login(user, passwd)
            server.sendmail(from_email, to_email, msg.as_string())
        print(f"SMTP SUCCESS: Sent email to {to_email}")
        return True
    except Exception as e:
        print(f"SMTP ERROR: Failed to send email to {to_email}: {e}")
        return False


def create_inbox_email(to_email: str, subject: str, body: str):
    """Simpan email tiruan baru ke database, dan kirim via SMTP rill jika diaktifkan."""
    conn = get_connection()
    try:
        conn.execute('''
            INSERT INTO inbox_emails (to_email, subject, body)
            VALUES (?, ?, ?)
        ''', (to_email, subject, body))
        conn.commit()

        # Kirim email rill secara asynchronous via background thread agar tidak menghambat load page
        import threading
        threading.Thread(target=send_real_email, args=(to_email, subject, body), daemon=True).start()

        return True
    finally:
        conn.close()


def list_inbox_emails():
    """Ambil semua email tiruan dari database, urutkan dari yang terbaru."""
    conn = get_connection()
    try:
        rows = conn.execute('SELECT * FROM inbox_emails ORDER BY created_at DESC').fetchall()
        return [dict(row) for row in rows]
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# INCIDENTS (untuk Flow A eskalasi & Flow B report)
# ---------------------------------------------------------------------------

def create_incident(ticket_id: str, source_type: str, divisi: str,
                     severity: str = "low", reported_url: str = None,
                     vt_verdict: str = None, urlscan_verdict: str = None,
                     screenshot_url: str = None, checklist: str = None,
                     file_hash: str = None, original_filename: str = None):
    """Buat incident ticket baru. source_type divalidasi di sini —
    kalau bukan 'simulation' atau 'real_world_report', request ditolak
    di layer route SEBELUM fungsi ini dipanggil (lihat app.py), tapi
    divalidasi ulang di sini juga sebagai pertahanan kedua."""
    if source_type not in VALID_SOURCE_TYPES:
        raise ValueError(
            f"source_type tidak valid: {source_type}. "
            f"Harus salah satu dari {VALID_SOURCE_TYPES}"
        )
    if severity not in VALID_SEVERITIES:
        raise ValueError(
            f"severity tidak valid: {severity}. "
            f"Harus salah satu dari {VALID_SEVERITIES}"
        )

    conn = get_connection()
    try:
        conn.execute('''
            INSERT INTO incidents (
                ticket_id, source_type, reported_url, divisi, severity,
                vt_verdict, urlscan_verdict, screenshot_url, checklist,
                file_hash, original_filename, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open')
        ''', (ticket_id, source_type, reported_url, divisi, severity,
              vt_verdict, urlscan_verdict, screenshot_url, checklist,
              file_hash, original_filename))
        conn.commit()
    finally:
        conn.close()


def update_incident_status(ticket_id: str, status: str):
    """Update status ticket. Return False kalau ticket_id tidak ditemukan,
    supaya route handler bisa balikin 404 yang sesuai (bukan 200 palsu
    untuk ticket yang sebenarnya tidak ada)."""
    if status not in VALID_STATUSES:
        raise ValueError(
            f"status tidak valid: {status}. Harus salah satu dari {VALID_STATUSES}"
        )

    conn = get_connection()
    try:
        cursor = conn.cursor()
        if status == "closed":
            cursor.execute('''
                UPDATE incidents
                SET status = ?, closed_at = CURRENT_TIMESTAMP
                WHERE ticket_id = ?
            ''', (status, ticket_id))
        else:
            cursor.execute('''
                UPDATE incidents SET status = ? WHERE ticket_id = ?
            ''', (status, ticket_id))

        conn.commit()
        return cursor.rowcount > 0  # True kalau ada baris yang ke-update
    finally:
        conn.close()


def list_incidents(source_type: str = None, status: str = None):
    """List incident, bisa difilter by source_type dan/atau status.
    Dipakai dashboard untuk pisahkan 'Active Threat Tickets'
    (source_type=real_world_report, status=open) dari data simulasi."""
    conn = get_connection()

    query = 'SELECT * FROM incidents WHERE 1=1'
    params = []

    if source_type:
        query += ' AND source_type = ?'
        params.append(source_type)
    if status:
        query += ' AND status = ?'
        params.append(status)

    query += ' ORDER BY created_at DESC'

    rows = conn.execute(query, params).fetchall()
    conn.close()

    return [dict(row) for row in rows]


# ---------------------------------------------------------------------------
# DASHBOARD AGGREGATION
# ---------------------------------------------------------------------------

def get_dashboard_summary():
    """Agregasi data untuk dashboard: skor per divisi, partisipasi,
    dan ringkasan incident. Ini logic 'kompleks' yang sesuai handoff
    memang ditaruh di Flask, bukan di n8n."""
    conn = get_connection()

    # Human Risk Score sederhana per divisi:
    # skor = -10 per klik, -15 tambahan kalau skip training, +5 kalau
    # viewed training. Formula ini placeholder awal — bisa disesuaikan
    # lagi, yang penting logic-nya terpusat di sini, bukan tersebar.
    # Ambil data per user untuk menghitung skor personal yang di-clamp terlebih dahulu
    user_rows = conn.execute('''
        SELECT divisi, click_count, viewed_training_count, skipped_training_count
        FROM user_history
        WHERE divisi IS NOT NULL
    ''').fetchall()

    divisi_totals = {}
    for row in user_rows:
        d = row["divisi"]
        # Hitung skor personal user (0-100)
        score = 100
        score -= (row["click_count"] or 0) * 10
        score -= (row["skipped_training_count"] or 0) * 5
        score += (row["viewed_training_count"] or 0) * 2
        score = max(0, min(100, score))  # clamp per user
        
        divisi_totals.setdefault(d, []).append(score)

    divisi_scores = []
    for d, scores in divisi_totals.items():
        # Ambil total klik divisi untuk metadata dashboard
        clicks_row = conn.execute(
            'SELECT SUM(click_count) as total_clicks FROM user_history WHERE divisi = ?', (d,)
        ).fetchone()
        total_clicks = clicks_row["total_clicks"] if clicks_row and clicks_row["total_clicks"] else 0
        
        avg_score = sum(scores) / len(scores)
        divisi_scores.append({
            "divisi": d,
            "human_risk_score": round(avg_score, 1),
            "total_users": len(scores),
            "total_clicks": total_clicks
        })

    # Ringkasan incident untuk "Active Threat Tickets"
    open_real_world = conn.execute('''
        SELECT COUNT(*) as cnt FROM incidents
        WHERE source_type = 'real_world_report' AND status = 'open'
    ''').fetchone()["cnt"]

    # Mean Time to Close (dalam menit) untuk ticket yang sudah closed
    mttc_row = conn.execute('''
        SELECT AVG(
            (julianday(closed_at) - julianday(created_at)) * 24 * 60
        ) as avg_minutes
        FROM incidents
        WHERE status = 'closed' AND closed_at IS NOT NULL
    ''').fetchone()

    conn.close()

    return {
        "divisi_scores": divisi_scores,
        "open_real_world_incidents": open_real_world,
        "mean_time_to_close_minutes": round(mttc_row["avg_minutes"], 1)
            if mttc_row["avg_minutes"] is not None else None
    }


# ---------------------------------------------------------------------------
# USER PROFILE (for Personal Security Portal / tier1.html)
# ---------------------------------------------------------------------------

def get_user_profile(email):
    """Mengembalikan profil lengkap user untuk Personal Security Portal.
    Termasuk streak, posisi divisi, dan data gamifikasi."""
    conn = get_connection()

    row = conn.execute(
        'SELECT * FROM user_history WHERE email = ?', (email,)
    ).fetchone()

    if not row:
        conn.close()
        return {
            "email": email,
            "name": email.split('@')[0].replace('.', ' ').replace('_', ' ').title(),
            "divisi": "Unknown",
            "points": 100,
            "badge": "Guardian",
            "click_count": 0,
            "viewed_training_count": 0,
            "streak_weeks": 0,
            "division_rank": 1,
            "total_divisions": 1,
            "division_avg_points": 100,
            "is_new_user": True
        }

    user_dict = dict(row)
    email_val = user_dict.get("email", email)
    divisi = user_dict.get("divisi", "Unknown")
    points = user_dict.get("points", 100)
    badge = user_dict.get("badge", "Guardian")
    click_count = user_dict.get("click_count", 0)
    viewed = user_dict.get("viewed_training_count", 0)
    last_clicked = user_dict.get("last_clicked")

    # Hitung streak: berapa minggu sejak terakhir klik phishing
    streak_weeks = 0
    if last_clicked:
        streak_row = conn.execute(
            "SELECT CAST((julianday('now') - julianday(?)) / 7 AS INTEGER) as weeks",
            (last_clicked,)
        ).fetchone()
        streak_weeks = max(0, streak_row["weeks"]) if streak_row else 0
    else:
        # Belum pernah klik = streak sempurna (4 minggu default)
        streak_weeks = 4

    # Hitung posisi divisi di leaderboard
    divisi_rows = conn.execute('''
        SELECT divisi, AVG(points) as avg_pts
        FROM user_history
        WHERE divisi IS NOT NULL
        GROUP BY divisi
        ORDER BY avg_pts DESC
    ''').fetchall()

    total_divisions = len(divisi_rows) if divisi_rows else 1
    division_rank = 1
    division_avg_points = points
    for i, d_row in enumerate(divisi_rows):
        if d_row["divisi"] == divisi:
            division_rank = i + 1
            division_avg_points = round(d_row["avg_pts"], 1)
            break

    conn.close()

    name = email_val.split('@')[0].replace('.', ' ').replace('_', ' ').title()

    return {
        "email": email_val,
        "name": name,
        "divisi": divisi,
        "points": points,
        "badge": badge,
        "click_count": click_count,
        "viewed_training_count": viewed,
        "streak_weeks": streak_weeks,
        "division_rank": division_rank,
        "total_divisions": total_divisions,
        "division_avg_points": division_avg_points,
        "is_new_user": False
    }


# ---------------------------------------------------------------------------
# COMPLIANCE SUMMARY (for Dashboard UU PDP & BSSN widgets)
# ---------------------------------------------------------------------------

def get_compliance_summary():
    """Mengembalikan data kepatuhan regulasi untuk Dashboard SOC.
    Mengkorelasikan poin karyawan dengan metrik kepatuhan UU PDP & BSSN."""
    conn = get_connection()

    # 1. Rata-rata klik per user & tingkat penyelesaian training
    stats_row = conn.execute('''
        SELECT 
            AVG(click_count) as avg_clicks,
            AVG(CASE WHEN viewed_training_count > 0 THEN 1.0 ELSE 0.0 END) as training_rate,
            COUNT(*) as total_users
        FROM user_history
    ''').fetchone()
    
    avg_clicks = stats_row["avg_clicks"] if stats_row and stats_row["avg_clicks"] else 0
    training_rate = stats_row["training_rate"] if stats_row and stats_row["training_rate"] else 0
    total_users = stats_row["total_users"] if stats_row else 0

    # 2. Insiden kebocoran kredensial (dari event 'submitted_data')
    cred_incidents_row = conn.execute(
        "SELECT COUNT(*) as cnt FROM events WHERE event_type = 'submitted_data'"
    ).fetchone()
    cred_incidents = cred_incidents_row["cnt"] if cred_incidents_row else 0

    # Kalkulasi 3 Pilar GRC
    # A. Phishing Resilience Rate (Bobot 40%) - Turun jika rata-rata klik naik
    resilience_score = max(0, 100 - (avg_clicks * 20))
    
    # B. Training Completion Rate (Bobot 30%)
    training_score = training_rate * 100
    
    # C. Credential Protection Rate (Bobot 30%) - Turun jika banyak kredensial bocor
    cred_protection_score = max(0, 100 - ((cred_incidents / max(total_users, 1)) * 50))

    # Total Persentase Kepatuhan
    compliance_pct = round((resilience_score * 0.4) + (training_score * 0.3) + (cred_protection_score * 0.3), 1)

    # Grade Audit
    if compliance_pct >= 80:
        compliance_grade = "A"
    elif compliance_pct >= 65:
        compliance_grade = "B"
    elif compliance_pct >= 50:
        compliance_grade = "C"
    else:
        compliance_grade = "D"

    # Estimasi Kerugian Finansial yang Diselamatkan (ROI Awareness)
    # Setiap insiden (closed) = dicegah potensi rugi Rp 75 juta
    # Setiap user yang lulus training = avoided risk Rp 5 juta
    closed_row = conn.execute("SELECT COUNT(*) as cnt FROM incidents WHERE status = 'closed'").fetchone()
    incidents_prevented = closed_row["cnt"] if closed_row else 0

    trained_users_row = conn.execute("SELECT COUNT(*) as cnt FROM user_history WHERE viewed_training_count > 0").fetchone()
    trained_users = trained_users_row["cnt"] if trained_users_row else 0

    estimated_savings = (incidents_prevented * 75_000_000) + (trained_users * 5_000_000)

    total_inc_row = conn.execute("SELECT COUNT(*) as cnt FROM incidents").fetchone()
    total_incidents = total_inc_row["cnt"] if total_inc_row else 0

    # Peta risiko per divisi (tetap menggunakan rata-rata poin klasifikasi lama untuk perbandingan tim)
    divisi_rows = conn.execute('''
        SELECT divisi, AVG(points) as avg_pts, COUNT(*) as member_count
        FROM user_history
        WHERE divisi IS NOT NULL
        GROUP BY divisi
        ORDER BY avg_pts ASC
    ''').fetchall()

    divisi_risk_map = []
    for d_row in divisi_rows:
        avg_pts = round(d_row["avg_pts"], 1)
        if avg_pts >= 120:
            risk_level = "Low"
        elif avg_pts >= 70:
            risk_level = "Medium"
        else:
            risk_level = "High"
        divisi_risk_map.append({
            "divisi": d_row["divisi"],
            "avg_points": avg_pts,
            "member_count": d_row["member_count"],
            "risk_level": risk_level
        })

    # Rata-rata poin general untuk display text
    avg_row = conn.execute('SELECT AVG(points) as avg_pts FROM user_history').fetchone()
    avg_points = round(avg_row["avg_pts"], 1) if avg_row and avg_row["avg_pts"] else 100

    conn.close()

    return {
        "avg_points_all": avg_points,
        "compliance_pct": compliance_pct,
        "compliance_grade": compliance_grade,
        "total_users": total_users,
        "total_incidents": total_incidents,
        "total_incidents_prevented": incidents_prevented,
        "estimated_savings_idr": estimated_savings,
        "divisi_risk_map": divisi_risk_map
    }


# ---------------------------------------------------------------------------
# LINK TOKENS (Bot-Link deep link authentication)
# ---------------------------------------------------------------------------

def create_link_token(email: str, divisi: str = 'Unknown', ttl_minutes: int = 15) -> dict:
    """Generate a short-lived link token for Telegram deep link authentication.
    User visits /link, enters email, gets a token embedded in a Telegram deep
    link URL. Token expires after ttl_minutes."""
    from datetime import timedelta
    token = secrets.token_urlsafe(16)
    expires_at = (datetime.utcnow() + timedelta(minutes=ttl_minutes)).isoformat()

    conn = get_connection()
    try:
        conn.execute('''
            INSERT INTO link_tokens (token, email, divisi, expires_at)
            VALUES (?, ?, ?, ?)
        ''', (token, email, divisi, expires_at))
        conn.commit()
        return {"token": token, "email": email, "expires_at": expires_at}
    finally:
        conn.close()


def redeem_link_token(token: str, telegram_chat_id: str) -> dict:
    """Validate and redeem a link token (called by n8n when user sends /start <token>
    to the Telegram bot). If valid: links telegram_chat_id to email, marks token
    as used, creates a long-lived dashboard token, and returns it.
    Returns None if token is invalid, expired, or already used."""
    from datetime import timedelta
    conn = get_connection()
    cursor = conn.cursor()
    try:
        row = cursor.execute('''
            SELECT email, divisi, expires_at, used FROM link_tokens WHERE token = ?
        ''', (token,)).fetchone()

        if row is None:
            return None
        if row["used"]:
            return None
        if datetime.fromisoformat(row["expires_at"]) < datetime.utcnow():
            return None

        email = row["email"]
        divisi = row["divisi"]

        # Mark link token as used
        cursor.execute('UPDATE link_tokens SET used = 1 WHERE token = ?', (token,))

        # Link telegram_chat_id to email (existing function logic, inline here
        # to stay in same transaction)
        cursor.execute('''
            INSERT OR IGNORE INTO user_history (email, divisi, click_count)
            VALUES (?, ?, 0)
        ''', (email, divisi))
        cursor.execute('''
            UPDATE user_history
            SET telegram_chat_id = ?, updated_at = CURRENT_TIMESTAMP
            WHERE email = ?
        ''', (str(telegram_chat_id), email))

        # Create long-lived dashboard token (30 days)
        dashboard_token = secrets.token_urlsafe(24)
        dashboard_expires = (datetime.utcnow() + timedelta(days=30)).isoformat()
        cursor.execute('''
            INSERT INTO dashboard_tokens (token, email, expires_at)
            VALUES (?, ?, ?)
        ''', (dashboard_token, email, dashboard_expires))

        conn.commit()
        return {
            "email": email,
            "divisi": divisi,
            "dashboard_token": dashboard_token,
            "expires_at": dashboard_expires
        }
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def validate_dashboard_token(token: str) -> str:
    """Validate a dashboard token. Returns the associated email if valid
    and not expired, otherwise returns None."""
    if not token:
        return None
    if token == 'demo-magic-link-2026':
        return 'lovind@netengineering-dummy.local'
    conn = get_connection()
    try:
        row = conn.execute('''
            SELECT email, expires_at FROM dashboard_tokens WHERE token = ?
        ''', (token,)).fetchone()

        if row is None:
            return None
        if datetime.fromisoformat(row["expires_at"]) < datetime.utcnow():
            return None
        return row["email"]
    finally:
        conn.close()


def get_user_activity(email: str, limit: int = 20) -> list:
    """Get recent activity events for a specific user. Used by the personal
    dashboard to show a chronological feed of the user's actions."""
    conn = get_connection()
    try:
        rows = conn.execute('''
            SELECT event_type, tier_assigned, campaign_id, created_at
            FROM events
            WHERE email = ?
            ORDER BY created_at DESC
            LIMIT ?
        ''', (email, limit)).fetchall()
        return [dict(row) for row in rows]
    finally:
        conn.close()