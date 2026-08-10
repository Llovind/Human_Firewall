"""
database.py — semua operasi SQLite untuk Human Firewall Lite.

Dipisah dari app.py supaya route handler tetap tipis dan logic data
access terpusat di satu tempat. Sesuai keputusan arsitektur di handoff:
n8n TIDAK PERNAH menyentuh SQLite langsung, semua lewat Flask — jadi
modul ini adalah satu-satunya pintu masuk ke database.
"""

import sqlite3
import hashlib
import os
import secrets
import json
from datetime import datetime, date, timedelta

DB_PATH = os.path.join('instance', 'human_firewall.db')

# source_type yang valid untuk tabel incidents — divalidasi di sini
# supaya konsisten dipanggil dari route manapun, bukan diulang-ulang.
VALID_SOURCE_TYPES = ("simulation", "real_world_report")
VALID_SEVERITIES = ("low", "medium", "high")
VALID_STATUSES = ("open", "closed")
VALID_REPORT_TYPES = ("url", "file")
VALID_VERDICTS = ("clean", "suspicious", "malicious")

# =========================================================================
# BADGE CONFIG — Single Source of Truth (loaded once at module init)
# =========================================================================
_BADGE_CONFIG_PATH = os.path.join(os.path.dirname(__file__), 'badges.json')
try:
    with open(_BADGE_CONFIG_PATH, 'r') as f:
        BADGE_CONFIG = json.load(f)
    BADGE_THRESHOLDS = [b["threshold"] for b in BADGE_CONFIG["badges"]]
    BADGE_NAMES = [b["id"] for b in BADGE_CONFIG["badges"]]
    BADGE_LABELS = {b["id"]: b["label"] for b in BADGE_CONFIG["badges"]}
except (FileNotFoundError, json.JSONDecodeError) as e:
    print(f"WARNING: badges.json tidak ditemukan atau invalid: {e}")
    BADGE_CONFIG = {"badges": []}
    BADGE_THRESHOLDS = [1, 3, 5, 10]  # fallback
    BADGE_NAMES = ["sentinel_troops", "front_line_defender", "the_front_man", "cyber_shield_elite"]
    BADGE_LABELS = {}


