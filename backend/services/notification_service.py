"""Durable, deduplicated SMTP outbox; OTP remains synchronous and independent."""
import html
import logging
import os
import time
from contextlib import closing

import database
from services.email_service import EmailService

logger = logging.getLogger(__name__)


def security_inbox():
    threshold = int(os.environ.get('EDUCATION_SCORE_THRESHOLD', '60'))
    cooldown = max(3600, int(os.environ.get('EDUCATION_COOLDOWN_SECONDS', '86400')))
    with closing(database.get_connection()) as conn:
        employees = [dict(row) for row in conn.execute('''SELECT a.id, a.email, u.divisi, u.points
            FROM employee_accounts a JOIN user_history u ON lower(a.email)=lower(u.email)
            WHERE a.role='employee' AND a.is_active=1 AND u.points < ?
            ORDER BY u.points, a.email''', (threshold,)).fetchall()]
        for employee in employees:
            row = conn.execute('''SELECT id, sent_at, last_error, attempts, created_at,
                CAST(strftime('%s',created_at) AS INTEGER) AS epoch
                FROM notification_outbox WHERE recipient=? AND dedupe_key LIKE 'education:%'
                ORDER BY id DESC LIMIT 1''', (employee['email'],)).fetchone()
            delivery = dict(row) if row else None
            employee['delivery'] = delivery
            employee['canSend'] = not row or (row['sent_at'] is not None and row['epoch'] <= int(time.time()) - cooldown)
        reports = [dict(row) for row in conn.execute('''SELECT * FROM employee_url_reports
            WHERE report_type='url' ORDER BY created_at DESC, id LIMIT 100''').fetchall()]
        audit = [dict(row) for row in conn.execute('SELECT * FROM notification_audit ORDER BY id DESC LIMIT 30').fetchall()]
    # Read-only report status; GRC can review but cannot mutate proxy policies.
    from services.report_service import _serialized
    reports = [_serialized(report) for report in reports]
    return {'threshold': threshold, 'scoreScale': 200, 'employees': employees,
            'reports': reports, 'audit': audit, 'deliveryMode': 'Mailpit (lab)',
            'emailEnabled': os.environ.get('EDUCATION_EMAIL_ENABLED', 'true').lower() == 'true',
            'automatic': os.environ.get('EDUCATION_AUTO_ENABLED', 'false').lower() == 'true'}


def queue_manual_warning(identity, account_id, reason, request_id):
    if identity.role not in {'soc', 'grc'}:
        raise PermissionError('Hanya SOC/GRC yang dapat mengirim warning')
    if os.environ.get('EDUCATION_EMAIL_ENABLED', 'true').lower() != 'true':
        raise ValueError('Pengiriman warning sedang dinonaktifkan')
    if not isinstance(account_id, int) or isinstance(account_id, bool):
        raise ValueError('accountId wajib berupa integer')
    if not isinstance(reason, str) or not 5 <= len(reason.strip()) <= 1000:
        raise ValueError('Alasan warning wajib 5–1000 karakter')
    threshold = int(os.environ.get('EDUCATION_SCORE_THRESHOLD', '60'))
    cooldown = max(3600, int(os.environ.get('EDUCATION_COOLDOWN_SECONDS', '86400')))
    now = int(time.time())
    with closing(database.get_connection()) as conn, conn:
        conn.execute('BEGIN IMMEDIATE')
        row = conn.execute('''SELECT a.email, u.points FROM employee_accounts a
            JOIN user_history u ON lower(a.email)=lower(u.email)
            WHERE a.id=? AND a.role='employee' AND a.is_active=1 AND u.points < ?''',
            (account_id, threshold)).fetchone()
        if not row:
            raise ValueError('Penerima harus employee aktif dengan poin di bawah baseline')
        previous = conn.execute('''SELECT id FROM notification_outbox WHERE recipient=?
            AND dedupe_key LIKE 'education:%' AND (sent_at IS NULL OR
            CAST(strftime('%s',created_at) AS INTEGER) > ?) LIMIT 1''', (row['email'], now - cooldown)).fetchone()
        if previous:
            raise ValueError('Warning masih antre atau cooldown belum selesai')
        text = (f"Skor pembelajaran Anda {row['points']}/200, di bawah baseline {threshold}/200. "
                f"Pesan tim {identity.role.upper()}: {reason.strip()}\n\n"
                'Lanjutkan training, Spot the Fake, dan kuis harian di dashboard AFFERENT. '
                'Periksa domain, jangan bagikan OTP/password, dan laporkan link meragukan.')
        outbox = conn.execute('''INSERT INTO notification_outbox
            (dedupe_key, recipient, subject, text_body) VALUES (?, ?, ?, ?)''',
            (f"education:{row['email']}:{now // cooldown}", row['email'], 'AFFERENT — warning edukasi keamanan', text))
        conn.execute('''INSERT INTO notification_audit
            (actor_email, actor_role, recipient, score, reason, request_id, outbox_id)
            VALUES (?, ?, ?, ?, ?, ?, ?)''',
            (identity.email, identity.role, row['email'], row['points'], reason.strip(), request_id, outbox.lastrowid))
    return {'queued': True, 'outboxId': outbox.lastrowid, 'deliveryMode': 'Mailpit (lab)'}


