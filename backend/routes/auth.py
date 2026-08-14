from flask import Blueprint, request, jsonify, render_template, session, redirect, url_for
import os
import database

auth_bp = Blueprint('auth', __name__)

# Fetch ADMIN_PASSWORD in blueprint to avoid circular imports
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD')

@auth_bp.route('/admin/login', methods=['GET', 'POST'])
def admin_login():
    """Redirect legacy Flask /admin/login requests directly to Next.js React Login Page."""
    dashboard_base = os.environ.get('NEXT_PUBLIC_BASE_URL', 'http://localhost:3000')
    return redirect(f"{dashboard_base}/admin/login")


@auth_bp.route('/admin/logout')
def admin_logout():
    session.clear()
    return redirect(url_for('auth.admin_login'))


@auth_bp.route('/api/auth/admin', methods=['POST'])
def api_auth_admin():
    """Verify admin password and return user object if valid."""
    data = request.get_json(silent=True)
    if not data or 'password' not in data:
        return jsonify({"error": "Password wajib diisi"}), 400

    if data['password'] == ADMIN_PASSWORD:
        return jsonify({
            "success": True,
            "user": {
                "email": "admin@humanfirewall.local",
                "name": "Security Administrator",
                "role": "admin"
            }
        }), 200
    else:
        return jsonify({"error": "Password admin salah"}), 401