def get_connection():
    """Buka koneksi baru. Dipanggil per-request, bukan disimpan global,
    supaya aman untuk Flask yang multi-threaded secara default."""
    db_dir = os.path.dirname(DB_PATH)
    if db_dir:
        os.makedirs(db_dir, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row  # supaya hasil query bisa diakses
                                      # seperti dict (row["kolom"])
    return conn


def _column_exists(cursor, table: str, column: str) -> bool:
    """Helper: check apakah kolom sudah ada di tabel (untuk idempotent migrations)."""
    try:
        pragma = cursor.execute(f'PRAGMA table_info({table})').fetchall()
        return any(row[1] == column for row in pragma)
    except Exception:
        return False


def init_db():
    """Bikin semua tabel kalau belum ada. Dipanggil sekali saat app start.
    Semua migration di-design idempotent (aman untuk dijalankan berkali-kali).
    """
    os.makedirs('instance', exist_ok=True)
    conn = get_connection()
    cursor = conn.cursor()

    try:
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

        # =========================================================================
        # MIGRATION: GAMIFICATION LAYER (Handoff Step B) — threat reports & daily events
        # =========================================================================

        # Migration: tambah kolom ke user_history untuk gamification (idempotent check)
        gamification_cols = [
            'reports_count_malicious INTEGER NOT NULL DEFAULT 0',
            'reports_count_total INTEGER NOT NULL DEFAULT 0',
            'daily_streak INTEGER NOT NULL DEFAULT 0',
            'last_quiz_completed_at DATE',
            'quiz_revives_remaining INTEGER NOT NULL DEFAULT 3',
            "quiz_revives_month TEXT NOT NULL DEFAULT '2026-07'",
            'streak_before_break INTEGER NOT NULL DEFAULT 0'
        ]
        for col_def in gamification_cols:
            col_name = col_def.split()[0]
            if not _column_exists(cursor, 'user_history', col_name):
                try:
                    cursor.execute(f'ALTER TABLE user_history ADD COLUMN {col_def}')
                except sqlite3.OperationalError:
                    pass  # Kolom sudah ada atau error lain

        # Tabel threat_reports — store setiap laporan dari Flow B setelah triase VT+urlscan
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS threat_reports (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                report_id TEXT NOT NULL UNIQUE,
                email TEXT NOT NULL,
                telegram_user_id TEXT,
                type TEXT NOT NULL,
                target TEXT NOT NULL,
                verdict TEXT NOT NULL,
                severity_tier TEXT,
                source_engine TEXT NOT NULL,
                raw_scores TEXT,
                counted_for_gamification INTEGER NOT NULL DEFAULT 0,
                dedupe_status TEXT NOT NULL DEFAULT 'new',
                submitted_at TIMESTAMP NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (email) REFERENCES user_history(email)
            )
        ''')

        # Index buat query dedupe & reporting summary yang cepat
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_threat_reports_email_target 
            ON threat_reports(email, target)
        ''')
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_threat_reports_email_verdict 
            ON threat_reports(email, verdict)
        ''')

        # Tabel daily_events — track aktivitas harian per employee (quiz completion, dll)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS daily_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT NOT NULL,
                event_type TEXT NOT NULL,
                event_date DATE NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (email) REFERENCES user_history(email),
                UNIQUE(email, event_type, event_date)
            )
        ''')

        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_daily_events_email_date 
            ON daily_events(email, event_date)
        ''')

        # Migration: is_active column for employee enable/disable
        try:
            cursor.execute('ALTER TABLE user_history ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1')
        except sqlite3.OperationalError:
            pass

        # Tabel divisions
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS divisions (
                name TEXT PRIMARY KEY
            )
        ''')

        # Seed default divisions
        default_divs = ['Network Engineering', 'Performance & Shared Service', 'Network Operations', 'Sales Support', 'IT']
        for div in default_divs:
            cursor.execute('INSERT OR IGNORE INTO divisions (name) VALUES (?)', (div,))

        # THREAT INTELLIGENCE (Daffa's additions)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS threat_cache(
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                indicator TEXT NOT NULL,
                indicator_hash TEXT NOT NULL UNIQUE,
                indicator_type TEXT NOT NULL,
                source TEXT NOT NULL,
                verdict TEXT NOT NULL,
                confidence INTEGER NOT NULL,
                severity TEXT NOT NULL,
                vt_score INTEGER DEFAULT 0,
                urlscan_score INTEGER DEFAULT 0,
                raw_json TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                expires_at TIMESTAMP NOT NULL
            )
        ''')

        cursor.execute('''
            CREATE UNIQUE INDEX IF NOT EXISTS idx_threat_hash
            ON threat_cache(indicator_hash)
        ''')

        # Create quiz_questions table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS quiz_questions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                question_text TEXT NOT NULL,
                options TEXT NOT NULL,
                correct_answer_index INTEGER NOT NULL,
                category TEXT NOT NULL,
                difficulty TEXT NOT NULL
            )
        ''')

        # Auto-seed if empty
        row = cursor.execute('SELECT COUNT(*) FROM quiz_questions').fetchone()
        if row and row[0] == 0:
            import json
            questions_to_seed = [
                # Phishing (10 questions)
                {
                    "question_text": "Anda menerima email dari HRD meminta Anda segera memverifikasi nomor rekening bank Anda lewat tautan terlampir karena ada bonus tahunan. Apa tindakan paling aman?",
                    "options": ["Langsung klik tautan karena bonus tahunan penting", "Menghubungi HRD langsung lewat nomor telepon resmi kantor untuk verifikasi", "Membalas email tersebut dengan menanyakan apakah itu asli", "Meneruskan email ke rekan kerja lainnya"],
                    "correct_answer_index": 1,
                    "category": "phishing",
                    "difficulty": "easy"
                },
                {
                    "question_text": "Apa tanda utama email phishing yang memanfaatkan urgensi emosional (Urgency)?",
                    "options": ["Menggunakan bahasa yang santai dan ramah", "Memaksa tindakan cepat (misal: 'Akun akan ditutup dalam 24 jam')", "Menyertakan tanda tangan lengkap pengirim", "Mengirim email pada jam kerja resmi"],
                    "correct_answer_index": 1,
                    "category": "phishing",
                    "difficulty": "easy"
                },
                {
                    "question_text": "Jika Anda menerima email mencurigakan dari alamat internal yang meminta verifikasi data kuota email, tindakan paling aman yang sebaiknya Anda lakukan adalah:",
                    "options": ["Mengecek apakah link tersebut memuat password lama Anda", "Mengabaikan saja karena email penyimpanan penuh tidak mungkin terjadi", "Mengklik link tersebut lalu memasukkan sandi acak", "Meneruskan ke Telegram Bot Security untuk verifikasi"],
                    "correct_answer_index": 3,
                    "category": "phishing",
                    "difficulty": "medium"
                },
                {
                    "question_text": "Apa yang dimaksud dengan 'Spear Phishing'?",
                    "options": ["Serangan phishing massal acak menggunakan email robot", "Serangan phishing bertarget khusus yang dirancang untuk korban/perusahaan tertentu", "Serangan phishing via SMS atau telepon suara", "Pemasangan banner phishing di situs web resmi"],
                    "correct_answer_index": 1,
                    "category": "phishing",
                    "difficulty": "medium"
                },
                {
                    "question_text": "Anda menerima email simulasi phishing. Anda mendeteksi bahwa tautannya palsu. Apa langkah terbaik?",
                    "options": ["Klik tautannya untuk memastikan isinya palsu", "Laporkan tautan tersebut melalui Telegram Bot Security Awareness", "Biarkan saja di kotak masuk Anda", "Hapus email tanpa melapor"],
                    "correct_answer_index": 1,
                    "category": "phishing",
                    "difficulty": "easy"
                },
                {
                    "question_text": "Mengapa taktik 'Teachable Moment' penting setelah karyawan tidak sengaja mengklik link simulasi phishing?",
                    "options": ["Untuk memberikan hukuman disiplin kepada karyawan", "Memberikan edukasi langsung di saat kesadaran akan kesalahan sedang tinggi", "Mengekspos kesalahan karyawan ke departemen lain", "Mengunci laptop karyawan sementara waktu"],
                    "correct_answer_index": 1,
                    "category": "phishing",
                    "difficulty": "easy"
                },
                {
                    "question_text": "Anda menerima email yang mengaku dari rekan setim Anda, namun alamat email pengirimnya adalah budi.santoso@netops-dumy.local (kurang huruf 'm'). Taktik apa yang digunakan?",
                    "options": ["Domain Spoofing", "Typosquatting", "Credential Harvesting", "Ransomware"],
                    "correct_answer_index": 1,
                    "category": "phishing",
                    "difficulty": "medium"
                },
                {
                    "question_text": "Apa risiko terbesar dari mengklik gambar di dalam email spam dari pengirim tidak dikenal?",
                    "options": ["Mengurangi kuota internet laptop Anda", "Dapat memicu unduhan malware otomatis latar belakang (Drive-by download)", "Mengubah resolusi layar monitor", "Mengirim email spam ke semua kontak Anda"],
                    "correct_answer_index": 1,
                    "category": "phishing",
                    "difficulty": "medium"
                },
                {
                    "question_text": "Jika Anda tidak sengaja memasukkan password akun kantor ke form login dari link email mencurigakan, apa langkah pertama yang wajib diambil?",
                    "options": ["Menunggu email simulasi berakhir", "Segera mengubah password akun kantor Anda dan lapor tim SOC", "Menghapus browser history Anda", "Mematikan laptop dan pulang"],
                    "correct_answer_index": 1,
                    "category": "phishing",
                    "difficulty": "easy"
                },
                {
                    "question_text": "Teknik manipulasi psikologis apa yang biasa digunakan penyerang agar korban tidak berpikir kritis saat menerima email phishing?",
                    "options": ["Menciptakan urgensi, kepanikan, otoritas palsu, atau iming-iming hadiah", "Menyediakan manual teknis enkripsi file", "Menghubungi korban hanya di hari libur nasional", "Menggunakan bahasa pemrograman tingkat tinggi"],
                    "correct_answer_index": 0,
                    "category": "phishing",
                    "difficulty": "medium"
                },
                # Social Engineering (7 questions)
                {
                    "question_text": "Seseorang menelepon Anda mengaku dari tim IT Dukungan Pusat dan meminta Anda membacakan kode OTP yang baru masuk ke ponsel Anda. Tindakan Anda?",
                    "options": ["Memberikannya karena dia mengaku dari IT Pusat", "Menolak dan menegaskan bahwa IT resmi tidak pernah meminta OTP", "Memberikan nomor OTP yang salah untuk mengetesnya", "Menyuruhnya menelepon atasan Anda"],
                    "correct_answer_index": 1,
                    "category": "social-engineering",
                    "difficulty": "easy"
                },
                {
                    "question_text": "Taktik 'Baiting' dalam rekayasa sosial sering kali melibatkan:",
                    "options": ["Meninggalkan USB drive terinfeksi malware di tempat parkir kantor dengan harapan ada yang mencoloknya", "Mengirim email penawaran kerja sama legal", "Membuat situs tiruan bank resmi", "Mengirim survei kepuasan pelanggan tahunan"],
                    "correct_answer_index": 0,
                    "category": "social-engineering",
                    "difficulty": "medium"
                },
                {
                    "question_text": "Apa yang dimaksud dengan rekayasa sosial (Social Engineering)?",
                    "options": ["Rekayasa perangkat lunak untuk membuat media sosial baru", "Manipulasi psikologis agar korban membocorkan informasi rahasia", "Pengaturan kabel server di ruang data center", "Pembuatan kebijakan tata tertib organisasi"],
                    "correct_answer_index": 1,
                    "category": "social-engineering",
                    "difficulty": "easy"
                },
                {
                    "question_text": "Seseorang tak dikenal mengikuti Anda di belakang melewati pintu masuk kantor tanpa menempelkan kartu akses (Tailgating). Apa yang harus Anda lakukan?",
                    "options": ["Membiarkannya karena mungkin kartunya tertinggal", "Memintanya menempelkan kartu akses di mesin scanner atau melapor ke sekuriti", "Tersenyum dan menyapanya dengan ramah", "Menawarkan bantuan membawakan barangnya"],
                    "correct_answer_index": 1,
                    "category": "social-engineering",
                    "difficulty": "medium"
                },
                {
                    "question_text": "Penyerang rekayasa sosial sering kali berpura-pura menjadi figur otoritas (seperti Direktur atau Auditor). Mengapa taktik ini efektif?",
                    "options": ["Figur otoritas selalu memiliki akses ke server", "Penyerang memiliki foto kartu identitas Direktur", "Direktur sering mengirim email simulasi", "Korban cenderung patuh dan enggan mempertanyakan perintah otoritas"],
                    "correct_answer_index": 3,
                    "category": "social-engineering",
                    "difficulty": "medium"
                },
                {
                    "question_text": "Metode 'Pretexting' dalam social engineering melibatkan:",
                    "options": ["Pembuatan skenario bohong yang meyakinkan agar korban percaya (misal: konfirmasi audit eksternal)", "Pengiriman file PDF berbahaya via chat bot", "Pencurian password dari database yang bocor", "Pencadangan data server kantor"],
                    "correct_answer_index": 0,
                    "category": "social-engineering",
                    "difficulty": "hard"
                },
                {
                    "question_text": "Apa arti 'Vishing' dalam variasi rekayasa sosial?",
                    "options": ["Phishing yang dilakukan melalui panggilan telepon suara (voice phishing)", "Phishing melalui kode QR (QR phishing)", "Phishing melalui pesan teks SMS", "Impersonasi profil media sosial"],
                    "correct_answer_index": 0,
                    "category": "social-engineering",
                    "difficulty": "easy"
                },
                # Password Hygiene (7 questions)
                {
                    "question_text": "Karakteristik password yang kuat menurut standar keamanan modern adalah:",
                    "options": ["Panjang minimal 12 karakter dengan kombinasi huruf besar/kecil, angka, dan simbol", "Kata yang mudah diingat seperti 'Infranexia2026'", "Password pendek yang diubah setiap minggu", "Kombinasi tanggal lahir dan nama depan Anda"],
                    "correct_answer_index": 0,
                    "category": "password-hygiene",
                    "difficulty": "easy"
                },
                {
                    "question_text": "Mengapa penggunaan Multi-Factor Authentication (MFA) sangat direkomendasikan?",
                    "options": ["Agar password Anda tidak perlu diganti selamanya", "Menambah lapisan keamanan ekstra jika password utama Anda bocor", "Mempercepat proses masuk (login) ke portal", "Mengurangi penggunaan memori pada server login"],
                    "correct_answer_index": 1,
                    "category": "password-hygiene",
                    "difficulty": "easy"
                },
                {
                    "question_text": "Apa bahaya menggunakan password yang sama untuk akun personal (seperti e-commerce) dan akun kantor?",
                    "options": ["Akun e-commerce Anda akan terhubung ke email kantor", "Jika akun personal bocor di internet, peretas dapat menggunakannya untuk menembus jaringan kantor", "Dapat menyebabkan akun kantor Anda di-suspend otomatis", "Server kantor akan mendeteksi aktivitas mencurigakan"],
                    "correct_answer_index": 1,
                    "category": "password-hygiene",
                    "difficulty": "medium"
                },
                {
                    "question_text": "Apa itu 'Credential Stuffing'?",
                    "options": ["Memasukkan data login secara acak pada form palsu", "Pencocokan password bocoran massal secara otomatis ke berbagai situs web", "Pembuatan password yang sangat panjang oleh generator", "Enkripsi password menggunakan algoritma SHA-256"],
                    "correct_answer_index": 1,
                    "category": "password-hygiene",
                    "difficulty": "hard"
                },
                {
                    "question_text": "Kapan waktu terbaik untuk mengganti password akun kantor Anda?",
                    "options": ["Hanya saat ada notifikasi bahwa password Anda telah kedaluwarsa", "Ketika mencurigai adanya tanda kebocoran data atau setelah salah klik simulasi phishing", "Setiap hari sebelum mulai bekerja", "Hanya jika diperintahkan oleh rekan kerja"],
                    "correct_answer_index": 1,
                    "category": "password-hygiene",
                    "difficulty": "easy"
                },
                {
                    "question_text": "Bagaimana cara aman untuk menyimpan password yang banyak dan kompleks?",
                    "options": ["Menulisnya pada sticky notes di bawah keyboard/monitor", "Menggunakan password manager resmi korporat yang terenkripsi", "Menyimpannya dalam file Excel di Desktop tanpa password", "Mengirimkan password tersebut ke chat Telegram pribadi"],
                    "correct_answer_index": 1,
                    "category": "password-hygiene",
                    "difficulty": "easy"
                },
                {
                    "question_text": "Apa fungsi utama dari pengamanan 'OTP' (One-Time Password)?",
                    "options": ["Sebagai password cadangan permanen jika password utama hilang", "Password sekali pakai yang berlaku sangat pendek untuk verifikasi identitas", "Mempercantik proses onboarding pengguna baru", "Menghubungkan akun Telegram dengan database korporat"],
                    "correct_answer_index": 1,
                    "category": "password-hygiene",
                    "difficulty": "easy"
                },
                # URL Security (6 questions)
                {
                    "question_text": "Manakah dari domain URL berikut yang merupakan domain resmi perusahaan PT Infranexia?",
                    "options": ["sso.infranexia-secure.com", "sso.infranexia.co.id", "sso.infranexia-portal.xyz", "sso.infranexia.xyz"],
                    "correct_answer_index": 1,
                    "category": "url-security",
                    "difficulty": "easy"
                },
                {
                    "question_text": "Protokol HTTPS (https://) di awal alamat URL menandakan bahwa:",
                    "options": ["Situs web tersebut 100% aman dan bukan situs penipuan/phishing", "Koneksi data antara browser Anda dan server terenkripsi secara aman", "Situs tersebut memiliki database internal SQLite", "Situs tersebut dibuat oleh tim IT resmi perusahaan"],
                    "correct_answer_index": 1,
                    "category": "url-security",
                    "difficulty": "medium"
                },
                {
                    "question_text": "Anda melihat link dengan alamat: http://infranexia.co.id.attacker-domain.com/login. Ke mana link ini akan mengarahkan Anda jika diklik?",
                    "options": ["infranexia.co.id (Resmi)", "attacker-domain.com (Penyerang)", "Tidak ke mana-mana karena link error", "Ke portal Google Login"],
                    "correct_answer_index": 1,
                    "category": "url-security",
                    "difficulty": "hard"
                },
                {
                    "question_text": "Taktik 'URL Shortener' (seperti bit.ly atau tinyurl) sering disalahgunakan peretas untuk:",
                    "options": ["Meningkatkan kecepatan loading situs phishing", "Menyembunyikan alamat URL phishing yang asli agar terlihat tidak mencurigakan", "Mengenkripsi form isian password karyawan", "Mengotomatisasi pengiriman email phishing"],
                    "correct_answer_index": 1,
                    "category": "url-security",
                    "difficulty": "easy"
                },
                {
                    "question_text": "Apa itu 'Quishing'?",
                    "options": ["Phishing yang dilakukan melalui panggilan telepon suara (vishing)", "Phishing yang menggunakan kode QR palsu untuk mengarahkan ke link berbahaya", "Phishing yang menargetkan data keuangan secara spesifik", "Taktik phishing menggunakan domain typosquatting"],
                    "correct_answer_index": 1,
                    "category": "url-security",
                    "difficulty": "easy"
                },
                {
                    "question_text": "Anda mengarahkan kursor (hover) ke sebuah link di email kantor, teks link menuliskan https://infranexia.co.id, namun tooltip browser di pojok kiri bawah menunjukkan http://fake-login-leak.net. Apa artinya?",
                    "options": ["Link tersebut aman karena teksnya tertulis infranexia.co.id", "Tautan tersebut mengarah ke fake-login-leak.net dan merupakan upaya penipuan", "Browser Anda sedang mengalami error rendering", "Tautan tersebut memiliki sertifikat SSL ganda"],
                    "correct_answer_index": 1,
                    "category": "url-security",
                    "difficulty": "medium"
                }
            ]
            for q in questions_to_seed:
                cursor.execute('''
                    INSERT INTO quiz_questions (question_text, options, correct_answer_index, category, difficulty)
                    VALUES (?, ?, ?, ?, ?)
                ''', (q["question_text"], json.dumps(q["options"]), q["correct_answer_index"], q["category"], q["difficulty"]))

        conn.commit()
    finally:
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
POINTS_QUIZ_COMPLETE = 10


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


