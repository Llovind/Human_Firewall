from flask import Blueprint, request, jsonify, render_template, session, redirect, url_for
import database
import os
import requests
import logging
from datetime import datetime, timedelta

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

def derive_divisi_from_email(email: str) -> str:
    """Ambil bagian domain dari email, cocokkan ke mapping di atas."""
    if not email or '@' not in email:
        return 'Unknown'
    domain = email.split('@')[-1].lower()
    return EMAIL_DOMAIN_TO_DIVISI.get(domain, 'Unknown')

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
        html = html.replace('__USER_EMAIL__', email)
        html = html.replace(
            '__HISTORY_NOTE__',
            build_history_note(history["click_count"] + 1, history["viewed_training_count"])
        )
        return html, 200

    html = render_template('tier2.html')
    return html.replace('__USER_EMAIL__', email), 200


@events_bp.route('/api/fake-login-submit', methods=['POST'])
def fake_login_submit():
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

    notify_n8n({
        "email": email,
        "divisi": divisi,
        "tier": database.classify_tier(history["click_count"]),
        "event_type": "submitted_data",
        "click_count_after": history["click_count"],
        "telegram_chat_id": history.get("telegram_chat_id"),
        "submitted_data": True
    })

    return jsonify({"message": "Tercatat"}), 201


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


@events_bp.route('/api/register-telegram', methods=['POST'])
def register_telegram():
    data = request.get_json(silent=True)
    if not data or not data.get('email') or not data.get('telegram_chat_id'):
        return jsonify({"error": "field 'email' dan 'telegram_chat_id' wajib diisi"}), 400

    email = data['email']
    telegram_chat_id = str(data['telegram_chat_id'])

    try:
        database.update_user_telegram_chat_id(email, telegram_chat_id)
        return jsonify({"message": "Pendaftaran Telegram sukses", "email": email, "telegram_chat_id": telegram_chat_id}), 200
    except Exception as e:
        return jsonify({"error": "Gagal mendaftarkan Telegram", "detail": str(e)}), 500


@events_bp.route('/api/otp/create', methods=['POST'])
def create_otp():
    data = request.get_json(silent=True)
    if not data or not data.get('email') or not data.get('telegram_chat_id') or not data.get('otp_code'):
        return jsonify({"error": "fields 'email', 'telegram_chat_id', and 'otp_code' are required"}), 400

    email = data['email']
    telegram_chat_id = str(data['telegram_chat_id'])
    otp_code = str(data['otp_code'])

    try:
        database.create_otp(email, telegram_chat_id, otp_code)
        subject = "Human Firewall — Kode Verifikasi OTP Telegram"
        body = (
            f"Halo Karyawan Infranexia,<br><br>"
            f"Kami menerima permintaan verifikasi akun Telegram Anda untuk platform Human Firewall.<br>"
            f"Kode OTP Anda adalah: <b>{otp_code}</b><br><br>"
            f"Masukkan kode di atas pada chat bot Telegram untuk menyelesaikan pendaftaran.<br>"
            f"Kode ini berlaku selama 15 menit.<br><br>"
            f"Salam hangat,<br><b>Tim IT Security Infranexia</b>"
        )
        database.create_inbox_email(email, subject, body)
        return jsonify({"message": "OTP created and email logged successfully"}), 201
    except Exception as e:
        return jsonify({"error": "Gagal membuat OTP", "detail": str(e)}), 500


@events_bp.route('/api/otp/verify', methods=['POST'])
def verify_otp():
    data = request.get_json(silent=True)
    if not data or not data.get('telegram_chat_id') or not data.get('otp_code'):
        return jsonify({"error": "fields 'telegram_chat_id' and 'otp_code' are required"}), 400

    telegram_chat_id = str(data['telegram_chat_id'])
    otp_code = str(data['otp_code'])

    try:
        email = database.verify_otp(telegram_chat_id, otp_code)
        if email:
            return jsonify({"status": "success", "message": "Verification successful", "email": email}), 200
        else:
            return jsonify({"status": "fail", "error": "Kode OTP salah atau kedaluwarsa"}), 400
    except Exception as e:
        return jsonify({"error": "Gagal memverifikasi OTP", "detail": str(e)}), 500


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
    return jsonify(database.get_user_profile(email)), 200


@events_bp.route('/api/user-eligibility', methods=['GET'])
def api_user_eligibility():
    email = request.args.get('email')
    token = request.args.get('token')

    if not email or not token:
        return jsonify({"error": "Parameters 'email' dan 'token' wajib diisi"}), 400

    token_email = database.validate_dashboard_token(token)
    if token_email is None or token_email != email:
        return jsonify({"error": "Token tidak valid atau tidak cocok dengan email"}), 403

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
                "message": "Skor Perilaku Keamanan Anda terverifikasi AMAN (>= 70). Pelatihan saat ini tidak diperlukan."
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
                    "message": "Anda sudah mengambil latihan hari ini. Silakan kembali lagi setelah masa cooldown."
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
    token = request.args.get('token')

    if not email or not token:
        return jsonify({"error": "parameters 'email' dan 'token' wajib diisi"}), 400

    token_email = database.validate_dashboard_token(token)
    if token_email is None or token_email != email:
        return jsonify({"error": "Token tidak valid atau tidak cocok dengan email"}), 403

    try:
        activities = database.get_user_activity(email)
        return jsonify({"activities": activities, "count": len(activities)}), 200
    except Exception as e:
        return jsonify({"error": "Gagal mengambil activity", "detail": str(e)}), 500