def enqueue(recipient, subject, text, dedupe_key):
    if not recipient:
        return
    with closing(database.get_connection()) as conn, conn:
        conn.execute('INSERT OR IGNORE INTO notification_outbox (dedupe_key, recipient, subject, text_body) VALUES (?, ?, ?, ?)',
                     (dedupe_key, recipient, subject, text))


def queue_education():
    threshold = int(os.environ.get('EDUCATION_SCORE_THRESHOLD', '60'))
    cooldown = max(3600, int(os.environ.get('EDUCATION_COOLDOWN_SECONDS', '86400')))
    since = int(time.time()) - cooldown
    with closing(database.get_connection()) as conn:
        rows = conn.execute('''SELECT a.email, u.points, u.click_count, u.viewed_training_count
            FROM employee_accounts a JOIN user_history u ON lower(u.email)=lower(a.email)
            WHERE a.role='employee' AND a.is_active=1 AND u.points < ?
            AND NOT EXISTS (SELECT 1 FROM notification_outbox n
                WHERE n.recipient=a.email AND n.dedupe_key LIKE 'education:%'
                AND (n.sent_at IS NULL OR CAST(strftime('%s', n.created_at) AS INTEGER) > ?))''',
            (threshold, since)).fetchall()
    for row in rows:
        text = (f"Skor pembelajaran Anda saat ini {row['points']}/200. "
                f"Tercatat {row['click_count']} klik simulasi dan {row['viewed_training_count']} training selesai. "
                'Luangkan waktu untuk training, Spot the Fake, dan kuis harian. '
                'Periksa domain sebelum membuka link, jangan bagikan OTP/password, '
                'dan laporkan link yang meragukan melalui dashboard AFFERENT.')
        enqueue(row['email'], 'AFFERENT — edukasi keamanan personal', text,
                f"education:{row['email']}:{int(time.time()) // cooldown}")


def deliver_one():
    now = int(time.time())
    with closing(database.get_connection()) as conn, conn:
        conn.execute('BEGIN IMMEDIATE')
        row = conn.execute('''SELECT * FROM notification_outbox WHERE sent_at IS NULL
            AND available_at <= ? AND lease_until <= ? ORDER BY id LIMIT 1''', (now, now)).fetchone()
        if not row:
            return False
        conn.execute('UPDATE notification_outbox SET lease_until=?, attempts=attempts+1 WHERE id=?', (now + 120, row['id']))
    try:
        # Re-check eligibility at delivery time: recovered scores must not warn.
        with closing(database.get_connection()) as conn:
            eligible = conn.execute('''SELECT 1 FROM employee_accounts a JOIN user_history u
                ON lower(u.email)=lower(a.email) WHERE a.email=? AND a.is_active=1
                AND a.role='employee' AND u.points < ?''',
                (row['recipient'], int(os.environ.get('EDUCATION_SCORE_THRESHOLD', '60')))).fetchone()
        if not eligible:
            with closing(database.get_connection()) as conn, conn:
                conn.execute("UPDATE notification_outbox SET sent_at=CURRENT_TIMESTAMP, last_error='skipped_not_eligible', lease_until=0 WHERE id=?", (row['id'],))
            return True
        EmailService().send(to_address=row['recipient'], subject=row['subject'], text=row['text_body'],
                            html='<div style="font-family:Poppins,Arial,sans-serif;line-height:1.7"><h2>AFFERENT Security</h2><p>' + html.escape(row['text_body']) + '</p></div>')
    except Exception as exc:
        # SMTP acceptance followed by a crash may replay a message: at-least-once,
        # not exactly-once. No tokens, provider responses, or recipient logged.
        logger.warning('Notification delivery deferred: %s', type(exc).__name__)
        with closing(database.get_connection()) as conn, conn:
            conn.execute('UPDATE notification_outbox SET lease_until=0, available_at=?, last_error=? WHERE id=?',
                         (now + min(3600, 30 * 2 ** min(row['attempts'], 7)), type(exc).__name__, row['id']))
        return False
    with closing(database.get_connection()) as conn, conn:
        conn.execute('UPDATE notification_outbox SET sent_at=CURRENT_TIMESTAMP, lease_until=0, last_error=NULL WHERE id=?', (row['id'],))
    return True