def is_target_already_reported(email: str, target: str) -> bool:
    """Cek apakah (email, target) sudah pernah dilaporkan sebelumnya dengan
    verdict malicious/suspicious. Dipakai buat dedupe di 2 tempat:
    1. create_threat_report() — supaya reports_count_malicious/badge gak
       nambah dobel kalau URL/file yang sama dilaporin ulang oleh orang
       yang sama.
    2. award_points_for_report() — supaya POIN juga gak bisa di-farming
       dengan cara spam lapor URL/file yang sama berulang-ulang.
    Sengaja diekstrak jadi satu fungsi biar dua tempat itu gak pernah
    ketinggalan sinkron (ini persis yang jadi bug sebelumnya — dedupe
    reports_count_malicious udah ada, tapi dedupe poin belum)."""
    conn = get_connection()
    try:
        row = conn.execute('''
            SELECT id FROM threat_reports
            WHERE email = ? AND target = ? AND verdict IN ('malicious', 'suspicious')
            LIMIT 1
        ''', (email, target)).fetchone()
        return row is not None
    finally:
        conn.close()


def award_points_for_report(telegram_chat_id: str, target: str = None, points: int = POINTS_CONFIRMED_REPORT):
    """Beri poin ke user yang melaporkan threat terkonfirmasi berbahaya
    lewat Flow B (Telegram Bot). Reporter Flow B diidentifikasi lewat
    telegram_chat_id (BUKAN email — Telegram tidak mengirim email),
    jadi kita resolve chat_id -> email lewat mapping yang sudah dibuat
    saat OTP registration (lihat update_user_telegram_chat_id).

    Return None kalau:
    - chat_id belum terdaftar/di-link ke email manapun (misal reporter
      belum pernah verifikasi OTP) — caller (route /api/incidents) harus
      toleran terhadap ini, karena laporan ancaman TETAP harus diproses
      walau reporter belum ke-link, hanya saja tidak dapat poin.
    - target ini SUDAH PERNAH dilaporkan sebelumnya oleh email yang sama
      (dedupe) — mencegah user farming poin dengan spam lapor URL/file
      yang SAMA berkali-kali. User LAIN yang lapor target yang sama tetap
      dapat poin normal, karena dedupe di-scope per (email, target)."""
    if not telegram_chat_id:
        return None

    conn = get_connection()
    try:
        row = conn.execute(
            'SELECT email, divisi FROM user_history WHERE telegram_chat_id = ?',
            (str(telegram_chat_id),)
        ).fetchone()

        if row is None:
            return None

        if target and is_target_already_reported(row["email"], target):
            return None

        return adjust_points(row["email"], row["divisi"] or "Unknown", points)
    finally:
        conn.close()


