"""
app.py — Flask API untuk Human Firewall Lite.

Sesuai keputusan arsitektur di handoff:
- Flask adalah SATU-SATUNYA pintu ke SQLite. n8n tidak pernah baca/tulis
  DB langsung, selalu lewat endpoint di file ini.
- Logic kompleks (scoring, agregasi dashboard, validasi) ada di sini
  dan di database.py — n8n hanya melakukan routing/branching sederhana.

UPDATE (Opsi 2 - real-time tier routing):
- GoPhish landing page sekarang hanya pass-through kosong (lihat
  gophish/landing-page-redirect.html) yang redirect ke /redirect-handler
  di bawah ini. Flask-lah yang menentukan halaman tier mana yang dilihat
  user, secara real-time, berdasarkan histori klik di database.
- Setelah event tercatat, Flask mengirim webhook ke n8n (fire-and-forget,
  TIDAK menunggu respons n8n) supaya n8n bisa menjalankan logic
  orchestration-nya sendiri (klasifikasi severity, eskalasi notifikasi,
  pembuatan incident ticket) — n8n TIDAK lagi berada di jalur redirect
  real-time, karena itu bukan kapasitasnya (lihat diskusi arsitektur).
"""

from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
import database
import uuid
import os
import requests

app = Flask(__name__)
CORS(app)

database.init_db()

# URL webhook n8n untuk Flow A. "flask_api" dan "n8n" berada di network
# Docker yang sama (hfl_network), jadi dipanggil lewat nama service,
# BUKAN localhost — localhost di dalam container flask_api merujuk ke
# container itu sendiri, bukan ke container n8n.
N8N_WEBHOOK_URL_FLOW_A = os.environ.get(
    'N8N_WEBHOOK_URL_FLOW_A',
    'http://n8n:5678/webhook/flask-event'
)


# Mapping domain email dummy -> nama divisi. Diperlukan karena GoPhish
# hanya mengirim {{.Email}} ke landing page, TIDAK ada field "Position"
# atau divisi yang bisa di-passthrough langsung. Pola domain ini sengaja
# kita desain sendiri (lihat daftar dummy users), jadi derive dari sini
# adalah cara paling reliable tanpa menambah dependency ke GoPhish API.
EMAIL_DOMAIN_TO_DIVISI = {
    'netengineering-dummy.local': 'Network Engineering',
    'netops-dummy.local': 'Network Operations',
    'perfshared-dummy.local': 'Performance & Shared Service',
    'salessupport-dummy.local': 'Sales Support',
}


def derive_divisi_from_email(email: str) -> str:
    """Ambil bagian domain dari email, cocokkan ke mapping di atas.
    Kalau domain tidak dikenali (misal typo atau divisi baru yang belum
    didaftarkan), fallback ke 'Unknown' — BUKAN None, supaya tidak
    melanggar constraint NOT NULL di kolom divisi pada tabel
    user_history (lihat database.py)."""
    if not email or '@' not in email:
        return 'Unknown'
    domain = email.split('@')[-1].lower()
    return EMAIL_DOMAIN_TO_DIVISI.get(domain, 'Unknown')

def build_history_note(click_count: int, viewed_training_count: int) -> str:
    """Bangun pesan personal untuk halaman tier1, berdasarkan riwayat
    klik user. Framing SENGAJA netral/suportif, bukan menyalahkan -
    terutama penting untuk chronic clicker (klik berkali-kali), supaya
    tidak terasa menge-judge walau datanya menunjukkan pola berulang."""
    if click_count <= 1:
        narrative = ("<p>Ini simulasi pertama yang Anda ikuti. "
                       "Selamat sudah membaca sampai sini!</p>")
    elif click_count <= 3:
        narrative = (f"<p>Ini simulasi ke-{click_count} yang Anda ikuti. "
                       f"Setiap latihan membantu Anda lebih cepat "
                       f"mengenali tanda-tandanya.</p>")
    else:
        narrative = (f"<p>Ini adalah simulasi ke-{click_count} yang anda ikuti. "
                       f"Bukan masalah, justru kesempatan baik untuk benar-benar "
                       f"membiasakan diri mengenali tanda-tanda di bawah ini sebelum "
                       f"menghadapi email phishing yang sungguhan.</p>")

    badge = (
        f'<div style="margin-top:10px;">'
        f'<span style="background:transparent;color:#5e35b1;font-size:11px;'
        f'padding:3px 10px;border:1px solid #5e35b1;border-radius:12px;">'
        f'Sudah dipelajari {viewed_training_count}x</span>'
        f'</div>'
    )

    return narrative + badge

