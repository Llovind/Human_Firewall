from flask import Blueprint, request, jsonify, render_template, session, redirect, url_for
import database
import os
import json
import requests
import logging
from datetime import datetime, timedelta
from security import (
    authenticate_session_request,
    create_simulation_token,
    current_identity,
    is_valid_service_request,
    require_employee_match,
    verify_simulation_token,
)

# Set up logging warning
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

events_bp = Blueprint('events', __name__)

N8N_WEBHOOK_URL_FLOW_A = os.environ.get(
    'N8N_WEBHOOK_URL_FLOW_A',
    'http://n8n:5678/webhook/flask-event'
)

# Mapping domain email dummy -> nama divisi
EMAIL_DOMAIN_TO_DIVISI = {
    'netengineering-dummy.local': 'Network Engineering',
    'netops-dummy.local': 'Network Operations',
    'perfshared-dummy.local': 'Performance & Shared Service',
    'salessupport-dummy.local': 'Sales Support',
}

def js_string_literal(value: str) -> str:
    """Escape a value for safe embedding as a JS string literal inside an
    inline <script> block, e.g. replacing `"__USER_EMAIL__"` (WITH the
    surrounding quotes) in a template.

    Why this is needed: `email` comes straight from a URL query param
    (attacker-controlled — it's the link in a phishing simulation). Naively
    doing `html.replace('__USER_EMAIL__', email)` inserts it into
    `const USER_EMAIL = "__USER_EMAIL__";` with zero escaping, so an email
    value like `";alert(document.cookie);//` breaks out of the string
    literal and executes as JS (reflected XSS).

    json.dumps() produces a valid, fully-escaped JS/JSON string literal
    (handles quotes, backslashes, control characters). We additionally
    escape `</` so the value can't prematurely close the surrounding
    <script> tag (json.dumps alone does not protect against that).
    """
    return json.dumps(value).replace('</', '<\\/')


def derive_divisi_from_email(email: str) -> str:
    """Ekstrak nama perusahaan / divisi secara dinamis dari domain email karyawan tanpa hardcoding."""
    if not email or '@' not in email:
        return 'General'
    domain = email.split('@')[-1].lower()
    company_part = domain.split('.')[0].replace('-', ' ').replace('_', ' ')
    if not company_part:
        return 'General'
    return company_part.title()

def build_history_note(click_count: int, viewed_training_count: int) -> str:
    """Bangun pesan personal untuk halaman tier1, berdasarkan riwayat klik user."""
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
    """Kirim event ke n8n secara fire-and-forget dengan timeout pendek & logging error."""
    try:
        response = requests.post(N8N_WEBHOOK_URL_FLOW_A, json=payload, timeout=2)
        response.raise_for_status()
    except requests.exceptions.RequestException as e:
        logger.warning(f"notify_n8n: Webhook notification to n8n failed or timed out: {e}")


@events_bp.route('/redirect-handler', methods=['GET'])
def redirect_handler():
    email = request.args.get('email')
    rid = request.args.get('rid', '')
    skip_fake_login = request.args.get('skip_fake_login') == 'true'

    if not email:
        return jsonify({"error": "parameter 'email' wajib diisi"}), 400

    # If rid is empty, automatically resolve to most recent active simulation campaign
    if not rid:
        conn = database.get_connection()
        try:
            camp_row = conn.execute(
                "SELECT name FROM simulation_campaigns WHERE status = 'In progress' ORDER BY id DESC LIMIT 1"
            ).fetchone()
            if camp_row:
                rid = camp_row["name"]
        finally:
            conn.close()

    # ── SECURE GATEWAY CHECK ──
    # Check if this simulation link has already been reported and blocked by the proxy
    scheme = request.scheme
    host = request.host
    reconstructed_url = f"{scheme}://{host}/redirect-handler?rid={rid}"
    
    from services.threat_service import analyze_indicator
    try:
        result = analyze_indicator(reconstructed_url)
        if result["policy"]["action"] == "block":
            from urllib.parse import quote
            return redirect(f"/blocked?url={quote(reconstructed_url, safe='')}")
    except Exception as e:
        print(f"ERROR in redirect-handler secure gateway check: {e}")

    history = database.get_user_history(email)
    tier = database.classify_tier(history["click_count"])
    divisi = history.get("divisi") or derive_divisi_from_email(email)
    telegram_chat_id = history.get("telegram_chat_id")

    try:
        database.record_event(
            email=email,
            divisi=divisi,
            event_type='clicked_link',
            tier_assigned=tier,
            campaign_id=rid or None
        )
    except Exception as e:
        print(f"ERROR: Failed to record clicked_link event: {e}")
        import traceback
        traceback.print_exc()

    notify_n8n({
        "email": email,
        "divisi": divisi,
        "tier": tier,
        "event_type": "clicked_link",
        "click_count_after": history["click_count"] + 1,
        "telegram_chat_id": telegram_chat_id,
        "submitted_data": False
    })

    if tier == "tier_1" or skip_fake_login:
        html = render_template('tier1.html')
        html = html.replace('"__USER_EMAIL__"', js_string_literal(email))
        html = html.replace(
            '"__SIMULATION_TOKEN__"',
            js_string_literal(create_simulation_token(email, rid or None))
        )
        html = html.replace(
            '__HISTORY_NOTE__',
            build_history_note(history["click_count"] + 1, history["viewed_training_count"])
        )
        return html, 200

    html = render_template('tier2.html')
    html = html.replace('"__USER_EMAIL__"', js_string_literal(email))
    html = html.replace('"__CAMPAIGN_ID__"', js_string_literal(rid or ''))
    return html, 200