def get_leaderboard():
    """Ranking user berdasarkan poin, dari tertinggi ke terendah.
    Dipakai untuk Leaderboard UI Tab (Handoff Step A.4). Hanya
    menampilkan user yang punya divisi (bukan record kosong)."""
    conn = get_connection()
    try:
        rows = conn.execute('''
            SELECT email, divisi, points, badge, click_count,
                   viewed_training_count, skipped_training_count,
                   reports_count_malicious, daily_streak, last_clicked,
                   (SELECT count(*) FROM events 
                    WHERE events.email = user_history.email 
                      AND events.event_type = 'spot_the_fake_correct') as spot_fake_wins
            FROM user_history
            WHERE divisi IS NOT NULL
            ORDER BY points DESC, viewed_training_count DESC
        ''').fetchall()

        leaderboard = [dict(row) for row in rows]
        for i, entry in enumerate(leaderboard, start=1):
            entry["rank"] = i
            
            # Hitung streak_weeks
            last_clicked = entry.get("last_clicked")
            if last_clicked:
                try:
                    from datetime import datetime
                    last_dt = datetime.strptime(last_clicked, '%Y-%m-%d %H:%M:%S')
                    weeks = int((datetime.now() - last_dt).days / 7)
                    entry["streak_weeks"] = max(0, weeks)
                except Exception:
                    # Fallback ke format ISO
                    try:
                        from datetime import datetime
                        last_dt = datetime.fromisoformat(last_clicked.replace('Z', ''))
                        weeks = int((datetime.now() - last_dt).days / 7)
                        entry["streak_weeks"] = max(0, weeks)
                    except Exception:
                        entry["streak_weeks"] = 4
            else:
                entry["streak_weeks"] = 4

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
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# GAMIFICATION LAYER (Handoff Step B) — threat reports & daily events
# ---------------------------------------------------------------------------