def notify_n8n(payload: dict):
    """Kirim event ke n8n secara fire-and-forget. Sengaja dibungkus
    try/except dengan timeout pendek — kalau n8n down atau lambat,
    user yang sedang melihat redirect-handler TIDAK BOLEH ikut
    terhambat. Ini murni notifikasi sampingan, bukan bagian dari
    response time yang dirasakan user."""
    try:
        requests.post(N8N_WEBHOOK_URL_FLOW_A, json=payload, timeout=3)
    except requests.exceptions.RequestException:
        # Gagal kirim ke n8n tidak boleh menggagalkan request utama.
        # Konsekuensinya: kalau ini sering terjadi, event eskalasi bisa
        # hilang - acceptable untuk MVP, dicatat sebagai limitation,
        # bukan ditangani dengan retry queue (di luar scope MVP).
        pass


# ---------------------------------------------------------------------------
# REAL-TIME TIER ROUTING (Opsi 2 — dipanggil browser user, BUKAN n8n)
# ---------------------------------------------------------------------------

@app.route('/redirect-handler', methods=['GET'])
def redirect_handler():
    """Dipanggil browser user setelah GoPhish landing page pass-through
    redirect ke sini. Menentukan halaman tier mana yang ditampilkan,
    SECARA REAL-TIME berdasarkan histori klik — ini menggantikan rencana
    awal di mana n8n menentukan tier sebelum redirect (tidak mungkin
    dilakukan n8n karena n8n tidak berada di jalur request browser).

    Query params:
        email (wajib)            — dari {{.Email}} GoPhish
        rid (opsional)           — dari {{.RId}} GoPhish, untuk logging
        skip_fake_login (opsional) — 'true' kalau dipanggil ulang setelah
                                      user submit fake-login (lihat
                                      fake_login_tier2.html), supaya
                                      tidak ditampilkan fake-login lagi.
    """
    email = request.args.get('email')
    rid = request.args.get('rid', '')
    skip_fake_login = request.args.get('skip_fake_login') == 'true'

    if not email:
        return jsonify({"error": "parameter 'email' wajib diisi"}), 400

    history = database.get_user_history(email)
    tier = database.classify_tier(history["click_count"])
    # User baru -> history["divisi"] pasti None (lihat get_user_history
    # di database.py). Derive dari domain email supaya TIDAK mengirim
    # None ke record_event, yang sebelumnya menyebabkan INSERT OR IGNORE
    # gagal diam-diam karena kolom divisi adalah NOT NULL.
    divisi = history.get("divisi") or derive_divisi_from_email(email)

    # Catat event 'clicked_link' SEBELUM render halaman, supaya
    # click_count yang dipakai untuk klasifikasi tier BERIKUTNYA sudah
    # benar (klik ke-N ini ikut dihitung untuk keputusan tier klik ke-N+1,
    # bukan untuk keputusan tier klik ini sendiri — tier untuk klik yang
    # SEDANG terjadi memakai history SEBELUM increment, sesuai logic
    # classify_tier yang sudah ada).
    try:
        database.record_event(
            email=email,
            divisi=divisi,
            event_type='clicked_link',
            tier_assigned=tier,
            campaign_id=rid or None
        )
    except Exception:
        # Pencatatan gagal tidak boleh menghalangi user melihat halaman
        # edukasi - itu lebih penting daripada kegagalan logging di MVP.
        pass

    # Beri tahu n8n bahwa event klik terjadi, supaya n8n bisa menjalankan
    # logic eskalasi (misal chronic clicker 4+) secara independen dari
    # jalur redirect real-time ini.
    notify_n8n({
        "email": email,
        "divisi": divisi,
        "tier": tier,
        "event_type": "clicked_link",
        "click_count_after": history["click_count"] + 1,
        "submitted_data": False
    })

    # Tier 1 (first-timer) ATAU sudah lewat fake-login (skip_fake_login) ->
    # langsung tampilkan teachable moment.
    if tier == "tier_1" or skip_fake_login:
        html = render_template('tier1.html')
        html = html.replace('__USER_EMAIL__', email)
        html = html.replace(
            '__HISTORY_NOTE__',
            build_history_note(history["click_count"] + 1, history["viewed_training_count"])
        )
        return html, 200

    # Tier 2 / tier_2_chronic, BELUM lewat fake-login -> tampilkan
    # fake-login dulu sesuai desain.
    html = render_template('tier2.html')
    return html.replace('__USER_EMAIL__', email), 200

