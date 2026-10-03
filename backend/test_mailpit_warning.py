"""Opt-in local Mailpit smoke check. Never writes the employee/demo database."""
import os
import tempfile
import uuid
from contextlib import closing
from types import SimpleNamespace


def main():
    if os.environ.get('SMTP_HOST') != 'mailpit' or os.environ.get('SMTP_PORT') != '1025':
        raise RuntimeError('This check is for Docker-internal Mailpit only')
    with tempfile.TemporaryDirectory() as folder:
        os.environ['DB_PATH'] = os.path.join(folder, 'warning-check.db')
        os.environ['EDUCATION_SCORE_THRESHOLD'] = '60'
        os.environ['EDUCATION_EMAIL_ENABLED'] = 'true'
        import database
        from services import auth_service, notification_service
        database.init_db()
        email = f'warning-check-{uuid.uuid4().hex[:8]}@demo.test'
        account = auth_service.create_account(email=email, password='MailpitTestingPassword2026!', role='employee', division='Demo check')
        database.adjust_points(email, 'Demo check', -41)
        notification_service.queue_manual_warning(
            SimpleNamespace(role='soc', email='soc-check@demo.test'), account['id'],
            '[INTEGRATION TEST] Test warning Mailpit; bukan employee sungguhan.', str(uuid.uuid4()))
        assert notification_service.deliver_one(), 'Mailpit delivery did not complete'
        with closing(database.get_connection()) as conn:
            row = conn.execute('SELECT sent_at, last_error FROM notification_outbox WHERE recipient=?', (email,)).fetchone()
            assert row['sent_at'] and row['last_error'] is None
        print('PASS: one synthetic warning accepted by Mailpit; real employee DB untouched')


if __name__ == '__main__':
    main()