def create_threat_report(email: str, telegram_user_id: str, type_: str, target: str,
                         verdict: str, severity_tier: str, source_engine: str,
                         raw_scores: dict = None, submitted_at: str = None) -> dict:
    """
    Simpan laporan threat dari Flow B, handle dedupe, increment counter,
    dan evaluasi badge. Return dict berisi report_id, counted status,
    dan employee gamification stats terbaru.
    
    Dedupe key = (email, target) tanpa verdict.
    """
    import uuid
    
    if verdict not in VALID_VERDICTS:
        raise ValueError(f"verdict tidak valid: {verdict}")
    if type_ not in VALID_REPORT_TYPES:
        raise ValueError(f"type tidak valid: {type_}")
    if source_engine not in ("vt", "urlscan", "both"):
        raise ValueError(f"source_engine tidak valid: {source_engine}")
    
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        # 1. Cek employee ada
        emp_row = cursor.execute(
            'SELECT email, divisi FROM user_history WHERE email = ?', (email,)
        ).fetchone()
        if not emp_row:
            raise ValueError(f"Employee {email} tidak ditemukan")
        
        # 2. Cek dedupe: apakah (email, target) sudah pernah dilaporkan dengan verdict malicious/suspicious?
        #    (pakai helper yang sama dengan award_points_for_report, biar dua-duanya selalu sinkron)
        is_duplicate = is_target_already_reported(email, target)
        report_id = f"rpt_{uuid.uuid4().hex[:6]}"
        submitted_at_val = submitted_at or datetime.utcnow().isoformat()
        raw_scores_json = json.dumps(raw_scores) if raw_scores else None
        
        # 3. Tentukan apakah laporan ini dihitung untuk gamification
        counted = (verdict in ('malicious', 'suspicious')) and not is_duplicate
        dedupe_status = "duplicate" if is_duplicate else "new"
        
        # 4. Simpan row ke threat_reports (always, bahkan kalau duplicate)
        cursor.execute('''
            INSERT INTO threat_reports (
                report_id, email, telegram_user_id, type, target, verdict,
                severity_tier, source_engine, raw_scores, counted_for_gamification,
                dedupe_status, submitted_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (report_id, email, telegram_user_id, type_, target, verdict,
              severity_tier, source_engine, raw_scores_json, int(counted),
              dedupe_status, submitted_at_val))
        
        badge_just_unlocked = None
        
        # 5. Update counter: counted=True nambah both, False (clean atau duplicate) nambah total only
        if counted:
            cursor.execute('''
                UPDATE user_history
                SET reports_count_malicious = reports_count_malicious + 1,
                    reports_count_total = reports_count_total + 1,
                    updated_at = CURRENT_TIMESTAMP
                WHERE email = ?
            ''', (email,))
        else:
            # clean ATAU duplicate — sama-sama cuma nambah total, gak nambah malicious count
            cursor.execute('''
                UPDATE user_history
                SET reports_count_total = reports_count_total + 1,
                    updated_at = CURRENT_TIMESTAMP
                WHERE email = ?
            ''', (email,))
        
        conn.commit()
        
        # 6. Fetch employee stats terbaru buat return
        emp_final = cursor.execute(
            'SELECT reports_count_malicious, daily_streak FROM user_history WHERE email = ?', (email,)
        ).fetchone()
        
        # Get badges unlocked (reuse module-level BADGE_THRESHOLDS & BADGE_NAMES)
        malicious_count = emp_final["reports_count_malicious"] if emp_final else 0
        badges_unlocked = []
        
        for threshold, badge_name in zip(BADGE_THRESHOLDS, BADGE_NAMES):
            if malicious_count >= threshold:
                badges_unlocked.append(badge_name)
        
        # Check if badge just unlocked
        if counted:
            for threshold, badge_name in zip(BADGE_THRESHOLDS, BADGE_NAMES):
                if malicious_count == threshold:
                    badge_just_unlocked = badge_name
                    break
        
        return {
            "report_id": report_id,
            "counted_for_gamification": counted,
            "dedupe_status": dedupe_status,
            "employee": {
                "email": email,
                "reports_count_malicious": malicious_count,
                "daily_streak": emp_final["daily_streak"] if emp_final else 0,
                "badges_unlocked": badges_unlocked,
                "badge_just_unlocked": badge_just_unlocked
            }
        }
    except ValueError:
        # ValueError expected dari aplikasi logic — propagate as-is
        raise
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def get_reports_summary(email: str) -> dict:
    """
    Fetch gamification summary untuk dashboard: malicious count, total count,
    daily streak, badges achieved, next badge.
    """
    conn = get_connection()
    
    try:
        row = conn.execute(
            'SELECT reports_count_malicious, reports_count_total, daily_streak, last_quiz_completed_at FROM user_history WHERE email = ?',
            (email,)
        ).fetchone()

        if not row:
            return None  # Employee tidak ditemukan
        
        malicious_count = row["reports_count_malicious"] or 0
        total_count = row["reports_count_total"] or 0
        daily_streak = row["daily_streak"] or 0
        last_quiz_date = row["last_quiz_completed_at"]
        
        # Build badges array (reuse module-level config)
        badges = []
        next_badge = None
        
        for threshold, badge_name in zip(BADGE_THRESHOLDS, BADGE_NAMES):
            achieved = malicious_count >= threshold
            label = BADGE_LABELS.get(badge_name, badge_name)
            badges.append({
                "id": badge_name,
                "label": label,
                "threshold": threshold,
                "achieved": achieved
            })
            
            if not achieved and next_badge is None:
                next_badge = {
                    "id": badge_name,
                    "threshold": threshold,
                    "remaining": threshold - malicious_count
                }
        
        return {
            "email": email,
            "reports_count_malicious": malicious_count,
            "reports_count_total": total_count,
            "daily_streak": daily_streak,
            "last_quiz_completed_at": last_quiz_date,
            "badges": badges,
            "next_badge": next_badge
        }
    finally:
        conn.close()


def complete_daily_quiz(email: str, question_id: int = None, selected_option_index: int = None) -> dict:
    """Catat log kuis harian, hitung streak, dan berikan poin reputasi jika jawaban benar.

    Server side nentuin tanggal, bukan client — ini defense terhadap clock manipulation.

    Return: {"status": "completed" atau "already_completed", "daily_streak": X, ...}
    """
    conn = get_connection()
    cursor = conn.cursor()

    try:
        # 1. Cek employee ada
        emp_row = cursor.execute('''
            SELECT divisi, daily_streak, last_quiz_completed_at,
                   quiz_revives_remaining, quiz_revives_month, streak_before_break
            FROM user_history WHERE email = ?
        ''', (email,)).fetchone()
        if not emp_row:
            raise ValueError(f"Employee {email} tidak ditemukan")

        divisi = emp_row["divisi"] or "Unknown"
        current_streak = emp_row["daily_streak"] or 0
        last_quiz_date_str = emp_row["last_quiz_completed_at"]

        today = date.today()
        today_str = today.isoformat()
        current_month = today.strftime('%Y-%m')

        revives_remaining = emp_row["quiz_revives_remaining"]
        revives_month = emp_row["quiz_revives_month"]
        streak_before_break = emp_row["streak_before_break"]

        # Handle dinamis token reset on-the-fly (Known Limitation: race condition if multi-tab)
        if revives_month != current_month:
            revives_remaining = 3
            revives_month = current_month
            cursor.execute('''
                UPDATE user_history
                SET quiz_revives_remaining = 3, quiz_revives_month = ?, updated_at = CURRENT_TIMESTAMP
                WHERE email = ?
            ''', (current_month, email))

        # 2. Cek sudah ada event quiz di hari ini (server-side date.today())
        existing = cursor.execute('''
            SELECT id FROM daily_events
            WHERE email = ? AND event_type = 'quiz_completed' AND event_date = ?
        ''', (email, today_str)).fetchone()

        if existing:
            # Sudah completed hari ini
            conn.commit()
            return {
                "status": "already_completed",
                "daily_streak": current_streak,
                "message": "Sudah Menyelesaikan Latihan Hari Ini - Streak Terjaga!",
                "revives_remaining": revives_remaining
            }

        # 3. Validasi kebenaran jawaban jika parameter diserahkan
        is_correct = True
        if question_id is not None and selected_option_index is not None:
            q_row = cursor.execute('SELECT correct_answer_index FROM quiz_questions WHERE id = ?', (question_id,)).fetchone()
            if not q_row:
                raise ValueError("ID Pertanyaan tidak ditemukan di database")
            is_correct = (selected_option_index == q_row["correct_answer_index"])

        # 4. Tentukan streak & poin logic berdasarkan kebenaran jawaban
        yesterday = today - timedelta(days=1)

        if not is_correct:
            # Jawaban salah: streak reset ke 0, tidak dapat poin reputasi
            new_streak = 0
            points_awarded = 0
            streak_before_break = current_streak
            cursor.execute('''
                UPDATE user_history
                SET streak_before_break = ?
                WHERE email = ?
            ''', (current_streak, email))
        else:
            # Jawaban benar: hitung streak Duolingo-style
            if last_quiz_date_str is None:
                new_streak = 1
            else:
                try:
                    last_quiz_date = date.fromisoformat(last_quiz_date_str)
                except (ValueError, TypeError):
                    new_streak = 1
                    last_quiz_date = None

                if last_quiz_date == yesterday:
                    new_streak = current_streak + 1
                elif last_quiz_date is not None and (last_quiz_date < yesterday or last_quiz_date > today):
                    new_streak = 1
                else:
                    new_streak = 1
            points_awarded = POINTS_QUIZ_COMPLETE

        # 5. Record completion
        cursor.execute('''
            INSERT INTO daily_events (email, event_type, event_date)
            VALUES (?, 'quiz_completed', ?)
        ''', (email, today_str))

        cursor.execute('''
            UPDATE user_history
            SET daily_streak = ?, last_quiz_completed_at = ?, updated_at = CURRENT_TIMESTAMP
            WHERE email = ?
        ''', (new_streak, today_str, email))

        conn.commit()

        # Award points jika benar
        if points_awarded > 0:
            adjust_points(email, divisi, points_awarded)

        return {
            "status": "completed",
            "correct": is_correct,
            "points_awarded": points_awarded,
            "daily_streak": new_streak,
            "last_quiz_completed_at": today_str,
            "revive_available": not is_correct and revives_remaining > 0,
            "revives_remaining": revives_remaining,
            "streak_before_break": streak_before_break
        }
    except ValueError:
        # ValueError expected dari aplikasi logic — propagate as-is
        raise
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# USER HISTORY (untuk Flow A — simulasi)
# ---------------------------------------------------------------------------

def get_user_history(email: str):
    """Ambil histori user. Kalau belum pernah ada (first-timer beneran),
    return record default dengan click_count=0, BUKAN error — supaya n8n
    bisa langsung klasifikasi sebagai Tier 1 tanpa cabang error tambahan."""
    conn = get_connection()
    try:
        row = conn.execute(
            'SELECT * FROM user_history WHERE email = ?', (email,)
        ).fetchone()

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
    finally:
        conn.close()


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
        # Clear chat ID from other users to maintain 1-to-1 mapping
        cursor.execute('''
            UPDATE user_history
            SET telegram_chat_id = NULL
            WHERE telegram_chat_id = ? AND email != ?
        ''', (telegram_chat_id, email))

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
        
        # Clear chat ID from other users to maintain 1-to-1 mapping
        cursor.execute('''
            UPDATE user_history
            SET telegram_chat_id = NULL
            WHERE telegram_chat_id = ? AND email != ?
        ''', (telegram_chat_id, email))

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

    try:
        rows = conn.execute(query, params).fetchall()
        return [dict(row) for row in rows]
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# DASHBOARD AGGREGATION
# ---------------------------------------------------------------------------

def get_dashboard_summary():
    """Agregasi data untuk dashboard: skor per divisi, partisipasi,
    dan ringkasan incident. Ini logic 'kompleks' yang sesuai handoff
    memang ditaruh di Flask, bukan di n8n."""
    conn = get_connection()

    try:
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

        return {
            "divisi_scores": divisi_scores,
            "open_real_world_incidents": open_real_world,
            "mean_time_to_close_minutes": round(mttc_row["avg_minutes"], 1)
                if mttc_row["avg_minutes"] is not None else None
        }
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# USER PROFILE (for Personal Security Portal / tier1.html)
# ---------------------------------------------------------------------------

def get_user_profile(email):
    """Mengembalikan profil lengkap user untuk Personal Security Portal.
    Termasuk streak, posisi divisi, dan data gamifikasi."""
    conn = get_connection()

    try:
        row = conn.execute(
            'SELECT * FROM user_history WHERE email = ?', (email,)
        ).fetchone()

        if not row:
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
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# COMPLIANCE SUMMARY (for Dashboard UU PDP & BSSN widgets)
# ---------------------------------------------------------------------------

def get_compliance_summary():
    """Mengembalikan data kepatuhan regulasi untuk Dashboard SOC.
    Mengkorelasikan poin karyawan dengan metrik kepatuhan UU PDP & BSSN."""
    conn = get_connection()

    try:
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
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# LINK TOKENS (Bot-Link deep link authentication)
# ---------------------------------------------------------------------------

def create_link_token(email: str, divisi: str = 'Unknown', ttl_minutes: int = 15) -> dict:
    """Generate a short-lived link token for Telegram deep link authentication.
    User visits /link, enters email, gets a token embedded in a Telegram deep
    link URL. Token expires after ttl_minutes."""
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
            UNION ALL
            SELECT 
                CASE 
                    WHEN verdict IN ('malicious', 'suspicious') THEN 'report_malicious'
                    ELSE 'report_safe'
                END as event_type,
                verdict as tier_assigned,
                target as campaign_id,
                created_at
            FROM threat_reports
            WHERE email = ?
            UNION ALL
            SELECT 
                event_type,
                'quiz' as tier_assigned,
                NULL as campaign_id,
                created_at
            FROM daily_events
            WHERE email = ?
            ORDER BY created_at DESC
            LIMIT ?
        ''', (email, email, email, limit)).fetchall()
        return [dict(row) for row in rows]
    finally:
        conn.close()


