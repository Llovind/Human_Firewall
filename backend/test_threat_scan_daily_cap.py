"""Isolated reward limits remain intact after retirement of the old gateway."""
import os
import tempfile
import unittest
from datetime import datetime, timedelta, timezone

_temp = tempfile.TemporaryDirectory()
os.environ.update(APP_ENV='test', DB_PATH=os.path.join(_temp.name, 'reward.db'),
                  ADMIN_PASSWORD='TestingAdmin2026!', SECRET_KEY='isolated-secret-32-characters-long',
                  SERVICE_API_KEY='isolated-service-32-characters-long', DEV_BYPASS_AUTH='false',
                  PROXY_FEATURE_ENABLED='false', SMTP_HOST='mailpit', SMTP_PORT='1025', SMTP_SECURITY='none')

import database
from app import app
from services import auth_service
from unittest.mock import patch


class RewardChecks(unittest.TestCase):
    def test_cap_duplicate_and_clean(self):
        email = 'reward@demo.test'
        auth_service.create_account(email=email, password='EmployeePassword2026!', role='employee', division='IT')
        self.assertFalse(database.award_threat_reward(email, 'https://safe.test', 'clean')['awarded'])
        for i in range(3):
            result = database.award_threat_reward(email, f'https://bad-{i}.test', 'malicious')
            self.assertTrue(result['awarded'])
            self.assertEqual(result['daily_count'], i + 1)
        self.assertFalse(database.award_threat_reward(email, 'https://bad-4.test', 'malicious')['awarded'])
        self.assertFalse(database.award_threat_reward(email, 'https://bad-0.test', 'malicious')['awarded'])
        self.assertEqual(database.get_user_history(email)['points'], 145)

    def test_wib_date(self):
        self.assertEqual(database.get_current_wib_date(), datetime.now(timezone(timedelta(hours=7))).strftime('%Y-%m-%d'))

    def test_legacy_gateway_retired(self):
        auth_service.create_account(email='retired@demo.test', password='EmployeePassword2026!', role='employee', division='IT')
        capture = {}
        client = app.test_client()
        with patch.object(auth_service.EmailService, 'send_login_otp', side_effect=lambda **kw: capture.update(kw)):
            challenge = client.post('/api/auth/login', json={'email': 'retired@demo.test', 'password': 'EmployeePassword2026!'}).get_json()
        session = client.post('/api/auth/verify-otp', json={'challengeId': challenge['challengeId'], 'otp': capture['otp_code']}).get_json()
        self.assertEqual(client.post('/api/threat/analyze', json={'indicator': 'https://example.test'}, headers={'X-Afferent-Session': session['sessionToken']}).status_code, 410)


if __name__ == '__main__':
    unittest.main()
