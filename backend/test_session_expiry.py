"""A login lasts one day from sign-in and is then refused; the sign-in itself reports the same lifetime."""
import os
import unittest
import uuid
from contextlib import closing
from datetime import timedelta
from unittest.mock import patch

import test_technical_debt  # noqa: F401  (sets the same safe test environment as the other suites)
from app import app
import database
from services import auth_service


def sign_in(email, password):
    """Same two-step sign-in the dashboard performs; returns the verify-otp response body."""
    otp = {}
    client = app.test_client()
    with patch.object(auth_service.EmailService, 'send_login_otp', side_effect=lambda **values: otp.update(values)):
        challenge = client.post('/api/auth/login', json={'email': email, 'password': password}).get_json()
    return client.post('/api/auth/verify-otp', json={'challengeId': challenge['challengeId'], 'otp': otp['otp_code']}).get_json()


class SessionExpiry(unittest.TestCase):
    def setUp(self):
        self.email = uuid.uuid4().hex + '@demo.test'
        self.password = 'SessionExpiryTesting2026!'
        auth_service.create_account(email=self.email, password=self.password, role='employee', division='IT')
        self.client = app.test_client()

    def session_status(self, token):
        return self.client.get('/api/auth/session', headers={'X-Afferent-Session': token}).status_code

    def test_default_lifetime_is_one_day(self):
        self.assertEqual(auth_service.SESSION_TTL_DEFAULT_SECONDS, 24 * 60 * 60)
        with patch.dict(os.environ):
            os.environ.pop('AUTH_SESSION_TTL_SECONDS', None)
            body = sign_in(self.email, self.password)
        self.assertEqual(body['expiresIn'], 86400)
        self.assertEqual(self.session_status(body['sessionToken']), 200)

    def test_configured_lifetime_still_wins(self):
        with patch.dict(os.environ, {'AUTH_SESSION_TTL_SECONDS': '3600'}):
            body = sign_in(self.email, self.password)
        self.assertEqual(body['expiresIn'], 3600)

    def test_token_is_refused_once_its_day_is_over(self):
        body = sign_in(self.email, self.password)
        token = body['sessionToken']
        self.assertEqual(self.session_status(token), 200)
        with closing(database.get_connection()) as conn, conn:
            conn.execute('UPDATE auth_sessions SET expires_at=? WHERE token_hash=?',
                         (auth_service._db_timestamp(auth_service._utcnow() - timedelta(seconds=1)), auth_service._session_hash(token)))
        self.assertEqual(self.session_status(token), 401)
        # Protected data is refused as well, not only the session check.
        self.assertEqual(self.client.get('/api/access-requests', headers={'X-Afferent-Session': token}).status_code, 401)

    def test_activity_does_not_extend_the_day(self):
        token = sign_in(self.email, self.password)['sessionToken']
        with closing(database.get_connection()) as conn:
            before = conn.execute('SELECT expires_at FROM auth_sessions WHERE token_hash=?', (auth_service._session_hash(token),)).fetchone()[0]
        for _ in range(3):
            self.session_status(token)
        with closing(database.get_connection()) as conn:
            after = conn.execute('SELECT expires_at FROM auth_sessions WHERE token_hash=?', (auth_service._session_hash(token),)).fetchone()[0]
        self.assertEqual(before, after)


if __name__ == '__main__':
    unittest.main()