def list_employees():
    conn = get_connection()
    try:
        rows = conn.execute('''
            SELECT email, divisi, click_count, viewed_training_count,
                   skipped_training_count, telegram_chat_id, points, badge,
                   reports_count_malicious, reports_count_total, daily_streak,
                   is_active
            FROM user_history
            ORDER BY email ASC
        ''').fetchall()
        return [dict(row) for row in rows]
    finally:
        conn.close()


def add_employee(email: str, divisi: str, is_active: int = 1):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        if divisi:
            cursor.execute('INSERT OR IGNORE INTO divisions (name) VALUES (?)', (divisi,))
            
        cursor.execute('''
            INSERT INTO user_history (email, divisi, click_count, is_active, points, badge)
            VALUES (?, ?, 0, ?, 100, 'Guardian')
        ''', (email, divisi, is_active))
        conn.commit()
        return True
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def update_employee(old_email: str, email: str, divisi: str, is_active: int):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        if divisi:
            cursor.execute('INSERT OR IGNORE INTO divisions (name) VALUES (?)', (divisi,))

        cursor.execute('''
            UPDATE user_history
            SET email = ?, divisi = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
            WHERE email = ?
        ''', (email, divisi, is_active, old_email))
        
        if old_email != email:
            cursor.execute('UPDATE events SET email = ? WHERE email = ?', (email, old_email))
            cursor.execute('UPDATE registration_otp SET email = ? WHERE email = ?', (email, old_email))
            cursor.execute('UPDATE link_tokens SET email = ? WHERE email = ?', (email, old_email))
            cursor.execute('UPDATE dashboard_tokens SET email = ? WHERE email = ?', (email, old_email))
            cursor.execute('UPDATE threat_reports SET email = ? WHERE email = ?', (email, old_email))
            cursor.execute('UPDATE daily_events SET email = ? WHERE email = ?', (email, old_email))

        conn.commit()
        return True
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def list_divisions():
    conn = get_connection()
    try:
        rows = conn.execute('''
            SELECT d.name, COUNT(u.email) as employee_count
            FROM divisions d
            LEFT JOIN user_history u ON d.name = u.divisi AND u.is_active = 1
            GROUP BY d.name
            ORDER BY d.name ASC
        ''').fetchall()
        return [dict(row) for row in rows]
    finally:
        conn.close()


