"""
database.py — semua operasi SQLite untuk Human Firewall Lite.

Dipisah dari app.py supaya route handler tetap tipis dan logic data
access terpusat di satu tempat. Sesuai keputusan arsitektur di handoff:
n8n TIDAK PERNAH menyentuh SQLite langsung, semua lewat Flask — jadi
modul ini adalah satu-satunya pintu masuk ke database.
"""

import sqlite3
import os
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
            status TEXT NOT NULL DEFAULT 'open',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            closed_at TIMESTAMP
        )
    ''')

    conn.commit()
    conn.close()


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
            "is_new_user": True
        }

    return {
        "email": row["email"],
        "divisi": row["divisi"],
        "click_count": row["click_count"],
        "viewed_training_count": row["viewed_training_count"],
        "skipped_training_count": row["skipped_training_count"],
        "last_clicked": row["last_clicked"],
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

        conn.commit()
        return True

    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# INCIDENTS (untuk Flow A eskalasi & Flow B report)
# ---------------------------------------------------------------------------

def create_incident(ticket_id: str, source_type: str, divisi: str,
                     severity: str = "low", reported_url: str = None,
                     vt_verdict: str = None, urlscan_verdict: str = None,
                     screenshot_url: str = None, checklist: str = None):
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
                vt_verdict, urlscan_verdict, screenshot_url, checklist, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'open')
        ''', (ticket_id, source_type, reported_url, divisi, severity,
              vt_verdict, urlscan_verdict, screenshot_url, checklist))
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
    divisi_rows = conn.execute('''
        SELECT
            divisi,
            COUNT(*) as total_users,
            SUM(click_count) as total_clicks,
            SUM(viewed_training_count) as total_viewed_training,
            SUM(skipped_training_count) as total_skipped_training
        FROM user_history
        WHERE divisi IS NOT NULL
        GROUP BY divisi
    ''').fetchall()

    divisi_scores = []
    for row in divisi_rows:
        score = 100
        score -= (row["total_clicks"] or 0) * 10
        score -= (row["total_skipped_training"] or 0) * 5
        score += (row["total_viewed_training"] or 0) * 2
        score = max(0, min(100, score))  # clamp 0-100

        divisi_scores.append({
            "divisi": row["divisi"],
            "human_risk_score": score,
            "total_users": row["total_users"],
            "total_clicks": row["total_clicks"] or 0
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