@app.route('/api/fake-login-submit', methods=['POST'])
def fake_login_submit():
    """Dipanggil dari form fake-login (Tier 2) SETELAH user submit.
    SENGAJA tidak menerima/menyimpan isi username/password apa pun -
    yang dicatat hanya FAKTA bahwa data disubmit, dipakai untuk skor
    dan severity incident (lihat handoff: data sensitif ke-submit
    menaikkan severity dibanding sekadar klik)."""
    data = request.get_json(silent=True)
    if not data or not data.get('email'):
        return jsonify({"error": "field 'email' wajib diisi"}), 400

    email = data['email']
    history = database.get_user_history(email)
    divisi = history.get("divisi") or derive_divisi_from_email(email)

    try:
        database.record_event(
            email=email,
            divisi=divisi,
            event_type='submitted_data',
            tier_assigned=database.classify_tier(history["click_count"])
        )
    except Exception as e:
        return jsonify({"error": "gagal menyimpan event", "detail": str(e)}), 500

    # submitted_data = True di sini -> n8n yang memutuskan apakah ini
    # perlu jadi incident ticket (lihat desain Flow A: branch data submit).
    notify_n8n({
        "email": email,
        "divisi": divisi,
        "tier": database.classify_tier(history["click_count"]),
        "event_type": "submitted_data",
        "click_count_after": history["click_count"],
        "submitted_data": True
    })

    return jsonify({"message": "Tercatat"}), 201


# ---------------------------------------------------------------------------
# FLOW A — SIMULASI (endpoint lama, tetap dipertahankan untuk kompatibilitas
# dan untuk dipanggil manual/testing — TIDAK lagi dipanggil n8n sebelum
# redirect, karena keputusan tier sekarang real-time di redirect_handler
# di atas)
# ---------------------------------------------------------------------------

@app.route('/api/user-history', methods=['GET'])
def get_user_history():
    email = request.args.get('email')
    if not email:
        return jsonify({"error": "parameter 'email' wajib diisi"}), 400

    history = database.get_user_history(email)
    history["tier_classification"] = database.classify_tier(history["click_count"])

    return jsonify(history), 200


@app.route('/api/event', methods=['POST'])
def save_event():
    """Dipakai juga oleh tombol 'Saya Mengerti' di teachable_moment_tier1.html
    (event_type='viewed_training') dan oleh beforeunload handler
    (event_type='skipped_training')."""
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "body JSON wajib diisi"}), 400

    email = data.get('email')
    event_type = data.get('event_type')

    if not email or not event_type:
        return jsonify({"error": "field 'email' dan 'event_type' wajib diisi"}), 400

    valid_event_types = (
        'clicked_link', 'submitted_data', 'viewed_training',
        'skipped_training', 'email_opened'
    )
    if event_type not in valid_event_types:
        return jsonify({
            "error": f"event_type tidak valid: {event_type}",
            "valid_options": valid_event_types
        }), 400

    try:
        database.record_event(
            email=email,
            divisi=data.get('divisi') or derive_divisi_from_email(email),
            event_type=event_type,
            tier_assigned=data.get('tier_assigned'),
            campaign_id=data.get('campaign_id')
        )
    except Exception as e:
        return jsonify({"error": "gagal menyimpan event", "detail": str(e)}), 500

    return jsonify({"message": "Event berhasil dicatat", "email": email,
                     "event_type": event_type}), 201