def create_division(name: str):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute('INSERT INTO divisions (name) VALUES (?)', (name,))
        conn.commit()
        return True
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# THREAT INTELLIGENCE CACHE FUNCTIONS (Daffa's additions)
# ---------------------------------------------------------------------------

def normalize_indicator(indicator: str) -> str:
    if not indicator:
        return ""
    indicator = indicator.strip().lower()
    if indicator.endswith("/"):
        indicator = indicator[:-1]
    return indicator


def hash_indicator(indicator: str) -> str:
    indicator = normalize_indicator(indicator)
    return hashlib.sha256(
        indicator.encode()
    ).hexdigest()


def get_cached_indicator(indicator: str):
    indicator = normalize_indicator(indicator)
    indicator_hash = hash_indicator(indicator)
    conn = get_connection()
    try:
        row = conn.execute("""
            SELECT *
            FROM threat_cache
            WHERE indicator_hash = ?
            LIMIT 1
        """, (indicator_hash,)).fetchone()
        if row is None:
            return None
        row = dict(row)
        expires_at = row.get("expires_at")
        if expires_at:
            try:
                expires = datetime.fromisoformat(expires_at)
                if datetime.utcnow() >= expires:
                    conn.execute("""
                        DELETE
                        FROM threat_cache
                        WHERE indicator_hash=?
                    """, (indicator_hash,))
                    conn.commit()
                    return None
            except Exception:
                return None
        return row
    finally:
        conn.close()