@events_bp.route('/api/fake-login-submit', methods=['POST'])
def fake_login_submit():
    data = request.get_json(silent=True)
    if not data or not data.get('email'):
        return jsonify({"error": "field 'email' wajib diisi"}), 400

    email = data['email']
    campaign_id = data.get('campaign_id') or data.get('rid') or None

    if not campaign_id:
        conn = database.get_connection()
        try:
            camp_row = conn.execute(
                "SELECT name FROM simulation_campaigns WHERE status = 'In progress' ORDER BY id DESC LIMIT 1"
            ).fetchone()
            if camp_row:
                campaign_id = camp_row["name"]
        finally:
            conn.close()

    history = database.get_user_history(email)
    divisi = history.get("divisi") or derive_divisi_from_email(email)

    try:
        database.record_event(
            email=email,
            divisi=divisi,
            event_type='submitted_data',
            tier_assigned=database.classify_tier(history["click_count"]),
            campaign_id=campaign_id
        )
    except Exception as e:
        return jsonify({"error": "gagal menyimpan event", "detail": str(e)}), 500

    notify_n8n({
        "email": email,
        "divisi": divisi,
        "tier": database.classify_tier(history["click_count"]),
        "event_type": "submitted_data",
        "click_count_after": history["click_count"],
        "telegram_chat_id": history.get("telegram_chat_id"),
        "submitted_data": True
    })

    return jsonify({"message": "Credential submission logged successfully"}), 200


@events_bp.route('/api/user-history', methods=['GET'])
def get_user_history():
    email = request.args.get('email')
    if not email:
        return jsonify({"error": "parameter 'email' wajib diisi"}), 400

    history = database.get_user_history(email)
    history["tier_classification"] = database.classify_tier(history["click_count"])
    return jsonify(history), 200


@events_bp.route('/api/event', methods=['POST'])
def save_event():
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "body JSON wajib diisi"}), 400

    email = data.get('email')
    event_type = data.get('event_type')

    if not email or not event_type:
        return jsonify({"error": "field 'email' dan 'event_type' wajib diisi"}), 400

    # Browser-originated employee and training events must prove ownership.
    # Trusted server-to-server callers continue to authenticate via bearer key.
    simulation_token = data.get('simulation_token')
    identity = current_identity() or authenticate_session_request(request)
    is_employee = bool(
        identity and identity.role == 'employee' and identity.email.lower() == email.lower()
    )
    is_simulation = verify_simulation_token(simulation_token or '', email)
    if not (is_valid_service_request(request) or is_employee or is_simulation):
        return jsonify({"error": "Unauthorized event submission"}), 401

    valid_event_types = (
        'clicked_link', 'submitted_data', 'viewed_training',
        'skipped_training', 'email_opened',
        'spot_the_fake_correct', 'spot_the_fake_incorrect'
    )
    if event_type not in valid_event_types:
        return jsonify({
            "error": f"event_type tidak valid: {event_type}",
            "valid_options": valid_event_types
        }), 400

    campaign_id = data.get('campaign_id')
    if not campaign_id:
        conn = database.get_connection()
        try:
            camp_row = conn.execute(
                "SELECT name FROM simulation_campaigns WHERE status = 'In progress' ORDER BY id DESC LIMIT 1"
            ).fetchone()
            if camp_row:
                campaign_id = camp_row["name"]
        finally:
            conn.close()

    try:
        database.record_event(
            email=email,
            divisi=data.get('divisi') or derive_divisi_from_email(email),
            event_type=event_type,
            tier_assigned=data.get('tier_assigned'),
            campaign_id=campaign_id
        )
    except Exception as e:
        return jsonify({"error": "gagal menyimpan event", "detail": str(e)}), 500

    return jsonify({"message": "Event berhasil dicatat", "email": email,
                     "event_type": event_type}), 201


@events_bp.route('/api/register-telegram', methods=['POST'])
@events_bp.route('/api/otp/create', methods=['POST'])
@events_bp.route('/api/otp/verify', methods=['POST'])
def retired_telegram_registration():
    return jsonify({
        "error": "Registrasi Telegram telah dinonaktifkan. Gunakan email, password, dan OTP.",
        "code": "AUTH_FLOW_RETIRED",
    }), 410