# ---------------------------------------------------------------------------
# INCIDENTS — dipakai DUA mode: simulation (Flow A eskalasi, dipanggil n8n
# setelah menerima webhook dari notify_n8n di atas) dan real_world_report
# (Flow B, dari hasil VirusTotal + urlscan.io)
# ---------------------------------------------------------------------------

@app.route('/api/incidents', methods=['POST'])
def create_incident():
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "body JSON wajib diisi"}), 400

    source_type = data.get('source_type')
    if source_type not in database.VALID_SOURCE_TYPES:
        return jsonify({
            "error": f"source_type wajib diisi dan harus salah satu dari "
                     f"{database.VALID_SOURCE_TYPES}",
            "received": source_type
        }), 400

    divisi = data.get('divisi')
    if not divisi:
        return jsonify({"error": "field 'divisi' wajib diisi"}), 400

    ticket_id = f"INC-{uuid.uuid4().hex[:8].upper()}"

    severity = data.get('severity', 'low')
    if severity not in database.VALID_SEVERITIES:
        return jsonify({
            "error": f"severity harus salah satu dari {database.VALID_SEVERITIES}",
            "received": severity
        }), 400

    try:
        database.create_incident(
            ticket_id=ticket_id,
            source_type=source_type,
            divisi=divisi,
            severity=severity,
            reported_url=data.get('reported_url'),
            vt_verdict=data.get('vt_verdict'),
            urlscan_verdict=data.get('urlscan_verdict'),
            screenshot_url=data.get('screenshot_url'),
            checklist=data.get('checklist')
        )
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": "gagal membuat ticket", "detail": str(e)}), 500

    return jsonify({"message": "Ticket incident berhasil dibuat",
                     "ticket_id": ticket_id, "source_type": source_type,
                     "severity": severity}), 201


@app.route('/api/incidents/<ticket_id>', methods=['PATCH'])
def update_incident(ticket_id):
    data = request.get_json(silent=True)
    if not data or 'status' not in data:
        return jsonify({"error": "field 'status' wajib diisi di body"}), 400

    status = data['status']
    try:
        updated = database.update_incident_status(ticket_id, status)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    if not updated:
        return jsonify({"error": f"ticket_id '{ticket_id}' tidak ditemukan"}), 404

    return jsonify({"message": f"Ticket {ticket_id} status diupdate ke {status}"}), 200


@app.route('/api/incidents', methods=['GET'])
def list_incidents():
    source_type = request.args.get('source_type')
    status = request.args.get('status')

    if source_type and source_type not in database.VALID_SOURCE_TYPES:
        return jsonify({
            "error": f"source_type tidak valid: {source_type}",
            "valid_options": database.VALID_SOURCE_TYPES
        }), 400

    incidents = database.list_incidents(source_type=source_type, status=status)
    return jsonify({"incidents": incidents, "count": len(incidents)}), 200


# ---------------------------------------------------------------------------
# DASHBOARD
# ---------------------------------------------------------------------------

@app.route('/api/dashboard-summary', methods=['GET'])
def dashboard_summary():
    summary = database.get_dashboard_summary()
    return jsonify(summary), 200


@app.route('/')
def dashboard():
    return ("<h1>Human Firewall Lite Dashboard</h1>"
            "<p>UI Dashboard dengan Chart.js akan dibangun di sini, "
            "menarik data dari /api/dashboard-summary dan /api/incidents.</p>")


@app.route('/health')
def health():
    return jsonify({"status": "ok"}), 200


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)