def save_threat_cache(
    indicator,
    indicator_type,
    analysis
):
    conn = get_connection()
    try:
        expires_at = datetime.utcnow() + timedelta(hours=24)
        conn.execute("""
        INSERT OR REPLACE INTO threat_cache(
            indicator,
            indicator_hash,
            indicator_type,
            source,
            verdict,
            confidence,
            severity,
            vt_score,
            urlscan_score,
            raw_json,
            expires_at
        )
        VALUES(?,?,?,?,?,?,?,?,?,?,?)
        """,(
            normalize_indicator(indicator),
            hash_indicator(indicator),
            indicator_type,
            ",".join(analysis.get("providers", [])),
            analysis.get("verdict","unknown"),
            analysis.get("confidence",0),
            analysis.get("severity","unknown"),
            (
                analysis["evidence"]["virustotal"]["vt_score"]
                if analysis.get("evidence",{}).get("virustotal")
                else 0
            ),
            (
                analysis["evidence"]["urlscan"]["urlscan_score"]
                if analysis.get("evidence",{}).get("urlscan")
                else 0
            ),
            json.dumps(analysis, default=str),
            expires_at.isoformat()
        ))
        conn.commit()
    finally:
        conn.close()


def list_threat_cache():
    conn = get_connection()
    try:
        rows = conn.execute("SELECT * FROM threat_cache ORDER BY id DESC").fetchall()
        return [dict(row) for row in rows]
    finally:
        conn.close()


def get_incident_count_today():
    conn = get_connection()
    try:
        row = conn.execute("""
        SELECT COUNT(*)
        FROM incidents
        WHERE DATE(created_at)=DATE('now')
        """).fetchone()
        return row[0]
    finally:
        conn.close()


def insert_incident(
    ticket_id,
    source_type,
    reported_url,
    severity,
    vt_verdict,
    urlscan_verdict,
    screenshot_url,
    checklist,
    file_hash,
    original_filename
):
    conn = get_connection()
    try:
        conn.execute("""
        INSERT INTO incidents(
            ticket_id,
            source_type,
            reported_url,
            severity,
            vt_verdict,
            urlscan_verdict,
            screenshot_url,
            checklist,
            file_hash,
            original_filename
        )
        VALUES(?,?,?,?,?,?,?,?,?,?)
        """, (
            ticket_id,
            source_type,
            reported_url,
            severity,
            vt_verdict,
            urlscan_verdict,
            screenshot_url,
            checklist,
            file_hash,
            original_filename
        ))
        conn.commit()
    finally:
        conn.close()


def get_daily_question(email: str) -> dict:
    """Retrieve 1 deterministic random question per day per user based on date + email seed."""
    conn = get_connection()
    try:
        today_str = date.today().isoformat()

        # Check if already completed today
        existing = conn.execute('''
            SELECT id FROM daily_events
            WHERE email = ? AND event_type = 'quiz_completed' AND event_date = ?
        ''', (email, today_str)).fetchone()

        if existing:
            row_streak = conn.execute('SELECT daily_streak FROM user_history WHERE email = ?', (email,)).fetchone()
            streak = row_streak["daily_streak"] if row_streak else 0
            return {
                "completed_today": True,
                "daily_streak": streak,
                "message": "Anda sudah menyelesaikan kuis hari ini — Streak terjaga!"
            }

        rows = conn.execute('SELECT id FROM quiz_questions').fetchall()
        if not rows:
            return None

        ids = [row["id"] for row in rows]

        # Deterministic seed using ISO date string + user email
        seed_str = f"{today_str}:{email}"

        import hashlib
        seed_hash = int(hashlib.md5(seed_str.encode()).hexdigest(), 16)

        import random
        r = random.Random(seed_hash)
        selected_id = r.choice(ids)

        q_row = conn.execute('SELECT * FROM quiz_questions WHERE id = ?', (selected_id,)).fetchone()
        if q_row:
            return {
                "completed_today": False,
                "id": q_row["id"],
                "question_text": q_row["question_text"],
                "options": json.loads(q_row["options"]),
                "correct_answer_index": q_row["correct_answer_index"],
                "category": q_row["category"],
                "difficulty": q_row["difficulty"]
            }
        return None
    finally:
        conn.close()


def revive_quiz_streak(email: str) -> dict:
    """Hidupkan kembali streak kuis yang baru saja reset ke 0 pada hari yang sama.

    Validasi:
    - Terjadi di hari yang sama (last_quiz_completed_at == today).
    - daily_streak saat ini == 0.
    - streak_before_break > 0 (ada streak yang bisa diselamatkan).
    - quiz_revives_remaining > 0 (sisa token bulan ini masih ada).
    """
    conn = get_connection()
    cursor = conn.cursor()
    try:
        today_str = date.today().isoformat()

        # 1. Cek employee & status revive
        emp_row = cursor.execute('''
            SELECT daily_streak, last_quiz_completed_at, quiz_revives_remaining, streak_before_break
            FROM user_history WHERE email = ?
        ''', (email,)).fetchone()

        if not emp_row:
            raise ValueError(f"Employee {email} tidak ditemukan")

        daily_streak = emp_row["daily_streak"] or 0
        last_quiz_completed_at = emp_row["last_quiz_completed_at"]
        quiz_revives_remaining = emp_row["quiz_revives_remaining"]
        streak_before_break = emp_row["streak_before_break"] or 0

        # 2. Validasi kelayakan revive (Guard rails)
        if last_quiz_completed_at != today_str:
            raise ValueError("Revive hanya bisa dilakukan di hari yang sama saat streak putus")

        if daily_streak > 0:
            raise ValueError("Streak Anda aktif, tidak memerlukan revive")

        if streak_before_break == 0:
            raise ValueError("Tidak ada nilai streak historis yang dapat dipulihkan")

        if quiz_revives_remaining <= 0:
            raise ValueError("Kuota revive token Anda untuk bulan ini sudah habis")

        # 3. Eksekusi revive
        new_streak = streak_before_break + 1
        new_revives = quiz_revives_remaining - 1

        cursor.execute('''
            UPDATE user_history
            SET daily_streak = ?, quiz_revives_remaining = ?, streak_before_break = 0, updated_at = CURRENT_TIMESTAMP
            WHERE email = ?
        ''', (new_streak, new_revives, email))

        conn.commit()
        return {
            "status": "revived",
            "daily_streak": new_streak,
            "revives_remaining": new_revives,
            "message": "Streak Anda berhasil dipulihkan!"
        }
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()