@events_bp.route('/api/emails', methods=['GET'])
def list_emails():
    try:
        emails = database.list_inbox_emails()
        return jsonify({"status": "success", "emails": emails, "count": len(emails)}), 200
    except Exception as e:
        return jsonify({"error": "Gagal mengambil inbox", "detail": str(e)}), 500


@events_bp.route('/api/user-profile', methods=['GET'])
def user_profile():
    email = request.args.get('email')
    if not email:
        return jsonify({"error": "parameter 'email' wajib diisi"}), 400
    simulation_token = request.args.get('simulation_token', '')
    if not (
        is_valid_service_request(request)
        or verify_simulation_token(simulation_token, email)
    ):
        return jsonify({"error": "Unauthorized profile access"}), 401
    return jsonify(database.get_user_profile(email)), 200


@events_bp.route('/api/user-eligibility', methods=['GET'])
def api_user_eligibility():
    email = request.args.get('email')

    if not email:
        return jsonify({"error": "Parameter 'email' wajib diisi"}), 400
    access_error = require_employee_match(email)
    if access_error:
        return access_error

    conn = database.get_connection()
    try:
        row = conn.execute('SELECT points FROM user_history WHERE email = ?', (email,)).fetchone()
        points = row["points"] if row else 100

        clicked_row = conn.execute(
            "SELECT count(*) as count FROM events WHERE email = ? AND event_type = 'clicked_link'",
            (email,)
        ).fetchone()
        has_clicked = clicked_row["count"] > 0 if clicked_row else False

        behavior_score = points / 2.0
        if behavior_score >= 70:
            return jsonify({
                "eligible": False,
                "reason": "safe",
                "message": "Skor perilaku Anda saat ini berada di zona aman. Latihan 'Spot the Fake' dikhususkan untuk rekan-rekan yang perlu meningkatkan skor mereka. Tetap pertahankan performa hebat Anda lewat Daily Quiz harian!"
            }), 200

        game_row = conn.execute('''
            SELECT created_at FROM events 
            WHERE email = ? AND event_type IN ('spot_the_fake_correct', 'spot_the_fake_incorrect')
            ORDER BY created_at DESC LIMIT 1
        ''', (email,)).fetchone()

        if game_row:
            last_played_str = game_row["created_at"]
            try:
                last_played = datetime.strptime(last_played_str, '%Y-%m-%d %H:%M:%S')
            except ValueError:
                try:
                    last_played = datetime.fromisoformat(last_played_str.replace('Z', ''))
                except ValueError:
                    last_played = datetime.utcnow()
            
            time_diff = datetime.utcnow() - last_played
            if time_diff < timedelta(hours=24):
                cooldown_seconds = int((timedelta(hours=24) - time_diff).total_seconds())
                return jsonify({
                    "eligible": False,
                    "reason": "cooldown",
                    "cooldown_seconds": cooldown_seconds,
                    "message": "Anda sudah mengikuti latihan hari ini. Silakan kembali lagi setelah masa cooldown selesai."
                }), 200

        return jsonify({
            "eligible": True,
            "points": points,
            "behavior_score": behavior_score
        }), 200
    finally:
        conn.close()


@events_bp.route('/api/user-activity', methods=['GET'])
def api_user_activity():
    email = request.args.get('email')

    if not email:
        return jsonify({"error": "Parameter 'email' wajib diisi"}), 400
    access_error = require_employee_match(email)
    if access_error:
        return access_error

    try:
        activities = database.get_user_activity(email)
        return jsonify({"activities": activities, "count": len(activities)}), 200
    except Exception as e:
        return jsonify({"error": "Gagal mengambil activity", "detail": str(e)}), 500


@events_bp.route('/api/dns-check', methods=['GET'])
def dns_check():
    import socket
    from urllib.parse import urlparse

    url = request.args.get('url', '').strip()
    if not url:
        return jsonify({"resolvable": False, "error": "url parameter is required"}), 400

    # Ensure URL has scheme for urlparse to identify hostname correctly
    if not url.startswith("http://") and not url.startswith("https://"):
        url = "http://" + url

    try:
        parsed = urlparse(url)
        hostname = parsed.hostname
        if not hostname:
            return jsonify({"resolvable": False, "error": "Invalid URL structure"}), 400

        socket.gethostbyname(hostname)
        return jsonify({"resolvable": True}), 200
    except socket.gaierror:
        return jsonify({"resolvable": False, "reason": "nxdomain"}), 200
    except Exception as e:
        return jsonify({"resolvable": False, "error": str(e)}), 500


@events_bp.route('/api/telegram/user', methods=['GET'])
def get_telegram_user():
    return jsonify({
        "error": "Integrasi identitas Telegram telah dinonaktifkan.",
        "code": "AUTH_FLOW_RETIRED",
    }), 410