@auth_bp.route('/api/telegram/command', methods=['POST'])
def telegram_command():
    data = request.get_json(silent=True)
    if not data or 'chat_id' not in data or 'command' not in data:
        return jsonify({"error": "chat_id and command are required"}), 400

    chat_id = str(data['chat_id'])
    cmd = data['command'].strip()
    cmd_lower = cmd.lower()
    first_name = data.get('first_name', 'User')

    conn = database.get_connection()
    try:
        dashboard_base = os.environ.get('NEXT_PUBLIC_BASE_URL', 'http://localhost:3000')

        # ── 1. Handle Email Input (e.g. name@domain.com or name@infranexia.co.id) ──
        if '@' in cmd or cmd_lower.endswith('.local') or cmd_lower.endswith('.com') or cmd_lower.endswith('.id'):
            input_email = cmd.strip()
            import random
            otp_code = str(random.randint(100000, 999999))

            user_row = conn.execute('SELECT email FROM user_history WHERE email = ?', (input_email,)).fetchone()
            if not user_row:
                divisi = database.derive_divisi_from_email(input_email) if hasattr(database, 'derive_divisi_from_email') else 'General'
                database.add_employee(input_email, divisi)

            database.create_otp(input_email, chat_id, otp_code)

            subject = "Human Firewall — Kode Verifikasi OTP Telegram"
            body = (
                "Halo Karyawan,<br><br>"
                f"Kode OTP verifikasi Telegram Anda adalah: <b>{otp_code}</b><br><br>"
                "Ketikkan kode 6 digit ini di chat bot Telegram untuk menyelesaikan verifikasi.<br>"
                "Salam,<br><b>Tim IT Security</b>"
            )
            database.create_inbox_email(input_email, subject, body)

            reply = (
                f"📧 Email <b>{input_email}</b> diterima.\n\n"
                "Kode OTP verifikasi telah dikirimkan ke <b>Inbox Webmail</b> Anda.\n\n"
                "Silakan ketikkan <b>6 digit kode OTP</b> tersebut di sini untuk menghubungkan akun Telegram Anda!"
            )
            return jsonify({"reply": reply}), 200

        # ── 2. Handle 6-Digit OTP Verification Input ──
        if cmd.isdigit() and len(cmd) == 6:
            otp_row = conn.execute(
                'SELECT email, otp_code FROM telegram_otp WHERE telegram_chat_id = ? AND is_verified = 0 ORDER BY created_at DESC LIMIT 1',
                (chat_id,)
            ).fetchone()

            if otp_row and otp_row["otp_code"] == cmd:
                target_email = otp_row["email"]
                database.update_user_telegram_chat_id(target_email, chat_id)
                conn.execute('UPDATE telegram_otp SET is_verified = 1 WHERE telegram_chat_id = ?', (chat_id,))
                conn.commit()
                reply = (
                    "✅ <b>Verifikasi Berhasil!</b>\n\n"
                    f"Akun Telegram Anda resmi terhubung dengan email <code>{target_email}</code>.\n\n"
                    "📌 <b>Perintah yang Bisa Anda Gunakan:</b>\n"
                    "• <code>/profile</code> — Lihat statistik performa & skor kepatuhan Anda.\n"
                    "• <code>/dashboard</code> — Dapatkan link login otomatis ke Dashboard personal Anda.\n"
                    "• <code>/help</code> — Lihat panduan bantuan kapan saja."
                )
            else:
                reply = "❌ Kode OTP salah atau telah kedaluwarsa. Silakan ketik ulang email perusahaan Anda untuk meminta OTP baru."
            return jsonify({"reply": reply}), 200

        # ── 3. Check User Registration Status ──
        row = conn.execute(
            'SELECT email, divisi, points, daily_streak, badge FROM user_history WHERE telegram_chat_id = ?',
            (chat_id,)
        ).fetchone()

        if cmd_lower in ('/start', '/help', 'start', 'help') or not row:
            if not row:
                reply = (
                    f"Halo {first_name}! 👋 Selamat datang di <b>Afferent Security Bot</b>.\n\n"
                    "Akun Telegram Anda belum terhubung dengan akun perusahaan.\n\n"
                    "📧 <b>Panduan Pendaftaran Akun (3 Langkah):</b>\n"
                    "1. Ketikkan <b>email perusahaan Anda</b> (contoh: <code>nama@infranexia.co.id</code>) di chat ini.\n"
                    "2. Buka Webmail Anda untuk melihat <b>6 digit kode OTP</b>.\n"
                    "3. Ketikkan 6 digit kode OTP tersebut di sini.\n\n"
                    "💡 <b>Laporan Ancaman Langsung:</b>\n"
                    "Anda juga bisa langsung meneruskan <b>URL mencurigakan</b> atau <b>File attachment</b> ke chat ini kapan saja untuk dianalisis otomatis!"
                )
            else:
                reply = (
                    f"Halo {first_name}! 👋 Selamat datang di <b>Afferent Security Bot</b>.\n\n"
                    "📌 <b>Daftar Perintah Resmi:</b>\n"
                    "• <code>/profile</code> — Lihat statistik performa & skor kepatuhan Anda.\n"
                    "• <code>/dashboard</code> — Dapatkan link login otomatis ke Dashboard personal Anda.\n"
                    "• <code>/help</code> — Menampilkan pesan panduan ini.\n\n"
                    "💡 <b>Cara Melaporkan Ancaman:</b>\n"
                    "• Kirimkan <b>URL mencurigakan</b> (berisi <code>http://...</code>)\n"
                    "• Kirimkan <b>Lampiran File</b> (PDF, EXE, DOCX, TXT)"
                )
            return jsonify({"reply": reply}), 200

        email = row["email"]
        divisi = row["divisi"]
        points = row["points"]
        streak = row["daily_streak"] or 0
        badge = row["badge"] or "None"

        rank_row = conn.execute(
            'SELECT count(*) + 1 as rank FROM user_history WHERE points > ?',
            (points,)
        ).fetchone()
        rank = rank_row["rank"] if rank_row else 1
        score_val = max(0, min(100, int(points / 2.0)))

        if cmd_lower in ('/profile', '/score', 'profile', 'score'):
            reply = (
                "👤 <b>Profil Keamanan Anda</b> 👤\n\n"
                f"📧 Email: <code>{email}</code>\n"
                f"🏢 Divisi: {divisi}\n\n"
                "🏆 <b>Statistik Performa:</b>\n"
                f"• Skor Kepatuhan: <b>{score_val}/100</b>\n"
                f"• Total Poin: <b>{points} pts</b>\n"
                f"• Peringkat Perusahaan: <b>#{rank}</b>\n"
                f"• Beruntun Bebas Insiden: <b>{streak} minggu</b>\n"
                f"• Lencana Saat Ini: <b>🛡️ {badge}</b>\n\n"
                "Pertahankan kinerja baik Anda untuk melindungi perusahaan! 💪"
            )
        elif cmd_lower in ('/dashboard', 'dashboard'):
            import uuid
            from datetime import datetime, timedelta

            token = str(uuid.uuid4())
            expires_dt = (datetime.utcnow() + timedelta(days=30)).isoformat()

            conn.execute(
                'INSERT INTO dashboard_tokens (token, email, expires_at) VALUES (?, ?, ?)',
                (token, email, expires_dt)
            )
            conn.commit()

            magic_link = f"{dashboard_base}/auth?token={token}"

            reply = (
                "🔑 <b>Link Akses Dashboard Anda</b> 🔑\n\n"
                "Silakan klik link di bawah ini untuk masuk ke Dashboard personal Anda secara otomatis:\n\n"
                f"🌐 {magic_link}\n\n"
                "⚠️ <b>Penting:</b> Jangan bagikan link ini kepada siapa pun."
            )
        else:
            reply = (
                f"Perintah <code>{cmd}</code> tidak dikenali.\n\n"
                "Ketik <code>/help</code> untuk melihat daftar perintah yang tersedia."
            )

        return jsonify({"reply": reply}), 200
    finally:
        conn.close()
